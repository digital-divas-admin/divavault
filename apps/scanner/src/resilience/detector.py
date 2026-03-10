"""Degradation detector: compares crawl snapshots against baselines to detect anomalies."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, select

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

    async def check_consecutive_failures(self, platform: str) -> list[DegradationEvent]:
        """Check if last N snapshots all have errors. No baseline needed."""
        events: list[DegradationEvent] = []
        try:
            critical_threshold = settings.resilience_consecutive_failure_critical
            warning_threshold = settings.resilience_consecutive_failure_warning

            async with async_session() as session:
                result = await session.execute(
                    select(CrawlHealthSnapshot.id, CrawlHealthSnapshot.error_message)
                    .where(CrawlHealthSnapshot.platform == platform)
                    .order_by(CrawlHealthSnapshot.created_at.desc())
                    .limit(critical_threshold)
                )
                recent = result.all()

            if len(recent) < warning_threshold:
                return events

            # The first row is the most recent snapshot
            snapshot_id = recent[0][0]

            # Count consecutive errors from most recent
            consecutive_errors = 0
            for row in recent:
                if row[1] is not None:  # error_message is not null
                    consecutive_errors += 1
                else:
                    break

            if consecutive_errors >= critical_threshold:
                severity = "critical"
            elif consecutive_errors >= warning_threshold:
                severity = "warning"
            else:
                return events

            event = await self._create_event_if_new(
                platform=platform,
                degradation_type="consecutive_failures",
                severity=severity,
                symptom=f"{consecutive_errors} consecutive crawl failures",
                baseline_value=None,
                current_value=float(consecutive_errors),
                deviation_pct=None,
                snapshot_id=snapshot_id,
            )
            if event:
                events.append(event)

        except Exception as e:
            log.error("consecutive_failure_check_error", platform=platform, error=str(e))

        return events

    async def check_prolonged_outage(self, platform: str) -> DegradationEvent | None:
        """Check if no successful crawl within X hours. No baseline needed."""
        try:
            outage_hours = settings.resilience_prolonged_outage_hours
            cutoff = datetime.now(timezone.utc) - timedelta(hours=outage_hours)

            async with async_session() as session:
                # Find most recent successful snapshot (no error)
                result = await session.execute(
                    select(CrawlHealthSnapshot.created_at)
                    .where(
                        and_(
                            CrawlHealthSnapshot.platform == platform,
                            CrawlHealthSnapshot.error_message.is_(None),
                        )
                    )
                    .order_by(CrawlHealthSnapshot.created_at.desc())
                    .limit(1)
                )
                last_success = result.scalar_one_or_none()

                # Get latest snapshot ID (any status) + existence check in one query
                latest_q = await session.execute(
                    select(CrawlHealthSnapshot.id)
                    .where(CrawlHealthSnapshot.platform == platform)
                    .order_by(CrawlHealthSnapshot.created_at.desc())
                    .limit(1)
                )
                snapshot_id = latest_q.scalar_one_or_none()

            if not snapshot_id:
                return None  # No data yet

            if last_success is not None and last_success >= cutoff:
                return None  # Recent success exists

            # Either no success ever, or last success is too old
            if last_success:
                hours_ago = (datetime.now(timezone.utc) - last_success).total_seconds() / 3600
                symptom = f"No successful crawl in {hours_ago:.0f}h (threshold: {outage_hours}h)"
            else:
                hours_ago = None
                symptom = f"No successful crawl ever recorded (threshold: {outage_hours}h)"

            return await self._create_event_if_new(
                platform=platform,
                degradation_type="prolonged_outage",
                severity="critical",
                symptom=symptom,
                baseline_value=float(outage_hours),
                current_value=float(hours_ago) if hours_ago is not None else None,
                deviation_pct=None,
                snapshot_id=snapshot_id,
            )

        except Exception as e:
            log.error("prolonged_outage_check_error", platform=platform, error=str(e))
            return None

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
