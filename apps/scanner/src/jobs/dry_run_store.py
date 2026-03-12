"""Dry-run job store wrapper -- suppresses scheduling metadata writes."""

from uuid import UUID
from src.jobs.store import JobStore, DueScan, DueCrawl
from src.utils.logging import get_logger

log = get_logger("dry_run_store")


class DryRunJobStore(JobStore):
    """Decorator around a real JobStore that suppresses scheduling writes.

    Pass-through (reads + inspectable writes):
      - get_due_contributor_scans
      - get_due_platform_crawls
      - mark_scan_started (creates scan_job for inspection)
      - mark_scan_failed
      - recover_stale
      - interrupt_running_jobs

    Suppressed (scheduling metadata writes):
      - mark_scan_complete -> log + skip (no last_scan_at/next_scan_at update)
      - mark_crawl_complete -> log + skip (no last_crawl_at/next_crawl_at/cursor update)
      - update_crawl_phase -> log + skip (no crawl_phase lock)
    """

    def __init__(self, inner: JobStore) -> None:
        self._inner = inner

    async def get_due_contributor_scans(self, batch_size: int) -> list[DueScan]:
        return await self._inner.get_due_contributor_scans(batch_size)

    async def get_due_platform_crawls(self) -> list[DueCrawl]:
        return await self._inner.get_due_platform_crawls()

    async def mark_scan_started(
        self, contributor_id: UUID, scan_type: str, source_name: str
    ) -> UUID:
        return await self._inner.mark_scan_started(contributor_id, scan_type, source_name)

    async def mark_scan_complete(
        self,
        job_id: UUID,
        contributor_id: UUID,
        scan_type: str,
        interval_hours: int,
        images_processed: int,
        matches_found: int,
    ) -> None:
        log.info(
            "dry_run_skip",
            action="mark_scan_complete",
            job_id=str(job_id),
            contributor_id=str(contributor_id),
            scan_type=scan_type,
            images_processed=images_processed,
            matches_found=matches_found,
        )

    async def mark_scan_failed(self, job_id: UUID, error: str) -> None:
        await self._inner.mark_scan_failed(job_id, error)

    async def mark_crawl_complete(
        self, platform: str, search_terms: dict | None
    ) -> None:
        log.info(
            "dry_run_skip",
            action="mark_crawl_complete",
            platform=platform,
        )

    async def recover_stale(self, max_age_minutes: int) -> tuple[int, int]:
        return await self._inner.recover_stale(max_age_minutes)

    async def update_crawl_phase(self, platform: str, phase: str | None) -> None:
        log.info(
            "dry_run_skip",
            action="update_crawl_phase",
            platform=platform,
            phase=phase,
        )

    async def interrupt_running_jobs(self) -> int:
        return await self._inner.interrupt_running_jobs()
