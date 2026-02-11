"""Test that subscription tiers correctly gate scanner behavior."""

import pytest

from src.config import TIER_CONFIG, get_tier_config


class TestTierConfig:
    def test_free_tier_defaults(self):
        config = get_tier_config("free")
        assert config["reverse_image_interval_hours"] == 168  # weekly
        assert config["reverse_image_max_photos"] == 3
        assert config["capture_evidence"] is False
        assert config["ai_detection"] is False
        assert config["generate_takedown"] is False
        assert config["show_full_details"] is False
        assert config["url_check"] is False
        assert config["max_known_accounts"] == 3

    def test_protected_tier(self):
        config = get_tier_config("protected")
        assert config["reverse_image_interval_hours"] == 24  # daily
        assert config["reverse_image_max_photos"] == 10
        assert config["capture_evidence"] is True
        assert config["ai_detection"] is True
        assert config["generate_takedown"] is True
        assert config["show_full_details"] is True
        assert config["url_check"] is True
        assert config["max_known_accounts"] == 10

    def test_premium_tier(self):
        config = get_tier_config("premium")
        assert config["reverse_image_interval_hours"] == 6
        assert config["capture_evidence"] is True
        assert config["ai_detection"] is True
        assert config["priority_scanning"] is True
        assert config["max_known_accounts"] == 25

    def test_unknown_tier_defaults_to_free(self):
        config = get_tier_config("unknown_tier")
        assert config == TIER_CONFIG["free"]

    def test_crawl_registry_embeddings_free_vs_paid(self):
        free = get_tier_config("free")
        protected = get_tier_config("protected")
        assert free["crawl_registry_embeddings"] == 1
        assert protected["crawl_registry_embeddings"] == "all"

    def test_all_tiers_have_store_match(self):
        for tier in ["free", "protected", "premium"]:
            assert get_tier_config(tier)["store_match"] is True

    def test_all_tiers_have_notify(self):
        for tier in ["free", "protected", "premium"]:
            assert get_tier_config(tier)["notify_on_match"] is True

    def test_all_tiers_have_platform_crawl(self):
        for tier in ["free", "protected", "premium"]:
            assert get_tier_config(tier)["platform_crawl_matching"] is True
