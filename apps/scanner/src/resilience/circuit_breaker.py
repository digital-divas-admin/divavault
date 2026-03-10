"""Platform circuit breaker: tracks consecutive failures and computes exponential backoff.

On repeated failures, increases retry delay exponentially (30min → 1h → 2h → ... → 24h cap).
After N consecutive failures (default 10), auto-disables the platform.
On success, resets the counter.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update as sa_update

from src.config import settings
from src.db.connection import async_session
from src.db.models import PlatformCrawlSchedule
from src.utils.logging import get_logger

log = get_logger("resilience.circuit_breaker")


class PlatformCircuitBreaker:
    """Tracks consecutive failures per platform with exponential backoff."""

    def _compute_backoff(self, failure_count: int) -> timedelta:
        """Compute backoff delay: min(base * 2^(n-1), max_delay)."""
        base = settings.circuit_breaker_base_delay_minutes
        max_delay = settings.circuit_breaker_max_delay_minutes
        delay_minutes = min(base * (2 ** (failure_count - 1)), max_delay)
        return timedelta(minutes=delay_minutes)

    async def record_failure(self, platform: str) -> timedelta:
        """Record a failure for a platform. Returns the backoff delay to apply.

        Increments consecutive_failures, sets last_failure_at, computes backoff.
        If max_failures is reached, auto-disables the platform.
        """
        try:
            async with async_session() as session:
                result = await session.execute(
                    select(PlatformCrawlSchedule).where(
                        PlatformCrawlSchedule.platform == platform
                    )
                )
                schedule = result.scalar_one_or_none()
                if not schedule:
                    log.warning("circuit_breaker_no_schedule", platform=platform)
                    return timedelta(minutes=settings.circuit_breaker_base_delay_minutes)

                new_count = schedule.consecutive_failures + 1
                now = datetime.now(timezone.utc)
                backoff = self._compute_backoff(new_count)

                values = {
                    "consecutive_failures": new_count,
                    "last_failure_at": now,
                }

                # Auto-disable after max consecutive failures
                if new_count >= settings.circuit_breaker_max_failures:
                    values["enabled"] = False
                    log.critical(
                        "circuit_breaker_tripped",
                        platform=platform,
                        consecutive_failures=new_count,
                        action="auto_disabled",
                    )

                await session.execute(
                    sa_update(PlatformCrawlSchedule)
                    .where(PlatformCrawlSchedule.platform == platform)
                    .values(**values)
                )
                await session.commit()

                log.info(
                    "circuit_breaker_failure_recorded",
                    platform=platform,
                    consecutive_failures=new_count,
                    backoff_minutes=backoff.total_seconds() / 60,
                )
                return backoff

        except Exception as e:
            log.error("circuit_breaker_record_failure_error", platform=platform, error=repr(e))
            return timedelta(minutes=settings.circuit_breaker_base_delay_minutes)

    async def record_success(self, platform: str) -> None:
        """Record a successful crawl — resets consecutive failure counter."""
        try:
            async with async_session() as session:
                result = await session.execute(
                    sa_update(PlatformCrawlSchedule)
                    .where(
                        PlatformCrawlSchedule.platform == platform,
                        PlatformCrawlSchedule.consecutive_failures > 0,
                    )
                    .values(consecutive_failures=0)
                )
                if result.rowcount > 0:
                    await session.commit()
                    log.info("circuit_breaker_reset", platform=platform)
        except Exception as e:
            log.error("circuit_breaker_record_success_error", platform=platform, error=repr(e))

    async def get_state(self, platform: str) -> dict:
        """Get the current circuit breaker state for a platform."""
        try:
            async with async_session() as session:
                result = await session.execute(
                    select(PlatformCrawlSchedule).where(
                        PlatformCrawlSchedule.platform == platform
                    )
                )
                schedule = result.scalar_one_or_none()
                if not schedule:
                    return {"consecutive_failures": 0, "last_failure_at": None, "tripped": False}

                tripped = schedule.consecutive_failures >= settings.circuit_breaker_max_failures
                next_backoff = None
                if schedule.consecutive_failures > 0:
                    next_backoff = self._compute_backoff(schedule.consecutive_failures).total_seconds() / 60

                return {
                    "consecutive_failures": schedule.consecutive_failures,
                    "last_failure_at": schedule.last_failure_at.isoformat() if schedule.last_failure_at else None,
                    "tripped": tripped,
                    "next_backoff_minutes": next_backoff,
                }
        except Exception as e:
            log.error("circuit_breaker_get_state_error", platform=platform, error=repr(e))
            return {"consecutive_failures": 0, "last_failure_at": None, "tripped": False, "error": str(e)}


circuit_breaker = PlatformCircuitBreaker()
