"""Threshold Optimizer: learns optimal similarity thresholds from match review decisions.

Schedule: every 6 hours
Minimum signals: 50 match reviews (match_confirmed + match_dismissed)
Model: scikit-learn LogisticRegression
"""

import json
from datetime import datetime, timezone

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

from src.db.connection import async_session
from src.db.models import MLFeedbackSignal, MLModelState
from src.intelligence.analyzers.base import BaseAnalyzer
from src.config import settings
from src.utils.logging import get_logger
from sqlalchemy import func, select, text

log = get_logger("threshold_optimizer")

# Default thresholds (must match config.py)
DEFAULT_THRESHOLDS = {
    "low": 0.50,
    "medium": 0.65,
    "high": 0.85,
}

# Safety constraints
HIGH_THRESHOLD_FLOOR = 0.70
LOW_THRESHOLD_CEILING = 0.60
MAX_CHANGE_PER_REC = 0.03


class ThresholdOptimizer(BaseAnalyzer):
    """Learns optimal similarity thresholds from human match review decisions."""

    def get_name(self) -> str:
        return "Threshold Optimizer"

    def get_schedule_hours(self) -> float:
        return 6.0

    def get_minimum_signals(self) -> int:
        return 50

    async def analyze(self) -> list[dict]:
        # 1. Query match review signals
        signals = await self._load_review_signals()
        if len(signals) < 20:
            log.info("threshold_optimizer_skip", reason="insufficient_signals", count=len(signals))
            return []

        # 2. Extract features and labels
        features, labels, platforms = self._extract_features(signals)
        if len(features) < 20:
            return []

        # 3. Get current thresholds
        current = await self._get_current_thresholds()

        # 4. Group by platform and fit models
        recommendations = []
        unique_platforms = set(platforms)

        for platform in unique_platforms:
            platform_mask = np.array([p == platform for p in platforms])
            platform_count = platform_mask.sum()

            if platform_count >= 20:
                X = features[platform_mask]
                y = labels[platform_mask]
            else:
                # Use all cross-platform signals
                X = features
                y = labels
                platform = "global"

            if len(np.unique(y)) < 2:
                log.info("threshold_skip_single_class", platform=platform)
                continue

            rec = self._fit_and_recommend(X, y, platform, current, signals, platform_mask if platform != "global" else None)
            if rec:
                recommendations.append(rec)

            # Only produce one global recommendation
            if platform == "global":
                break

        # 5. Save model state
        await self._save_model_state(features, labels)

        return recommendations

    async def _load_review_signals(self) -> list[dict]:
        """Load match_confirmed and match_dismissed signals."""
        async with async_session() as session:
            result = await session.execute(
                select(MLFeedbackSignal)
                .where(MLFeedbackSignal.signal_type.in_(["match_confirmed", "match_dismissed"]))
                .order_by(MLFeedbackSignal.created_at.desc())
                .limit(5000)
            )
            rows = result.scalars().all()

        signals = []
        for row in rows:
            ctx = row.context or {}
            similarity = ctx.get("similarity_score") or ctx.get("similarity")
            if similarity is None:
                continue
            signals.append({
                "signal_type": row.signal_type,
                "similarity": float(similarity),
                "platform": ctx.get("platform", "unknown"),
                "face_detection_confidence": ctx.get("face_detection_confidence"),
            })
        return signals

    def _extract_features(self, signals: list[dict]) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """Extract features (similarity + optional face confidence) and labels."""
        features = []
        labels = []
        platforms = []

        for s in signals:
            feat = [s["similarity"]]
            if s["face_detection_confidence"] is not None:
                feat.append(float(s["face_detection_confidence"]))
            features.append(feat)
            labels.append(1 if s["signal_type"] == "match_confirmed" else 0)
            platforms.append(s["platform"])

        # Ensure consistent feature dimensions (pad with 0.5 if missing face confidence)
        max_features = max(len(f) for f in features) if features else 1
        for f in features:
            while len(f) < max_features:
                f.append(0.5)

        return np.array(features), np.array(labels), platforms

    async def _get_current_thresholds(self) -> dict:
        """Read current thresholds from ml_model_state or config defaults."""
        async with async_session() as session:
            result = await session.execute(
                select(MLModelState)
                .where(MLModelState.model_name == "threshold_optimizer")
                .order_by(MLModelState.version.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()

        if row and row.parameters:
            thresholds = row.parameters.get("thresholds")
            if thresholds:
                return thresholds

        return {
            "low": settings.match_threshold_low,
            "medium": settings.match_threshold_medium,
            "high": settings.match_threshold_high,
        }

    def _fit_and_recommend(
        self,
        X: np.ndarray,
        y: np.ndarray,
        platform: str,
        current: dict,
        all_signals: list[dict],
        platform_mask: np.ndarray | None,
    ) -> dict | None:
        """Fit LogisticRegression and produce threshold recommendation if needed."""
        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X, y)

        # Compute AUC
        try:
            y_proba = model.predict_proba(X)[:, 1]
            auc = float(roc_auc_score(y, y_proba))
        except Exception:
            auc = 0.0

        accuracy = float(model.score(X, y))

        # Find thresholds at P=0.3, P=0.6, P=0.9
        sim_range = np.arange(0.40, 1.01, 0.01)
        # Build feature matrix for prediction (similarity + padding for extra features)
        n_features = X.shape[1]
        sim_features = np.zeros((len(sim_range), n_features))
        sim_features[:, 0] = sim_range
        if n_features > 1:
            sim_features[:, 1] = 0.5  # default face confidence

        probas = model.predict_proba(sim_features)[:, 1]

        learned = {}
        for tier, target_p in [("low", 0.3), ("medium", 0.6), ("high", 0.9)]:
            # Find the similarity value where P(true_positive) crosses target
            idx = np.argmin(np.abs(probas - target_p))
            learned[tier] = round(float(sim_range[idx]), 2)

        # Apply safety constraints
        learned["high"] = max(learned["high"], HIGH_THRESHOLD_FLOOR)
        learned["low"] = min(learned["low"], LOW_THRESHOLD_CEILING)

        # Ensure ordering: low <= medium <= high
        learned["medium"] = max(learned["medium"], learned["low"])
        learned["medium"] = min(learned["medium"], learned["high"])

        # Check if any threshold differs by > 0.02 from current
        changes = {}
        for tier in ["low", "medium", "high"]:
            diff = learned[tier] - current[tier]
            if abs(diff) > 0.02:
                # Cap change at MAX_CHANGE_PER_REC
                capped_change = max(-MAX_CHANGE_PER_REC, min(MAX_CHANGE_PER_REC, diff))
                proposed = round(current[tier] + capped_change, 2)
                # Re-apply constraints on proposed
                if tier == "high":
                    proposed = max(proposed, HIGH_THRESHOLD_FLOOR)
                elif tier == "low":
                    proposed = min(proposed, LOW_THRESHOLD_CEILING)
                changes[tier] = proposed

        if not changes:
            log.info("threshold_optimizer_no_changes", platform=platform, learned=learned, current=current)
            return None

        # Count reclassified matches
        confirmed = sum(1 for s in all_signals if s["signal_type"] == "match_confirmed")
        dismissed = sum(1 for s in all_signals if s["signal_type"] == "match_dismissed")
        reclassified = self._count_reclassified(all_signals, current, {**current, **changes})

        proposed_value = {**current, **changes}
        reasoning = (
            f"{confirmed} confirmed matches and {dismissed} dismissed matches "
            f"show the optimal thresholds are {learned}. "
            f"Current thresholds are {current}. "
            f"{reclassified} matches would change confidence tier."
        )

        return {
            "rec_type": "threshold_change",
            "target_platform": platform if platform != "global" else None,
            "target_entity": "match_thresholds",
            "current_value": current,
            "proposed_value": proposed_value,
            "reasoning": reasoning,
            "expected_impact": f"Reclassifies {reclassified} matches based on {len(all_signals)} reviews",
            "confidence": min(0.95, auc),
            "risk_level": "medium" if any(abs(changes.get(t, 0) - current.get(t, 0)) > 0.02 for t in changes) else "low",
            "supporting_data": {
                "model_auc": round(auc, 4),
                "model_accuracy": round(accuracy, 4),
                "total_signals": len(all_signals),
                "confirmed": confirmed,
                "dismissed": dismissed,
                "platform": platform,
                "reclassified_count": reclassified,
                "learned_thresholds": learned,
            },
        }

    def _count_reclassified(self, signals: list[dict], old_thresholds: dict, new_thresholds: dict) -> int:
        """Count how many signals would change confidence tier."""
        count = 0
        for s in signals:
            sim = s["similarity"]
            old_tier = self._classify(sim, old_thresholds)
            new_tier = self._classify(sim, new_thresholds)
            if old_tier != new_tier:
                count += 1
        return count

    @staticmethod
    def _classify(similarity: float, thresholds: dict) -> str:
        if similarity >= thresholds["high"]:
            return "high"
        elif similarity >= thresholds["medium"]:
            return "medium"
        elif similarity >= thresholds["low"]:
            return "low"
        return "none"

    async def _save_model_state(self, features: np.ndarray, labels: np.ndarray) -> None:
        """Save model state for auditing."""
        try:
            model = LogisticRegression(max_iter=1000, random_state=42)
            if len(np.unique(labels)) >= 2:
                model.fit(features, labels)
                y_proba = model.predict_proba(features)[:, 1]
                auc = float(roc_auc_score(labels, y_proba))
                accuracy = float(model.score(features, labels))
                params = {
                    "coefficients": model.coef_.tolist(),
                    "intercept": model.intercept_.tolist(),
                }
            else:
                auc = 0.0
                accuracy = 0.0
                params = {}

            async with async_session() as session:
                # Get next version
                result = await session.execute(
                    select(func.coalesce(func.max(MLModelState.version), 0))
                    .where(MLModelState.model_name == "threshold_optimizer")
                )
                max_version = result.scalar_one()

                new_state = MLModelState(
                    model_name="threshold_optimizer",
                    version=max_version + 1,
                    parameters=params,
                    metrics={"auc": round(auc, 4), "accuracy": round(accuracy, 4), "n_samples": len(labels)},
                    training_signals=len(labels),
                    is_active=True,
                    trained_at=datetime.now(timezone.utc),
                )
                session.add(new_state)
                await session.commit()

            log.info("model_state_saved", model="threshold_optimizer", version=max_version + 1)
        except Exception as e:
            log.error("model_state_save_error", error=str(e))
