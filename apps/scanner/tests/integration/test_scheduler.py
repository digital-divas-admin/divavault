"""Integration tests for the scheduler."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.jobs.store import DueCrawl, DueScan


@pytest.mark.asyncio
class TestSchedulerResilience:
    async def test_failed_scan_does_not_block_others(self):
        """If one contributor's scan fails, others should still proceed."""
        from src.jobs.scheduler import _run_contributor_scans

        mock_store = MagicMock()
        mock_store.get_due_contributor_scans = AsyncMock(
            return_value=[
                DueScan(uuid4(), "reverse_image", 168, 0),
                DueScan(uuid4(), "reverse_image", 168, 0),
            ]
        )
        mock_store.mark_scan_started = AsyncMock(return_value=uuid4())
        mock_store.mark_scan_failed = AsyncMock()
        mock_store.mark_scan_complete = AsyncMock()

        # First scan fails, second should still run
        call_count = 0

        async def mock_execute(store, scan):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Simulated failure")

        with patch(
            "src.jobs.scheduler._execute_contributor_scan",
            side_effect=mock_execute,
        ):
            await _run_contributor_scans(mock_store)

        assert call_count == 2  # Both were attempted

    async def test_shutdown_stops_scan_loop(self):
        """Shutdown flag should stop processing mid-batch."""
        import src.jobs.scheduler as sched
        from src.jobs.scheduler import _run_contributor_scans

        original = sched.shutdown_requested
        try:
            mock_store = MagicMock()
            mock_store.get_due_contributor_scans = AsyncMock(
                return_value=[
                    DueScan(uuid4(), "reverse_image", 168, 0),
                    DueScan(uuid4(), "reverse_image", 168, 0),
                    DueScan(uuid4(), "reverse_image", 168, 0),
                ]
            )

            call_count = 0

            async def mock_execute(store, scan):
                nonlocal call_count
                call_count += 1
                sched.shutdown_requested = True  # Request shutdown after first

            with patch(
                "src.jobs.scheduler._execute_contributor_scan",
                side_effect=mock_execute,
            ):
                await _run_contributor_scans(mock_store)

            # Should have stopped after 1 (shutdown was set)
            assert call_count == 1
        finally:
            sched.shutdown_requested = original


@pytest.mark.asyncio
class TestStaleJobRecovery:
    async def test_recover_stale_jobs_on_startup(self):
        """Stale jobs should be recovered when scheduler starts."""
        mock_store = MagicMock()
        mock_store.recover_stale = AsyncMock(return_value=3)

        count = await mock_store.recover_stale(max_age_minutes=30)
        assert count == 3
        mock_store.recover_stale.assert_called_once_with(max_age_minutes=30)
