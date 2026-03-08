"""Telemetry collector: records crawl health snapshots after each crawl tick."""

from datetime import datetime, timezone
from uuid import UUID

from src.db.connection import async_session
from src.resilience.models import CrawlHealthSnapshot
from src.utils.logging import get_logger

log = get_logger("resilience.collector")


class CrawlTelemetryCollector:
    """Records per-crawl telemetry into crawl_health_snapshots."""

    async def record_crawl(
        self,
        platform: str,
        crawl_type: str,
        started_at: datetime,
        finished_at: datetime,
        images_discovered: int,
        images_new: int,
        download_failures: int = 0,
        faces_found: int = 0,
        tags_total: int = 0,
        tags_exhausted: int = 0,
        http_errors: dict | None = None,
        error_message: str | None = None,
        metadata: dict | None = None,
        tick_number: int = 0,
    ) -> UUID | None:
        """Record a crawl health snapshot. Never raises -- logs errors internally."""
        try:
            duration = (finished_at - started_at).total_seconds()
            snapshot = CrawlHealthSnapshot(
                platform=platform,
                crawl_type=crawl_type,
                tick_number=tick_number,
                started_at=started_at,
                finished_at=finished_at,
                duration_seconds=duration,
                images_discovered=images_discovered,
                images_new=images_new,
                download_failures=download_failures,
                tags_total=tags_total,
                tags_exhausted=tags_exhausted,
                faces_found=faces_found,
                http_errors=http_errors,
                error_message=error_message,
                extra_metadata=metadata,
            )
            async with async_session() as session:
                session.add(snapshot)
                await session.flush()
                snapshot_id = snapshot.id
                await session.commit()
            log.info(
                "crawl_health_recorded",
                platform=platform,
                crawl_type=crawl_type,
                images_discovered=images_discovered,
                images_new=images_new,
                duration=round(duration, 1),
            )
            return snapshot_id
        except Exception as e:
            log.error("crawl_health_record_error", platform=platform, error=str(e))
            return None


collector = CrawlTelemetryCollector()
