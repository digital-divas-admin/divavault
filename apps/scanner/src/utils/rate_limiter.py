"""Token bucket rate limiter for external API calls."""

import asyncio
import time
from dataclasses import dataclass, field


class RateLimiterTimeout(Exception):
    """Raised when acquire() exceeds max_wait."""


@dataclass
class RateLimiter:
    """Async token bucket rate limiter.

    Args:
        rate: Number of tokens added per second.
        max_tokens: Maximum bucket capacity.
    """

    rate: float
    max_tokens: float
    _tokens: float = field(init=False)
    _last_refill: float = field(init=False)
    _lock: asyncio.Lock = field(init=False, default_factory=asyncio.Lock)
    _total_waits: int = field(init=False, default=0)
    _total_wait_time: float = field(init=False, default=0.0)
    _total_acquires: int = field(init=False, default=0)

    def __post_init__(self):
        self._tokens = self.max_tokens
        self._last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self.max_tokens, self._tokens + elapsed * self.rate)
        self._last_refill = now

    async def acquire(self, tokens: float = 1.0, max_wait: float = 120.0) -> None:
        """Wait until the requested number of tokens are available.

        Args:
            tokens: Number of tokens to acquire.
            max_wait: Maximum seconds to wait before raising RateLimiterTimeout.
        """
        self._total_acquires += 1
        if self.rate <= 0:
            raise RateLimiterTimeout(
                f"Rate is {self.rate} — tokens will never refill"
            )
        start = time.monotonic()
        deadline = start + max_wait
        while True:
            async with self._lock:
                self._refill()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    waited = time.monotonic() - start
                    if waited > 0.01:
                        self._total_waits += 1
                        self._total_wait_time += waited
                    return
                # Calculate wait time
                deficit = tokens - self._tokens
                wait_time = deficit / self.rate
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RateLimiterTimeout(
                    f"Could not acquire {tokens} tokens within {max_wait}s"
                )
            await asyncio.sleep(min(wait_time, remaining))

    def get_stats(self) -> dict:
        """Return instrumentation stats for this rate limiter."""
        return {
            "total_acquires": self._total_acquires,
            "total_waits": self._total_waits,
            "total_wait_time_s": round(self._total_wait_time, 2),
        }


# Pre-configured limiters for external services
RATE_LIMITERS: dict[str, RateLimiter] = {
    "tineye": RateLimiter(rate=2.0, max_tokens=10.0),       # 2 req/sec, burst of 10
    "hive": RateLimiter(rate=5.0, max_tokens=20.0),          # 5 req/sec, burst of 20
    "civitai": RateLimiter(rate=2.0, max_tokens=5.0),         # 2 req/sec, burst of 5 (direct, no proxy)
    "deviantart": RateLimiter(rate=5.0, max_tokens=20.0),   # 5 req/sec, burst of 20 (ScraperAPI handles IP rotation)
    "supabase_storage": RateLimiter(rate=10.0, max_tokens=50.0),  # 10 req/sec
    "meta_ad_library": RateLimiter(rate=2.0, max_tokens=10.0),    # 2 req/sec, burst of 10
    "shutterstock": RateLimiter(rate=3.0, max_tokens=15.0),       # 3 req/sec, burst of 15
    "getty": RateLimiter(rate=3.0, max_tokens=15.0),              # 3 req/sec, burst of 15
    "adobe_stock": RateLimiter(rate=3.0, max_tokens=15.0),        # 3 req/sec, burst of 15
    "anthropic": RateLimiter(rate=5.0, max_tokens=20.0),          # 5 req/sec, burst of 20
    "civitai_mapper": RateLimiter(rate=2.0, max_tokens=5.0),     # 2 req/sec (mapper only)
    "deviantart_mapper": RateLimiter(rate=2.0, max_tokens=5.0),  # 2 req/sec (mapper only)
    "common_crawl": RateLimiter(rate=1.0, max_tokens=3.0),    # 1 req/sec, gentle on free API
    "reddit": RateLimiter(rate=1.0, max_tokens=5.0),           # 1 req/sec, Reddit rate limit
    "google_cse": RateLimiter(rate=1.0, max_tokens=5.0),       # 1 req/sec
    "fourchan": RateLimiter(rate=1.0, max_tokens=1.0),          # 1 req/sec, no burst (4chan strict limit)
    "scout_assess": RateLimiter(rate=5.0, max_tokens=20.0),    # 5 req/sec for assessment HTTP GETs
    "serpapi": RateLimiter(rate=1.0, max_tokens=5.0),            # 1 req/sec, burst of 5
    "wayback": RateLimiter(rate=1.0, max_tokens=3.0),            # 1 req/sec, burst of 3
    "ap_api": RateLimiter(rate=1.0, max_tokens=5.0),             # 1 req/sec, burst of 5
}


def get_limiter(service: str) -> RateLimiter:
    """Get rate limiter for a service, creating a default if not configured."""
    if service not in RATE_LIMITERS:
        RATE_LIMITERS[service] = RateLimiter(rate=1.0, max_tokens=5.0)
    return RATE_LIMITERS[service]
