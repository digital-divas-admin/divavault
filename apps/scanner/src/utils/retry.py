"""Retry logic with exponential backoff and circuit breaker."""

import asyncio
import time
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.utils.logging import get_logger

log = get_logger("retry")


# Standard retry decorator for external API calls
def retry_async(
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 60.0,
    retry_on: tuple = (Exception,),
):
    """Retry decorator with exponential backoff for async functions."""
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=min_wait, max=max_wait),
        retry=retry_if_exception_type(retry_on),
        reraise=True,
    )


@dataclass
class CircuitBreaker:
    """Simple circuit breaker that stops calling a failing service.

    After `failure_threshold` consecutive failures, the circuit opens
    and rejects calls for `recovery_timeout` seconds.
    """

    failure_threshold: int = 5
    recovery_timeout: float = 300.0  # 5 minutes
    _failure_count: int = field(init=False, default=0)
    _last_failure_time: float = field(init=False, default=0.0)
    _is_open: bool = field(init=False, default=False)

    def _check_recovery(self) -> None:
        if self._is_open and (time.monotonic() - self._last_failure_time) > self.recovery_timeout:
            self._is_open = False
            self._failure_count = 0

    @property
    def is_open(self) -> bool:
        self._check_recovery()
        return self._is_open

    def record_success(self) -> None:
        self._failure_count = 0
        self._is_open = False

    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._failure_count >= self.failure_threshold:
            self._is_open = True
            log.warning(
                "circuit_breaker_opened",
                failure_count=self._failure_count,
                recovery_timeout=self.recovery_timeout,
            )


class CircuitOpenError(Exception):
    """Raised when trying to call through an open circuit breaker."""

    pass


# Pre-configured circuit breakers per service
CIRCUIT_BREAKERS: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(service: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a service."""
    if service not in CIRCUIT_BREAKERS:
        CIRCUIT_BREAKERS[service] = CircuitBreaker()
    return CIRCUIT_BREAKERS[service]


def with_circuit_breaker(service: str):
    """Decorator that wraps an async function with a circuit breaker."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cb = get_circuit_breaker(service)
            if cb.is_open:
                raise CircuitOpenError(f"Circuit breaker open for {service}")
            try:
                result = await func(*args, **kwargs)
                cb.record_success()
                return result
            except Exception:
                cb.record_failure()
                raise
        return wrapper
    return decorator
