"""Test discovery sources with mocked API responses."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.discovery.base import DiscoveryContext
from src.discovery.url_check import URLCheckDiscovery, _extract_title


class TestURLCheckDiscovery:
    @pytest.mark.asyncio
    async def test_empty_urls(self):
        discovery = URLCheckDiscovery()
        context = DiscoveryContext(urls=[])
        results = await discovery.discover(context)
        assert results == []

    @pytest.mark.asyncio
    async def test_none_urls(self):
        discovery = URLCheckDiscovery()
        context = DiscoveryContext(urls=None)
        results = await discovery.discover(context)
        assert results == []

    def test_get_source_type(self):
        assert URLCheckDiscovery().get_source_type() == "url_check"

    def test_get_source_name(self):
        assert URLCheckDiscovery().get_source_name() == "url_check"


class TestExtractTitle:
    def test_basic_title(self):
        assert _extract_title("<title>Hello World</title>") == "Hello World"

    def test_no_title(self):
        assert _extract_title("<html><body></body></html>") is None

    def test_title_with_whitespace(self):
        assert _extract_title("<title>  Hello  </title>") == "Hello"

    def test_long_title_truncated(self):
        long_title = "A" * 300
        result = _extract_title(f"<title>{long_title}</title>")
        assert len(result) == 200


class TestCivitAICrawl:
    def test_source_type(self):
        from src.discovery.platform_crawl import CivitAICrawl
        assert CivitAICrawl().get_source_type() == "platform_crawl"

    def test_source_name(self):
        from src.discovery.platform_crawl import CivitAICrawl
        assert CivitAICrawl().get_source_name() == "civitai"


class TestTinEyeDiscovery:
    def test_source_type(self):
        from src.discovery.reverse_image import TinEyeDiscovery
        assert TinEyeDiscovery().get_source_type() == "reverse_image"

    def test_source_name(self):
        from src.discovery.reverse_image import TinEyeDiscovery
        assert TinEyeDiscovery().get_source_name() == "tineye"

    @pytest.mark.asyncio
    async def test_no_api_key_returns_empty(self):
        from src.discovery.reverse_image import TinEyeDiscovery

        with patch("src.discovery.reverse_image.settings") as mock:
            mock.tineye_api_key = ""
            discovery = TinEyeDiscovery()
            context = DiscoveryContext(images=[("bucket", "path.jpg")])
            results = await discovery.discover(context)
            assert results == []
