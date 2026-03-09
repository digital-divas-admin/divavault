"""Resilience notifier: sends degradation alerts and daily digests via logging and ntfy.sh."""

from datetime import datetime, timezone

import aiohttp

from src.config import settings
from src.resilience.models import DegradationEvent
from src.utils.logging import get_logger

log = get_logger("resilience.notifier")


async def _post_to_ntfy(title: str, body: str, priority: str = "default", tags: str = "") -> None:
    """Post a notification to ntfy.sh. No-op if NTFY_TOPIC is not configured."""
    if not settings.ntfy_topic:
        return
    async with aiohttp.ClientSession() as http:
        await http.post(
            f"https://ntfy.sh/{settings.ntfy_topic}",
            data=body,
            headers={
                "Title": title,
                "Priority": priority,
                "Tags": tags,
            },
            timeout=aiohttp.ClientTimeout(total=10),
        )


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

    try:
        await _post_to_ntfy(
            title=f"[{event.severity.upper()}] {event.platform} degradation",
            body=event.symptom,
            priority="high" if event.severity == "critical" else "default",
            tags=f"warning,{event.platform}",
        )
        if settings.ntfy_topic:
            log.info("degradation_ntfy_sent", platform=event.platform, topic=settings.ntfy_topic)
    except Exception as e:
        log.error("degradation_ntfy_error", error=str(e))


async def send_daily_digest(platform_metrics: dict[str, dict], pipeline: dict, match_count: int, issues: list[str]) -> None:
    """Send daily digest summary. Logs always, pushes to ntfy.sh if configured.

    Args:
        platform_metrics: Dict of platform -> {images, faces, status_label}
        pipeline: Dict with pending_detection, pending_matching counts
        match_count: Number of new matches today
        issues: List of issue strings (empty = all clear)
    """
    today = datetime.now(timezone.utc).strftime("%b %-d")
    lines = [f"Scanner Daily Report - {today}", ""]

    for platform, metrics in platform_metrics.items():
        status = metrics.get("status_label", "ok")
        images = metrics.get("images", 0)
        faces = metrics.get("faces", 0)
        lines.append(f"{platform}: {images:,} images, {faces:,} faces ({status})")

    lines.append(f"Pipeline: {pipeline.get('pending_detection', 0)} pending detection, {pipeline.get('pending_matching', 0)} pending matching")
    lines.append(f"Matches: {match_count} new")

    if issues:
        lines.append(f"Status: ATTENTION - {len(issues)} issue(s)")
        for issue in issues:
            lines.append(f"  - {issue}")
    else:
        lines.append("Status: ALL CLEAR")

    body = "\n".join(lines)
    log.info("daily_digest", body=body)

    try:
        await _post_to_ntfy(
            title=f"Scanner Daily Report - {today}",
            body=body,
            priority="high" if issues else "low",
            tags="white_check_mark" if not issues else "warning",
        )
        if settings.ntfy_topic:
            log.info("daily_digest_ntfy_sent", topic=settings.ntfy_topic)
    except Exception as e:
        log.error("daily_digest_ntfy_error", error=str(e))
