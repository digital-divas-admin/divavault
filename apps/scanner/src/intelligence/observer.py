"""ML Observer: buffers pipeline events and batch-flushes to ml_feedback_signals.

The observer is purely additive — it never affects pipeline behavior.
All methods are wrapped in try/except so observer failures cannot break the scanner.

Usage:
    from src.intelligence.observer import observer

    await observer.emit("crawl_completed", "platform", "civitai", {
        "total_discovered": 150,
        "new_inserted": 42,
    })
"""

import time
from datetime import datetime, timezone

from sqlalchemy import text

from src.utils.logging import get_logger

log = get_logger("ml_observer")

FLUSH_INTERVAL = 30  # seconds between time-based flushes
FLUSH_THRESHOLD = 50  # buffer size trigger
MAX_BUFFER_SIZE = 500  # cap to prevent memory leak on persistent DB failures

_INSERT_SQL = text("""
    INSERT INTO ml_feedback_signals (signal_type, entity_type, entity_id, context, actor)
    VALUES (:signal_type, :entity_type, :entity_id, :context, :actor)
""")


class Observer:
    """Buffers ML feedback signals and batch-flushes them to the database."""

    def __init__(self) -> None:
        self._buffer: list[dict] = []
        self._last_flush: float = time.monotonic()

    @property
    def buffer_size(self) -> int:
        return len(self._buffer)

    async def emit(
        self,
        signal_type: str,
        entity_type: str,
        entity_id: str,
        context: dict | None = None,
        actor: str = "system",
    ) -> None:
        """Append a signal to the buffer. Auto-flushes if threshold/interval reached.

        Never raises — all errors are logged and swallowed.
        """
        try:
            import json

            self._buffer.append({
                "signal_type": signal_type,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "context": json.dumps(context or {}),
                "actor": actor,
            })

            # Auto-flush on threshold or interval
            elapsed = time.monotonic() - self._last_flush
            if len(self._buffer) >= FLUSH_THRESHOLD or elapsed >= FLUSH_INTERVAL:
                await self.flush()

            # Hard cap to prevent memory leak
            if len(self._buffer) > MAX_BUFFER_SIZE:
                log.warning("observer_buffer_overflow", dropped=len(self._buffer) - MAX_BUFFER_SIZE)
                self._buffer = self._buffer[-MAX_BUFFER_SIZE:]

        except Exception as e:
            log.error("observer_emit_error", error=str(e))

    async def flush(self) -> None:
        """Batch insert buffered signals into ml_feedback_signals.

        On failure: logs error, keeps signals in buffer for retry.
        On success: clears buffer, updates last flush time.
        """
        if not self._buffer:
            self._last_flush = time.monotonic()
            return

        batch = list(self._buffer)
        try:
            from src.db.connection import async_session

            async with async_session() as session:
                for params in batch:
                    await session.execute(_INSERT_SQL, params)
                await session.commit()

            # Success — clear flushed signals
            self._buffer = self._buffer[len(batch):]
            self._last_flush = time.monotonic()
            log.info("observer_flush", flushed=len(batch), remaining=len(self._buffer))

        except Exception as e:
            log.error("observer_flush_error", error=str(e), buffered=len(self._buffer))
            # Signals stay in buffer for retry on next flush

    async def shutdown(self) -> None:
        """Final flush on shutdown."""
        log.info("observer_shutdown", buffered=len(self._buffer))
        await self.flush()


# Module-level singleton
observer = Observer()
