"""Token bucket rate limiter for external API calls."""

import asyncio
import time
from dataclasses import dataclass, field


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

    def __post_init__(self):
        self._tokens = self.max_tokens
        self._last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self.max_tokens, self._tokens + elapsed * self.rate)
        self._last_refill = now

    async def acquire(self, tokens: float = 1.0) -> None:
        """Wait until the requested number of tokens are available."""
        while True:
            async with self._lock:
                self._refill()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return
                # Calculate wait time
                deficit = tokens - self._tokens
                wait_time = deficit / self.rate
            await asyncio.sleep(wait_time)


# Pre-configured limiters for external services
RATE_LIMITERS: dict[str, RateLimiter] = {
    "tineye": RateLimiter(rate=2.0, max_tokens=10.0),       # 2 req/sec, burst of 10
    "hive": RateLimiter(rate=5.0, max_tokens=20.0),          # 5 req/sec, burst of 20
    "civitai": RateLimiter(rate=5.0, max_tokens=20.0),       # 5 req/sec, burst of 20
    "deviantart": RateLimiter(rate=10.0, max_tokens=20.0),  # 10 req/sec, burst of 20
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
    "scout_assess": RateLimiter(rate=5.0, max_tokens=20.0),    # 5 req/sec for assessment HTTP GETs
}


def get_limiter(service: str) -> RateLimiter:
    """Get rate limiter for a service, creating a default if not configured."""
    if service not in RATE_LIMITERS:
        RATE_LIMITERS[service] = RateLimiter(rate=1.0, max_tokens=5.0)
    return RATE_LIMITERS[service]
