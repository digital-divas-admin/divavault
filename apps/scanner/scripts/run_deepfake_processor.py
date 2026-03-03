"""Standalone deepfake task processor.

Polls the deepfake_tasks table independently of the main scanner scheduler.
Designed to run on the Mac mini (CPU-only) — no GPU or InsightFace imports.

Usage:
    cd apps/scanner
    .venv/bin/python scripts/run_deepfake_processor.py           # 30s tick
    .venv/bin/python scripts/run_deepfake_processor.py --tick 60  # 60s tick
"""

import argparse
import asyncio
import os
import signal
import sys

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace("\\", "/")
sys.path.insert(0, SCANNER_ROOT)
os.chdir(SCANNER_ROOT)

from src.utils.logging import get_logger

log = get_logger("deepfake.standalone")

_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    log.info("shutdown_signal", signal=signum)
    _shutdown = True


async def main(tick_seconds: int) -> None:
    from src.deepfake.processor import process_pending_tasks

    log.info("deepfake_processor_started", tick_seconds=tick_seconds, pid=os.getpid())
    print(f"Deepfake processor started (tick={tick_seconds}s, pid={os.getpid()})")
    print("Press Ctrl+C to stop.\n")

    total_processed = 0

    while not _shutdown:
        try:
            count = await process_pending_tasks()
            if count > 0:
                total_processed += count
                log.info("tick_processed", count=count, total=total_processed)
                print(f"  Processed {count} tasks (total: {total_processed})")
        except Exception as e:
            log.error("tick_error", error=str(e))
            print(f"  Error: {e}")

        # Sleep in small increments to respond to shutdown quickly
        for _ in range(tick_seconds * 2):
            if _shutdown:
                break
            await asyncio.sleep(0.5)

    # Clean shutdown
    log.info("deepfake_processor_stopping", total_processed=total_processed)
    print(f"\nShutting down (processed {total_processed} tasks total)")

    from src.db.connection import dispose_engine
    await dispose_engine()
    log.info("deepfake_processor_stopped")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Standalone deepfake task processor")
    parser.add_argument(
        "--tick",
        type=int,
        default=30,
        help="Seconds between polling ticks (default: 30)",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    asyncio.run(main(args.tick))
