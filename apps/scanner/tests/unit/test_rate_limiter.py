"""Test rate limiter functionality."""

import asyncio
import time

import pytest

from src.utils.rate_limiter import RateLimiter, get_limiter


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_immediate_acquire(self):
        """Should acquire immediately when tokens available."""
        limiter = RateLimiter(rate=10.0, max_tokens=10.0)
        start = time.monotonic()
        await limiter.acquire()
        elapsed = time.monotonic() - start
        assert elapsed < 0.1

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Should wait when tokens exhausted."""
        limiter = RateLimiter(rate=10.0, max_tokens=1.0)
        await limiter.acquire()  # Take the one token
        start = time.monotonic()
        await limiter.acquire()  # Should wait ~0.1s
        elapsed = time.monotonic() - start
        assert elapsed >= 0.05  # At least some wait

    @pytest.mark.asyncio
    async def test_burst_capacity(self):
        """Should allow burst up to max_tokens."""
        limiter = RateLimiter(rate=1.0, max_tokens=5.0)
        for _ in range(5):
            await limiter.acquire()  # Should all succeed immediately


class TestGetLimiter:
    def test_known_service(self):
        limiter = get_limiter("tineye")
        assert isinstance(limiter, RateLimiter)

    def test_unknown_service_creates_default(self):
        limiter = get_limiter("new_service_xyz")
        assert isinstance(limiter, RateLimiter)
        assert limiter.rate == 1.0
