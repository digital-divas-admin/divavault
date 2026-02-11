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
from src.utils.image_download import load_and_resize
from src.utils.logging import get_logger

log = get_logger("crawl_script")

ALEXIS_ID = UUID("3e9e72a1-f6a1-4e58-aaeb-ab4716dd4dca")
TEMP_DIR = Path(settings.temp_dir)
TEMP_DIR.mkdir(parents=True, exist_ok=True)


async def crawl_civitai() -> list[dict]:
    """Run CivitAI crawler and return discovered image URLs."""
    crawl = CivitAICrawl()

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
    )

    print(f"\n{'='*60}")
    print(f"PHASE 1: CRAWLING CIVITAI")
    print(f"{'='*60}")
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


async def download_image(session: aiohttp.ClientSession, url: str, image_id) -> Path | None:
    """Download an image to temp directory."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return None
            data = await resp.read()
            if len(data) < 1000:  # too small
                return None
            path = TEMP_DIR / f"{image_id}.jpg"
            path.write_bytes(data)
            return path
    except Exception:
        return None


async def process_images(new_images: list[dict]) -> int:
    """Download images, detect faces, store embeddings. Returns faces found."""
    print(f"\n{'='*60}")
    print(f"PHASE 2: FACE DETECTION ({len(new_images)} images)")
    print(f"{'='*60}")

    model = get_model()
    faces_found = 0
    images_processed = 0
    start = time.time()

    # Process in batches with concurrent downloads
    batch_size = 20
    connector = aiohttp.TCPConnector(limit=10)

    async with aiohttp.ClientSession(connector=connector) as http_session:
        for batch_start in range(0, len(new_images), batch_size):
            batch = new_images[batch_start:batch_start + batch_size]

            # Download batch concurrently
            download_tasks = [
                download_image(http_session, img["source_url"], img["id"])
                for img in batch
            ]
            paths = await asyncio.gather(*download_tasks)

            # Process each downloaded image
            async with async_session() as db_session:
                for img, path in zip(batch, paths):
                    images_processed += 1
                    if path is None:
                        await db_session.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {"id": img["id"]})
                        continue

                    try:
                        cv_img = load_and_resize(path)
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
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": len(faces)})

                            for face_idx, face in enumerate(faces):
                                embedding = face.normed_embedding
                                det_score = float(face.det_score)
                                await insert_discovered_face_embedding(
                                    db_session, img["id"], face_idx, embedding, det_score
                                )
                                faces_found += 1

                    except Exception as e:
                        await db_session.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {"id": img["id"]})
                    finally:
                        path.unlink(missing_ok=True)

                await db_session.commit()

            elapsed = time.time() - start
            rate = images_processed / elapsed if elapsed > 0 else 0
            print(f"  Processed {images_processed}/{len(new_images)} | "
                  f"Faces: {faces_found} | "
                  f"{rate:.1f} img/sec | "
                  f"{elapsed:.0f}s elapsed", flush=True)

    return faces_found


async def backfill_alexis() -> int:
    """Run backfill for Alexis against all discovered face embeddings."""
    print(f"\n{'='*60}")
    print(f"PHASE 3: BACKFILL AGAINST ALEXIS")
    print(f"{'='*60}")

    async with async_session() as session:
        # Get Alexis's best embedding
        r = await session.execute(text("""
            SELECT id, embedding
            FROM contributor_embeddings
            WHERE contributor_id = :cid
            ORDER BY detection_score DESC NULLS LAST
            LIMIT 1
        """), {"cid": str(ALEXIS_ID)})
        row = r.fetchone()
        if not row:
            print("ERROR: Alexis has no embeddings!")
            return 0

        emb_id = row[0]
        # Raw SQL returns vector as string like "[0.01,-0.04,...]" — parse it
        raw_emb = row[1]
        if isinstance(raw_emb, str):
            embedding_vec = np.array([float(x) for x in raw_emb.strip("[]").split(",")])
        else:
            embedding_vec = np.array(raw_emb)
        print(f"Using embedding {emb_id} (shape: {embedding_vec.shape})")

        # Count available face embeddings
        r2 = await session.execute(text("SELECT count(*) FROM discovered_face_embeddings"))
        total_embs = r2.scalar()
        print(f"Searching against {total_embs} discovered face embeddings...")

        # Run backfill
        hits = await backfill_contributor_against_discovered(
            session,
            contributor_id=ALEXIS_ID,
            embedding=embedding_vec,
            threshold=settings.match_threshold_low,
            days_back=settings.civitai_backfill_days,
        )

        if not hits:
            print(f"No matches found above threshold ({settings.match_threshold_low})")
            return 0

        matches_created = 0
        for hit in hits:
            confidence = get_confidence_tier(hit["similarity"])
            if confidence is None:
                continue

            match = await insert_match(
                session,
                discovered_image_id=hit["discovered_image_id"],
                contributor_id=ALEXIS_ID,
                similarity_score=hit["similarity"],
                confidence_tier=confidence,
                best_embedding_id=emb_id,
                face_index=hit["face_index"],
            )
            if match:
                matches_created += 1
                print(f"  MATCH: similarity={hit['similarity']:.4f} "
                      f"confidence={confidence} "
                      f"image={hit['discovered_image_id']}")

        await session.commit()
        print(f"\nTotal matches created: {matches_created}")
        return matches_created


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

    # Phase 4: Backfill
    matches = await backfill_alexis()

    # Summary
    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"COMPLETE ({elapsed:.0f}s)")
    print(f"{'='*60}")
    print(f"  Images discovered: {len(images)}")
    print(f"  New (not deduped): {len(new_images)}")
    print(f"  Faces detected:    {faces}")
    print(f"  Alexis matches:    {matches}")


if __name__ == "__main__":
    asyncio.run(main())
