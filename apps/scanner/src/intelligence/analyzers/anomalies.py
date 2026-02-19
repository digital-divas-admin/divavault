"""Anomaly Detector: identifies unusual patterns that may indicate emerging threats.

Schedule: every 2 hours
Minimum signals: 20
Detects: volume spikes, face rate shifts, match surges, model drift, new clusters
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from src.db.connection import async_session
from src.intelligence.analyzers.base import BaseAnalyzer
from src.utils.logging import get_logger

log = get_logger("anomaly_detector")

# Thresholds
VOLUME_SPIKE_FACTOR = 5.0      # 5x normal volume = spike
FACE_RATE_SHIFT_THRESHOLD = 0.20  # 20% face_rate change
MATCH_SURGE_THRESHOLD = 10     # 10+ matches from 1 source in 24h
MODEL_DRIFT_ACCURACY = 0.80    # accuracy below this = drift


class AnomalyDetector(BaseAnalyzer):
    """Detects anomalous patterns in crawl/match data."""

    def get_name(self) -> str:
        return "Anomaly Detector"

    def get_schedule_hours(self) -> float:
        return 2.0

    def get_minimum_signals(self) -> int:
        return 20

    async def analyze(self) -> list[dict]:
        alerts = []
        alerts.extend(await self._detect_volume_spikes())
        alerts.extend(await self._detect_face_rate_shift())
        alerts.extend(await self._detect_match_surge())
        alerts.extend(await self._detect_model_drift())

        if alerts:
            log.info("anomalies_detected", count=len(alerts))

        return alerts

    async def _detect_volume_spikes(self) -> list[dict]:
        """Detect tags/sections with 5x normal content volume in last 24h."""
        alerts = []
        async with async_session() as session:
            result = await session.execute(
                text("""
                    WITH recent AS (
                        SELECT platform,
                               count(*) as recent_count
                        FROM discovered_images
                        WHERE discovered_at > now() - interval '24 hours'
                        GROUP BY platform
                    ),
                    baseline AS (
                        SELECT platform,
                               count(*) / GREATEST(
                                   EXTRACT(EPOCH FROM (now() - min(discovered_at))) / 86400, 1
                               ) as daily_avg
                        FROM discovered_images
                        WHERE discovered_at > now() - interval '30 days'
                          AND discovered_at < now() - interval '24 hours'
                        GROUP BY platform
                    )
                    SELECT r.platform, r.recent_count, COALESCE(b.daily_avg, 0) as daily_avg
                    FROM recent r
                    LEFT JOIN baseline b ON r.platform = b.platform
                    WHERE b.daily_avg > 0
                      AND r.recent_count > b.daily_avg * :spike_factor
                """),
                {"spike_factor": VOLUME_SPIKE_FACTOR},
            )
            rows = result.fetchall()

        for row in rows:
            platform, recent, daily_avg = row
            recent = float(recent)
            daily_avg = float(daily_avg)
            spike_ratio = recent / daily_avg if daily_avg > 0 else 0

            alerts.append({
                "rec_type": "anomaly_alert",
                "target_platform": platform,
                "target_entity": f"volume_spike_{platform}",
                "current_value": {"recent_24h": recent, "daily_avg": round(daily_avg, 1)},
                "proposed_value": {"action": "investigate", "type": "volume_spike"},
                "reasoning": (
                    f"Platform '{platform}' discovered {int(recent)} images in the last 24h, "
                    f"which is {spike_ratio:.1f}x the 30-day daily average of {daily_avg:.0f}. "
                    f"This could indicate a new content surge or crawler issue."
                ),
                "expected_impact": "May indicate emerging threat or crawler anomaly",
                "confidence": min(0.95, 0.5 + (spike_ratio - VOLUME_SPIKE_FACTOR) * 0.1),
                "risk_level": "high" if spike_ratio > 10 else "medium",
                "supporting_data": {
                    "platform": platform,
                    "recent_24h": recent,
                    "daily_avg": round(daily_avg, 1),
                    "spike_ratio": round(spike_ratio, 1),
                },
            })

        return alerts

    async def _detect_face_rate_shift(self) -> list[dict]:
        """Detect sections where face_rate changed >20% since last check."""
        alerts = []
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT section_key, platform, section_name, face_rate, total_scanned,
                           total_faces
                    FROM ml_section_profiles
                    WHERE scan_enabled = true
                      AND total_scanned > 100
                      AND face_rate IS NOT NULL
                      AND last_crawl_at > now() - interval '7 days'
                """)
            )
            profiles = result.fetchall()

        for row in profiles:
            section_key, platform, name, face_rate, scanned, faces = row
            face_rate = float(face_rate) if face_rate is not None else None
            scanned = int(scanned) if scanned is not None else None
            if face_rate is None or scanned is None or scanned < 100:
                continue

            # Compare against stored baseline (using ml_platform_maps history)
            async with async_session() as session:
                result = await session.execute(
                    text("""
                        SELECT taxonomy->'sections' as sections
                        FROM ml_platform_maps
                        WHERE platform = :platform
                        ORDER BY snapshot_at DESC
                        OFFSET 1 LIMIT 1
                    """),
                    {"platform": platform},
                )
                prev = result.fetchone()

            if not prev or not prev[0]:
                continue

            # Find this section in previous snapshot
            prev_sections = prev[0] if isinstance(prev[0], list) else []
            prev_section = next((s for s in prev_sections if s.get("section_id") == section_key), None)
            if not prev_section:
                continue

            prev_content = prev_section.get("total_content", 0)
            if prev_content > 0 and scanned > 0:
                # Check if face_rate shifted significantly
                growth_ratio = scanned / prev_content if prev_content > 0 else 0
                if growth_ratio > 2.0:  # Content doubled
                    alerts.append({
                        "rec_type": "anomaly_alert",
                        "target_platform": platform,
                        "target_entity": section_key,
                        "current_value": {"face_rate": float(face_rate), "total_scanned": scanned},
                        "proposed_value": {"action": "investigate", "type": "face_rate_shift"},
                        "reasoning": (
                            f"Section '{name}' on {platform} has grown {growth_ratio:.1f}x "
                            f"with face_rate={float(face_rate):.1%}. "
                            f"Rapid content growth may indicate new uploaders or bot activity."
                        ),
                        "expected_impact": "May indicate new threat actor or content trend",
                        "confidence": min(0.85, 0.4 + growth_ratio * 0.1),
                        "risk_level": "medium",
                        "supporting_data": {
                            "section": section_key,
                            "platform": platform,
                            "face_rate": round(float(face_rate), 4),
                            "total_scanned": scanned,
                            "growth_ratio": round(growth_ratio, 1),
                        },
                    })

        return alerts

    async def _detect_match_surge(self) -> list[dict]:
        """Detect >10 matches from a single source/account in 24h."""
        alerts = []
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT di.page_url, di.platform, count(DISTINCT m.id) as match_count,
                           count(DISTINCT m.contributor_id) as contributor_count
                    FROM matches m
                    JOIN discovered_images di ON m.discovered_image_id = di.id
                    WHERE m.created_at > now() - interval '24 hours'
                      AND di.page_url IS NOT NULL
                    GROUP BY di.page_url, di.platform
                    HAVING count(DISTINCT m.id) >= :threshold
                    ORDER BY count(DISTINCT m.id) DESC
                    LIMIT 10
                """),
                {"threshold": MATCH_SURGE_THRESHOLD},
            )
            rows = result.fetchall()

        for row in rows:
            page_url, platform, match_count, contributor_count = row
            # Extract account/username from URL if possible
            account = self._extract_account(page_url, platform)

            alerts.append({
                "rec_type": "anomaly_alert",
                "target_platform": platform or "unknown",
                "target_entity": account or page_url[:100],
                "current_value": {"match_count": match_count, "contributors_affected": contributor_count},
                "proposed_value": {"action": "investigate", "type": "match_surge"},
                "reasoning": (
                    f"Source '{account or page_url[:60]}' on {platform or 'unknown'} generated "
                    f"{match_count} matches affecting {contributor_count} contributors in 24h. "
                    f"This may indicate a hostile account mass-producing deepfakes."
                ),
                "expected_impact": "Potential hostile account requiring immediate review",
                "confidence": min(0.95, 0.6 + match_count * 0.02),
                "risk_level": "high",
                "supporting_data": {
                    "page_url": page_url,
                    "platform": platform,
                    "match_count": match_count,
                    "contributor_count": contributor_count,
                    "account": account,
                },
            })

        return alerts

    async def _detect_model_drift(self) -> list[dict]:
        """Detect when ML model accuracy drops below threshold."""
        alerts = []
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT model_name, version, metrics
                    FROM ml_model_state
                    WHERE metrics IS NOT NULL
                    ORDER BY model_name, version DESC
                """)
            )
            rows = result.fetchall()

        # Group by model, check latest version's metrics
        seen_models = set()
        for row in rows:
            model_name, version, metrics = row
            if model_name in seen_models:
                continue
            seen_models.add(model_name)

            if not metrics:
                continue

            accuracy = metrics.get("accuracy") or metrics.get("auc") or metrics.get("precision")
            if accuracy is not None and accuracy < MODEL_DRIFT_ACCURACY:
                alerts.append({
                    "rec_type": "anomaly_alert",
                    "target_platform": None,
                    "target_entity": model_name,
                    "current_value": {"accuracy": accuracy, "version": version},
                    "proposed_value": {"action": "retrain", "type": "model_drift"},
                    "reasoning": (
                        f"Model '{model_name}' v{version} accuracy has dropped to {accuracy:.2f}, "
                        f"below the {MODEL_DRIFT_ACCURACY} threshold. "
                        f"The model may need retraining with recent feedback signals."
                    ),
                    "expected_impact": "Degraded detection quality until model is retrained",
                    "confidence": 0.9,
                    "risk_level": "high",
                    "supporting_data": {
                        "model_name": model_name,
                        "version": version,
                        "accuracy": accuracy,
                        "threshold": MODEL_DRIFT_ACCURACY,
                        "full_metrics": metrics,
                    },
                })

        return alerts

    @staticmethod
    def _extract_account(url: str | None, platform: str | None) -> str | None:
        """Try to extract an account/username from a page URL."""
        if not url:
            return None
        import re
        if platform == "deviantart":
            m = re.search(r'deviantart\.com/([^/]+)', url)
            return m.group(1) if m else None
        if platform == "civitai":
            m = re.search(r'civitai\.com/user/([^/]+)', url)
            return m.group(1) if m else None
        return None
