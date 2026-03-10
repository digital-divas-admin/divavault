"""Reddit test crawl — CLI wrapper.

Crawls high-risk subreddits via the public JSON API and inserts discovered
image URLs into discovered_images (DEFERRED detection — no face
detection here, that happens in process_faces.py).

Usage:
  .venv/Scripts/python.exe scripts/crawl_reddit.py                          # default subreddits, 3 pages each
  .venv/Scripts/python.exe scripts/crawl_reddit.py --subs aiNSFW CelebsAI   # specific subs
  .venv/Scripts/python.exe scripts/crawl_reddit.py --pages 1                 # shallow test (1 page/sub)
  .venv/Scripts/python.exe scripts/crawl_reddit.py --backfill                # deep backfill mode
"""

import os
import sys

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SCANNER_ROOT)
sys.path.insert(0, SCANNER_ROOT)

import argparse
import asyncio
import time
from datetime import datetime, timezone

from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.db.queries import batch_insert_discovered_images
from src.discovery.base import DiscoveryContext
from src.discovery.reddit_crawl import RedditCrawl, TARGET_SUBREDDITS
from src.resilience.collector import collector
from src.utils.logging import get_logger, setup_logging

setup_logging()
log = get_logger("crawl_reddit")


async def main():
    parser = argparse.ArgumentParser(description="Crawl Reddit subreddits for images")
    parser.add_argument(
        "--subs", nargs="+", default=None,
        help=f"Subreddits to crawl (default: {TARGET_SUBREDDITS})",
    )
    parser.add_argument(
        "--pages", type=int, default=None,
        help=f"Max pages per subreddit (default: {settings.reddit_max_pages})",
    )
    parser.add_argument(
        "--backfill", action="store_true",
        help="Run in backfill mode (deeper pagination, persistent cursors)",
    )
    args = parser.parse_args()

    start = time.monotonic()
    crawl_start = datetime.now(timezone.utc)
    subs = args.subs or TARGET_SUBREDDITS
    pages_override = args.pages

    # Override config if --pages provided
    if pages_override is not None:
        settings.reddit_max_pages = pages_override
        settings.reddit_backfill_pages = pages_override

    print(f"Reddit crawl starting")
    print(f"  Subreddits: {subs}")
    print(f"  Pages/sub: {pages_override or settings.reddit_max_pages}")
    print(f"  Mode: {'backfill' if args.backfill else 'sweep'}")
    print()

    # Load existing schedule state from DB (reused for cursor persistence later)
    existing_state = {}
    search_cursors = {}
    backfill_cursors = {}
    try:
        async with async_session() as session:
            r = await session.execute(text(
                "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'reddit'"
            ))
            row = r.fetchone()
            if row and row[0]:
                existing_state = row[0]
                search_cursors = existing_state.get("search_cursors", {})
                bf = existing_state.get("backfill", {})
                backfill_cursors = bf.get("cursors", {})
                if search_cursors:
                    print(f"  Loaded {len(search_cursors)} sweep cursors")
                if backfill_cursors:
                    print(f"  Loaded {len(backfill_cursors)} backfill cursors")
    except Exception as e:
        print(f"  Warning: could not load cursors: {e}")

    # Build context
    search_terms = [f"r/{s}" for s in subs]
    context = DiscoveryContext(
        platform="reddit",
        search_terms=search_terms,
        backfill=args.backfill,
        search_cursors=search_cursors if not args.backfill else None,
        backfill_cursors=backfill_cursors if args.backfill else None,
    )

    # Run crawl
    crawler = RedditCrawl()
    result = await crawler.discover(context)

    print(f"\nCrawl complete:")
    print(f"  Images found: {len(result.images)}")
    print(f"  Subreddits crawled: {result.tags_total}")
    print(f"  Subreddits exhausted: {result.tags_exhausted}")

    new_count = 0
    if not result.images:
        print("\nNo images found — nothing to insert.")
    else:
        # Show sample URLs
        print(f"\nSample URLs (first 5):")
        for img in result.images[:5]:
            print(f"  {img.source_url}")
            print(f"    page: {img.page_url}")

        # Insert into discovered_images
        images_for_insert = [
            {
                "source_url": img.source_url,
                "page_url": img.page_url,
                "page_title": img.page_title,
                "image_stored_url": img.image_stored_url,
                "search_term": img.search_term,
            }
            for img in result.images
        ]

        async with async_session() as session:
            new_count = await batch_insert_discovered_images(
                session, images_for_insert, "reddit"
            )
            await session.commit()

        print(f"\n  Inserted: {new_count} new images (of {len(result.images)} total)")

    # Persist cursors (reuse existing_state loaded at startup to avoid extra DB query)
    if result.search_cursors:
        try:
            if args.backfill:
                bf = existing_state.get("backfill", {})
                bf["cursors"] = dict(result.search_cursors)
                bf["terms_total"] = result.tags_total
                bf["terms_exhausted"] = result.tags_exhausted
                existing_state["backfill"] = bf
            else:
                existing_state["search_cursors"] = {
                    k: v for k, v in result.search_cursors.items() if v is not None
                }

            import json
            async with async_session() as session:
                await session.execute(text(
                    "UPDATE platform_crawl_schedule SET search_terms = :st, last_crawl_at = now() WHERE platform = 'reddit'"
                ), {"st": json.dumps(existing_state)})
                await session.commit()
            print(f"  Cursors saved ({len(result.search_cursors)} subreddits)")
        except Exception as e:
            print(f"  Warning: could not save cursors: {e}")
    else:
        # Update last_crawl_at even when no cursors to save
        try:
            async with async_session() as session:
                await session.execute(text(
                    "UPDATE platform_crawl_schedule SET last_crawl_at = now() WHERE platform = 'reddit'"
                ))
                await session.commit()
        except Exception as e:
            print(f"  Warning: could not update last_crawl_at: {e}")

    # Record crawl telemetry for daily report / resilience monitoring
    await collector.record_crawl(
        platform="reddit",
        crawl_type="backfill" if args.backfill else "sweep",
        started_at=crawl_start,
        finished_at=datetime.now(timezone.utc),
        images_discovered=len(result.images),
        images_new=new_count,
        tags_total=result.tags_total,
        tags_exhausted=result.tags_exhausted,
    )

    elapsed = time.monotonic() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    asyncio.run(main())
