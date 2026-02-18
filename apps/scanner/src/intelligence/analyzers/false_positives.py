"""False Positive Filter: trains a classifier to predict match quality.

Schedule: every 6 hours
Minimum signals: 100 match reviews (match_confirmed + match_dismissed)
Model: scikit-learn RandomForestClassifier
"""

import hashlib
import json
import math
from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import cross_val_predict
from sqlalchemy import func, select, text

from src.db.connection import async_session
from src.db.models import (
    DiscoveredImage,
    MLFeedbackSignal,
    MLModelState,
    Match,
)
from src.intelligence.analyzers.base import BaseAnalyzer
from src.utils.logging import get_logger

log = get_logger("false_positive_filter")

# Platform encoding for one-hot features
KNOWN_PLATFORMS = ["civitai", "deviantart", "reddit", "tineye", "other"]

# Confidence tier encoding (ordinal)
TIER_TO_ORDINAL = {"low": 0, "medium": 1, "high": 2}

# Minimum dismissals before recommending suppression
MIN_DISMISSALS_FOR_SUPPRESSION = 5


def _section_hash(section: str | None) -> float:
    """Hash a section string to a stable float in [0, 1] for use as a numeric feature."""
    if not section:
        return 0.5
    h = hashlib.md5(section.lower().encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _log_resolution(width: int | None, height: int | None) -> float:
    """Log-scaled resolution proxy, normalised to ~[0, 1] for typical web images."""
    if not width or not height or width <= 0 or height <= 0:
        return 0.5
    # log10(1920*1080) ≈ 6.32; divide by 7 to keep most values < 1
    return min(1.0, math.log10(width * height) / 7.0)


class FalsePositiveFilter(BaseAnalyzer):
    """Trains a false positive classifier and scores pending matches."""

    def get_name(self) -> str:
        return "False Positive Filter"

    def get_schedule_hours(self) -> float:
        return 6.0

    def get_minimum_signals(self) -> int:
        return 100

    async def analyze(self) -> list[dict]:
        # 1. Load match review data with features
        training_data = await self._load_training_data()
        if len(training_data) < 30:
            log.info("fp_filter_skip", reason="insufficient_training_data", count=len(training_data))
            return []

        # 2. Extract features and labels
        X, y, feature_names = self._extract_features(training_data)
        if len(X) < 30 or len(np.unique(y)) < 2:
            return []

        # 3. Train classifier
        model, metrics = self._train_model(X, y)

        # 4. Score pending matches
        scored_count = await self._score_pending_matches(model, feature_names)

        # 5. Save model state
        await self._save_model_state(model, metrics, feature_names, len(training_data))

        # 6. Detect repeat false positives → suppression recommendations
        recommendations = await self._detect_repeat_fps()

        log.info(
            "fp_filter_complete",
            training_samples=len(training_data),
            metrics=metrics,
            scored_pending=scored_count,
            suppression_recs=len(recommendations),
        )

        return recommendations

    async def _load_training_data(self) -> list[dict]:
        """Load confirmed and dismissed match data with features.

        Joins discovered_images via the match_id stored in signal context to
        pull image resolution and section (derived from page_url).
        """
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        mfs.signal_type,
                        mfs.context->>'similarity_score' as similarity,
                        mfs.context->>'platform' as platform,
                        mfs.context->>'confidence_tier' as confidence_tier,
                        mfs.context->>'is_ai_generated' as is_ai_generated,
                        mfs.context->>'ai_detection_score' as ai_detection_score,
                        mfs.context->>'face_count' as face_count,
                        mfs.context->>'match_id' as match_id,
                        mfs.context->>'face_detection_confidence' as face_det_conf,
                        di.width as img_width,
                        di.height as img_height,
                        di.page_url as page_url
                    FROM ml_feedback_signals mfs
                    LEFT JOIN matches m ON m.id::text = mfs.context->>'match_id'
                    LEFT JOIN discovered_images di ON m.discovered_image_id = di.id
                    WHERE mfs.signal_type IN ('match_confirmed', 'match_dismissed')
                    ORDER BY mfs.created_at DESC
                    LIMIT 10000
                """)
            )
            rows = result.fetchall()

        data = []
        for row in rows:
            similarity = row[1]
            if similarity is None:
                continue
            try:
                similarity = float(similarity)
            except (ValueError, TypeError):
                continue

            data.append({
                "label": 1 if row[0] == "match_confirmed" else 0,
                "similarity": similarity,
                "platform": row[2] or "other",
                "confidence_tier": row[3] or "low",
                "is_ai_generated": row[4] == "true" if row[4] else False,
                "ai_detection_score": float(row[5]) if row[5] else 0.0,
                "face_count": int(row[6]) if row[6] else 1,
                "face_detection_confidence": float(row[8]) if row[8] else 0.5,
                "image_resolution": _log_resolution(row[9], row[10]),
                "section": row[11],  # page_url used as section proxy
            })

        return data

    def _extract_features(self, data: list[dict]) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """Extract feature matrix and labels from training data."""
        feature_names = [
            "similarity_score",
            "face_detection_confidence",
            "image_resolution",
            "face_count",
            "is_ai_generated",
            "ai_detection_score",
            "confidence_tier_ordinal",
        ] + [f"platform_{p}" for p in KNOWN_PLATFORMS] + [
            "section_hash",
        ]

        features = []
        labels = []

        for d in data:
            feat = [
                d["similarity"],
                d.get("face_detection_confidence", 0.5),
                d.get("image_resolution", 0.5),
                min(d["face_count"], 10),  # cap at 10
                1.0 if d["is_ai_generated"] else 0.0,
                d["ai_detection_score"],
                TIER_TO_ORDINAL.get(d["confidence_tier"], 0),
            ]

            # One-hot platform encoding
            platform = d["platform"].lower()
            for p in KNOWN_PLATFORMS:
                feat.append(1.0 if platform == p or (p == "other" and platform not in KNOWN_PLATFORMS[:-1]) else 0.0)

            # Section hash (page_url hashed to numeric)
            feat.append(_section_hash(d.get("section")))

            features.append(feat)
            labels.append(d["label"])

        return np.array(features), np.array(labels), feature_names

    def _train_model(self, X: np.ndarray, y: np.ndarray) -> tuple[RandomForestClassifier, dict]:
        """Train RandomForest classifier and compute metrics."""
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=6,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X, y)

        # Cross-validated predictions for unbiased metrics
        try:
            cv_folds = min(5, max(2, len(y) // 20))
            if cv_folds >= 2 and len(np.unique(y)) >= 2:
                y_pred_cv = cross_val_predict(model, X, y, cv=cv_folds)
                metrics = {
                    "precision": round(float(precision_score(y, y_pred_cv, zero_division=0)), 4),
                    "recall": round(float(recall_score(y, y_pred_cv, zero_division=0)), 4),
                    "f1": round(float(f1_score(y, y_pred_cv, zero_division=0)), 4),
                    "accuracy": round(float((y_pred_cv == y).mean()), 4),
                }
            else:
                y_pred = model.predict(X)
                metrics = {
                    "precision": round(float(precision_score(y, y_pred, zero_division=0)), 4),
                    "recall": round(float(recall_score(y, y_pred, zero_division=0)), 4),
                    "f1": round(float(f1_score(y, y_pred, zero_division=0)), 4),
                    "accuracy": round(float((y_pred == y).mean()), 4),
                }
        except Exception:
            metrics = {"precision": 0.0, "recall": 0.0, "f1": 0.0, "accuracy": 0.0}

        return model, metrics

    async def _score_pending_matches(self, model: RandomForestClassifier, feature_names: list[str]) -> int:
        """Score pending matches with false positive probability."""
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT m.id, m.similarity_score, m.confidence_tier,
                           m.is_ai_generated, m.ai_detection_score,
                           di.face_count, di.platform,
                           di.width, di.height, di.page_url
                    FROM matches m
                    JOIN discovered_images di ON m.discovered_image_id = di.id
                    WHERE m.status = 'new'
                    LIMIT 1000
                """)
            )
            pending = result.fetchall()

        if not pending:
            return 0

        # Build feature matrix
        match_ids = []
        features = []

        for row in pending:
            match_id, similarity, tier, is_ai, ai_score, face_count, platform, width, height, page_url = row
            feat = [
                float(similarity) if similarity else 0.5,
                0.5,  # face_detection_confidence not available on pending matches
                _log_resolution(width, height),
                min(int(face_count or 1), 10),
                1.0 if is_ai else 0.0,
                float(ai_score) if ai_score else 0.0,
                TIER_TO_ORDINAL.get(tier, 0),
            ]
            platform_lower = (platform or "other").lower()
            for p in KNOWN_PLATFORMS:
                feat.append(1.0 if platform_lower == p or (p == "other" and platform_lower not in KNOWN_PLATFORMS[:-1]) else 0.0)

            # Section hash
            feat.append(_section_hash(page_url))

            match_ids.append(str(match_id))
            features.append(feat)

        X_pending = np.array(features)
        probas = model.predict_proba(X_pending)

        # Get P(true_positive) — class 1 probability
        tp_col = list(model.classes_).index(1) if 1 in model.classes_ else 0
        fp_probabilities = 1.0 - probas[:, tp_col]

        # Store fp_probability as a signal for each match
        async with async_session() as session:
            for i, match_id in enumerate(match_ids):
                fp_prob = float(fp_probabilities[i])
                await session.execute(
                    text("""
                        INSERT INTO ml_feedback_signals (signal_type, entity_type, entity_id, context)
                        VALUES ('fp_score', 'match', :match_id, :context)
                    """),
                    {
                        "match_id": match_id,
                        "context": json.dumps({
                            "fp_probability": round(fp_prob, 4),
                            "model": "false_positive_filter",
                        }),
                    },
                )
            await session.commit()

        return len(match_ids)

    async def _detect_repeat_fps(self) -> list[dict]:
        """Find contributor+platform pairs that are repeatedly dismissed."""
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT m.contributor_id, di.platform, COUNT(*) as dismiss_count
                    FROM matches m
                    JOIN discovered_images di ON m.discovered_image_id = di.id
                    WHERE m.status = 'false_positive'
                    GROUP BY m.contributor_id, di.platform
                    HAVING COUNT(*) >= :min_dismissals
                    ORDER BY COUNT(*) DESC
                    LIMIT 20
                """),
                {"min_dismissals": MIN_DISMISSALS_FOR_SUPPRESSION},
            )
            repeat_fps = result.fetchall()

        recommendations = []
        for row in repeat_fps:
            contributor_id, platform, dismiss_count = row
            recommendations.append({
                "rec_type": "fp_suppression",
                "target_platform": platform,
                "target_entity": str(contributor_id),
                "current_value": {"dismissal_count": dismiss_count},
                "proposed_value": {
                    "action": "suppress",
                    "contributor_id": str(contributor_id),
                    "platform": platform,
                },
                "reasoning": (
                    f"Contributor {str(contributor_id)[:8]}... has {dismiss_count} dismissed matches "
                    f"on {platform}. This suggests a systematic false positive pattern. "
                    f"Suppressing this pair reduces review burden."
                ),
                "expected_impact": f"Reduces review queue by ~{dismiss_count} false positives",
                "confidence": min(0.9, 0.5 + dismiss_count / 20),
                "risk_level": "medium",
                "supporting_data": {
                    "contributor_id": str(contributor_id),
                    "platform": platform,
                    "dismissal_count": dismiss_count,
                },
            })

        return recommendations

    async def _save_model_state(
        self,
        model: RandomForestClassifier,
        metrics: dict,
        feature_names: list[str],
        n_samples: int,
    ) -> None:
        """Save trained model state for auditing and ML scorer consumption."""
        try:
            # Store feature importances and model config
            importances = dict(zip(feature_names, [round(float(fi), 4) for fi in model.feature_importances_]))

            params = {
                "feature_importances": importances,
                "n_estimators": model.n_estimators,
                "max_depth": model.max_depth,
                "feature_names": feature_names,
                "classes": model.classes_.tolist(),
            }

            async with async_session() as session:
                result = await session.execute(
                    select(func.coalesce(func.max(MLModelState.version), 0))
                    .where(MLModelState.model_name == "false_positive_filter")
                )
                max_version = result.scalar_one()

                new_state = MLModelState(
                    model_name="false_positive_filter",
                    version=max_version + 1,
                    parameters=params,
                    metrics={**metrics, "n_samples": n_samples},
                    training_signals=n_samples,
                    is_active=True,
                    trained_at=datetime.now(timezone.utc),
                )
                session.add(new_state)
                await session.commit()

            log.info("fp_model_state_saved", version=max_version + 1, metrics=metrics)
        except Exception as e:
            log.error("fp_model_state_save_error", error=str(e))
