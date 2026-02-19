"""DeviantArt crawl with inline face detection — CLI wrapper.

Thin CLI that builds a DiscoveryContext and calls the DeviantArtCrawl provider's
discover_with_detection(). All crawl + detection logic lives in the provider.

Usage:
  .venv/bin/python scripts/crawl_deviantart.py                    # full crawl
  .venv/bin/python scripts/crawl_deviantart.py --max-pages 5      # shallow test
"""

import os
import sys

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SCANNER_ROOT)
sys.path.insert(0, SCANNER_ROOT)

import argparse
import asyncio
import json
import time

from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.db.queries import insert_inline_detected_image
from src.discovery.base import DiscoveryContext
from src.discovery.deviantart_crawl import DeviantArtCrawl, ALL_TAGS
from src.ingest.embeddings import init_model
from src.utils.logging import get_logger, setup_logging

setup_logging()
log = get_logger("crawl_deviantart")


async def main():
    parser = argparse.ArgumentParser(
        description="Crawl DeviantArt with inline face detection"
    )
    parser.add_argument(
        "--max-pages", type=int, default=None,
        help="Override max pages per tag (ignores damage tiers)",
    )
    args = parser.parse_args()

    start = time.monotonic()

    # Initialize InsightFace model (one-time, ~3s)
    print("Loading InsightFace model...")
    model = init_model()
    print("Model loaded.\n")

    # Load prioritized tag config from mapper
    effective_tags = list(ALL_TAGS)
    tag_depths: dict[str, int] = {}
    try:
        from src.intelligence.mapper.orchestrator import get_search_config

        config = await get_search_config("deviantart")
        if config.effective_terms is not None and len(config.effective_terms) > 0:
            effective_tags = config.effective_terms
            tag_depths = config.tag_depths or {}
            if config.damage_breakdown:
                d = config.damage_breakdown
                print(f"Prioritized config loaded:")
                print(f"  HIGH:   {d.get('high', 0)} tags @ {settings.deviantart_high_damage_pages} pages")
                print(f"  MEDIUM: {d.get('medium', 0)} tags @ {settings.deviantart_medium_damage_pages} pages")
                print(f"  LOW:    {d.get('low', 0)} tags @ {settings.deviantart_low_damage_pages} pages")
        elif config.effective_terms is not None and len(config.effective_terms) == 0:
            print("No enabled sections in mapper — nothing to crawl.")
            return
    except Exception as e:
        print(f"Mapper unavailable ({e}), using ALL_TAGS with default depth")

    # --max-pages overrides all per-tag depths
    if args.max_pages:
        tag_depths = {tag: args.max_pages for tag in effective_tags}

    # Load saved cursors from DB
    async with async_session() as session:
        r = await session.execute(text(
            "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'deviantart'"
        ))
        row = r.fetchone()
        search_terms_data = (row[0] if row else None) or {}
    saved_cursors = search_terms_data.get("search_cursors", {})

    # Print run header
    cursor_count = sum(1 for t in effective_tags if saved_cursors.get(t))
    print(f"\n{'='*60}")
    print(f"CRAWLING DEVIANTART (inline detection via provider)")
    print(f"{'='*60}")
    print(f"Tags: {len(effective_tags)}")
    print(f"Concurrency: {settings.deviantart_concurrency}")
    print(f"Resuming from cursors: {cursor_count}/{len(effective_tags)} tags")
    print()

    # Build context for the provider
    context = DiscoveryContext(
        platform="deviantart",
        search_terms=effective_tags,
        search_cursors=saved_cursors,
        tag_depths=tag_depths if tag_depths else None,
    )

    # Call the provider's inline crawl+detection
    crawl = DeviantArtCrawl()
    result = await crawl.discover_with_detection(context, model)

    # Insert pre-detected images with embeddings
    new_count = 0
    for img in result.images:
        faces_data = [
            {
                "face_index": f.face_index,
                "embedding": f.embedding.tolist() if hasattr(f.embedding, "tolist") else list(f.embedding),
                "detection_score": f.detection_score,
            }
            for f in img.faces
        ]
        async with async_session() as session:
            inserted = await insert_inline_detected_image(
                session=session,
                source_url=img.source_url,
                page_url=img.page_url,
                page_title=img.page_title,
                platform="deviantart",
                has_face=img.has_face,
                face_count=img.face_count,
                faces=faces_data,
            )
            await session.commit()
        if inserted:
            new_count += 1

    # Persist cursors for next run
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

    # Print summary
    elapsed = time.monotonic() - start
    face_images = sum(1 for img in result.images if img.has_face)
    total_faces = sum(img.face_count for img in result.images)
    print(f"\n{'='*60}")
    print(f"COMPLETE ({elapsed:.0f}s)")
    print(f"{'='*60}")
    print(f"  Images processed:    {len(result.images)}")
    print(f"  Images downloaded:   {result.images_downloaded}")
    print(f"  Download failures:   {result.download_failures}")
    print(f"  Images with faces:   {face_images}")
    print(f"  Total face embeds:   {total_faces}")
    print(f"  New DB rows:         {new_count}")
    print(f"  Tags total:          {result.tags_total}")
    print(f"  Tags exhausted:      {result.tags_exhausted}")
    if result.images_downloaded > 0:
        fr = face_images / result.images_downloaded * 100
        print(f"  Face rate:           {fr:.1f}%")
    print(f"\nCursors persisted. Embeddings are ready for matching.")


if __name__ == "__main__":
    asyncio.run(main())
