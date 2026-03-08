"""Resilience notifier: sends degradation alerts via logging and ntfy.sh."""

import aiohttp

from src.config import settings
from src.resilience.models import DegradationEvent
from src.utils.logging import get_logger

log = get_logger("resilience.notifier")


async def notify_degradation(event: DegradationEvent) -> None:
    """Send degradation alert. Logs always, pushes to ntfy.sh if configured."""
    log.warning(
        "degradation_alert",
        platform=event.platform,
        severity=event.severity,
        type=event.degradation_type,
        symptom=event.symptom,
        event_id=str(event.id),
    )

    # ntfy.sh push (optional)
    if settings.ntfy_topic:
        try:
            async with aiohttp.ClientSession() as http:
                await http.post(
                    f"https://ntfy.sh/{settings.ntfy_topic}",
                    data=event.symptom,
                    headers={
                        "Title": f"[{event.severity.upper()}] {event.platform} degradation",
                        "Priority": "high" if event.severity == "critical" else "default",
                        "Tags": f"warning,{event.platform}",
                    },
                    timeout=aiohttp.ClientTimeout(total=10),
                )
            log.info("degradation_ntfy_sent", platform=event.platform, topic=settings.ntfy_topic)
        except Exception as e:
            log.error("degradation_ntfy_error", error=str(e))
