"""Baseline calculator: computes rolling averages from crawl health snapshots."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from src.config import settings
from src.db.connection import async_session
from src.resilience.models import CrawlHealthSnapshot
from src.utils.logging import get_logger

log = get_logger("resilience.baseline")


class BaselineCalculator:
    """Computes rolling baseline metrics from recent crawl snapshots."""

    async def get_baseline(
        self,
        platform: str,
        crawl_type: str = "sweep",
        window_days: int | None = None,
    ) -> dict | None:
        """Get baseline metrics for a platform.

        Returns dict with avg_discovered, avg_new, avg_duration, snapshot_count
        or None if fewer than 3 snapshots exist.
        """
        if window_days is None:
            window_days = settings.resilience_baseline_days

        cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

        try:
            async with async_session() as session:
                result = await session.execute(
                    select(
                        func.avg(CrawlHealthSnapshot.images_discovered).label("avg_discovered"),
                        func.avg(CrawlHealthSnapshot.images_new).label("avg_new"),
                        func.avg(CrawlHealthSnapshot.duration_seconds).label("avg_duration"),
                        func.avg(CrawlHealthSnapshot.download_failures).label("avg_failures"),
                        func.count().label("snapshot_count"),
                    )
                    .where(CrawlHealthSnapshot.platform == platform)
                    .where(CrawlHealthSnapshot.crawl_type == crawl_type)
                    .where(CrawlHealthSnapshot.created_at >= cutoff)
                    .where(CrawlHealthSnapshot.error_message.is_(None))
                )
                row = result.one()

            if row.snapshot_count < 3:
                log.info(
                    "baseline_insufficient",
                    platform=platform,
                    snapshots=row.snapshot_count,
                )
                return None

            baseline = {
                "avg_discovered": float(row.avg_discovered or 0),
                "avg_new": float(row.avg_new or 0),
                "avg_duration": float(row.avg_duration or 0),
                "avg_failures": float(row.avg_failures or 0),
                "snapshot_count": row.snapshot_count,
            }
            log.info(
                "baseline_computed",
                platform=platform,
                **baseline,
            )
            return baseline
        except Exception as e:
            log.error("baseline_error", platform=platform, error=str(e))
            return None


baseline_calculator = BaselineCalculator()
