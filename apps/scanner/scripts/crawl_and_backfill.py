"""Full crawl + face detection + backfill pipeline.

Usage: .venv/bin/python scripts/crawl_and_backfill.py
"""

import os
import sys

# Ensure src/ is importable regardless of working directory
SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SCANNER_ROOT)
sys.path.insert(0, SCANNER_ROOT)

import asyncio
import json
import time
from pathlib import Path
from uuid import UUID

import aiohttp
import numpy as np
from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.db.queries import (
    backfill_contributor_against_discovered,
    insert_discovered_face_embedding,
    insert_match,
)
from src.discovery.base import DiscoveryContext
from src.discovery.platform_crawl import CivitAICrawl
from src.ingest.embeddings import init_model, get_model
from src.matching.confidence import get_confidence_tier
from src.utils.image_download import (
    check_content_type,
    check_magic_bytes,
    civitai_thumbnail_url,
    load_and_resize,
    upload_thumbnail,
)
from src.utils.logging import get_logger

log = get_logger("crawl_script")
TEMP_DIR = Path(settings.temp_dir)
TEMP_DIR.mkdir(parents=True, exist_ok=True)


async def crawl_civitai() -> list[dict]:
    """Run CivitAI crawler and return discovered image URLs."""
    crawl = CivitAICrawl()

    # Load mapper config for dynamic search terms (same pattern as DeviantArt)
    effective_terms: list[str] | None = None
    tag_depths: dict[str, int] | None = None
    try:
        from src.intelligence.mapper.orchestrator import get_search_config

        config = await get_search_config("civitai")
        if config.effective_terms is not None and len(config.effective_terms) > 0:
            effective_terms = config.effective_terms
            tag_depths = config.tag_depths
            if config.damage_breakdown:
                d = config.damage_breakdown
                print(f"Mapper config loaded:")
                print(f"  HIGH:   {d.get('high', 0)} terms")
                print(f"  MEDIUM: {d.get('medium', 0)} terms")
                print(f"  LOW:    {d.get('low', 0)} terms")
                print(f"  Total:  {len(effective_terms)} unique search terms")
        elif config.effective_terms is not None and len(config.effective_terms) == 0:
            print("No enabled sections in mapper — nothing to crawl.")
            return []
    except Exception as e:
        print(f"Mapper unavailable ({e}), using hardcoded defaults")

    # Load any existing cursors from DB
    async with async_session() as session:
        r = await session.execute(text(
            "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'civitai'"
        ))
        row = r.fetchone()
        search_terms_data = (row[0] if row else None) or {}

    ctx = DiscoveryContext(
        platform="civitai",
        cursor=search_terms_data.get("cursor"),
        search_cursors=search_terms_data.get("search_cursors"),
        model_cursors=search_terms_data.get("model_cursors"),
        search_terms=effective_terms,
        tag_depths=tag_depths,
    )

    print(f"\n{'='*60}")
    print(f"PHASE 1: CRAWLING CIVITAI")
    print(f"{'='*60}")
    terms_count = len(effective_terms) if effective_terms else "8+9 (hardcoded)"
    print(f"Search terms: {terms_count}")
    print(f"Image pages per term: {settings.civitai_max_pages}")
    print(f"Model pages per tag:  {settings.civitai_model_pages_per_tag}")
    print(f"Resuming from cursors: image={bool(ctx.cursor or ctx.search_cursors)}, model={bool(ctx.model_cursors)}")

    result = await crawl.discover(ctx)

    print(f"\nCrawl complete: {len(result.images)} image URLs discovered")

    # Persist cursors for next run
    new_search_terms = dict(search_terms_data)
    if result.next_cursor is not None:
        new_search_terms["cursor"] = result.next_cursor
    elif "cursor" in new_search_terms:
        del new_search_terms["cursor"]
    if result.search_cursors:
        active = {k: v for k, v in result.search_cursors.items() if v is not None}
        if active:
            new_search_terms["search_cursors"] = active
        elif "search_cursors" in new_search_terms:
            del new_search_terms["search_cursors"]
    elif "search_cursors" in new_search_terms:
        del new_search_terms["search_cursors"]
    if result.model_cursors:
        active_mc = {k: v for k, v in result.model_cursors.items() if v is not None}
        if active_mc:
            new_search_terms["model_cursors"] = active_mc
        elif "model_cursors" in new_search_terms:
            del new_search_terms["model_cursors"]
    elif "model_cursors" in new_search_terms:
        del new_search_terms["model_cursors"]

    async with async_session() as session:
        await session.execute(text(
            "UPDATE platform_crawl_schedule SET search_terms = CAST(:terms AS jsonb), last_crawl_at = now() WHERE platform = 'civitai'"
        ), {"terms": json.dumps(new_search_terms)})
        await session.commit()
    print("Cursors persisted for next run")

    return [
        {"source_url": img.source_url, "page_url": img.page_url, "page_title": img.page_title}
        for img in result.images
    ]


async def insert_discovered_images(images: list[dict]) -> list[dict]:
    """Insert images into discovered_images in batches, return only NEW ones."""
    new_images = []
    batch_size = 500
    total = len(images)

    async with async_session() as session:
        for batch_start in range(0, total, batch_size):
            batch = images[batch_start:batch_start + batch_size]

            # Build batch VALUES clause
            values_parts = []
            params = {}
            for i, img in enumerate(batch):
                values_parts.append(f"(:url_{i}, :page_url_{i}, :title_{i}, 'civitai')")
                params[f"url_{i}"] = img["source_url"]
                params[f"page_url_{i}"] = img["page_url"]
                params[f"title_{i}"] = img.get("page_title")

            values_sql = ", ".join(values_parts)
            r = await session.execute(text(f"""
                INSERT INTO discovered_images (source_url, page_url, page_title, platform)
                VALUES {values_sql}
                ON CONFLICT (md5(source_url)) DO NOTHING
                RETURNING id, source_url
            """), params)
            rows = r.fetchall()

            # Map returned URLs to their image dicts
            url_to_img = {img["source_url"]: img for img in batch}
            for row in rows:
                img_dict = url_to_img.get(row[1])
                if img_dict:
                    new_images.append({"id": row[0], **img_dict})

            await session.commit()
            print(f"  Batch {batch_start // batch_size + 1}: "
                  f"{len(rows)} new / {len(batch)} total "
                  f"({batch_start + len(batch)}/{total})", flush=True)

    print(f"Inserted {len(new_images)} new images ({total - len(new_images)} deduped)")
    return new_images


async def download_thumbnail(
    session: aiohttp.ClientSession, source_url: str, image_id
) -> tuple[Path | None, str | None]:
    """Download CivitAI CDN thumbnail for face detection.

    Returns (path, skip_reason). skip_reason is None on success.
    """
    thumb_url = civitai_thumbnail_url(source_url)
    try:
        async with session.get(thumb_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return None, f"http_{resp.status}"
            if not check_content_type(resp.content_type):
                ct = (resp.content_type or "unknown").split(";")[0].strip()
                return None, f"content_type:{ct}"
            data = await resp.read()
            if len(data) < 500:
                return None, "too_small"
            if not check_magic_bytes(data):
                return None, "magic_bytes"
            path = TEMP_DIR / f"{image_id}_thumb.jpg"
            path.write_bytes(data)
            return path, None
    except Exception as e:
        return None, "exception"


async def download_original(
    session: aiohttp.ClientSession, source_url: str, image_id
) -> Path | None:
    """Download full-resolution original for embedding extraction (face-positive only)."""
    try:
        async with session.get(source_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                return None
            if not check_content_type(resp.content_type):
                return None
            data = await resp.read()
            if len(data) < 1000:
                return None
            if not check_magic_bytes(data):
                return None
            path = TEMP_DIR / f"{image_id}.jpg"
            path.write_bytes(data)
            return path
    except Exception:
        return None


async def process_images(new_images: list[dict]) -> int:
    """Two-pass face detection: thumbnail detect -> original embed. Returns faces found."""
    print(f"\n{'='*60}")
    print(f"PHASE 2: FACE DETECTION ({len(new_images)} images)")
    print(f"{'='*60}")
    print(f"  Two-pass: thumbnail (width=450) detection -> original embedding")

    model = get_model()
    faces_found = 0
    images_processed = 0
    thumbs_with_faces = 0
    originals_downloaded = 0
    skip_counts: dict[str, int] = {}
    start = time.time()

    batch_size = 20
    connector = aiohttp.TCPConnector(limit=10)

    async with aiohttp.ClientSession(connector=connector) as http_session:
        for batch_start in range(0, len(new_images), batch_size):
            batch = new_images[batch_start:batch_start + batch_size]

            # --- Pass 1: Download thumbnails and detect faces ---
            thumb_tasks = [
                download_thumbnail(http_session, img["source_url"], img["id"])
                for img in batch
            ]
            thumb_results = await asyncio.gather(*thumb_tasks)

            face_positive: list[tuple[dict, int]] = []  # (img_dict, face_count_from_thumb)

            async with async_session() as db_session:
                for img, (thumb_path, skip_reason) in zip(batch, thumb_results):
                    images_processed += 1
                    if thumb_path is None:
                        if skip_reason:
                            skip_counts[skip_reason] = skip_counts.get(skip_reason, 0) + 1
                        await db_session.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {"id": img["id"]})
                        continue

                    try:
                        cv_img = load_and_resize(thumb_path)
                        if cv_img is None:
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = false WHERE id = :id"
                            ), {"id": img["id"]})
                            continue

                        faces = model.get(cv_img)

                        if len(faces) == 0:
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = false, face_count = 0 WHERE id = :id"
                            ), {"id": img["id"]})
                        else:
                            # Face found on thumbnail — queue for original download
                            thumbs_with_faces += 1
                            face_positive.append((img, len(faces)))
                    except Exception:
                        await db_session.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {"id": img["id"]})
                    finally:
                        thumb_path.unlink(missing_ok=True)

                await db_session.commit()

            # --- Pass 2: Download originals for face-positive images, extract embeddings ---
            if face_positive:
                orig_tasks = [
                    download_original(http_session, img["source_url"], img["id"])
                    for img, _ in face_positive
                ]
                orig_paths = await asyncio.gather(*orig_tasks)

                async with async_session() as db_session:
                    for (img, thumb_face_count), orig_path in zip(face_positive, orig_paths):
                        if orig_path is not None:
                            originals_downloaded += 1

                        # Use original if available, otherwise fall back to re-downloading thumbnail
                        detect_path = orig_path
                        used_fallback = False
                        if detect_path is None:
                            # Fallback: re-download thumbnail for embeddings (better than discarding)
                            fb_path, _ = await download_thumbnail(http_session, img["source_url"], img["id"])
                            detect_path = fb_path
                            used_fallback = True

                        if detect_path is None:
                            # Both original and fallback failed
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": thumb_face_count})
                            continue

                        try:
                            cv_img = load_and_resize(detect_path)
                            if cv_img is None:
                                await db_session.execute(text(
                                    "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                                ), {"id": img["id"], "fc": thumb_face_count})
                                continue

                            faces = model.get(cv_img)

                            face_count = len(faces) if len(faces) > 0 else thumb_face_count
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": face_count})

                            for face_idx, face in enumerate(faces):
                                await insert_discovered_face_embedding(
                                    db_session, img["id"], face_idx,
                                    face.normed_embedding, float(face.det_score),
                                )
                                faces_found += 1

                            # Upload thumbnail for match review
                            await upload_thumbnail(
                                detect_path, platform="civitai", http_session=http_session,
                            )

                        except Exception:
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": thumb_face_count})
                        finally:
                            detect_path.unlink(missing_ok=True)
                            if used_fallback and orig_path:
                                orig_path.unlink(missing_ok=True)

                    await db_session.commit()

            elapsed = time.time() - start
            rate = images_processed / elapsed if elapsed > 0 else 0
            print(f"  Processed {images_processed}/{len(new_images)} | "
                  f"Faces: {faces_found} | "
                  f"Face+: {thumbs_with_faces} | "
                  f"Originals: {originals_downloaded} | "
                  f"{rate:.1f} img/sec | "
                  f"{elapsed:.0f}s elapsed", flush=True)

    # Print skip summary
    if skip_counts:
        print(f"\n  Skip summary:")
        for reason, count in sorted(skip_counts.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {count}")

    pct = (thumbs_with_faces / images_processed * 100) if images_processed > 0 else 0
    print(f"\n  Face-positive rate: {thumbs_with_faces}/{images_processed} ({pct:.1f}%)")

    return faces_found


async def backfill_all_contributors() -> int:
    """Run backfill for ALL onboarded contributors against discovered face embeddings."""
    print(f"\n{'='*60}")
    print(f"PHASE 3: BACKFILL AGAINST ALL CONTRIBUTORS")
    print(f"{'='*60}")

    # Get all onboarded contributors who have embeddings
    async with async_session() as session:
        r = await session.execute(text("""
            SELECT DISTINCT ce.contributor_id, c.full_name
            FROM contributor_embeddings ce
            JOIN contributors c ON c.id = ce.contributor_id
            WHERE c.onboarding_completed = true
              AND c.opted_out = false
              AND c.suspended = false
            ORDER BY ce.contributor_id
        """))
        contributors = r.fetchall()

    if not contributors:
        print("No onboarded contributors with embeddings found.")
        return 0

    print(f"Found {len(contributors)} contributors to match against")

    # Count available face embeddings
    async with async_session() as session:
        r2 = await session.execute(text("SELECT count(*) FROM discovered_face_embeddings"))
        total_embs = r2.scalar()
    print(f"Searching against {total_embs} discovered face embeddings...")

    total_matches = 0

    for contributor_id, full_name in contributors:
        display_name = full_name or str(contributor_id)[:8]

        async with async_session() as session:
            # Get contributor's best embedding
            r = await session.execute(text("""
                SELECT id, embedding::text
                FROM contributor_embeddings
                WHERE contributor_id = :cid
                ORDER BY is_primary DESC, detection_score DESC NULLS LAST
                LIMIT 1
            """), {"cid": str(contributor_id)})
            row = r.fetchone()
            if not row:
                continue

            emb_id = row[0]
            raw_emb = row[1]
            if isinstance(raw_emb, str):
                embedding_vec = np.array([float(x) for x in raw_emb.strip("[]").split(",")])
            else:
                embedding_vec = np.array(raw_emb)

            # Run backfill for this contributor
            hits = await backfill_contributor_against_discovered(
                session,
                contributor_id=contributor_id,
                embedding=embedding_vec,
                threshold=settings.match_threshold_low,
                days_back=settings.civitai_backfill_days,
            )

            if not hits:
                continue

            contributor_matches = 0
            for hit in hits:
                confidence = get_confidence_tier(hit["similarity"])
                if confidence is None:
                    continue

                match = await insert_match(
                    session,
                    discovered_image_id=hit["discovered_image_id"],
                    contributor_id=contributor_id,
                    similarity_score=hit["similarity"],
                    confidence_tier=confidence,
                    best_embedding_id=emb_id,
                    face_index=hit["face_index"],
                )
                if match:
                    contributor_matches += 1
                    print(f"  MATCH [{display_name}]: similarity={hit['similarity']:.4f} "
                          f"confidence={confidence} "
                          f"image={hit['discovered_image_id']}")

            await session.commit()
            if contributor_matches > 0:
                print(f"  → {display_name}: {contributor_matches} matches")
                total_matches += contributor_matches

    print(f"\nTotal matches created across all contributors: {total_matches}")
    return total_matches


async def main():
    start = time.time()

    # Initialize InsightFace
    print("Loading InsightFace model...")
    init_model()

    # Phase 1: Crawl
    images = await crawl_civitai()

    # Phase 2: Insert + deduplicate
    new_images = await insert_discovered_images(images)

    if new_images:
        # Phase 3: Face detection
        faces = await process_images(new_images)
    else:
        print("\nNo new images to process (all deduped)")
        faces = 0

    # Phase 4: Backfill against all contributors
    matches = await backfill_all_contributors()

    # Summary
    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"COMPLETE ({elapsed:.0f}s)")
    print(f"{'='*60}")
    print(f"  Images discovered: {len(images)}")
    print(f"  New (not deduped): {len(new_images)}")
    print(f"  Faces detected:    {faces}")
    print(f"  Matches (all):     {matches}")


if __name__ == "__main__":
    asyncio.run(main())
