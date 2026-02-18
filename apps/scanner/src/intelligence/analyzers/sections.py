"""Section Ranker: computes ML priority scores for platform sections.

Schedule: daily (every 24 hours)
Minimum signals: 30 (crawl_completed signals, indicating enough crawl history)
Model: weighted scoring function
"""

from datetime import datetime, timezone

import numpy as np
from sqlalchemy import func, select, text

from src.db.connection import async_session
from src.db.models import MLFeedbackSignal, MLPlatformMap, MLSectionProfile
from src.intelligence.analyzers.base import BaseAnalyzer
from src.utils.logging import get_logger

log = get_logger("section_ranker")

# Risk keyword scoring
HIGH_RISK_KEYWORDS = ["real person", "celebrity", "deepfake", "nsfw", "instagram", "influencer"]
MEDIUM_RISK_KEYWORDS = ["portrait", "face", "photorealistic", "face edit"]
LOW_RISK_KEYWORDS = ["anime", "style", "concept", "traditional", "cartoon", "illustration", "fantasy"]

# Priority to risk level mapping
PRIORITY_TO_RISK = [
    (0.8, "critical"),
    (0.6, "high"),
    (0.3, "medium"),
    (0.1, "low"),
]

# Priority to AI recommendation
PRIORITY_TO_REC = [
    (0.7, "scan"),
    (0.15, "optional"),
]


def risk_keyword_score(section_name: str) -> float:
    """Score a section name based on risk keywords."""
    name_lower = (section_name or "").lower()
    for kw in HIGH_RISK_KEYWORDS:
        if kw in name_lower:
            return 1.0
    for kw in MEDIUM_RISK_KEYWORDS:
        if kw in name_lower:
            return 0.7
    for kw in LOW_RISK_KEYWORDS:
        if kw in name_lower:
            return 0.0
    return 0.3


def normalize_values(values: list[float]) -> list[float]:
    """Normalize values to 0-1 range. Returns 0s if all values are equal."""
    if not values:
        return []
    arr = np.array(values, dtype=float)
    vmin, vmax = arr.min(), arr.max()
    if vmax == vmin:
        return [0.5] * len(values)
    return ((arr - vmin) / (vmax - vmin)).tolist()


def jaccard_similarity(a: str, b: str) -> float:
    """Simple word-level Jaccard similarity between two strings."""
    tokens_a = set(a.lower().split())
    tokens_b = set(b.lower().split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


class SectionRanker(BaseAnalyzer):
    """Computes ML priority scores for platform sections."""

    def get_name(self) -> str:
        return "Section Ranker"

    def get_schedule_hours(self) -> float:
        return 24.0

    def get_minimum_signals(self) -> int:
        return 30

    async def analyze(self) -> list[dict]:
        # 1. Load all section profiles
        sections = await self._load_sections()
        if not sections:
            log.info("section_ranker_skip", reason="no_sections")
            return []

        # 2. Load content velocity data
        velocity_map = await self._compute_content_velocity(sections)

        # 3. Load match/confirmed stats from signals
        stats_map = await self._load_match_stats()

        # 4. Compute priorities for scanned sections
        scanned = [s for s in sections if s.total_scanned and s.total_scanned > 0]
        unscanned = [s for s in sections if not s.total_scanned or s.total_scanned == 0]

        scored_sections = []
        if scanned:
            scored_sections = self._score_scanned_sections(scanned, velocity_map, stats_map)

        # 5. Score unscanned sections by similarity to scored sections
        if unscanned and scored_sections:
            self._score_unscanned_sections(unscanned, scored_sections)

        # 6. Update all section profiles in DB
        await self._update_section_profiles(scanned + unscanned)

        # 7. Generate recommendations
        recommendations = self._generate_recommendations(sections)

        log.info(
            "section_ranker_complete",
            total_sections=len(sections),
            scanned=len(scanned),
            unscanned=len(unscanned),
            recommendations=len(recommendations),
        )

        return recommendations

    async def _load_sections(self) -> list[MLSectionProfile]:
        """Load all section profiles."""
        async with async_session() as session:
            result = await session.execute(
                select(MLSectionProfile).order_by(MLSectionProfile.platform, MLSectionProfile.section_key)
            )
            return list(result.scalars().all())

    async def _compute_content_velocity(self, sections: list[MLSectionProfile]) -> dict[str, float]:
        """Compute content velocity: change in total_content since last map snapshot."""
        velocity = {}
        platforms = set(s.platform for s in sections if s.platform)

        for platform in platforms:
            async with async_session() as session:
                result = await session.execute(
                    select(MLPlatformMap.taxonomy)
                    .where(MLPlatformMap.platform == platform)
                    .order_by(MLPlatformMap.snapshot_at.desc())
                    .limit(2)
                )
                maps = result.scalars().all()

            if len(maps) < 2:
                continue

            current_taxonomy = maps[0] or {}
            previous_taxonomy = maps[1] or {}

            current_sections = current_taxonomy.get("sections", [])
            previous_sections = previous_taxonomy.get("sections", [])

            prev_by_id = {s.get("section_id"): s.get("total_content", 0) for s in previous_sections}

            for s in current_sections:
                sid = s.get("section_id")
                if sid:
                    current_count = s.get("total_content", 0)
                    prev_count = prev_by_id.get(sid, current_count)
                    velocity[sid] = max(0, current_count - prev_count)

        return velocity

    async def _load_match_stats(self) -> dict[str, dict]:
        """Load match/confirmed/dismissed counts from signals grouped by platform."""
        stats: dict[str, dict] = {}
        async with async_session() as session:
            result = await session.execute(
                select(MLFeedbackSignal)
                .where(MLFeedbackSignal.signal_type.in_([
                    "match_found", "match_confirmed", "match_dismissed",
                ]))
            )
            rows = result.scalars().all()

        for row in rows:
            ctx = row.context or {}
            platform = ctx.get("platform", "unknown")
            if platform not in stats:
                stats[platform] = {"matches": 0, "confirmed": 0, "dismissed": 0}
            if row.signal_type == "match_found":
                stats[platform]["matches"] += 1
            elif row.signal_type == "match_confirmed":
                stats[platform]["confirmed"] += 1
            elif row.signal_type == "match_dismissed":
                stats[platform]["dismissed"] += 1

        return stats

    def _score_scanned_sections(
        self,
        sections: list[MLSectionProfile],
        velocity_map: dict[str, float],
        stats_map: dict[str, dict],
    ) -> list[tuple[MLSectionProfile, float]]:
        """Compute priority scores for sections with scan data."""
        # Collect raw values for normalization
        face_rates = [s.face_rate or 0.0 for s in sections]
        match_rates = []
        confirmed_rates = []
        velocities = []

        for s in sections:
            # match_rate = total_matches / total_faces (estimate from signals)
            platform_stats = stats_map.get(s.platform, {})
            total_matches = platform_stats.get("matches", 0)
            total_faces = s.total_faces or 0
            match_rate = total_matches / total_faces if total_faces > 0 else 0.0
            match_rates.append(match_rate)

            # confirmed_rate from signals
            confirmed = platform_stats.get("confirmed", 0)
            dismissed = platform_stats.get("dismissed", 0)
            total_reviews = confirmed + dismissed
            confirmed_rate = confirmed / total_reviews if total_reviews > 0 else 0.5
            confirmed_rates.append(confirmed_rate)

            # content velocity
            vel = velocity_map.get(s.section_id, 0.0)
            velocities.append(vel)

        # Normalize
        norm_face = normalize_values(face_rates)
        norm_match = normalize_values(match_rates)
        norm_confirmed = normalize_values(confirmed_rates)
        norm_velocity = normalize_values(velocities)

        scored = []
        for i, s in enumerate(sections):
            keyword_score = risk_keyword_score(s.section_name or s.section_key)
            priority = (
                0.30 * norm_face[i]
                + 0.25 * norm_match[i]
                + 0.20 * norm_confirmed[i]
                + 0.15 * keyword_score
                + 0.10 * norm_velocity[i]
            )
            s._computed_priority = round(priority, 4)
            s._computed_confidence = 0.7  # observed data
            scored.append((s, priority))

        return scored

    def _score_unscanned_sections(
        self,
        unscanned: list[MLSectionProfile],
        scored: list[tuple[MLSectionProfile, float]],
    ) -> None:
        """Score unscanned sections by text similarity to scored sections."""
        for section in unscanned:
            name = section.section_name or section.section_key or ""
            similarities = []
            for scored_section, priority in scored:
                scored_name = scored_section.section_name or scored_section.section_key or ""
                sim = jaccard_similarity(name, scored_name)
                similarities.append((sim, priority))

            # Top-3 most similar
            similarities.sort(key=lambda x: x[0], reverse=True)
            top3 = similarities[:3]

            if top3 and any(s > 0 for s, _ in top3):
                total_weight = sum(s for s, _ in top3)
                weighted_avg = sum(s * p for s, p in top3) / total_weight if total_weight > 0 else 0.5
                section._computed_priority = round(weighted_avg, 4)
            else:
                # Fallback: use keyword score
                section._computed_priority = round(risk_keyword_score(name) * 0.5, 4)

            section._computed_confidence = 0.3  # predicted, not observed

    async def _update_section_profiles(self, sections: list[MLSectionProfile]) -> None:
        """Update ml_priority, ml_risk_level, ai_recommendation, ai_reason for all sections."""
        async with async_session() as session:
            for s in sections:
                priority = getattr(s, "_computed_priority", 0.5)
                confidence = getattr(s, "_computed_confidence", 0.5)

                # Determine risk level
                risk_level = "none"
                for threshold, level in PRIORITY_TO_RISK:
                    if priority > threshold:
                        risk_level = level
                        break

                # Determine AI recommendation
                if priority > 0.7:
                    ai_rec = "scan"
                elif priority >= 0.15:
                    ai_rec = "optional"
                else:
                    ai_rec = "skip"

                # Build reason
                keyword_score = risk_keyword_score(s.section_name or s.section_key)
                face_info = f"face_rate={s.face_rate:.2f}" if s.face_rate else "no scan data"
                reason = (
                    f"Priority {priority:.2f} (risk_keywords={keyword_score:.1f}, "
                    f"{face_info}, confidence={confidence:.1f}). "
                    f"Recommendation: {ai_rec}"
                )

                # Update via raw SQL to avoid detached instance issues
                await session.execute(
                    text("""
                        UPDATE ml_section_profiles
                        SET ml_priority = :priority,
                            ml_risk_level = :risk_level,
                            ai_recommendation = :ai_rec,
                            ai_reason = :reason,
                            confidence = :confidence,
                            last_updated_at = :now
                        WHERE id = :id
                    """),
                    {
                        "priority": priority,
                        "risk_level": risk_level,
                        "ai_rec": ai_rec,
                        "reason": reason,
                        "confidence": confidence,
                        "now": datetime.now(timezone.utc),
                        "id": str(s.id),
                    },
                )
            await session.commit()

    def _generate_recommendations(self, sections: list[MLSectionProfile]) -> list[dict]:
        """Generate section toggle recommendations."""
        recommendations = []

        for s in sections:
            priority = getattr(s, "_computed_priority", 0.5)

            # Skip human-overridden sections
            if s.human_override:
                continue

            # High-priority disabled section
            if priority > 0.7 and not s.scan_enabled:
                recommendations.append({
                    "rec_type": "section_toggle",
                    "target_platform": s.platform,
                    "target_entity": s.section_id or s.section_key,
                    "current_value": {"scan_enabled": False},
                    "proposed_value": {"scan_enabled": True},
                    "reasoning": (
                        f"Section '{s.section_name or s.section_key}' has high ML priority "
                        f"({priority:.2f}) based on face rate ({s.face_rate:.2f}), "
                        f"keyword risk signals, and similarity to productive sections. "
                        f"Enabling scanning is recommended."
                    ),
                    "expected_impact": f"New content source with priority {priority:.2f}",
                    "confidence": min(0.9, priority),
                    "risk_level": "low",
                    "supporting_data": {
                        "section_id": s.section_id or s.section_key,
                        "platform": s.platform,
                        "ml_priority": priority,
                        "face_rate": s.face_rate,
                        "total_content": s.total_content,
                        "total_scanned": s.total_scanned,
                    },
                })

            # Low-priority enabled section
            elif priority < 0.15 and s.scan_enabled:
                recommendations.append({
                    "rec_type": "section_toggle",
                    "target_platform": s.platform,
                    "target_entity": s.section_id or s.section_key,
                    "current_value": {"scan_enabled": True},
                    "proposed_value": {"scan_enabled": False},
                    "reasoning": (
                        f"Section '{s.section_name or s.section_key}' has very low ML priority "
                        f"({priority:.2f}) with low face rate ({s.face_rate:.2f}) and no "
                        f"significant match activity. Disabling saves crawl resources."
                    ),
                    "expected_impact": f"Saves crawl resources; section priority is {priority:.2f}",
                    "confidence": min(0.85, 1.0 - priority),
                    "risk_level": "low",
                    "supporting_data": {
                        "section_id": s.section_id or s.section_key,
                        "platform": s.platform,
                        "ml_priority": priority,
                        "face_rate": s.face_rate,
                        "total_content": s.total_content,
                        "total_scanned": s.total_scanned,
                    },
                })

        return recommendations
