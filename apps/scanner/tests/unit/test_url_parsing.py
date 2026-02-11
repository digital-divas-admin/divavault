"""Test URL parsing for platform and handle extraction."""

import pytest

from src.utils.url_parser import parse_url


class TestPlatformExtraction:
    @pytest.mark.parametrize(
        "url,expected_platform,expected_handle",
        [
            ("https://instagram.com/user123", "instagram", "user123"),
            ("https://www.instagram.com/user.name/", "instagram", "user.name"),
            ("https://m.instagram.com/user_name", "instagram", "user_name"),
            ("https://twitter.com/handle", "twitter", "handle"),
            ("https://x.com/handle", "twitter", "handle"),
            ("https://www.x.com/handle/", "twitter", "handle"),
            ("https://tiktok.com/@creator", "tiktok", "creator"),
            ("https://www.tiktok.com/creator", "tiktok", "creator"),
            ("https://facebook.com/profile.name", "facebook", "profile.name"),
            ("https://linkedin.com/in/john-doe", "linkedin", "john-doe"),
            ("https://deviantart.com/artist-name", "deviantart", "artist-name"),
            ("https://reddit.com/user/redditor", "reddit", "redditor"),
            ("https://civitai.com/user/creator1", "civitai", "creator1"),
            ("https://youtube.com/@channel", "youtube", "channel"),
        ],
    )
    def test_known_platforms(self, url, expected_platform, expected_handle):
        result = parse_url(url)
        assert result.platform == expected_platform
        assert result.handle == expected_handle

    def test_unknown_platform(self):
        result = parse_url("https://unknown-site.com/page")
        assert result.platform is None
        assert result.domain == "unknown-site.com"

    def test_subdomain_matching(self):
        result = parse_url("https://m.instagram.com/user")
        assert result.platform == "instagram"

    def test_handle_case_insensitive(self):
        result = parse_url("https://instagram.com/UserName")
        assert result.handle == "username"

    def test_malformed_url(self):
        result = parse_url("not a url at all")
        assert result.platform is None

    def test_empty_path(self):
        result = parse_url("https://instagram.com/")
        assert result.platform == "instagram"
        assert result.handle is None
