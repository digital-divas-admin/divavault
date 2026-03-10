"""Resilience tick: orchestrates the full detection -> diagnosis -> patch -> promote cycle."""

from sqlalchemy import exists, select

from src.config import settings
from src.db.connection import async_session
from src.resilience.baseline import baseline_calculator
from src.resilience.constants import MONITORED_PLATFORMS
from src.resilience.detector import degradation_detector
from src.resilience.models import CrawlHealthSnapshot, CrawlerPatch, DegradationEvent
from src.resilience.notifier import notify_degradation
from src.utils.logging import get_logger

log = get_logger("resilience.tick")


async def resilience_tick(tick_number: int) -> None:
    """Run one resilience cycle. Never raises -- all errors handled internally."""
    if not settings.resilience_enabled:
        return

    for platform in MONITORED_PLATFORMS:
        try:
            await _check_platform(platform, tick_number)
        except Exception as e:
            log.error("resilience_platform_error", platform=platform, error=str(e))


async def _check_platform(platform: str, tick_number: int) -> None:
    """Run resilience checks for a single platform."""

    # 1. Get latest snapshot
    async with async_session() as session:
        result = await session.execute(
            select(CrawlHealthSnapshot)
            .where(CrawlHealthSnapshot.platform == platform)
            .order_by(CrawlHealthSnapshot.created_at.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()

    if not latest:
        return

    # 2a. Consecutive failure check (no baseline needed)
    events: list[DegradationEvent] = []
    try:
        events += await degradation_detector.check_consecutive_failures(platform)
    except Exception as e:
        log.error("consecutive_failure_check_error", platform=platform, error=str(e))

    # 2b. Prolonged outage check (no baseline needed)
    try:
        outage = await degradation_detector.check_prolonged_outage(platform)
        if outage:
            events.append(outage)
    except Exception as e:
        log.error("prolonged_outage_check_error", platform=platform, error=str(e))

    # 3. Get baseline for standard checks
    baseline = await baseline_calculator.get_baseline(platform)
    if baseline:
        # 4. Run baseline-dependent degradation checks
        events += await degradation_detector.check(platform, latest, baseline)

    # Notify on new events (with failure count for escalation)
    for event in events:
        try:
            failure_count = None
            if event.degradation_type == "consecutive_failures" and event.current_value:
                failure_count = int(event.current_value)
            await notify_degradation(event, failure_count=failure_count)
        except Exception as e:
            log.error("notify_error", event_id=str(event.id), error=str(e))

    # 4. Diagnose undiagnosed events (limit 1 per tick to avoid overload)
    try:
        async with async_session() as session:
            result = await session.execute(
                select(DegradationEvent)
                .where(DegradationEvent.platform == platform)
                .where(DegradationEvent.status == "open")
                .order_by(DegradationEvent.created_at.asc())
                .limit(1)
            )
            undiagnosed = result.scalar_one_or_none()

        if undiagnosed and settings.resilience_claude_enabled:
            from src.resilience.diagnosis import diagnosis_engine
            await diagnosis_engine.diagnose(undiagnosed.id)
    except Exception as e:
        log.error("diagnosis_tick_error", platform=platform, error=str(e))

    # 5. Generate patches for diagnosed events without patches
    if settings.resilience_auto_patch:
        try:
            async with async_session() as session:
                result = await session.execute(
                    select(DegradationEvent)
                    .where(DegradationEvent.platform == platform)
                    .where(DegradationEvent.status == "diagnosed")
                    .where(
                        ~exists(
                            select(CrawlerPatch.id).where(
                                CrawlerPatch.degradation_event_id == DegradationEvent.id
                            )
                        )
                    )
                    .order_by(DegradationEvent.created_at.asc())
                    .limit(1)
                )
                needs_patch = result.scalar_one_or_none()

            if needs_patch:
                from src.resilience.patcher import patch_generator
                import json
                diagnosis_data = None
                if needs_patch.diagnosis:
                    try:
                        diagnosis_data = json.loads(needs_patch.diagnosis)
                    except (json.JSONDecodeError, TypeError):
                        diagnosis_data = {"root_cause": needs_patch.root_cause or "UNKNOWN"}
                await patch_generator.generate(needs_patch, diagnosis_data)
        except Exception as e:
            log.error("patch_gen_tick_error", platform=platform, error=str(e))

    # 6. Promote draft patches through pipeline
    try:
        async with async_session() as session:
            result = await session.execute(
                select(CrawlerPatch)
                .where(CrawlerPatch.platform == platform)
                .where(CrawlerPatch.status.in_(["draft", "sandbox", "canary"]))
                .order_by(CrawlerPatch.created_at.asc())
                .limit(1)
            )
            promotable = result.scalar_one_or_none()

        if promotable:
            from src.resilience.promoter import patch_promoter
            await patch_promoter.promote(promotable)
    except Exception as e:
        log.error("promote_tick_error", platform=platform, error=str(e))
