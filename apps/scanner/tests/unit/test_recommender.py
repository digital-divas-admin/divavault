"""Tests for the Recommender: analyzer orchestration, scheduling, synthetic cleanup."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from src.intelligence.recommender import Recommender
from src.intelligence.analyzers.base import BaseAnalyzer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

class MockAnalyzer(BaseAnalyzer):
    """Test analyzer with configurable behavior."""

    def __init__(self, name="TestAnalyzer", schedule_hours=1.0, min_signals=10):
        self._name = name
        self._schedule = schedule_hours
        self._min_signals = min_signals
        self.analyze_called = False
        self._recommendations = []

    def get_name(self) -> str:
        return self._name

    def get_schedule_hours(self) -> float:
        return self._schedule

    def get_minimum_signals(self) -> int:
        return self._min_signals

    async def analyze(self) -> list[dict]:
        self.analyze_called = True
        return self._recommendations


@pytest.fixture
def mock_analyzer():
    return MockAnalyzer()


@pytest.fixture
def recommender(mock_analyzer):
    return Recommender([mock_analyzer])


# ---------------------------------------------------------------------------
# Tick scheduling
# ---------------------------------------------------------------------------

class TestTick:
    @pytest.mark.asyncio
    async def test_runs_due_analyzer(self, recommender, mock_analyzer):
        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_insert_recommendation", new_callable=AsyncMock), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        assert mock_analyzer.analyze_called

    @pytest.mark.asyncio
    async def test_skips_not_due_analyzer(self, recommender, mock_analyzer):
        recommender._last_run["TestAnalyzer"] = datetime.now(timezone.utc)

        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        assert not mock_analyzer.analyze_called

    @pytest.mark.asyncio
    async def test_skips_insufficient_signals(self, recommender, mock_analyzer):
        mock_analyzer._min_signals = 1000

        with patch.object(recommender, "_count_signals", return_value=5), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        assert not mock_analyzer.analyze_called

    @pytest.mark.asyncio
    async def test_inserts_recommendations(self, recommender, mock_analyzer):
        mock_analyzer._recommendations = [
            {"rec_type": "test", "target_entity": "x", "confidence": 0.8},
        ]
        inserted = []

        async def capture_insert(rec):
            inserted.append(rec)

        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_insert_recommendation", side_effect=capture_insert), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        assert len(inserted) == 1
        assert inserted[0]["rec_type"] == "test"

    @pytest.mark.asyncio
    async def test_analyzer_failure_does_not_crash(self, recommender, mock_analyzer):
        """Analyzer exceptions should be caught, not crash the tick."""
        async def broken_analyze():
            raise RuntimeError("Analyzer exploded")

        mock_analyzer.analyze = broken_analyze

        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            # Should not raise
            await recommender.tick()

    @pytest.mark.asyncio
    async def test_records_last_run(self, recommender, mock_analyzer):
        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_insert_recommendation", new_callable=AsyncMock), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        assert "TestAnalyzer" in recommender._last_run

    @pytest.mark.asyncio
    async def test_tick_calls_synthetic_cleanup(self, recommender):
        cleanup_called = False

        async def mock_cleanup(now):
            nonlocal cleanup_called
            cleanup_called = True

        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_insert_recommendation", new_callable=AsyncMock), \
             patch.object(recommender, "_check_synthetic_cleanup", side_effect=mock_cleanup):
            await recommender.tick()

        assert cleanup_called


# ---------------------------------------------------------------------------
# Synthetic cleanup check (Fix 4)
# ---------------------------------------------------------------------------

class TestSyntheticCleanup:
    @pytest.mark.asyncio
    async def test_recommends_cleanup_when_organic_over_100(self):
        recommender = Recommender([])
        inserted = []

        async def capture_insert(rec):
            inserted.append(rec)

        recommender._insert_recommendation = capture_insert

        # Mock DB: 150 organic, 10 synthetic
        mock_session = AsyncMock()
        call_count = [0]

        async def mock_execute(query):
            call_count[0] += 1
            result = MagicMock()
            if call_count[0] == 1:
                result.scalar_one.return_value = 150  # organic
            else:
                result.scalar_one.return_value = 10   # synthetic
            return result

        mock_session.execute = mock_execute
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.recommender.async_session", return_value=mock_session):
            await recommender._check_synthetic_cleanup(datetime.now(timezone.utc))

        assert len(inserted) == 1
        assert inserted[0]["rec_type"] == "synthetic_cleanup"
        assert inserted[0]["current_value"]["organic_contributors"] == 150
        assert inserted[0]["current_value"]["synthetic_contributors"] == 10

    @pytest.mark.asyncio
    async def test_no_cleanup_when_organic_under_100(self):
        recommender = Recommender([])
        inserted = []

        async def capture_insert(rec):
            inserted.append(rec)

        recommender._insert_recommendation = capture_insert

        mock_session = AsyncMock()

        async def mock_execute(query):
            result = MagicMock()
            result.scalar_one.return_value = 50  # organic < 100
            return result

        mock_session.execute = mock_execute
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.recommender.async_session", return_value=mock_session):
            await recommender._check_synthetic_cleanup(datetime.now(timezone.utc))

        assert len(inserted) == 0

    @pytest.mark.asyncio
    async def test_no_cleanup_when_zero_synthetics(self):
        recommender = Recommender([])
        inserted = []

        async def capture_insert(rec):
            inserted.append(rec)

        recommender._insert_recommendation = capture_insert

        mock_session = AsyncMock()
        call_count = [0]

        async def mock_execute(query):
            call_count[0] += 1
            result = MagicMock()
            if call_count[0] == 1:
                result.scalar_one.return_value = 200  # organic
            else:
                result.scalar_one.return_value = 0    # zero synthetic
            return result

        mock_session.execute = mock_execute
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.recommender.async_session", return_value=mock_session):
            await recommender._check_synthetic_cleanup(datetime.now(timezone.utc))

        assert len(inserted) == 0

    @pytest.mark.asyncio
    async def test_only_runs_once_per_day(self):
        recommender = Recommender([])
        recommender._last_run["synthetic_cleanup_check"] = datetime.now(timezone.utc)
        inserted = []

        async def capture_insert(rec):
            inserted.append(rec)

        recommender._insert_recommendation = capture_insert

        await recommender._check_synthetic_cleanup(datetime.now(timezone.utc))
        assert len(inserted) == 0  # Should skip, ran recently


# ---------------------------------------------------------------------------
# Analyzer status
# ---------------------------------------------------------------------------

class TestAnalyzerStatus:
    @pytest.mark.asyncio
    async def test_returns_all_analyzers(self, recommender, mock_analyzer):
        with patch.object(recommender, "_count_signals", return_value=50):
            status = await recommender.get_analyzer_status()

        assert len(status) == 1
        assert status[0]["name"] == "TestAnalyzer"
        assert status[0]["status"] == "active"  # 50 >= 10

    @pytest.mark.asyncio
    async def test_warming_status(self, recommender, mock_analyzer):
        mock_analyzer._min_signals = 100

        with patch.object(recommender, "_count_signals", return_value=5):
            status = await recommender.get_analyzer_status()

        assert status[0]["status"] == "warming"
