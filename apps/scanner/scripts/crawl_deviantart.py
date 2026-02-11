"""DeviantArt crawl script — Phase 1 only (discovery + insert).

Usage: .venv/bin/python scripts/crawl_deviantart.py [--max-pages N]

Face detection and matching run automatically on next scheduler tick,
or via scripts/crawl_and_backfill.py.
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
from src.discovery.base import DiscoveryContext
from src.discovery.deviantart_crawl import DeviantArtCrawl, ALL_TAGS
from src.utils.logging import get_logger, setup_logging

setup_logging()
log = get_logger("crawl_deviantart")


async def crawl_deviantart(max_pages: int | None = None) -> list[dict]:
    """Run DeviantArt crawler and return discovered image URLs."""
    crawl = DeviantArtCrawl()

    # Override max_pages if specified
    if max_pages is not None:
        import src.discovery.deviantart_crawl as mod
        from unittest.mock import patch
        settings_patch = patch.object(mod.settings, "deviantart_max_pages", max_pages)
        settings_patch.start()

    # Load existing cursors from DB
    async with async_session() as session:
        r = await session.execute(text(
            "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'deviantart'"
        ))
        row = r.fetchone()
        search_terms_data = (row[0] if row else None) or {}

    ctx = DiscoveryContext(
        platform="deviantart",
        search_cursors=search_terms_data.get("search_cursors"),
    )

    effective_pages = max_pages or settings.deviantart_max_pages
    print(f"\n{'='*60}")
    print(f"PHASE 1: CRAWLING DEVIANTART")
    print(f"{'='*60}")
    print(f"Tags: {len(ALL_TAGS)}")
    print(f"Max pages per tag: {effective_pages}")
    print(f"Resuming from cursors: {bool(ctx.search_cursors)}")
    if ctx.search_cursors:
        active = {k: v for k, v in ctx.search_cursors.items() if v is not None}
        print(f"  Active cursors: {len(active)}/{len(ALL_TAGS)} tags")

    result = await crawl.discover(ctx)

    print(f"\nCrawl complete: {len(result.images)} image URLs discovered")
    print(f"Tags exhausted: {result.tags_exhausted}/{result.tags_total}")

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
            "UPDATE platform_crawl_schedule SET search_terms = CAST(:terms AS jsonb), last_crawl_at = now() WHERE platform = 'deviantart'"
        ), {"terms": json.dumps(new_search_terms)})
        await session.commit()
    print("Cursors persisted for next run")

    return [
        {"source_url": img.source_url, "page_url": img.page_url, "page_title": img.page_title}
        for img in result.images
    ]


async def insert_discovered_images(images: list[dict]) -> int:
    """Insert images into discovered_images, return count of new."""
    new_count = 0
    batch_size = 500
    total = len(images)

    print(f"\nInserting {total} images into discovered_images...")

    async with async_session() as session:
        for batch_start in range(0, total, batch_size):
            batch = images[batch_start:batch_start + batch_size]

            values_parts = []
            params = {}
            for i, img in enumerate(batch):
                values_parts.append(f"(:url_{i}, :page_url_{i}, :title_{i}, 'deviantart')")
                params[f"url_{i}"] = img["source_url"]
                params[f"page_url_{i}"] = img["page_url"]
                params[f"title_{i}"] = img.get("page_title")

            values_sql = ", ".join(values_parts)
            r = await session.execute(text(f"""
                INSERT INTO discovered_images (source_url, page_url, page_title, platform)
                VALUES {values_sql}
                ON CONFLICT (md5(source_url)) DO NOTHING
                RETURNING id
            """), params)
            rows = r.fetchall()
            new_count += len(rows)

            await session.commit()
            print(f"  Batch {batch_start // batch_size + 1}: "
                  f"{len(rows)} new / {len(batch)} total "
                  f"({batch_start + len(batch)}/{total})", flush=True)

    deduped = total - new_count
    print(f"Inserted {new_count} new images ({deduped} deduped)")
    return new_count


async def main():
    parser = argparse.ArgumentParser(description="Crawl DeviantArt for AI-generated portraits")
    parser.add_argument("--max-pages", type=int, default=None,
                        help=f"Max pages per tag (default: {settings.deviantart_max_pages})")
    args = parser.parse_args()

    start = time.time()

    # Phase 1: Crawl
    images = await crawl_deviantart(args.max_pages)

    # Phase 2: Insert + deduplicate
    if images:
        new_count = await insert_discovered_images(images)
    else:
        print("\nNo images discovered")
        new_count = 0

    # Summary
    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"COMPLETE ({elapsed:.0f}s)")
    print(f"{'='*60}")
    print(f"  Images discovered: {len(images)}")
    print(f"  New (not deduped): {new_count}")
    print(f"\nFace detection + matching will run on next scheduler tick.")


if __name__ == "__main__":
    asyncio.run(main())
