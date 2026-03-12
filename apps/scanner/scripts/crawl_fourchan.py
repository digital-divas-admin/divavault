"""4chan test crawl — CLI wrapper.

Crawls 4chan boards via the read-only JSON API and inserts discovered
image URLs into discovered_images (DEFERRED detection — no face
detection here, that happens in process_faces.py).

Usage:
  .venv/Scripts/python.exe scripts/crawl_fourchan.py                 # default boards, 10 threads each
  .venv/Scripts/python.exe scripts/crawl_fourchan.py --boards s hr   # specific boards
  .venv/Scripts/python.exe scripts/crawl_fourchan.py --threads 3     # shallow test (3 threads/board)
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
from src.discovery.fourchan_crawl import FourChanCrawl, TARGET_BOARDS
from src.resilience.collector import collector
from src.utils.logging import get_logger, setup_logging

setup_logging()
log = get_logger("crawl_fourchan")


async def main():
    parser = argparse.ArgumentParser(description="Crawl 4chan boards for images")
    parser.add_argument(
        "--boards", nargs="+", default=None,
        help=f"Boards to crawl (default: {TARGET_BOARDS})",
    )
    parser.add_argument(
        "--threads", type=int, default=None,
        help=f"Max threads to drill into per board (default: {settings.fourchan_threads_per_board})",
    )
    parser.add_argument(
        "--backfill", action="store_true",
        help="Run in backfill mode (deeper thread drill-in, persistent cursors)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Suppress scheduling writes (cursors, last_crawl_at, next_crawl_at)",
    )
    parser.add_argument(
        "--capture", type=str, default=None,
        help="Directory to save HTTP responses for replay",
    )
    parser.add_argument(
        "--replay", type=str, default=None,
        help="Directory to replay HTTP responses from (no network)",
    )
    parser.add_argument(
        "--dump-stage", type=str, default=None, choices=["fetch"],
        help="Dump stage output to --dump-dir",
    )
    parser.add_argument(
        "--dump-dir", type=str, default=None,
        help="Directory for stage fixture dumps",
    )
    args = parser.parse_args()
    dry_run = args.dry_run

    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE — scheduling writes suppressed")
        print("  Data inserts: YES (results inspectable in DB)")
        print("  Schedule mutations: NO (cursors, last_crawl_at, next_crawl_at untouched)")
        print("=" * 60)
        print()

    start = time.monotonic()
    crawl_start = datetime.now(timezone.utc)
    boards = args.boards or TARGET_BOARDS
    threads_override = args.threads

    # Override config if --threads provided
    if threads_override is not None:
        settings.fourchan_threads_per_board = threads_override
        settings.fourchan_backfill_threads = threads_override

    print(f"4chan crawl starting")
    print(f"  Boards: {boards}")
    print(f"  Threads/board: {threads_override or settings.fourchan_threads_per_board}")
    print(f"  Mode: {'backfill' if args.backfill else 'sweep'}")
    print()

    # Load existing cursors from DB
    search_cursors = {}
    backfill_cursors = {}
    try:
        async with async_session() as session:
            r = await session.execute(text(
                "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'fourchan'"
            ))
            row = r.fetchone()
            if row and row[0]:
                data = row[0]
                search_cursors = data.get("search_cursors", {})
                bf = data.get("backfill", {})
                backfill_cursors = bf.get("cursors", {})
                # Validate cursor types
                from src.utils.cursors import validate_cursor_dict
                search_cursors = validate_cursor_dict(search_cursors)
                backfill_cursors = validate_cursor_dict(backfill_cursors)
                if search_cursors:
                    print(f"  Loaded {len(search_cursors)} sweep cursors")
                if backfill_cursors:
                    print(f"  Loaded {len(backfill_cursors)} backfill cursors")
    except Exception as e:
        log.warning("cursor_load_error", error=repr(e))

    # Set up HTTP session override for recording/replay
    http_session_override = None
    _real_session = None
    if args.capture:
        import aiohttp
        from pathlib import Path
        from src.utils.http_recorder import RecordingSession
        _real_session = aiohttp.ClientSession(
            headers={"User-Agent": "ConsentedAI-Scanner/1.0 (face-protection; contact@consentedai.com)"},
            timeout=aiohttp.ClientTimeout(total=15),
        )
        http_session_override = RecordingSession(_real_session, Path(args.capture))
        print(f"  Recording HTTP responses to: {args.capture}")
    elif args.replay:
        from pathlib import Path
        from src.utils.http_recorder import ReplaySession
        http_session_override = ReplaySession(Path(args.replay))
        print(f"  Replaying HTTP responses from: {args.replay}")

    # Build context
    search_terms = [f"/{b}/" for b in boards]
    context = DiscoveryContext(
        platform="fourchan",
        search_terms=search_terms,
        backfill=args.backfill,
        search_cursors=search_cursors if not args.backfill else None,
        backfill_cursors=backfill_cursors if args.backfill else None,
        http_session_override=http_session_override,
    )

    # Run crawl
    crawler = FourChanCrawl()
    result = await crawler.discover(context)

    # Dump fixture if requested
    if args.dump_stage == "fetch" and args.dump_dir:
        from pathlib import Path as _Path
        from src.fixtures.dumper import dump_discovery_result
        dump_path = _Path(args.dump_dir) / "fetch.json"
        dump_discovery_result(result, dump_path)
        print(f"Fixture dumped: {dump_path}")

    print(f"\nCrawl complete:")
    print(f"  Images found: {len(result.images)}")
    print(f"  Boards crawled: {result.tags_total}")
    print(f"  Boards exhausted: {result.tags_exhausted}")

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
                session, images_for_insert, "fourchan"
            )
            await session.commit()

        print(f"\n  Inserted: {new_count} new images (of {len(result.images)} total)")

    # Persist cursors
    if result.search_cursors:
        try:
            if not dry_run:
                async with async_session() as session:
                    existing = {}
                    r = await session.execute(text(
                        "SELECT search_terms FROM platform_crawl_schedule WHERE platform = 'fourchan'"
                    ))
                    row = r.fetchone()
                    if row and row[0]:
                        existing = row[0]

                    if args.backfill:
                        bf = existing.get("backfill", {})
                        bf["cursors"] = dict(result.search_cursors)
                        bf["terms_total"] = result.tags_total
                        bf["terms_exhausted"] = result.tags_exhausted
                        existing["backfill"] = bf
                    else:
                        existing["search_cursors"] = {
                            k: v for k, v in result.search_cursors.items() if v is not None
                        }

                    import json
                    await session.execute(text(
                        "UPDATE platform_crawl_schedule SET search_terms = :st, last_crawl_at = now() WHERE platform = 'fourchan'"
                    ), {"st": json.dumps(existing)})
                    await session.commit()
                print(f"  Cursors saved ({len(result.search_cursors)} boards)")
            else:
                print(f"  [dry-run] Skipped cursor persistence ({len(result.search_cursors)} boards)")
        except Exception as e:
            log.warning("cursor_save_error", error=repr(e))

    else:
        # Update last_crawl_at even when no cursors to save
        if not dry_run:
            try:
                async with async_session() as session:
                    await session.execute(text(
                        "UPDATE platform_crawl_schedule SET last_crawl_at = now() WHERE platform = 'fourchan'"
                    ))
                    await session.commit()
            except Exception as e:
                log.warning("last_crawl_at_update_error", error=repr(e))
        else:
            print("  [dry-run] Skipped last_crawl_at update")

    # Record crawl telemetry for daily report / resilience monitoring
    crawl_type = "backfill" if args.backfill else "sweep"
    if dry_run:
        crawl_type = f"[dry-run] {crawl_type}"
    await collector.record_crawl(
        platform="fourchan",
        crawl_type=crawl_type,
        started_at=crawl_start,
        finished_at=datetime.now(timezone.utc),
        images_discovered=len(result.images),
        images_new=new_count,
        tags_total=result.tags_total,
        tags_exhausted=result.tags_exhausted,
    )

    # Clean up HTTP session override
    if _real_session is not None:
        await _real_session.close()

    elapsed = time.monotonic() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    except Exception as e:
        log.error("fatal_error", error=repr(e))
        import traceback
        traceback.print_exc()
        sys.exit(1)
