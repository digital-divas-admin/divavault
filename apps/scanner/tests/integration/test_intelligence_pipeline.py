"""Integration test: full ML intelligence pipeline (recommender → applier cycle).

Tests the complete flow from analyzer execution through recommendation storage
to recommendation application, with mocked database.
"""

import numpy as np
import pytest
from collections import Counter
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.intelligence.analyzers.base import BaseAnalyzer
from src.intelligence.analyzers.false_positives import FalsePositiveFilter, _log_resolution, _section_hash
from src.intelligence.analyzers.sources import SourceIntelligence
from src.intelligence.analyzers.threshold import ThresholdOptimizer
from src.intelligence.applier import Applier
from src.intelligence.observer import Observer
from src.intelligence.recommender import Recommender


# ---------------------------------------------------------------------------
# End-to-end: observer → signal → analyzer → recommendation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestObserverToAnalyzer:
    async def test_observer_buffers_signals(self):
        """Verify signals emitted during matching reach the observer buffer."""
        obs = Observer()

        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("match_confirmed", "match", str(uuid4()), {
                "similarity_score": 0.92,
                "platform": "civitai",
                "confidence_tier": "high",
                "face_detection_confidence": 0.95,
            })
            await obs.emit("match_dismissed", "match", str(uuid4()), {
                "similarity_score": 0.45,
                "platform": "civitai",
                "confidence_tier": "low",
            })

        assert obs.buffer_size == 2

    async def test_signal_context_preserved(self):
        """Verify signal context includes all required fields for FP filter."""
        obs = Observer()
        context = {
            "similarity_score": 0.88,
            "platform": "civitai",
            "confidence_tier": "high",
            "is_ai_generated": True,
            "ai_detection_score": 0.91,
            "face_count": 1,
            "face_detection_confidence": 0.87,
            "match_id": str(uuid4()),
        }

        with patch.object(obs, "flush", new_callable=AsyncMock):
            await obs.emit("match_confirmed", "match", str(uuid4()), context)

        import json
        stored = json.loads(obs._buffer[0]["context"])
        assert stored["face_detection_confidence"] == 0.87
        assert stored["similarity_score"] == 0.88


# ---------------------------------------------------------------------------
# End-to-end: recommender orchestrates multiple analyzers
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestRecommenderOrchestration:
    async def test_runs_all_due_analyzers(self):
        """Recommender should run each analyzer that is due and has enough signals."""
        analyzer_a = MagicMock(spec=BaseAnalyzer)
        analyzer_a.get_name.return_value = "Analyzer A"
        analyzer_a.get_schedule_hours.return_value = 1.0
        analyzer_a.get_minimum_signals.return_value = 5
        analyzer_a.analyze = AsyncMock(return_value=[])

        analyzer_b = MagicMock(spec=BaseAnalyzer)
        analyzer_b.get_name.return_value = "Analyzer B"
        analyzer_b.get_schedule_hours.return_value = 24.0
        analyzer_b.get_minimum_signals.return_value = 5
        analyzer_b.analyze = AsyncMock(return_value=[])

        recommender = Recommender([analyzer_a, analyzer_b])

        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_insert_recommendation", new_callable=AsyncMock), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        analyzer_a.analyze.assert_called_once()
        analyzer_b.analyze.assert_called_once()

    async def test_failed_analyzer_doesnt_block_others(self):
        """If analyzer A fails, analyzer B should still run."""
        analyzer_a = MagicMock(spec=BaseAnalyzer)
        analyzer_a.get_name.return_value = "Broken Analyzer"
        analyzer_a.get_schedule_hours.return_value = 1.0
        analyzer_a.get_minimum_signals.return_value = 5
        analyzer_a.analyze = AsyncMock(side_effect=RuntimeError("crash"))

        analyzer_b = MagicMock(spec=BaseAnalyzer)
        analyzer_b.get_name.return_value = "Healthy Analyzer"
        analyzer_b.get_schedule_hours.return_value = 1.0
        analyzer_b.get_minimum_signals.return_value = 5
        analyzer_b.analyze = AsyncMock(return_value=[])

        recommender = Recommender([analyzer_a, analyzer_b])

        with patch.object(recommender, "_count_signals", return_value=100), \
             patch.object(recommender, "_insert_recommendation", new_callable=AsyncMock), \
             patch.object(recommender, "_check_synthetic_cleanup", new_callable=AsyncMock):
            await recommender.tick()

        analyzer_b.analyze.assert_called_once()


# ---------------------------------------------------------------------------
# End-to-end: FP filter feature pipeline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestFPFilterFeaturePipeline:
    async def test_full_feature_extraction_and_training(self):
        """Verify the entire FP filter pipeline: data → features → model → scoring."""
        rng = np.random.RandomState(42)

        # Simulate 60 training samples
        training_data = []
        for i in range(60):
            training_data.append({
                "label": 1 if i < 30 else 0,
                "similarity": float(rng.uniform(0.3, 1.0)),
                "platform": "civitai" if i % 2 == 0 else "deviantart",
                "confidence_tier": "high" if i < 20 else "medium" if i < 40 else "low",
                "is_ai_generated": i < 30,
                "ai_detection_score": float(rng.uniform(0.5, 1.0)),
                "face_count": int(rng.randint(1, 3)),
                "face_detection_confidence": float(rng.uniform(0.3, 0.99)),
                "image_resolution": _log_resolution(
                    int(rng.randint(200, 4096)),
                    int(rng.randint(200, 4096)),
                ),
                "section": f"https://civitai.com/models/category-{i % 5}",
            })

        fp = FalsePositiveFilter()
        X, y, names = fp._extract_features(training_data)

        # Feature dimensions check
        assert X.shape == (60, 13)
        assert len(names) == 13
        assert "face_detection_confidence" in names
        assert "image_resolution" in names
        assert "section_hash" in names

        # Train model
        model, metrics = fp._train_model(X, y)
        assert model is not None
        assert "precision" in metrics
        assert "recall" in metrics
        assert "f1" in metrics

        # Score some test data
        test_features = np.random.randn(5, 13)
        probas = model.predict_proba(test_features)
        assert probas.shape == (5, 2)


# ---------------------------------------------------------------------------
# End-to-end: source intelligence clustering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestSourceIntelligenceClustering:
    async def test_detects_all_cluster_types(self):
        """Full pipeline: shared generator + shared titles + shared content."""
        analyzer = SourceIntelligence()

        shared_url = "https://civitai.com/images/stolen123"

        profiles = {
            "civitai:alice": {
                "account": "alice", "platform": "civitai", "match_count": 3,
                "ai_generators": Counter({"stable_diffusion": 3}),
                "page_titles": ["AI deepfake portrait realistic face"],
                "is_known": False,
                "matches": [{"source_url": shared_url}],
            },
            "civitai:bob": {
                "account": "bob", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter({"stable_diffusion": 2}),
                "page_titles": ["AI deepfake portrait realistic generation"],
                "is_known": False,
                "matches": [{"source_url": shared_url}],
            },
            "civitai:charlie": {
                "account": "charlie", "platform": "civitai", "match_count": 1,
                "ai_generators": Counter({"midjourney": 1}),
                "page_titles": ["landscape photography"],
                "is_known": False,
                "matches": [{"source_url": "https://civitai.com/images/unique999"}],
            },
        }

        clusters = analyzer._detect_clusters(profiles)
        types = [c["cluster_type"] for c in clusters]

        assert "shared_generator" in types  # alice + bob share stable_diffusion
        assert "shared_titles" in types     # alice + bob have similar titles
        assert "shared_content" in types    # alice + bob share same source_url


# ---------------------------------------------------------------------------
# End-to-end: applier handles all recommendation types
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestApplierFullCycle:
    async def test_apply_approved_with_mixed_types(self):
        """Applier should handle a mix of recommendation types without error."""
        applier = Applier()

        recs = []
        for rec_type in ["threshold_change", "section_toggle", "fp_suppression",
                         "hostile_account_flag", "synthetic_cleanup", "priority_source"]:
            rec = MagicMock()
            rec.id = uuid4()
            rec.recommendation_type = rec_type
            rec.payload = {"proposed_value": {"action": "test"}}
            rec.status = "approved"
            rec.target_platform = "civitai"
            rec.target_entity = "test"
            rec.reasoning = "test"
            rec.supporting_data = {"match_count": 1}
            rec.risk_level = "low"
            rec.confidence = 0.8
            rec.created_at = datetime.now(timezone.utc)
            recs.append(rec)

        # Mock all apply methods
        for method in ["_apply_threshold_change", "_apply_section_toggle",
                       "_apply_fp_suppression", "_apply_hostile_account_flag",
                       "_apply_synthetic_cleanup"]:
            setattr(applier, method, AsyncMock())

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.applier.async_session", return_value=mock_session), \
             patch("src.intelligence.applier.observer") as mock_obs:
            mock_obs.emit = AsyncMock()

            for rec in recs:
                await applier._apply_one(rec)

        # All type-specific methods should have been called
        applier._apply_threshold_change.assert_called_once()
        applier._apply_section_toggle.assert_called_once()
        applier._apply_fp_suppression.assert_called_once()
        applier._apply_hostile_account_flag.assert_called_once()
        applier._apply_synthetic_cleanup.assert_called_once()


# ---------------------------------------------------------------------------
# Model state persistence
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestModelStatePersistence:
    async def test_fp_filter_saves_training_signals(self):
        """Verify the FP filter model state includes training_signals and is_active."""
        from sklearn.ensemble import RandomForestClassifier

        fp = FalsePositiveFilter()
        model = RandomForestClassifier(n_estimators=10, random_state=42)
        X = np.random.randn(50, 13)
        y = np.array([1]*25 + [0]*25)
        model.fit(X, y)

        captured = {}

        mock_session = AsyncMock()
        mock_scalar = MagicMock()
        mock_scalar.scalar_one.return_value = 2
        mock_session.execute = AsyncMock(return_value=mock_scalar)
        mock_session.commit = AsyncMock()
        mock_session.add = lambda obj: captured.update({"state": obj})
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.analyzers.false_positives.async_session", return_value=mock_session):
            await fp._save_model_state(model, {"f1": 0.85}, ["f"]*13, 200)

        assert captured["state"].training_signals == 200
        assert captured["state"].is_active is True
        assert captured["state"].version == 3  # max_version(2) + 1

    async def test_threshold_optimizer_saves_training_signals(self):
        """Verify the threshold optimizer model state includes training_signals."""
        opt = ThresholdOptimizer()

        captured = {}

        mock_session = AsyncMock()
        mock_scalar = MagicMock()
        mock_scalar.scalar_one.return_value = 5
        mock_session.execute = AsyncMock(return_value=mock_scalar)
        mock_session.commit = AsyncMock()
        mock_session.add = lambda obj: captured.update({"state": obj})
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        rng = np.random.RandomState(42)
        features = np.column_stack([rng.uniform(0.3, 1.0, 60)])
        labels = np.array([1]*30 + [0]*30)

        with patch("src.intelligence.analyzers.threshold.async_session", return_value=mock_session):
            await opt._save_model_state(features, labels)

        assert captured["state"].training_signals == 60
        assert captured["state"].is_active is True


# ---------------------------------------------------------------------------
# Scheduler integration (mocked)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestSchedulerIntegration:
    async def test_ml_intelligence_initializes_all_analyzers(self):
        """Verify _run_ml_intelligence creates all 6 analyzers."""
        from src.jobs.scheduler import _run_ml_intelligence
        import src.jobs.scheduler as scheduler_mod

        # Reset globals
        scheduler_mod._recommender = None
        scheduler_mod._applier = None

        with patch("src.intelligence.recommender.Recommender") as MockRecommender, \
             patch("src.intelligence.applier.Applier") as MockApplier:
            mock_rec = MagicMock()
            mock_rec.tick = AsyncMock()
            MockRecommender.return_value = mock_rec

            mock_app = MagicMock()
            mock_app.apply_approved = AsyncMock()
            MockApplier.return_value = mock_app

            await _run_ml_intelligence()

            # Recommender should be initialized with 7 analyzers
            args = MockRecommender.call_args[0][0]
            assert len(args) == 7
            analyzer_types = [type(a).__name__ for a in args]
            assert "ThresholdOptimizer" in analyzer_types
            assert "SectionRanker" in analyzer_types
            assert "FalsePositiveFilter" in analyzer_types
            assert "SourceIntelligence" in analyzer_types
            assert "AnomalyDetector" in analyzer_types

            mock_rec.tick.assert_called_once()
            mock_app.apply_approved.assert_called_once()

        # Reset globals again
        scheduler_mod._recommender = None
        scheduler_mod._applier = None
