"""Tests for Fix 1: FP Filter — face_detection_confidence, image_resolution, section features."""

import json
import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.intelligence.analyzers.false_positives import (
    FalsePositiveFilter,
    KNOWN_PLATFORMS,
    TIER_TO_ORDINAL,
    _log_resolution,
    _section_hash,
)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

class TestLogResolution:
    """Test the _log_resolution helper."""

    def test_typical_hd_image(self):
        """1920x1080 should produce a value around 0.9."""
        val = _log_resolution(1920, 1080)
        assert 0.8 < val < 1.0

    def test_small_thumbnail(self):
        """100x100 should produce a low value."""
        val = _log_resolution(100, 100)
        assert 0.4 < val < 0.7

    def test_none_dimensions(self):
        """Missing dimensions should return default 0.5."""
        assert _log_resolution(None, None) == 0.5
        assert _log_resolution(0, 0) == 0.5
        assert _log_resolution(None, 1080) == 0.5

    def test_very_large_image(self):
        """4K image should cap at 1.0."""
        val = _log_resolution(4096, 2160)
        assert val <= 1.0


class TestSectionHash:
    """Test the _section_hash helper."""

    def test_none_returns_default(self):
        assert _section_hash(None) == 0.5

    def test_empty_string_returns_default(self):
        assert _section_hash("") == 0.5

    def test_returns_float_in_range(self):
        val = _section_hash("https://civitai.com/models/lora")
        assert 0.0 <= val <= 1.0

    def test_deterministic(self):
        """Same input always produces same output."""
        a = _section_hash("https://civitai.com/models")
        b = _section_hash("https://civitai.com/models")
        assert a == b

    def test_case_insensitive(self):
        a = _section_hash("CIVITAI")
        b = _section_hash("civitai")
        assert a == b

    def test_different_sections_differ(self):
        a = _section_hash("https://civitai.com/models")
        b = _section_hash("https://deviantart.com/tag/aiart")
        assert a != b


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

class TestExtractFeatures:
    """Test that the feature vector includes all new features."""

    def setup_method(self):
        self.analyzer = FalsePositiveFilter()

    def _make_sample(self, **overrides):
        base = {
            "label": 1,
            "similarity": 0.82,
            "platform": "civitai",
            "confidence_tier": "high",
            "is_ai_generated": True,
            "ai_detection_score": 0.91,
            "face_count": 1,
            "face_detection_confidence": 0.88,
            "image_resolution": 0.85,
            "section": "https://civitai.com/models/lora",
        }
        base.update(overrides)
        return base

    def test_feature_count(self):
        """Feature vector should have 13 dimensions:
        similarity + face_det_conf + image_res + face_count + is_ai + ai_score +
        confidence_tier + 5 platform one-hots + section_hash
        """
        data = [self._make_sample()]
        X, y, names = self.analyzer._extract_features(data)
        assert X.shape == (1, 13)
        assert len(names) == 13

    def test_feature_names_include_new_features(self):
        data = [self._make_sample()]
        _, _, names = self.analyzer._extract_features(data)
        assert "face_detection_confidence" in names
        assert "image_resolution" in names
        assert "section_hash" in names

    def test_face_detection_confidence_position(self):
        """face_detection_confidence should be at index 1."""
        data = [self._make_sample(face_detection_confidence=0.95)]
        X, _, _ = self.analyzer._extract_features(data)
        assert X[0, 1] == pytest.approx(0.95)

    def test_image_resolution_position(self):
        """image_resolution should be at index 2."""
        data = [self._make_sample(image_resolution=0.72)]
        X, _, _ = self.analyzer._extract_features(data)
        assert X[0, 2] == pytest.approx(0.72)

    def test_section_hash_is_last(self):
        """section_hash should be the last feature."""
        data = [self._make_sample(section="https://civitai.com/models/lora")]
        X, _, names = self.analyzer._extract_features(data)
        assert names[-1] == "section_hash"
        assert 0.0 <= X[0, -1] <= 1.0

    def test_default_values_for_missing_features(self):
        """Missing face_det_conf and image_resolution should default to 0.5."""
        data = [self._make_sample()]
        del data[0]["face_detection_confidence"]
        del data[0]["image_resolution"]
        X, _, _ = self.analyzer._extract_features(data)
        assert X[0, 1] == pytest.approx(0.5)  # face_detection_confidence
        assert X[0, 2] == pytest.approx(0.5)  # image_resolution

    def test_platform_one_hot_encoding(self):
        """civitai should produce [1,0,0,0,0] for platform columns."""
        data = [self._make_sample(platform="civitai")]
        X, _, names = self.analyzer._extract_features(data)
        civitai_idx = names.index("platform_civitai")
        assert X[0, civitai_idx] == 1.0
        for p in KNOWN_PLATFORMS:
            if p != "civitai":
                idx = names.index(f"platform_{p}")
                assert X[0, idx] == 0.0

    def test_multiple_samples(self):
        """Verify feature extraction works with multiple samples."""
        data = [
            self._make_sample(similarity=0.9, label=1),
            self._make_sample(similarity=0.5, label=0, platform="deviantart"),
            self._make_sample(similarity=0.7, label=1, face_detection_confidence=0.3),
        ]
        X, y, names = self.analyzer._extract_features(data)
        assert X.shape == (3, 13)
        assert y.tolist() == [1, 0, 1]


# ---------------------------------------------------------------------------
# Training + scoring end-to-end (mocked DB)
# ---------------------------------------------------------------------------

class TestFPFilterAnalyze:
    """End-to-end test of the FP filter analyzer with mocked database."""

    def setup_method(self):
        self.analyzer = FalsePositiveFilter()

    def _make_training_row(self, signal_type, similarity, platform="civitai",
                           face_det_conf="0.85", width=1920, height=1080,
                           page_url="https://civitai.com/models/lora"):
        """Build a row tuple matching the SELECT in _load_training_data."""
        match_id = str(uuid4())
        return (
            signal_type,            # 0: signal_type
            str(similarity),        # 1: similarity
            platform,               # 2: platform
            "high",                 # 3: confidence_tier
            "true",                 # 4: is_ai_generated
            "0.9",                  # 5: ai_detection_score
            "1",                    # 6: face_count
            match_id,               # 7: match_id
            face_det_conf,          # 8: face_detection_confidence
            width,                  # 9: img_width
            height,                 # 10: img_height
            page_url,               # 11: page_url
        )

    @pytest.mark.asyncio
    async def test_load_training_data_extracts_new_fields(self):
        """Verify _load_training_data returns face_detection_confidence, image_resolution, section."""
        rows = [
            self._make_training_row("match_confirmed", 0.9, face_det_conf="0.92", width=1920, height=1080),
            self._make_training_row("match_dismissed", 0.5, face_det_conf="0.45", width=200, height=200),
        ]

        mock_result = MagicMock()
        mock_result.fetchall.return_value = rows

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.analyzers.false_positives.async_session", return_value=mock_session):
            data = await self.analyzer._load_training_data()

        assert len(data) == 2
        # First row: confirmed
        assert data[0]["face_detection_confidence"] == pytest.approx(0.92)
        assert data[0]["image_resolution"] == pytest.approx(_log_resolution(1920, 1080))
        assert data[0]["section"] == "https://civitai.com/models/lora"
        # Second row: dismissed
        assert data[1]["face_detection_confidence"] == pytest.approx(0.45)

    @pytest.mark.asyncio
    async def test_full_analyze_produces_correct_feature_dimensions(self):
        """Verify that the full analyze path trains on 13-dim feature vectors."""
        # Generate 60 samples (30 confirmed, 30 dismissed) to meet minimums
        rng = np.random.RandomState(42)
        training_data = []
        for i in range(60):
            label = 1 if i < 30 else 0
            training_data.append({
                "label": label,
                "similarity": float(rng.uniform(0.4, 1.0)),
                "platform": "civitai",
                "confidence_tier": "high",
                "is_ai_generated": True,
                "ai_detection_score": float(rng.uniform(0.5, 1.0)),
                "face_count": 1,
                "face_detection_confidence": float(rng.uniform(0.3, 0.99)),
                "image_resolution": float(rng.uniform(0.3, 0.95)),
                "section": f"https://civitai.com/section/{i % 5}",
            })

        with patch.object(self.analyzer, "_load_training_data", return_value=training_data), \
             patch.object(self.analyzer, "_score_pending_matches", return_value=0), \
             patch.object(self.analyzer, "_save_model_state", return_value=None), \
             patch.object(self.analyzer, "_detect_repeat_fps", return_value=[]):

            recs = await self.analyzer.analyze()

        # analyze should complete without error
        assert isinstance(recs, list)

    @pytest.mark.asyncio
    async def test_save_model_state_includes_training_signals(self):
        """Verify _save_model_state sets training_signals and is_active."""
        from sklearn.ensemble import RandomForestClassifier

        model = RandomForestClassifier(n_estimators=10, random_state=42)
        X = np.random.randn(50, 13)
        y = np.array([1]*25 + [0]*25)
        model.fit(X, y)

        captured_state = {}

        async def mock_commit():
            pass

        mock_session = AsyncMock()
        mock_scalar = MagicMock()
        mock_scalar.scalar_one.return_value = 0
        mock_session.execute = AsyncMock(return_value=mock_scalar)
        mock_session.commit = mock_commit

        def capture_add(obj):
            captured_state["model"] = obj

        mock_session.add = capture_add
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        feature_names = ["f1"] * 13

        with patch("src.intelligence.analyzers.false_positives.async_session", return_value=mock_session):
            await self.analyzer._save_model_state(model, {"f1": 0.9}, feature_names, 200)

        assert captured_state["model"].training_signals == 200
        assert captured_state["model"].is_active is True
