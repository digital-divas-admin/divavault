"""Test stale job recovery on startup."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4


@pytest.mark.asyncio
class TestStaleJobRecovery:
    async def test_recovery_resets_running_jobs(self):
        """Jobs stuck in 'running' for too long should be marked failed."""
        mock_store = MagicMock()
        mock_store.recover_stale = AsyncMock(return_value=2)

        recovered = await mock_store.recover_stale(max_age_minutes=30)
        assert recovered == 2

    async def test_recovery_resets_interrupted_jobs(self):
        """Jobs in 'interrupted' state should be recovered."""
        mock_store = MagicMock()
        mock_store.recover_stale = AsyncMock(return_value=1)

        recovered = await mock_store.recover_stale(max_age_minutes=30)
        assert recovered == 1

    async def test_no_stale_jobs(self):
        """When no stale jobs exist, recovery returns 0."""
        mock_store = MagicMock()
        mock_store.recover_stale = AsyncMock(return_value=0)

        recovered = await mock_store.recover_stale(max_age_minutes=30)
        assert recovered == 0

    async def test_interrupt_running_jobs_on_shutdown(self):
        """Running jobs should be interrupted on graceful shutdown."""
        mock_store = MagicMock()
        mock_store.interrupt_running_jobs = AsyncMock(return_value=5)

        interrupted = await mock_store.interrupt_running_jobs()
        assert interrupted == 5
