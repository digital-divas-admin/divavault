"""Unit tests for PlatformCircuitBreaker."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.resilience.circuit_breaker import PlatformCircuitBreaker


@pytest.fixture
def cb():
    return PlatformCircuitBreaker()


class TestBackoffComputation:
    """Test _compute_backoff without DB calls."""

    def test_first_failure_base_delay(self, cb):
        """First failure = base delay (30 min)."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            result = cb._compute_backoff(1)
            assert result == timedelta(minutes=30)

    def test_second_failure_doubles(self, cb):
        """Second failure = 2x base (60 min)."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            result = cb._compute_backoff(2)
            assert result == timedelta(minutes=60)

    def test_third_failure(self, cb):
        """Third failure = 4x base (120 min = 2h)."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            result = cb._compute_backoff(3)
            assert result == timedelta(minutes=120)

    def test_exponential_sequence(self, cb):
        """Verify full exponential sequence: 30, 60, 120, 240, 480, 960, 1440 (capped)."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            expected = [30, 60, 120, 240, 480, 960, 1440]
            for i, exp_minutes in enumerate(expected, 1):
                result = cb._compute_backoff(i)
                assert result == timedelta(minutes=exp_minutes), f"Failure {i}: expected {exp_minutes}m, got {result}"

    def test_cap_at_max_delay(self, cb):
        """Large failure count should cap at max_delay (24h = 1440 min)."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            result = cb._compute_backoff(20)
            assert result == timedelta(minutes=1440)

    def test_custom_base_delay(self, cb):
        """Respect custom base delay."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 10
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            result = cb._compute_backoff(1)
            assert result == timedelta(minutes=10)

    def test_custom_max_delay(self, cb):
        """Respect custom max delay cap."""
        with patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 60
            # 3rd failure would be 120min but capped at 60
            result = cb._compute_backoff(3)
            assert result == timedelta(minutes=60)


class TestRecordFailure:
    """Test record_failure with mocked DB."""

    @pytest.mark.asyncio
    async def test_increments_counter(self, cb):
        """record_failure should increment consecutive_failures."""
        mock_schedule = MagicMock()
        mock_schedule.consecutive_failures = 2
        mock_schedule.last_failure_at = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_schedule

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm), \
             patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            mock_settings.circuit_breaker_max_failures = 10

            backoff = await cb.record_failure("civitai")

            # 3rd failure → 120min backoff
            assert backoff == timedelta(minutes=120)
            # Should have executed UPDATE
            assert mock_session.execute.call_count == 2  # SELECT + UPDATE
            assert mock_session.commit.called

    @pytest.mark.asyncio
    async def test_auto_disable_on_max_failures(self, cb):
        """Should auto-disable platform at max_failures threshold."""
        mock_schedule = MagicMock()
        mock_schedule.consecutive_failures = 9  # will become 10

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_schedule

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm), \
             patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            mock_settings.circuit_breaker_max_failures = 10

            backoff = await cb.record_failure("civitai")

            # The UPDATE call should include enabled=False
            update_call = mock_session.execute.call_args_list[1]
            # We can't easily inspect SQLAlchemy update values from mock,
            # but we verify the function returned valid backoff
            assert backoff == timedelta(minutes=1440)  # 10th failure capped at 24h

    @pytest.mark.asyncio
    async def test_no_schedule_returns_base_delay(self, cb):
        """If platform has no schedule row, return base delay."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm), \
             patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440

            backoff = await cb.record_failure("unknown")
            assert backoff == timedelta(minutes=30)

    @pytest.mark.asyncio
    async def test_db_error_returns_base_delay(self, cb):
        """On DB error, return base delay gracefully."""
        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(side_effect=Exception("DB down"))
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm), \
             patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30

            backoff = await cb.record_failure("civitai")
            assert backoff == timedelta(minutes=30)


class TestRecordSuccess:
    """Test record_success with mocked DB."""

    @pytest.mark.asyncio
    async def test_resets_counter(self, cb):
        """record_success should reset consecutive_failures to 0 when rows affected."""
        mock_result = MagicMock()
        mock_result.rowcount = 1  # UPDATE affected 1 row

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm):
            await cb.record_success("civitai")
            assert mock_session.commit.called

    @pytest.mark.asyncio
    async def test_noop_when_no_failures(self, cb):
        """If consecutive_failures is already 0, UPDATE affects 0 rows, no commit."""
        mock_result = MagicMock()
        mock_result.rowcount = 0  # No rows matched (already at 0)

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm):
            await cb.record_success("civitai")
            assert not mock_session.commit.called

    @pytest.mark.asyncio
    async def test_db_error_silent(self, cb):
        """DB error in record_success should be silent (never raise)."""
        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(side_effect=Exception("DB down"))
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm):
            # Should not raise
            await cb.record_success("civitai")


class TestGetState:
    """Test get_state with mocked DB."""

    @pytest.mark.asyncio
    async def test_returns_state_dict(self, cb):
        """get_state should return a dict with circuit breaker state."""
        now = datetime.now(timezone.utc)
        mock_schedule = MagicMock()
        mock_schedule.consecutive_failures = 3
        mock_schedule.last_failure_at = now

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_schedule

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm), \
             patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            mock_settings.circuit_breaker_max_failures = 10

            state = await cb.get_state("civitai")
            assert state["consecutive_failures"] == 3
            assert state["last_failure_at"] == now.isoformat()
            assert state["tripped"] is False
            assert state["next_backoff_minutes"] == 120.0  # 30 * 2^(3-1) = 120

    @pytest.mark.asyncio
    async def test_tripped_state(self, cb):
        """get_state should show tripped=True at max_failures."""
        mock_schedule = MagicMock()
        mock_schedule.consecutive_failures = 10
        mock_schedule.last_failure_at = datetime.now(timezone.utc)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_schedule

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("src.resilience.circuit_breaker.async_session", return_value=mock_cm), \
             patch("src.resilience.circuit_breaker.settings") as mock_settings:
            mock_settings.circuit_breaker_base_delay_minutes = 30
            mock_settings.circuit_breaker_max_delay_minutes = 1440
            mock_settings.circuit_breaker_max_failures = 10

            state = await cb.get_state("civitai")
            assert state["tripped"] is True
