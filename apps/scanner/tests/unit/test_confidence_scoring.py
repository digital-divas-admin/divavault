"""Test confidence scoring and threshold application."""

import pytest
from unittest.mock import patch

from src.matching.confidence import (
    get_confidence_tier,
    should_capture_evidence,
    should_notify,
    should_run_ai_detection,
)


class TestConfidenceTier:
    def test_high_confidence(self):
        with patch("src.matching.confidence.settings") as mock:
            mock.match_threshold_high = 0.85
            mock.match_threshold_medium = 0.65
            mock.match_threshold_low = 0.50
            assert get_confidence_tier(0.90) == "high"
            assert get_confidence_tier(0.85) == "high"

    def test_medium_confidence(self):
        with patch("src.matching.confidence.settings") as mock:
            mock.match_threshold_high = 0.85
            mock.match_threshold_medium = 0.65
            mock.match_threshold_low = 0.50
            assert get_confidence_tier(0.75) == "medium"
            assert get_confidence_tier(0.65) == "medium"

    def test_low_confidence(self):
        with patch("src.matching.confidence.settings") as mock:
            mock.match_threshold_high = 0.85
            mock.match_threshold_medium = 0.65
            mock.match_threshold_low = 0.50
            assert get_confidence_tier(0.55) == "low"
            assert get_confidence_tier(0.50) == "low"

    def test_below_threshold(self):
        with patch("src.matching.confidence.settings") as mock:
            mock.match_threshold_high = 0.85
            mock.match_threshold_medium = 0.65
            mock.match_threshold_low = 0.50
            assert get_confidence_tier(0.49) is None
            assert get_confidence_tier(0.30) is None
            assert get_confidence_tier(0.0) is None


class TestTierGating:
    """Test that tier configuration correctly gates scanner behavior."""

    def test_free_tier_no_ai_detection(self):
        tier_config = {"ai_detection": False, "capture_evidence": False, "notify_on_match": True}
        assert should_run_ai_detection("medium", False, tier_config) is False

    def test_protected_tier_has_ai_detection(self):
        tier_config = {"ai_detection": True, "capture_evidence": True, "notify_on_match": True}
        assert should_run_ai_detection("medium", False, tier_config) is True

    def test_ai_detection_skipped_for_low_confidence(self):
        tier_config = {"ai_detection": True}
        assert should_run_ai_detection("low", False, tier_config) is False

    def test_ai_detection_skipped_for_known_account(self):
        tier_config = {"ai_detection": True}
        assert should_run_ai_detection("high", True, tier_config) is False

    def test_free_tier_no_evidence_capture(self):
        tier_config = {"capture_evidence": False}
        assert should_capture_evidence("high", False, tier_config) is False

    def test_protected_tier_evidence_capture(self):
        tier_config = {"capture_evidence": True}
        assert should_capture_evidence("medium", False, tier_config) is True

    def test_evidence_skipped_for_known_account(self):
        tier_config = {"capture_evidence": True}
        assert should_capture_evidence("high", True, tier_config) is False

    def test_evidence_skipped_for_low_confidence(self):
        tier_config = {"capture_evidence": True}
        assert should_capture_evidence("low", False, tier_config) is False

    def test_notification_for_medium_confidence(self):
        tier_config = {"notify_on_match": True}
        assert should_notify("medium", False, tier_config) is True

    def test_no_notification_for_low_confidence(self):
        tier_config = {"notify_on_match": True}
        assert should_notify("low", False, tier_config) is False

    def test_no_notification_for_known_account(self):
        tier_config = {"notify_on_match": True}
        assert should_notify("high", True, tier_config) is False
