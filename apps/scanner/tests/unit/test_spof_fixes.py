"""Tests for scheduler single-point-of-failure elimination.

Tests cover:
  1. Rate limiter max_wait + RateLimiterTimeout
  2. Per-platform crawl timeout + cleanup
  3. _run_step on_timeout callback
  4. Concurrent matching (semaphore-gated gather)
  5. Per-tag timeout in DeviantArt crawler
  6. Config additions
"""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── 1. Rate limiter ──────────────────────────────────────────────────────────


class TestRateLimiterMaxWait:
    """Test the max_wait safety valve on RateLimiter.acquire()."""

    @pytest.mark.asyncio
    async def test_acquire_succeeds_within_max_wait(self):
        from src.utils.rate_limiter import RateLimiter

        limiter = RateLimiter(rate=10.0, max_tokens=10.0)
        # Should acquire immediately (bucket is full)
        await limiter.acquire(tokens=1.0, max_wait=1.0)

    @pytest.mark.asyncio
    async def test_acquire_raises_on_timeout(self):
        from src.utils.rate_limiter import RateLimiter, RateLimiterTimeout

        # Drain the bucket completely
        limiter = RateLimiter(rate=0.1, max_tokens=1.0)
        await limiter.acquire(tokens=1.0)  # drain

        # Now try to acquire with a very short max_wait
        with pytest.raises(RateLimiterTimeout, match="Could not acquire"):
            await limiter.acquire(tokens=1.0, max_wait=0.1)

    @pytest.mark.asyncio
    async def test_acquire_raises_on_zero_rate(self):
        from src.utils.rate_limiter import RateLimiter, RateLimiterTimeout

        limiter = RateLimiter(rate=0.0, max_tokens=1.0)
        with pytest.raises(RateLimiterTimeout, match="Rate is 0.0"):
            await limiter.acquire(tokens=1.0)

    @pytest.mark.asyncio
    async def test_acquire_raises_on_negative_rate(self):
        from src.utils.rate_limiter import RateLimiter, RateLimiterTimeout

        limiter = RateLimiter(rate=-1.0, max_tokens=1.0)
        with pytest.raises(RateLimiterTimeout, match="Rate is -1.0"):
            await limiter.acquire(tokens=1.0)

    @pytest.mark.asyncio
    async def test_default_max_wait_is_120(self):
        """Verify the default max_wait doesn't break existing callers."""
        import inspect
        from src.utils.rate_limiter import RateLimiter

        sig = inspect.signature(RateLimiter.acquire)
        assert sig.parameters["max_wait"].default == 120.0

    @pytest.mark.asyncio
    async def test_acquire_respects_deadline_not_per_iteration(self):
        """max_wait is total elapsed, not per sleep cycle."""
        from src.utils.rate_limiter import RateLimiter, RateLimiterTimeout

        # Very slow refill (0.5 tokens/sec), drain fully
        limiter = RateLimiter(rate=0.5, max_tokens=1.0)
        await limiter.acquire(tokens=1.0)

        start = time.monotonic()
        with pytest.raises(RateLimiterTimeout):
            await limiter.acquire(tokens=5.0, max_wait=0.3)
        elapsed = time.monotonic() - start
        # Should have given up around 0.3s, not waited for full 10s refill
        assert elapsed < 1.0


# ── 2. Config additions ─────────────────────────────────────────────────────


class TestConfigAdditions:
    def test_per_platform_crawl_timeout_default(self):
        from src.config import Settings

        s = Settings()
        assert s.per_platform_crawl_timeout == 300



# ── 3. _run_step on_timeout callback ────────────────────────────────────────


class TestRunStep:
    @pytest.mark.asyncio
    async def test_run_step_calls_on_timeout(self):
        """on_timeout callback should be invoked when step times out."""
        from src.jobs.scheduler import _run_step

        callback = AsyncMock()

        async def slow_coro():
            await asyncio.sleep(10)

        await _run_step("test_step", slow_coro(), timeout_seconds=0.1, on_timeout=callback)
        callback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_run_step_no_callback_on_success(self):
        """on_timeout callback should NOT be called when step succeeds."""
        from src.jobs.scheduler import _run_step

        callback = AsyncMock()

        async def fast_coro():
            pass

        await _run_step("test_step", fast_coro(), timeout_seconds=5, on_timeout=callback)
        callback.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_run_step_no_callback_on_exception(self):
        """on_timeout callback should NOT be called on non-timeout exceptions."""
        from src.jobs.scheduler import _run_step

        callback = AsyncMock()

        async def failing_coro():
            raise ValueError("boom")

        await _run_step("test_step", failing_coro(), timeout_seconds=5, on_timeout=callback)
        callback.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_run_step_callback_exception_is_caught(self):
        """If on_timeout callback raises, it should be caught (not propagated)."""
        from src.jobs.scheduler import _run_step

        async def bad_callback():
            raise RuntimeError("cleanup failed")

        async def slow_coro():
            await asyncio.sleep(10)

        # Should not raise even though callback raises
        await _run_step("test_step", slow_coro(), timeout_seconds=0.1, on_timeout=bad_callback)


# ── 4. Cleanup crawl state ──────────────────────────────────────────────────


class TestCleanupCrawlState:
    @pytest.mark.asyncio
    async def test_cleanup_single_platform(self):
        """_cleanup_crawl_state(platform) resets phase and fails jobs for that platform."""
        from src.jobs.scheduler import _cleanup_crawl_state

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.jobs.scheduler.async_session", return_value=mock_session):
            await _cleanup_crawl_state("civitai")

        # Should have called execute twice (phase reset + job update) and commit
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cleanup_all_platforms(self):
        """_cleanup_crawl_state(None) resets phase for all enabled platforms."""
        from src.jobs.scheduler import _cleanup_crawl_state

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.jobs.scheduler.async_session", return_value=mock_session):
            await _cleanup_crawl_state()  # No platform = all

        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cleanup_handles_db_error(self):
        """_cleanup_crawl_state should not raise on DB errors."""
        from src.jobs.scheduler import _cleanup_crawl_state

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session.execute.side_effect = Exception("DB down")

        with patch("src.jobs.scheduler.async_session", return_value=mock_session):
            # Should not raise
            await _cleanup_crawl_state("civitai")


# ── 5. Per-tag timeout in DeviantArt ─────────────────────────────────────────


class TestDeviantArtTagTimeout:
    def test_tag_timeout_constant_exists(self):
        from src.discovery.deviantart_crawl import TAG_TIMEOUT_SECONDS

        assert TAG_TIMEOUT_SECONDS == 120

    def test_tag_timeout_is_module_level(self):
        """TAG_TIMEOUT_SECONDS should be a module-level constant, not buried in a method."""
        import src.discovery.deviantart_crawl as mod

        assert hasattr(mod, "TAG_TIMEOUT_SECONDS")


# ── 6. Concurrent matching structure ─────────────────────────────────────────


class TestConcurrentMatchingStructure:
    """Test _match_one returns values (not mutating closures)."""

    @pytest.mark.asyncio
    async def test_match_one_returns_tuple(self):
        """Verify _phase_matching uses return values, not nonlocal."""
        import ast

        # Read the source and check there's no 'nonlocal' in _phase_matching
        import inspect
        from src.jobs.scheduler import _phase_matching

        source = inspect.getsource(_phase_matching)
        tree = ast.parse(source)

        # Check no Nonlocal nodes exist
        for node in ast.walk(tree):
            assert not isinstance(node, ast.Nonlocal), \
                "_phase_matching should not use nonlocal — use return values instead"

    @pytest.mark.asyncio
    async def test_matching_uses_local_batch(self):
        """Verify _phase_matching uses in-memory batch matching (not per-embedding DB queries)."""
        import inspect
        from src.jobs.scheduler import _phase_matching

        source = inspect.getsource(_phase_matching)
        assert "batch_compare_local" in source
        assert "load_matching_registry" in source
        assert "matching_max_per_tick" in source


# ── 7. _safe_crawl timeout behavior ─────────────────────────────────────────


class TestSafeCrawlTimeout:
    @pytest.mark.asyncio
    async def test_safe_crawl_calls_cleanup_on_timeout(self):
        """When _phase_crawl_and_insert hangs, _safe_crawl should time out and clean up."""
        from src.jobs.scheduler import _safe_crawl

        mock_crawl = MagicMock()
        mock_crawl.platform = "test_platform"
        mock_job_store = AsyncMock()

        async def hang_forever(*args, **kwargs):
            await asyncio.sleep(999)

        with patch("src.jobs.scheduler._phase_crawl_and_insert", side_effect=hang_forever), \
             patch("src.jobs.scheduler.settings") as mock_settings, \
             patch("src.jobs.scheduler._cleanup_crawl_state", new_callable=AsyncMock) as mock_cleanup:
            mock_settings.per_platform_crawl_timeout = 0.1

            await _safe_crawl(mock_job_store, mock_crawl)

            mock_cleanup.assert_awaited_once_with("test_platform")

    @pytest.mark.asyncio
    async def test_safe_crawl_cleanup_on_normal_exception(self):
        """On non-timeout exceptions, _safe_crawl should still call cleanup (belt-and-suspenders)."""
        from src.jobs.scheduler import _safe_crawl

        mock_crawl = MagicMock()
        mock_crawl.platform = "test_platform"
        mock_job_store = AsyncMock()

        async def fail_fast(*args, **kwargs):
            raise ValueError("some error")

        with patch("src.jobs.scheduler._phase_crawl_and_insert", side_effect=fail_fast), \
             patch("src.jobs.scheduler.settings") as mock_settings, \
             patch("src.jobs.scheduler._cleanup_crawl_state", new_callable=AsyncMock) as mock_cleanup:
            mock_settings.per_platform_crawl_timeout = 300

            await _safe_crawl(mock_job_store, mock_crawl)

            mock_cleanup.assert_awaited_once_with("test_platform")

    @pytest.mark.asyncio
    async def test_safe_crawl_no_cleanup_on_success(self):
        """On success, no cleanup should run."""
        from src.jobs.scheduler import _safe_crawl

        mock_crawl = MagicMock()
        mock_crawl.platform = "test_platform"
        mock_job_store = AsyncMock()

        async def succeed(*args, **kwargs):
            pass

        with patch("src.jobs.scheduler._phase_crawl_and_insert", side_effect=succeed), \
             patch("src.jobs.scheduler.settings") as mock_settings, \
             patch("src.jobs.scheduler._cleanup_crawl_state", new_callable=AsyncMock) as mock_cleanup:
            mock_settings.per_platform_crawl_timeout = 300

            await _safe_crawl(mock_job_store, mock_crawl)

            mock_cleanup.assert_not_awaited()


# ── 8. Integration: rate limiter under concurrent access ─────────────────────


class TestRateLimiterConcurrency:
    @pytest.mark.asyncio
    async def test_concurrent_acquires_respect_max_wait(self):
        """Multiple concurrent acquires should each respect their own deadline."""
        from src.utils.rate_limiter import RateLimiter, RateLimiterTimeout

        # Very slow refill, capacity for exactly 2 tokens
        limiter = RateLimiter(rate=0.5, max_tokens=2.0)
        await limiter.acquire(tokens=2.0)  # drain

        results = []

        async def try_acquire(idx):
            try:
                await limiter.acquire(tokens=1.0, max_wait=0.2)
                results.append(("ok", idx))
            except RateLimiterTimeout:
                results.append(("timeout", idx))

        # Fire 5 concurrent acquires, all should timeout since refill is too slow
        await asyncio.gather(*[try_acquire(i) for i in range(5)])

        # All 5 should have timed out
        timeouts = [r for r in results if r[0] == "timeout"]
        assert len(timeouts) == 5
