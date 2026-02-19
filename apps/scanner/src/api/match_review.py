"""Match review signal emission for ML feedback loop."""

from uuid import UUID
from src.intelligence.observer import observer
from src.utils.logging import get_logger

log = get_logger("match_review")


async def emit_match_review_signal(
    match_id: UUID,
    status: str,
    reviewer: str = "admin",
) -> None:
    """Emit ML feedback signal when a match is reviewed.

    Called from the Next.js admin API when match status changes.

    Args:
        match_id: The match ID being reviewed
        status: New status - "confirmed", "rejected", "dismissed"
        reviewer: Who reviewed (default "admin")
    """
    signal_type = {
        "confirmed": "match_confirmed",
        "rejected": "match_dismissed",
        "dismissed": "match_dismissed",
    }.get(status)

    if not signal_type:
        log.warning("unknown_review_status", status=status, match_id=str(match_id))
        return

    await observer.emit(
        signal_type=signal_type,
        entity_type="match",
        entity_id=str(match_id),
        context={
            "status": status,
            "reviewer": reviewer,
        },
        actor=reviewer,
    )

    # Force flush so signal is immediately available
    await observer.flush()

    log.info("match_review_signal_emitted", match_id=str(match_id), signal_type=signal_type)
