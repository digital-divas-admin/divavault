"""Tests for the ML Observer: buffering, flushing, overflow protection."""

import json
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.intelligence.observer import Observer, FLUSH_THRESHOLD, FLUSH_INTERVAL, MAX_BUFFER_SIZE


@pytest.fixture
def obs():
    """Fresh observer for each test."""
    return Observer()


# ---------------------------------------------------------------------------
# Basic emit
# ---------------------------------------------------------------------------

class TestEmit:
    @pytest.mark.asyncio
    async def test_emit_adds_to_buffer(self, obs):
        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("crawl_completed", "platform", "civitai", {"total": 50})
        assert obs.buffer_size == 1

    @pytest.mark.asyncio
    async def test_emit_serializes_context(self, obs):
        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("test", "entity", "123", {"key": "value"})
        assert obs._buffer[0]["context"] == json.dumps({"key": "value"})

    @pytest.mark.asyncio
    async def test_emit_default_context(self, obs):
        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("test", "entity", "123")
        assert obs._buffer[0]["context"] == json.dumps({})

    @pytest.mark.asyncio
    async def test_emit_default_actor(self, obs):
        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("test", "entity", "123")
        assert obs._buffer[0]["actor"] == "system"

    @pytest.mark.asyncio
    async def test_emit_custom_actor(self, obs):
        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("test", "entity", "123", actor="admin")
        assert obs._buffer[0]["actor"] == "admin"


# ---------------------------------------------------------------------------
# Auto-flush triggers
# ---------------------------------------------------------------------------

class TestAutoFlush:
    @pytest.mark.asyncio
    async def test_flush_on_threshold(self, obs):
        """Buffer reaching FLUSH_THRESHOLD triggers flush."""
        flush_called = False
        original_flush = obs.flush

        async def mock_flush():
            nonlocal flush_called
            flush_called = True

        obs.flush = mock_flush

        for i in range(FLUSH_THRESHOLD):
            obs._buffer.append({"signal_type": f"test_{i}", "entity_type": "t",
                                "entity_id": str(i), "context": "{}", "actor": "system"})

        # Next emit should trigger flush
        await obs.emit("trigger", "entity", "999")
        assert flush_called

    @pytest.mark.asyncio
    async def test_flush_on_interval(self, obs):
        """Elapsed time > FLUSH_INTERVAL triggers flush."""
        flush_called = False

        async def mock_flush():
            nonlocal flush_called
            flush_called = True

        obs.flush = mock_flush
        obs._last_flush = time.monotonic() - FLUSH_INTERVAL - 1  # Force interval exceeded

        await obs.emit("trigger", "entity", "999")
        assert flush_called


# ---------------------------------------------------------------------------
# Buffer overflow
# ---------------------------------------------------------------------------

class TestOverflow:
    @pytest.mark.asyncio
    async def test_buffer_capped_at_max(self, obs):
        """Buffer should never exceed MAX_BUFFER_SIZE."""
        with patch.object(obs, "flush", new_callable=AsyncMock):
            for i in range(MAX_BUFFER_SIZE + 50):
                obs._buffer.append({"signal_type": f"test_{i}", "entity_type": "t",
                                    "entity_id": str(i), "context": "{}", "actor": "system"})

            await obs.emit("overflow", "entity", "999")
        assert obs.buffer_size <= MAX_BUFFER_SIZE + 1


# ---------------------------------------------------------------------------
# Flush mechanics
# ---------------------------------------------------------------------------

class TestFlush:
    @pytest.mark.asyncio
    async def test_flush_clears_buffer_on_success(self, obs):
        obs._buffer = [
            {"signal_type": "test", "entity_type": "e", "entity_id": "1", "context": "{}", "actor": "system"},
        ]

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.db.connection.async_session", return_value=mock_session):
            await obs.flush()

        assert obs.buffer_size == 0

    @pytest.mark.asyncio
    async def test_flush_keeps_buffer_on_failure(self, obs):
        obs._buffer = [
            {"signal_type": "test", "entity_type": "e", "entity_id": "1", "context": "{}", "actor": "system"},
        ]

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=Exception("DB error"))
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.db.connection.async_session", return_value=mock_session):
            await obs.flush()

        # Buffer should still have the signal for retry
        assert obs.buffer_size == 1

    @pytest.mark.asyncio
    async def test_flush_empty_buffer_noop(self, obs):
        """Flushing an empty buffer should not error."""
        await obs.flush()
        assert obs.buffer_size == 0


# ---------------------------------------------------------------------------
# Shutdown
# ---------------------------------------------------------------------------

class TestShutdown:
    @pytest.mark.asyncio
    async def test_shutdown_flushes(self, obs):
        flush_called = False

        async def mock_flush():
            nonlocal flush_called
            flush_called = True

        obs.flush = mock_flush
        obs._buffer = [{"signal_type": "test", "entity_type": "e", "entity_id": "1",
                         "context": "{}", "actor": "system"}]

        await obs.shutdown()
        assert flush_called


# ---------------------------------------------------------------------------
# Error resilience
# ---------------------------------------------------------------------------

class TestResilience:
    @pytest.mark.asyncio
    async def test_emit_never_raises(self, obs):
        """Even with broken flush, emit should not raise."""
        async def bad_flush():
            raise RuntimeError("Flush broken")

        obs.flush = bad_flush
        obs._last_flush = time.monotonic() - FLUSH_INTERVAL - 1

        # Should not raise
        await obs.emit("test", "entity", "123")
