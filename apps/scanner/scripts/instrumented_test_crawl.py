"""Instrumented test crawl: CivitAI + DeviantArt (5 pages deep).

One-time diagnostic script. Captures per-term/per-tag breakdowns,
ScraperAPI credit usage, phase timing, and bandwidth data.

Usage: .venv/Scripts/python.exe scripts/instrumented_test_crawl.py
"""

import os
import sys

# ── Environment overrides BEFORE any scanner imports ──────────────────────
# Force 5-page depth for both platforms regardless of .env settings
os.environ["CIVITAI_MAX_PAGES"] = "5"
os.environ["CIVITAI_MODEL_PAGES_PER_TAG"] = "5"
os.environ["DEVIANTART_MAX_PAGES"] = "5"
os.environ["DEVIANTART_HIGH_DAMAGE_PAGES"] = "5"
os.environ["DEVIANTART_MEDIUM_DAMAGE_PAGES"] = "5"
os.environ["DEVIANTART_LOW_DAMAGE_PAGES"] = "5"

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SCANNER_ROOT)
sys.path.insert(0, SCANNER_ROOT)


# ── Request metrics + aiohttp monkey-patch ────────────────────────────────
# Must be applied BEFORE any crawler modules create sessions.

import time as _time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from urllib.parse import urlparse

import aiohttp


@dataclass
class RequestRecord:
    url: str
    domain: str
    proxied: bool
    status: int
    elapsed_ms: float
    content_length: int
    error: str | None = None


class RequestMetrics:
    """Thread-safe collector for all HTTP request metadata."""

    def __init__(self):
        self._lock = threading.Lock()
        self.records: list[RequestRecord] = []

    def add(self, rec: RequestRecord):
        with self._lock:
            self.records.append(rec)

    @property
    def total_requests(self) -> int:
        return len(self.records)

    @property
    def proxied_requests(self) -> int:
        return sum(1 for r in self.records if r.proxied)

    def by_domain(self) -> dict[str, list[RequestRecord]]:
        out: dict[str, list[RequestRecord]] = defaultdict(list)
        for r in self.records:
            out[r.domain].append(r)
        return dict(out)

    def summary(self) -> dict:
        domains = self.by_domain()
        domain_stats = {}
        for domain, recs in sorted(domains.items()):
            ok = [r for r in recs if r.error is None and 200 <= r.status < 400]
            errs = [r for r in recs if r.error or r.status >= 400]
            total_bytes = sum(r.content_length for r in recs)
            avg_ms = sum(r.elapsed_ms for r in ok) / len(ok) if ok else 0
            proxied = sum(1 for r in recs if r.proxied)
            domain_stats[domain] = {
                "requests": len(recs),
                "proxied": proxied,
                "ok": len(ok),
                "errors": len(errs),
                "total_bytes": total_bytes,
                "avg_ms": round(avg_ms, 1),
            }
        return {
            "total_requests": self.total_requests,
            "proxied_requests": self.proxied_requests,
            "domains": domain_stats,
        }


metrics = RequestMetrics()

# Monkey-patch aiohttp.ClientSession._request to intercept all HTTP traffic
_original_request = aiohttp.ClientSession._request


async def _instrumented_request(self, method, url, **kwargs):
    url_str = str(url)
    domain = urlparse(url_str).hostname or "unknown"
    proxied = "proxy" in kwargs and kwargs["proxy"] is not None
    t0 = _time.monotonic()
    error = None
    status = 0
    content_length = 0

    try:
        resp = await _original_request(self, method, url, **kwargs)
        status = resp.status
        cl = resp.headers.get("Content-Length")
        if cl and cl.isdigit():
            content_length = int(cl)
        return resp
    except Exception as e:
        error = type(e).__name__
        raise
    finally:
        elapsed_ms = (_time.monotonic() - t0) * 1000
        metrics.add(RequestRecord(
            url=url_str,
            domain=domain,
            proxied=proxied,
            status=status,
            elapsed_ms=elapsed_ms,
            content_length=content_length,
            error=error,
        ))


aiohttp.ClientSession._request = _instrumented_request


# ── Now safe to import scanner modules ────────────────────────────────────

import asyncio
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.db.queries import (
    backfill_contributor_against_discovered,
    batch_insert_inline_detected_images,
    insert_discovered_face_embedding,
    insert_match,
)
from src.discovery.base import DiscoveredImageResult, DiscoveryContext
from src.discovery.platform_crawl import (
    CivitAICrawl,
    DEFAULT_IMAGE_SEARCH_TERMS,
    LORA_HUMAN_TAGS,
)
from src.discovery.deviantart_crawl import DeviantArtCrawl, ALL_TAGS
from src.ingest.embeddings import init_model, get_model
from src.matching.confidence import get_confidence_tier
from src.utils.image_download import (
    check_content_type,
    check_magic_bytes,
    civitai_thumbnail_url,
    load_and_resize,
    upload_thumbnail,
)
from src.utils.rate_limiter import get_limiter

TEMP_DIR = Path(settings.temp_dir)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# ── Timing helper ─────────────────────────────────────────────────────────


class PhaseTimer:
    """Context manager that records elapsed time."""

    def __init__(self):
        self.start = 0.0
        self.elapsed = 0.0

    def __enter__(self):
        self.start = _time.monotonic()
        return self

    def __exit__(self, *_):
        self.elapsed = _time.monotonic() - self.start

    @property
    def fmt(self) -> str:
        m, s = divmod(self.elapsed, 60)
        return f"{int(m)}m{s:04.1f}s"


def fmt_time(seconds: float) -> str:
    m, s = divmod(seconds, 60)
    return f"{int(m)}m{s:04.1f}s"


def fmt_bytes(n: int) -> str:
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.1f} GB"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f} MB"
    if n >= 1_000:
        return f"{n / 1_000:.1f} KB"
    return f"{n} B"


# ── CivitAI instrumented crawl ────────────────────────────────────────────


async def run_civitai_crawl(report: dict):
    """Run CivitAI 3-stream crawl with per-stream timing and per-term yield."""
    print(f"\n{'='*70}")
    print(f"  CIVITAI INSTRUMENTED CRAWL (5 pages/stream)")
    print(f"{'='*70}")

    crawl = CivitAICrawl()
    civitai_report: dict = {"streams": {}, "phases": {}}

    # Load mapper config (same as crawl_and_backfill.py)
    effective_terms: list[str] | None = None
    tag_depths: dict[str, int] | None = None
    try:
        from src.intelligence.mapper.orchestrator import get_search_config
        config = await get_search_config("civitai")
        if config.effective_terms and len(config.effective_terms) > 0:
            effective_terms = config.effective_terms
            tag_depths = config.tag_depths
            civitai_report["mapper_active"] = True
            if config.damage_breakdown:
                civitai_report["damage_breakdown"] = config.damage_breakdown
                print(f"  Mapper: HIGH={config.damage_breakdown.get('high', 0)} "
                      f"MED={config.damage_breakdown.get('medium', 0)} "
                      f"LOW={config.damage_breakdown.get('low', 0)}")
    except Exception as e:
        print(f"  Mapper unavailable ({e}), using hardcoded defaults")
        civitai_report["mapper_active"] = False

    # Determine actual terms being used
    search_terms = effective_terms if effective_terms else DEFAULT_IMAGE_SEARCH_TERMS
    lora_tags = effective_terms if effective_terms else LORA_HUMAN_TAGS

    print(f"  Image search terms ({len(search_terms)}): {', '.join(search_terms[:10])}{'...' if len(search_terms) > 10 else ''}")
    print(f"  LoRA tags ({len(lora_tags)}): {', '.join(lora_tags[:10])}{'...' if len(lora_tags) > 10 else ''}")
    print(f"  Pages per stream: {settings.civitai_max_pages}")
    print(f"  Model pages per tag: {settings.civitai_model_pages_per_tag}")

    # Load cursors from DB
    async with async_session() as session:
        r = await session.execute(text(
            "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'civitai'"
        ))
        row = r.fetchone()
        search_terms_data = (row[0] if row else None) or {}

    # ── Stream 1: Global feed ──
    print(f"\n  Stream 1: Global image feed...")
    proxy = settings.proxy_url or None
    crawl._proxy = proxy
    limiter = get_limiter("civitai")

    req_before = metrics.total_requests
    async with aiohttp.ClientSession() as http_session:
        with PhaseTimer() as t1:
            feed_results, feed_cursor = await crawl._fetch_images(
                http_session, limiter, search_terms_data.get("cursor")
            )
    feed_reqs = metrics.total_requests - req_before
    civitai_report["streams"]["global_feed"] = {
        "images": len(feed_results),
        "time_s": round(t1.elapsed, 1),
        "api_requests": feed_reqs,
    }
    print(f"    {len(feed_results)} images in {t1.fmt} ({feed_reqs} API requests)")

    # ── Stream 2: Image search ──
    print(f"\n  Stream 2: Image search ({len(search_terms)} terms)...")
    req_before = metrics.total_requests
    async with aiohttp.ClientSession() as http_session:
        with PhaseTimer() as t2:
            search_results, search_cursors = await crawl._fetch_image_searches(
                http_session, limiter, search_terms_data.get("search_cursors"),
                search_terms=search_terms,
            )
    search_reqs = metrics.total_requests - req_before

    # Per-term breakdown
    per_term: dict[str, int] = Counter()
    for img in search_results:
        per_term[img.search_term or "unknown"] += 1

    civitai_report["streams"]["image_search"] = {
        "images": len(search_results),
        "time_s": round(t2.elapsed, 1),
        "api_requests": search_reqs,
        "per_term": dict(per_term.most_common()),
    }
    print(f"    {len(search_results)} images in {t2.fmt} ({search_reqs} API requests)")
    for term, count in per_term.most_common(10):
        print(f"      {term:<25} {count:>5} images")

    # ── Stream 3: LoRA models ──
    print(f"\n  Stream 3: LoRA models ({len(lora_tags)} tags)...")
    req_before = metrics.total_requests
    async with aiohttp.ClientSession() as http_session:
        with PhaseTimer() as t3:
            lora_results, model_cursors = await crawl._fetch_lora_models_by_tags(
                http_session, limiter, search_terms_data.get("model_cursors"),
                tags=lora_tags,
            )
    lora_reqs = metrics.total_requests - req_before

    per_tag_lora: dict[str, int] = Counter()
    for img in lora_results:
        per_tag_lora[img.search_term or "unknown"] += 1

    civitai_report["streams"]["lora_models"] = {
        "images": len(lora_results),
        "time_s": round(t3.elapsed, 1),
        "api_requests": lora_reqs,
        "per_tag": dict(per_tag_lora.most_common()),
    }
    print(f"    {len(lora_results)} images in {t3.fmt} ({lora_reqs} API requests)")
    for tag, count in per_tag_lora.most_common(10):
        print(f"      {tag:<25} {count:>5} images")

    crawl_time = t1.elapsed + t2.elapsed + t3.elapsed
    all_images = feed_results + search_results + lora_results
    civitai_report["crawl_total"] = {
        "images": len(all_images),
        "time_s": round(crawl_time, 1),
        "api_requests": feed_reqs + search_reqs + lora_reqs,
    }

    # ── Phase 2: Insert + dedup ──
    print(f"\n  Inserting {len(all_images)} images into DB (dedup by URL)...")
    with PhaseTimer() as t_insert:
        image_dicts = [
            {"source_url": img.source_url, "page_url": img.page_url, "page_title": img.page_title}
            for img in all_images
        ]
        new_images = await _insert_discovered_images(image_dicts)

    dedup_count = len(all_images) - len(new_images)
    dedup_pct = (dedup_count / len(all_images) * 100) if all_images else 0
    civitai_report["phases"]["insert"] = {
        "total": len(all_images),
        "new": len(new_images),
        "deduped": dedup_count,
        "dedup_pct": round(dedup_pct, 1),
        "time_s": round(t_insert.elapsed, 1),
    }
    print(f"    {len(new_images)} new, {dedup_count} deduped ({dedup_pct:.1f}%) in {t_insert.fmt}")

    # ── Persist cursors immediately after crawl+insert ──
    # (so if face detection crashes, we don't re-crawl the same pages)
    new_search_terms = dict(search_terms_data)
    if feed_cursor is not None:
        new_search_terms["cursor"] = feed_cursor
    elif "cursor" in new_search_terms:
        del new_search_terms["cursor"]
    if search_cursors:
        active = {k: v for k, v in search_cursors.items() if v is not None}
        if active:
            new_search_terms["search_cursors"] = active
        elif "search_cursors" in new_search_terms:
            del new_search_terms["search_cursors"]
    elif "search_cursors" in new_search_terms:
        del new_search_terms["search_cursors"]
    if model_cursors:
        active_mc = {k: v for k, v in model_cursors.items() if v is not None}
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
    print(f"  Cursors persisted to DB.")

    # ── Phase 3: Face detection (two-pass) ──
    faces_found = 0
    if new_images:
        print(f"\n  Face detection on {len(new_images)} new images (two-pass thumbnail->original)...")
        model = get_model()
        req_before = metrics.total_requests
        with PhaseTimer() as t_detect:
            faces_found = await _process_images_instrumented(new_images, model)
        detect_reqs = metrics.total_requests - req_before
        face_rate = (faces_found / len(new_images) * 100) if new_images else 0
        civitai_report["phases"]["detection"] = {
            "images_processed": len(new_images),
            "faces_found": faces_found,
            "face_rate_pct": round(face_rate, 1),
            "time_s": round(t_detect.elapsed, 1),
            "cdn_requests": detect_reqs,
        }
        print(f"    {faces_found} faces ({face_rate:.1f}% rate) in {t_detect.fmt}")
    else:
        print(f"\n  No new images — skipping face detection")
        civitai_report["phases"]["detection"] = {
            "images_processed": 0, "faces_found": 0,
            "face_rate_pct": 0, "time_s": 0, "cdn_requests": 0,
        }

    # ── Phase 4: Matching ──
    print(f"\n  Matching against all contributors...")
    req_before = metrics.total_requests
    with PhaseTimer() as t_match:
        matches = await _backfill_all_contributors()
    civitai_report["phases"]["matching"] = {
        "matches_created": matches,
        "time_s": round(t_match.elapsed, 1),
    }
    print(f"    {matches} matches in {t_match.fmt}")

    report["civitai"] = civitai_report
    return len(all_images), len(new_images), faces_found, matches


async def _insert_discovered_images(images: list[dict]) -> list[dict]:
    """Insert images into discovered_images, return only NEW ones."""
    new_images = []
    batch_size = 500

    async with async_session() as session:
        for batch_start in range(0, len(images), batch_size):
            batch = images[batch_start:batch_start + batch_size]
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

            url_to_img = {img["source_url"]: img for img in batch}
            for row in rows:
                img_dict = url_to_img.get(row[1])
                if img_dict:
                    new_images.append({"id": row[0], **img_dict})

            await session.commit()

    return new_images


async def _download_thumbnail(
    session: aiohttp.ClientSession, source_url: str, image_id
) -> tuple[Path | None, str | None]:
    thumb_url = civitai_thumbnail_url(source_url)
    try:
        async with session.get(thumb_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return None, f"http_{resp.status}"
            if not check_content_type(resp.content_type):
                return None, f"content_type"
            data = await resp.read()
            if len(data) < 500:
                return None, "too_small"
            if not check_magic_bytes(data):
                return None, "magic_bytes"
            path = TEMP_DIR / f"{image_id}_thumb.jpg"
            path.write_bytes(data)
            return path, None
    except Exception:
        return None, "exception"


async def _download_original(
    session: aiohttp.ClientSession, source_url: str, image_id
) -> Path | None:
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


async def _process_images_instrumented(new_images: list[dict], model) -> int:
    """Two-pass face detection (same logic as crawl_and_backfill.py)."""
    faces_found = 0
    batch_size = 20
    connector = aiohttp.TCPConnector(limit=10)

    async with aiohttp.ClientSession(connector=connector) as http_session:
        for batch_start in range(0, len(new_images), batch_size):
            batch = new_images[batch_start:batch_start + batch_size]

            # Pass 1: thumbnails
            thumb_tasks = [
                _download_thumbnail(http_session, img["source_url"], img["id"])
                for img in batch
            ]
            thumb_results = await asyncio.gather(*thumb_tasks)

            face_positive: list[tuple[dict, int]] = []

            async with async_session() as db_session:
                for img, (thumb_path, skip_reason) in zip(batch, thumb_results):
                    if thumb_path is None:
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
                            face_positive.append((img, len(faces)))
                    except Exception:
                        await db_session.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {"id": img["id"]})
                    finally:
                        thumb_path.unlink(missing_ok=True)

                await db_session.commit()

            # Pass 2: originals for face-positive
            if face_positive:
                orig_tasks = [
                    _download_original(http_session, img["source_url"], img["id"])
                    for img, _ in face_positive
                ]
                orig_paths = await asyncio.gather(*orig_tasks)

                async with async_session() as db_session:
                    for (img, thumb_fc), orig_path in zip(face_positive, orig_paths):
                        detect_path = orig_path
                        used_fallback = False
                        if detect_path is None:
                            fb_path, _ = await _download_thumbnail(http_session, img["source_url"], img["id"])
                            detect_path = fb_path
                            used_fallback = True

                        if detect_path is None:
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": thumb_fc})
                            continue

                        try:
                            cv_img = load_and_resize(detect_path)
                            if cv_img is None:
                                await db_session.execute(text(
                                    "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                                ), {"id": img["id"], "fc": thumb_fc})
                                continue

                            faces = model.get(cv_img)
                            face_count = len(faces) if len(faces) > 0 else thumb_fc
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": face_count})

                            for face_idx, face in enumerate(faces):
                                await insert_discovered_face_embedding(
                                    db_session, img["id"], face_idx,
                                    face.normed_embedding, float(face.det_score),
                                )
                                faces_found += 1

                            await upload_thumbnail(
                                detect_path, platform="civitai", http_session=http_session,
                            )
                        except Exception:
                            await db_session.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {"id": img["id"], "fc": thumb_fc})
                        finally:
                            detect_path.unlink(missing_ok=True)
                            if used_fallback and orig_path:
                                orig_path.unlink(missing_ok=True)

                    await db_session.commit()

            done = min(batch_start + batch_size, len(new_images))
            print(f"    {done}/{len(new_images)} processed, {faces_found} faces so far",
                  flush=True)

    return faces_found


async def _backfill_all_contributors() -> int:
    """Match against ALL onboarded contributors' embeddings."""
    # Get all onboarded contributors who have embeddings
    async with async_session() as session:
        r = await session.execute(text("""
            SELECT DISTINCT ce.contributor_id, c.full_name
            FROM contributor_embeddings ce
            JOIN contributors c ON c.id = ce.contributor_id
            WHERE c.onboarding_completed = true
              AND c.opted_out = false
              AND c.suspended = false
        """))
        contributors = r.fetchall()

    if not contributors:
        print("    WARNING: No contributors with embeddings — skipping matching")
        return 0

    print(f"    Matching against {len(contributors)} contributors")
    total_matches = 0

    for contributor_id, full_name in contributors:
        display_name = full_name or str(contributor_id)[:8]
        async with async_session() as session:
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
                    print(f"    MATCH [{display_name}]: similarity={hit['similarity']:.4f} "
                          f"confidence={confidence} image={hit['discovered_image_id']}")

            await session.commit()
            total_matches += contributor_matches

    return total_matches


# ── DeviantArt instrumented crawl ─────────────────────────────────────────


async def run_deviantart_crawl(report: dict, face_model):
    """Run DeviantArt inline crawl with per-tag analysis."""
    print(f"\n{'='*70}")
    print(f"  DEVIANTART INSTRUMENTED CRAWL (5 pages/tag)")
    print(f"{'='*70}")

    da_report: dict = {}

    # Load mapper config
    effective_tags = list(ALL_TAGS)
    tag_depths: dict[str, int] = {}
    try:
        from src.intelligence.mapper.orchestrator import get_search_config
        config = await get_search_config("deviantart")
        if config.effective_terms and len(config.effective_terms) > 0:
            effective_tags = config.effective_terms
            tag_depths = config.tag_depths or {}
            da_report["mapper_active"] = True
            if config.damage_breakdown:
                da_report["damage_breakdown"] = config.damage_breakdown
                d = config.damage_breakdown
                print(f"  Mapper: HIGH={d.get('high', 0)} MED={d.get('medium', 0)} LOW={d.get('low', 0)}")
    except Exception as e:
        print(f"  Mapper unavailable ({e}), using ALL_TAGS")
        da_report["mapper_active"] = False

    # Override all depths to 5 for this test
    tag_depths = {tag: 5 for tag in effective_tags}

    print(f"  Tags: {len(effective_tags)}")
    print(f"  Concurrency: {settings.deviantart_concurrency}")

    # Load cursors
    async with async_session() as session:
        r = await session.execute(text(
            "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'deviantart'"
        ))
        row = r.fetchone()
        search_terms_data = (row[0] if row else None) or {}
    saved_cursors = search_terms_data.get("search_cursors", {})

    context = DiscoveryContext(
        platform="deviantart",
        search_terms=effective_tags,
        search_cursors=saved_cursors,
        tag_depths=tag_depths,
    )

    crawl = DeviantArtCrawl()

    # Run the full inline crawl+detection
    req_before = metrics.total_requests
    with PhaseTimer() as t_da:
        result = await crawl.discover_with_detection(context, face_model)
    da_reqs = metrics.total_requests - req_before

    # Per-tag analysis
    per_tag: dict[str, dict] = defaultdict(lambda: {
        "images": 0, "faces": 0, "face_images": 0,
    })
    for img in result.images:
        tag = img.search_term or "unknown"
        per_tag[tag]["images"] += 1
        if img.has_face:
            per_tag[tag]["face_images"] += 1
            per_tag[tag]["faces"] += img.face_count

    # Compute face rates
    per_tag_list = []
    for tag, stats in per_tag.items():
        face_rate = (stats["face_images"] / stats["images"] * 100) if stats["images"] > 0 else 0
        per_tag_list.append({
            "tag": tag,
            "images": stats["images"],
            "face_images": stats["face_images"],
            "faces": stats["faces"],
            "face_rate_pct": round(face_rate, 1),
        })

    # Insert into DB
    print(f"\n  Inserting {len(result.images)} images into DB...")
    with PhaseTimer() as t_insert:
        images_data = [
            {
                "source_url": img.source_url,
                "page_url": img.page_url,
                "page_title": img.page_title,
                "has_face": img.has_face,
                "face_count": img.face_count,
                "image_stored_url": img.image_stored_url,
                "search_term": img.search_term,
                "faces": [
                    {
                        "face_index": f.face_index,
                        "embedding": f.embedding.tolist() if hasattr(f.embedding, "tolist") else list(f.embedding),
                        "detection_score": f.detection_score,
                    }
                    for f in img.faces
                ],
            }
            for img in result.images
        ]
        new_count = await batch_insert_inline_detected_images(images_data, "deviantart")

    # Persist cursors
    new_search_terms = dict(search_terms_data)
    if result.search_cursors:
        active = {k: v for k, v in result.search_cursors.items() if v is not None}
        if active:
            new_search_terms["search_cursors"] = active
        elif "search_cursors" in new_search_terms:
            del new_search_terms["search_cursors"]
    elif "search_cursors" in new_search_terms:
        del new_search_terms["search_cursors"]

    async with async_session() as session:
        await session.execute(text(
            "UPDATE platform_crawl_schedule "
            "SET search_terms = CAST(:terms AS jsonb), last_crawl_at = now() "
            "WHERE platform = 'deviantart'"
        ), {"terms": json.dumps(new_search_terms)})
        await session.commit()

    # Build report
    face_images = sum(1 for img in result.images if img.has_face)
    total_faces = sum(img.face_count for img in result.images)
    face_rate = (face_images / result.images_downloaded * 100) if result.images_downloaded > 0 else 0

    tags_exhausted = sum(1 for c in (result.search_cursors or {}).values() if c is None)
    tags_early_stopped = sum(
        1 for c in (result.search_cursors or {}).values()
        if c is not None
    )

    da_report.update({
        "total_time_s": round(t_da.elapsed, 1),
        "images_processed": len(result.images),
        "images_downloaded": result.images_downloaded,
        "download_failures": result.download_failures,
        "face_images": face_images,
        "total_faces": total_faces,
        "face_rate_pct": round(face_rate, 1),
        "new_db_rows": new_count,
        "insert_time_s": round(t_insert.elapsed, 1),
        "tags_total": result.tags_total,
        "tags_exhausted": tags_exhausted,
        "tags_with_cursor": tags_early_stopped,
        "api_requests": da_reqs,
        "per_tag": sorted(per_tag_list, key=lambda x: -x["images"]),
    })

    # Print summary
    print(f"\n  Results ({t_da.fmt} total):")
    print(f"    Images downloaded:  {result.images_downloaded}")
    print(f"    Download failures:  {result.download_failures}")
    print(f"    Face images:        {face_images} ({face_rate:.1f}%)")
    print(f"    Total faces:        {total_faces}")
    print(f"    New DB rows:        {new_count}")
    print(f"    Tags exhausted:     {tags_exhausted}")
    print(f"    Tags w/ cursor:     {tags_early_stopped}")

    # Top tags by volume
    by_volume = sorted(per_tag_list, key=lambda x: -x["images"])[:15]
    if by_volume:
        print(f"\n  Top tags by volume:")
        for t in by_volume:
            print(f"    {t['tag']:<25} {t['images']:>5} imgs  {t['face_images']:>4} faces  ({t['face_rate_pct']:.1f}%)")

    # Top tags by face rate (min 10 images)
    by_face_rate = sorted(
        [t for t in per_tag_list if t["images"] >= 10],
        key=lambda x: -x["face_rate_pct"]
    )[:15]
    if by_face_rate:
        print(f"\n  Top tags by face rate (min 10 images):")
        for t in by_face_rate:
            print(f"    {t['tag']:<25} {t['face_rate_pct']:>5.1f}%  ({t['face_images']}/{t['images']})")

    report["deviantart"] = da_report
    return len(result.images), face_images, total_faces


# ── Main ──────────────────────────────────────────────────────────────────


async def main():
    total_start = _time.monotonic()
    report: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "config": {
            "civitai_max_pages": settings.civitai_max_pages,
            "civitai_model_pages_per_tag": settings.civitai_model_pages_per_tag,
            "deviantart_max_pages": settings.deviantart_max_pages,
            "deviantart_concurrency": settings.deviantart_concurrency,
            "proxy_configured": bool(settings.proxy_url),
        },
    }

    print(f"\n{'#'*70}")
    print(f"  INSTRUMENTED TEST CRAWL")
    print(f"  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'#'*70}")
    print(f"\n  Config:")
    print(f"    CivitAI pages/stream:   {settings.civitai_max_pages}")
    print(f"    CivitAI model pages:    {settings.civitai_model_pages_per_tag}")
    print(f"    DeviantArt pages/tag:   {settings.deviantart_max_pages}")
    print(f"    DeviantArt concurrency: {settings.deviantart_concurrency}")
    print(f"    Proxy: {'yes' if settings.proxy_url else 'NO'}")

    # Initialize InsightFace (shared by both platforms)
    print(f"\n  Loading InsightFace model...")
    with PhaseTimer() as t_model:
        face_model = init_model()
    print(f"  Model loaded in {t_model.fmt}")
    report["model_load_time_s"] = round(t_model.elapsed, 1)

    # ── CivitAI ──
    civitai_images, civitai_new, civitai_faces, civitai_matches = await run_civitai_crawl(report)

    # ── DeviantArt ──
    da_images, da_face_images, da_faces = await run_deviantart_crawl(report, face_model)

    # ── Network summary ──
    total_elapsed = _time.monotonic() - total_start
    net = metrics.summary()
    report["network"] = net
    report["total_time_s"] = round(total_elapsed, 1)

    print(f"\n{'='*70}")
    print(f"  NETWORK SUMMARY")
    print(f"{'='*70}")
    print(f"  Total requests: {net['total_requests']}")
    print(f"  Proxied (ScraperAPI credits): {net['proxied_requests']}")
    print(f"\n  {'Domain':<40} {'Reqs':>6} {'Proxy':>6} {'OK':>5} {'Err':>5} {'Bytes':>10} {'Avg ms':>8}")
    print(f"  {'-'*40} {'-'*6} {'-'*6} {'-'*5} {'-'*5} {'-'*10} {'-'*8}")
    for domain, stats in sorted(net["domains"].items()):
        print(f"  {domain:<40} {stats['requests']:>6} {stats['proxied']:>6} "
              f"{stats['ok']:>5} {stats['errors']:>5} "
              f"{fmt_bytes(stats['total_bytes']):>10} {stats['avg_ms']:>7.0f}ms")

    # ── ScraperAPI credit estimate ──
    # Proxied requests = ScraperAPI credits (1:1)
    civitai_proxy = sum(
        1 for r in metrics.records
        if r.proxied and "civitai.com" in r.domain
    )
    da_proxy = sum(
        1 for r in metrics.records
        if r.proxied and ("deviantart.com" in r.domain or "backend.deviantart.com" in r.domain)
    )
    other_proxy = net["proxied_requests"] - civitai_proxy - da_proxy

    print(f"\n{'='*70}")
    print(f"  SCRAPERAPI CREDITS")
    print(f"{'='*70}")
    print(f"  CivitAI:    {civitai_proxy:>6} credits")
    print(f"  DeviantArt: {da_proxy:>6} credits")
    if other_proxy > 0:
        print(f"  Other:      {other_proxy:>6} credits")
    print(f"  TOTAL:      {net['proxied_requests']:>6} credits")

    # ── Final summary ──
    print(f"\n{'='*70}")
    print(f"  FINAL SUMMARY ({fmt_time(total_elapsed)})")
    print(f"{'='*70}")
    print(f"\n  CivitAI:")
    print(f"    Images discovered: {civitai_images}")
    print(f"    New (not deduped): {civitai_new}")
    print(f"    Faces detected:    {civitai_faces}")
    print(f"    Matches:           {civitai_matches}")
    print(f"\n  DeviantArt:")
    print(f"    Images processed:  {da_images}")
    print(f"    Face images:       {da_face_images}")
    print(f"    Total faces:       {da_faces}")
    print(f"\n  Combined:")
    print(f"    Total images:      {civitai_images + da_images}")
    print(f"    Total faces:       {civitai_faces + da_faces}")
    print(f"    ScraperAPI credits:{net['proxied_requests']}")
    print(f"    Total time:        {fmt_time(total_elapsed)}")

    # ── Write JSON report ──
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = Path(__file__).parent / f"test_crawl_report_{ts}.json"
    report_path.write_text(json.dumps(report, indent=2, default=str))
    print(f"\n  Report written to: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
