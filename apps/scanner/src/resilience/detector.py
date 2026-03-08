"""Degradation detector: compares crawl snapshots against baselines to detect anomalies."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select

from src.config import settings
from src.db.connection import async_session
from src.resilience.models import CrawlHealthSnapshot, DegradationEvent
from src.utils.logging import get_logger

log = get_logger("resilience.detector")


class DegradationDetector:
    """Detects crawl degradation by comparing latest snapshot against baseline."""

    async def check(
        self,
        platform: str,
        latest_snapshot: CrawlHealthSnapshot,
        baseline: dict,
    ) -> list[DegradationEvent]:
        """Check for degradation signals. Returns list of new events created."""
        events: list[DegradationEvent] = []

        try:
            # 1. Total failure -- zero discovered when baseline says > 10
            if latest_snapshot.images_discovered == 0 and baseline["avg_discovered"] > 10:
                event = await self._create_event_if_new(
                    platform=platform,
                    degradation_type="total_failure",
                    severity="critical",
                    symptom=f"Zero images discovered (baseline avg: {baseline['avg_discovered']:.0f})",
                    baseline_value=baseline["avg_discovered"],
                    current_value=0,
                    deviation_pct=-100.0,
                    snapshot_id=latest_snapshot.id,
                )
                if event:
                    events.append(event)

            # 2. Yield collapse -- new images well below baseline
            elif baseline["avg_new"] > 0 and latest_snapshot.images_new is not None:
                ratio = latest_snapshot.images_new / baseline["avg_new"]
                if ratio < settings.resilience_yield_critical:
                    severity = "critical"
                elif ratio < settings.resilience_yield_warning:
                    severity = "warning"
                else:
                    severity = None

                if severity:
                    deviation = (ratio - 1.0) * 100
                    event = await self._create_event_if_new(
                        platform=platform,
                        degradation_type="yield_collapse",
                        severity=severity,
                        symptom=f"New images at {ratio:.0%} of baseline ({latest_snapshot.images_new} vs avg {baseline['avg_new']:.0f})",
                        baseline_value=baseline["avg_new"],
                        current_value=float(latest_snapshot.images_new),
                        deviation_pct=round(deviation, 1),
                        snapshot_id=latest_snapshot.id,
                    )
                    if event:
                        events.append(event)

            # 3. Download failure spike
            if (
                latest_snapshot.images_discovered > 0
                and latest_snapshot.download_failures > 0
                and (latest_snapshot.download_failures / latest_snapshot.images_discovered) > 0.5
            ):
                failure_rate = latest_snapshot.download_failures / latest_snapshot.images_discovered
                event = await self._create_event_if_new(
                    platform=platform,
                    degradation_type="download_failure_spike",
                    severity="warning",
                    symptom=f"Download failure rate {failure_rate:.0%} ({latest_snapshot.download_failures}/{latest_snapshot.images_discovered})",
                    baseline_value=baseline.get("avg_failures", 0),
                    current_value=float(latest_snapshot.download_failures),
                    deviation_pct=round(failure_rate * 100, 1),
                    snapshot_id=latest_snapshot.id,
                )
                if event:
                    events.append(event)

            # 4. Error message present
            if latest_snapshot.error_message:
                event = await self._create_event_if_new(
                    platform=platform,
                    degradation_type="crawl_error",
                    severity="warning",
                    symptom=f"Crawl error: {latest_snapshot.error_message[:200]}",
                    baseline_value=None,
                    current_value=None,
                    deviation_pct=None,
                    snapshot_id=latest_snapshot.id,
                )
                if event:
                    events.append(event)

        except Exception as e:
            log.error("degradation_check_error", platform=platform, error=str(e))

        return events

    async def _create_event_if_new(
        self,
        platform: str,
        degradation_type: str,
        severity: str,
        symptom: str,
        baseline_value: float | None,
        current_value: float | None,
        deviation_pct: float | None,
        snapshot_id: UUID,
    ) -> DegradationEvent | None:
        """Create a degradation event if no open/diagnosed event of same type exists."""
        try:
            async with async_session() as session:
                existing = await session.execute(
                    select(DegradationEvent.id)
                    .where(
                        and_(
                            DegradationEvent.platform == platform,
                            DegradationEvent.degradation_type == degradation_type,
                            DegradationEvent.status.in_(["open", "diagnosed"]),
                        )
                    )
                    .limit(1)
                )
                if existing.scalar_one_or_none() is not None:
                    return None

                event = DegradationEvent(
                    platform=platform,
                    degradation_type=degradation_type,
                    severity=severity,
                    symptom=symptom,
                    baseline_value=baseline_value,
                    current_value=current_value,
                    deviation_pct=deviation_pct,
                    snapshot_id=snapshot_id,
                    status="open",
                )
                session.add(event)
                await session.flush()
                event_id = event.id
                await session.commit()

            log.warning(
                "degradation_detected",
                platform=platform,
                type=degradation_type,
                severity=severity,
                symptom=symptom,
            )
            return event
        except Exception as e:
            log.error("create_event_error", platform=platform, error=str(e))
            return None


degradation_detector = DegradationDetector()
