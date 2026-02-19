"""Recommender: orchestrates when analyzers run and stores their recommendations.

Called from the scheduler loop. Runs due analyzers, inserts recommendations into
ml_recommendations, and tracks last-run times.
"""

import json
from datetime import datetime, timezone

from sqlalchemy import func, select, text

from src.db.connection import async_session
from src.db.models import MLFeedbackSignal, MLRecommendation
from src.intelligence.analyzers.base import BaseAnalyzer
from src.intelligence.observer import observer
from src.utils.logging import get_logger

log = get_logger("recommender")


class Recommender:
    """Orchestrates analyzer execution on a schedule."""

    def __init__(self, analyzers: list[BaseAnalyzer]) -> None:
        self._analyzers = analyzers
        self._last_run: dict[str, datetime] = {}

    async def tick(self) -> None:
        """Called from main scheduler loop. Runs due analyzers."""
        now = datetime.now(timezone.utc)

        total_analyzers_run = 0
        total_recs_generated = 0

        for analyzer in self._analyzers:
            name = analyzer.get_name()
            hours = analyzer.get_schedule_hours()
            last = self._last_run.get(name)

            # Check if due
            if last and (now - last).total_seconds() < hours * 3600:
                continue

            # Check minimum signals
            signal_count = await self._count_signals()
            minimum = analyzer.get_minimum_signals()
            if signal_count < minimum:
                log.info(
                    "analyzer_skipped_insufficient_signals",
                    analyzer=name,
                    signals=signal_count,
                    minimum=minimum,
                )
                continue

            # Run analyzer
            try:
                recommendations = await analyzer.analyze()
                for rec in recommendations:
                    await self._insert_recommendation(rec)
                self._last_run[name] = now
                total_analyzers_run += 1
                total_recs_generated += len(recommendations)
                log.info(
                    "analyzer_completed",
                    analyzer=name,
                    recommendations=len(recommendations),
                )
            except Exception as e:
                log.error("analyzer_failed", analyzer=name, error=str(e))
                # NEVER re-raise — analyzer failures don't block scanner

        # Emit single summary signal for the entire ML cycle (instead of per-analyzer)
        if total_analyzers_run > 0:
            try:
                await observer.emit("ml_cycle_completed", "recommender", "ml_cycle", {
                    "analyzers_run": total_analyzers_run,
                    "recommendations_generated": total_recs_generated,
                    "signals_available": signal_count,
                })
            except Exception:
                pass

        # Phase 5C: check for synthetic cleanup opportunity (once per day)
        await self._check_synthetic_cleanup(now)

    async def _count_signals(self) -> int:
        """Count total signals in ml_feedback_signals."""
        async with async_session() as session:
            result = await session.execute(
                select(func.count()).select_from(MLFeedbackSignal)
            )
            return result.scalar_one()

    async def _insert_recommendation(self, rec: dict) -> None:
        """Insert a recommendation into ml_recommendations."""
        async with async_session() as session:
            new_rec = MLRecommendation(
                recommendation_type=rec["rec_type"],
                target_entity=rec.get("target_entity", "unknown"),
                target_id=rec.get("target_entity", "unknown"),
                payload={
                    "current_value": rec.get("current_value"),
                    "proposed_value": rec.get("proposed_value"),
                },
                confidence=rec.get("confidence", 0.0),
                status="pending",
                target_platform=rec.get("target_platform"),
                reasoning=rec.get("reasoning"),
                expected_impact=rec.get("expected_impact"),
                risk_level=rec.get("risk_level", "low"),
                supporting_data=rec.get("supporting_data", {}),
            )
            session.add(new_rec)
            await session.commit()
            log.info(
                "recommendation_inserted",
                rec_type=rec["rec_type"],
                target=rec.get("target_entity"),
                confidence=rec.get("confidence"),
            )

    async def _check_synthetic_cleanup(self, now: datetime) -> None:
        """Phase 5C: recommend cleanup of synthetic embeddings once organic contributors > 100."""
        last_check = self._last_run.get("synthetic_cleanup_check")
        if last_check and (now - last_check).total_seconds() < 86400:  # once per day
            return

        self._last_run["synthetic_cleanup_check"] = now

        try:
            async with async_session() as session:
                # Count real (non-test) contributors who completed onboarding
                result = await session.execute(
                    text("""
                        SELECT COUNT(*) FROM contributors
                        WHERE is_test_user = false AND onboarding_completed = true
                    """)
                )
                organic_count = result.scalar_one()

                if organic_count <= 100:
                    return

                # Count synthetic test users still present
                result = await session.execute(
                    text("""
                        SELECT COUNT(*) FROM contributors
                        WHERE test_user_type = 'synthetic'
                    """)
                )
                synthetic_count = result.scalar_one()

                if synthetic_count == 0:
                    return

            await self._insert_recommendation({
                "rec_type": "synthetic_cleanup",
                "target_entity": "synthetic_contributors",
                "current_value": {
                    "organic_contributors": organic_count,
                    "synthetic_contributors": synthetic_count,
                },
                "proposed_value": {
                    "action": "remove_synthetic",
                    "synthetic_count": synthetic_count,
                },
                "reasoning": (
                    f"There are {organic_count} organic contributors (>100 threshold). "
                    f"{synthetic_count} synthetic test users remain and can be cleaned up "
                    f"to free resources and avoid embedding noise."
                ),
                "expected_impact": f"Removes {synthetic_count} synthetic embeddings, reducing noise",
                "confidence": 0.95,
                "risk_level": "low",
                "supporting_data": {
                    "organic_count": organic_count,
                    "synthetic_count": synthetic_count,
                },
            })
            log.info(
                "synthetic_cleanup_recommended",
                organic=organic_count,
                synthetic=synthetic_count,
            )
        except Exception as e:
            log.error("synthetic_cleanup_check_error", error=str(e))

    async def get_analyzer_status(self) -> list[dict]:
        """Returns status of each analyzer for the dashboard."""
        signal_count = await self._count_signals()
        return [
            {
                "name": a.get_name(),
                "status": "active" if signal_count >= a.get_minimum_signals() else "warming",
                "signals": signal_count,
                "minimum": a.get_minimum_signals(),
                "last_run": self._last_run.get(a.get_name(), None),
                "schedule_hours": a.get_schedule_hours(),
            }
            for a in self._analyzers
        ]
