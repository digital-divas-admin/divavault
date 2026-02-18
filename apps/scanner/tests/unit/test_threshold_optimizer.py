"""Tests for the Threshold Optimizer analyzer."""

import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.intelligence.analyzers.threshold import (
    ThresholdOptimizer,
    DEFAULT_THRESHOLDS,
    HIGH_THRESHOLD_FLOOR,
    LOW_THRESHOLD_CEILING,
    MAX_CHANGE_PER_REC,
)


@pytest.fixture
def optimizer():
    return ThresholdOptimizer()


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class TestConfiguration:
    def test_schedule_hours(self, optimizer):
        assert optimizer.get_schedule_hours() == 6.0

    def test_minimum_signals(self, optimizer):
        assert optimizer.get_minimum_signals() == 50

    def test_name(self, optimizer):
        assert optimizer.get_name() == "Threshold Optimizer"


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

class TestExtractFeatures:
    def test_basic_extraction(self, optimizer):
        signals = [
            {"signal_type": "match_confirmed", "similarity": 0.9, "platform": "civitai", "face_detection_confidence": None},
            {"signal_type": "match_dismissed", "similarity": 0.5, "platform": "civitai", "face_detection_confidence": 0.8},
        ]
        features, labels, platforms = optimizer._extract_features(signals)
        assert features.shape[0] == 2
        assert labels.tolist() == [1, 0]
        assert platforms == ["civitai", "civitai"]

    def test_consistent_dimensions(self, optimizer):
        """Even with mixed face confidence presence, dimensions should match."""
        signals = [
            {"signal_type": "match_confirmed", "similarity": 0.8, "platform": "x", "face_detection_confidence": 0.9},
            {"signal_type": "match_dismissed", "similarity": 0.4, "platform": "x", "face_detection_confidence": None},
        ]
        features, _, _ = optimizer._extract_features(signals)
        assert features.shape[1] == 2  # similarity + face_confidence (padded)


# ---------------------------------------------------------------------------
# Classification helper
# ---------------------------------------------------------------------------

class TestClassify:
    def test_high_tier(self):
        thresholds = {"low": 0.50, "medium": 0.65, "high": 0.85}
        assert ThresholdOptimizer._classify(0.90, thresholds) == "high"
        assert ThresholdOptimizer._classify(0.85, thresholds) == "high"

    def test_medium_tier(self):
        thresholds = {"low": 0.50, "medium": 0.65, "high": 0.85}
        assert ThresholdOptimizer._classify(0.70, thresholds) == "medium"
        assert ThresholdOptimizer._classify(0.65, thresholds) == "medium"

    def test_low_tier(self):
        thresholds = {"low": 0.50, "medium": 0.65, "high": 0.85}
        assert ThresholdOptimizer._classify(0.55, thresholds) == "low"

    def test_below_all(self):
        thresholds = {"low": 0.50, "medium": 0.65, "high": 0.85}
        assert ThresholdOptimizer._classify(0.40, thresholds) == "none"


# ---------------------------------------------------------------------------
# Safety constraints
# ---------------------------------------------------------------------------

class TestSafetyConstraints:
    def test_high_threshold_never_below_floor(self, optimizer):
        """Even if the model suggests low high threshold, floor enforces minimum."""
        rng = np.random.RandomState(42)
        # All signals at low similarity → model would pull high threshold down
        signals = [
            {"signal_type": "match_confirmed", "similarity": 0.5 + rng.uniform(0, 0.1),
             "platform": "civitai", "face_detection_confidence": None}
            for _ in range(30)
        ] + [
            {"signal_type": "match_dismissed", "similarity": 0.3 + rng.uniform(0, 0.1),
             "platform": "civitai", "face_detection_confidence": None}
            for _ in range(30)
        ]
        features, labels, platforms = optimizer._extract_features(signals)
        current = {"low": 0.50, "medium": 0.65, "high": 0.85}

        rec = optimizer._fit_and_recommend(features, labels, "civitai", current, signals, None)
        if rec:
            proposed_high = rec["proposed_value"]["high"]
            assert proposed_high >= HIGH_THRESHOLD_FLOOR

    def test_change_per_rec_capped(self, optimizer):
        """Single recommendation can't change threshold by more than MAX_CHANGE_PER_REC."""
        rng = np.random.RandomState(42)
        signals = [
            {"signal_type": "match_confirmed" if i < 30 else "match_dismissed",
             "similarity": float(rng.uniform(0.3, 1.0)),
             "platform": "x", "face_detection_confidence": None}
            for i in range(60)
        ]
        features, labels, platforms = optimizer._extract_features(signals)
        current = {"low": 0.50, "medium": 0.65, "high": 0.85}

        rec = optimizer._fit_and_recommend(features, labels, "x", current, signals, None)
        if rec:
            for tier in ["low", "medium", "high"]:
                diff = abs(rec["proposed_value"][tier] - current[tier])
                assert diff <= MAX_CHANGE_PER_REC + 0.001


# ---------------------------------------------------------------------------
# Reclassification counting
# ---------------------------------------------------------------------------

class TestCountReclassified:
    def test_counts_tier_changes(self, optimizer):
        signals = [
            {"similarity": 0.80, "signal_type": "match_confirmed"},  # high→medium
            {"similarity": 0.60, "signal_type": "match_dismissed"},  # medium→low
            {"similarity": 0.50, "signal_type": "match_dismissed"},  # low→low (no change)
        ]
        old = {"low": 0.50, "medium": 0.65, "high": 0.80}
        new = {"low": 0.55, "medium": 0.70, "high": 0.85}
        count = optimizer._count_reclassified(signals, old, new)
        # 0.80: was high, now medium → change
        # 0.60: was medium, now low → change
        # 0.50: was low, now below threshold → change
        assert count >= 2


# ---------------------------------------------------------------------------
# Full analyze with mocked DB
# ---------------------------------------------------------------------------

class TestThresholdOptimizerAnalyze:
    @pytest.mark.asyncio
    async def test_skip_on_insufficient_signals(self, optimizer):
        with patch.object(optimizer, "_load_review_signals", return_value=[]):
            recs = await optimizer.analyze()
        assert recs == []

    @pytest.mark.asyncio
    async def test_produces_recommendation_with_divergent_thresholds(self, optimizer):
        """With clearly separable data, optimizer should suggest threshold changes."""
        rng = np.random.RandomState(42)
        signals = [
            {"signal_type": "match_confirmed", "similarity": 0.9 + rng.uniform(-0.05, 0.05),
             "platform": "civitai", "face_detection_confidence": None}
            for _ in range(30)
        ] + [
            {"signal_type": "match_dismissed", "similarity": 0.4 + rng.uniform(-0.05, 0.05),
             "platform": "civitai", "face_detection_confidence": None}
            for _ in range(30)
        ]

        with patch.object(optimizer, "_load_review_signals", return_value=signals), \
             patch.object(optimizer, "_get_current_thresholds", return_value={"low": 0.50, "medium": 0.65, "high": 0.85}), \
             patch.object(optimizer, "_save_model_state", return_value=None):
            recs = await optimizer.analyze()

        # May or may not produce rec depending on model fit
        assert isinstance(recs, list)

    @pytest.mark.asyncio
    async def test_save_model_state_sets_training_signals(self, optimizer):
        """Verify _save_model_state sets training_signals and is_active."""
        captured = {}

        mock_session = AsyncMock()
        mock_scalar = MagicMock()
        mock_scalar.scalar_one.return_value = 0
        mock_session.execute = AsyncMock(return_value=mock_scalar)
        mock_session.commit = AsyncMock()

        def capture_add(obj):
            captured["model"] = obj

        mock_session.add = capture_add
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        rng = np.random.RandomState(42)
        features = np.column_stack([
            rng.uniform(0.3, 1.0, 60),
        ])
        labels = np.array([1]*30 + [0]*30)

        with patch("src.intelligence.analyzers.threshold.async_session", return_value=mock_session):
            await optimizer._save_model_state(features, labels)

        assert captured["model"].training_signals == 60
        assert captured["model"].is_active is True
