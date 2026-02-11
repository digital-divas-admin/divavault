"""Job store abstraction for scan scheduling.

Uses PostgreSQL with SELECT FOR UPDATE SKIP LOCKED for safe concurrent access.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.connection import async_session
from src.db.models import PlatformCrawlSchedule, ScanSchedule
from src.db.queries import (
    create_scan_job,
    get_due_crawls,
    get_due_scans,
    recover_stale_jobs,
    update_crawl_schedule_after_run,
    update_scan_job,
    update_scan_schedule_after_run,
)
from src.utils.logging import get_logger

log = get_logger("job_store")


@dataclass
class DueScan:
    contributor_id: UUID
    scan_type: str
    interval_hours: int
    priority: int


@dataclass
class DueCrawl:
    platform: str
    search_terms: dict | None
    cursor: str | None


class JobStore(ABC):
    """Abstract job store for scan scheduling."""

    @abstractmethod
    async def get_due_contributor_scans(self, batch_size: int) -> list[DueScan]:
        ...

    @abstractmethod
    async def get_due_platform_crawls(self) -> list[DueCrawl]:
        ...

    @abstractmethod
    async def mark_scan_started(
        self, contributor_id: UUID, scan_type: str, source_name: str
    ) -> UUID:
        """Create scan_job, return job_id."""
        ...

    @abstractmethod
    async def mark_scan_complete(
        self,
        job_id: UUID,
        contributor_id: UUID,
        scan_type: str,
        interval_hours: int,
        images_processed: int,
        matches_found: int,
    ) -> None:
        ...

    @abstractmethod
    async def mark_scan_failed(self, job_id: UUID, error: str) -> None:
        ...

    @abstractmethod
    async def mark_crawl_complete(
        self, platform: str, search_terms: dict | None
    ) -> None:
        ...

    @abstractmethod
    async def recover_stale(self, max_age_minutes: int) -> int:
        ...

    @abstractmethod
    async def update_crawl_phase(self, platform: str, phase: str | None) -> None:
        """Update the crawl_phase column on platform_crawl_schedule."""
        ...

    @abstractmethod
    async def interrupt_running_jobs(self) -> int:
        ...


class PostgresJobStore(JobStore):
    """PostgreSQL-backed job store."""

    async def get_due_contributor_scans(self, batch_size: int) -> list[DueScan]:
        async with async_session() as session:
            schedules = await get_due_scans(session, batch_size)
            return [
                DueScan(
                    contributor_id=s.contributor_id,
                    scan_type=s.scan_type,
                    interval_hours=s.scan_interval_hours,
                    priority=s.priority,
                )
                for s in schedules
            ]

    async def get_due_platform_crawls(self) -> list[DueCrawl]:
        async with async_session() as session:
            crawls = await get_due_crawls(session)
            return [
                DueCrawl(
                    platform=c.platform,
                    search_terms=c.search_terms,
                    cursor=(c.search_terms or {}).get("cursor"),
                )
                for c in crawls
            ]

    async def mark_scan_started(
        self, contributor_id: UUID, scan_type: str, source_name: str
    ) -> UUID:
        async with async_session() as session:
            job = await create_scan_job(
                session,
                scan_type=scan_type,
                source_name=source_name,
                contributor_id=contributor_id,
            )
            await update_scan_job(session, job.id, status="running")
            await session.commit()
            return job.id

    async def mark_scan_complete(
        self,
        job_id: UUID,
        contributor_id: UUID,
        scan_type: str,
        interval_hours: int,
        images_processed: int,
        matches_found: int,
    ) -> None:
        async with async_session() as session:
            await update_scan_job(
                session,
                job_id,
                status="completed",
                images_processed=images_processed,
                matches_found=matches_found,
            )
            await update_scan_schedule_after_run(
                session, contributor_id, scan_type, interval_hours
            )
            await session.commit()

    async def mark_scan_failed(self, job_id: UUID, error: str) -> None:
        async with async_session() as session:
            await update_scan_job(session, job_id, status="failed", error_message=error)
            await session.commit()

    async def mark_crawl_complete(
        self, platform: str, search_terms: dict | None
    ) -> None:
        async with async_session() as session:
            await update_crawl_schedule_after_run(session, platform, search_terms)
            await session.commit()

    async def recover_stale(self, max_age_minutes: int) -> int:
        async with async_session() as session:
            count = await recover_stale_jobs(session, max_age_minutes)
            await session.commit()
            return count

    async def update_crawl_phase(self, platform: str, phase: str | None) -> None:
        async with async_session() as session:
            await session.execute(
                update(PlatformCrawlSchedule)
                .where(PlatformCrawlSchedule.platform == platform)
                .values(crawl_phase=phase)
            )
            await session.commit()

    async def interrupt_running_jobs(self) -> int:
        """Mark all running jobs as interrupted (for graceful shutdown)."""
        async with async_session() as session:
            from sqlalchemy import update as sa_update

            from src.db.models import ScanJob

            result = await session.execute(
                sa_update(ScanJob)
                .where(ScanJob.status == "running")
                .values(status="interrupted")
            )
            await session.commit()
            return result.rowcount
