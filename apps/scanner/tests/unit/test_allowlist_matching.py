"""Test allowlist/known account matching with URL variations."""

import pytest

from src.utils.url_parser import check_allowlist, normalize_domain, parse_url


class TestURLParsing:
    def test_instagram_basic(self):
        result = parse_url("https://instagram.com/alice_creates")
        assert result.platform == "instagram"
        assert result.handle == "alice_creates"

    def test_instagram_www(self):
        result = parse_url("https://www.instagram.com/alice_creates")
        assert result.platform == "instagram"
        assert result.handle == "alice_creates"

    def test_instagram_mobile(self):
        result = parse_url("https://m.instagram.com/alice_creates")
        assert result.platform == "instagram"
        assert result.handle == "alice_creates"

    def test_instagram_trailing_slash(self):
        result = parse_url("https://instagram.com/alice_creates/")
        assert result.platform == "instagram"
        assert result.handle == "alice_creates"

    def test_twitter_basic(self):
        result = parse_url("https://twitter.com/alice_art")
        assert result.platform == "twitter"
        assert result.handle == "alice_art"

    def test_x_dot_com(self):
        result = parse_url("https://x.com/alice_art")
        assert result.platform == "twitter"
        assert result.handle == "alice_art"

    def test_civitai_user(self):
        result = parse_url("https://civitai.com/user/someuser")
        assert result.platform == "civitai"
        assert result.handle == "someuser"

    def test_reddit_user(self):
        result = parse_url("https://reddit.com/user/someuser")
        assert result.platform == "reddit"
        assert result.handle == "someuser"

    def test_unknown_domain(self):
        result = parse_url("https://randomsite.com/page")
        assert result.platform is None
        assert result.domain == "randomsite.com"

    def test_no_protocol(self):
        result = parse_url("instagram.com/alice")
        assert result.platform == "instagram"
        assert result.handle == "alice"


class TestNormalizeDomain:
    def test_www_prefix(self):
        assert normalize_domain("www.instagram.com") == "instagram.com"

    def test_mobile_prefix(self):
        assert normalize_domain("m.facebook.com") == "facebook.com"

    def test_no_prefix(self):
        assert normalize_domain("instagram.com") == "instagram.com"

    def test_uppercase(self):
        assert normalize_domain("WWW.Instagram.COM") == "instagram.com"


class TestAllowlistChecking:
    def test_exact_match(self, sample_known_accounts):
        result = check_allowlist(
            "https://instagram.com/alice_creates",
            sample_known_accounts,
        )
        assert result is not None
        assert result["platform"] == "instagram"

    def test_www_variation(self, sample_known_accounts):
        result = check_allowlist(
            "https://www.instagram.com/alice_creates/",
            sample_known_accounts,
        )
        assert result is not None

    def test_mobile_variation(self, sample_known_accounts):
        result = check_allowlist(
            "https://m.instagram.com/alice_creates",
            sample_known_accounts,
        )
        assert result is not None

    def test_different_handle_not_matched(self, sample_known_accounts):
        """alice_impersonator should NOT match alice_creates."""
        result = check_allowlist(
            "https://instagram.com/alice_impersonator",
            sample_known_accounts,
        )
        assert result is None

    def test_same_platform_different_account(self, sample_known_accounts):
        result = check_allowlist(
            "https://instagram.com/someone_else",
            sample_known_accounts,
        )
        assert result is None

    def test_twitter_match(self, sample_known_accounts):
        result = check_allowlist(
            "https://twitter.com/alice_art",
            sample_known_accounts,
        )
        assert result is not None
        assert result["platform"] == "twitter"

    def test_x_dot_com_match(self, sample_known_accounts):
        """x.com should also match twitter known accounts."""
        result = check_allowlist(
            "https://x.com/alice_art",
            sample_known_accounts,
        )
        assert result is not None

    def test_personal_website_domain_match(self, sample_known_accounts):
        result = check_allowlist(
            "https://alicecreates.com/portfolio/image1",
            sample_known_accounts,
        )
        assert result is not None

    def test_unknown_platform_no_match(self, sample_known_accounts):
        result = check_allowlist(
            "https://randomsite.com/user/alice",
            sample_known_accounts,
        )
        assert result is None

    def test_empty_known_accounts(self):
        result = check_allowlist(
            "https://instagram.com/alice",
            [],
        )
        assert result is None

    def test_none_page_url(self, sample_known_accounts):
        result = check_allowlist(None, sample_known_accounts)
        assert result is None
