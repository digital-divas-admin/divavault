"""Test DeviantArt hybrid RSS + HTML discovery source with mocked responses."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.discovery.base import DiscoveredImageResult, DiscoveryContext
from src.utils.retry import CircuitOpenError
from src.discovery.deviantart_crawl import (
    ALL_TAGS,
    DEVIANTART_RSS_URL,
    DEVIANTART_TAG_URL,
    DeviantArtCrawl,
    HTML_PAGE_SIZE,
    RSS_PAGE_SIZE,
)


# ---------------------------------------------------------------------------
# Helpers: build mock RSS XML responses
# ---------------------------------------------------------------------------

def _rss_item(
    title="AI Portrait",
    image_url="https://img.deviantart.net/abc/image.jpg",
    page_url="https://www.deviantart.com/artist/art/test-123",
    width="800",
    height="600",
):
    """Build an RSS <item> XML fragment."""
    return f"""<item>
        <title>{title}</title>
        <link>{page_url}</link>
        <media:title type="plain" xmlns:media="http://search.yahoo.com/mrss/">{title}</media:title>
        <media:content url="{image_url}" medium="image" width="{width}" height="{height}" xmlns:media="http://search.yahoo.com/mrss/" />
    </item>"""


def _rss_feed(items: list[str], has_next: bool = True, offset: int = 0):
    """Build a complete RSS XML response."""
    next_link = ""
    if has_next:
        next_offset = offset + RSS_PAGE_SIZE
        next_link = f'<atom:link rel="next" href="https://backend.deviantart.com/rss.xml?q=boost%3Apopular+tag%3Atest&amp;offset={next_offset}" xmlns:atom="http://www.w3.org/2005/Atom" />'

    items_xml = "\n".join(items)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
    xmlns:media="http://search.yahoo.com/mrss/"
    xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>DeviantArt: Popular</title>
    {next_link}
    {items_xml}
  </channel>
</rss>"""


def _mock_response(status=200, text_data=""):
    """Create a mock aiohttp response as an async context manager."""
    resp = AsyncMock()
    resp.status = status
    resp.text = AsyncMock(return_value=text_data)
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=resp)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


# ---------------------------------------------------------------------------
# Basic identity tests
# ---------------------------------------------------------------------------

class TestDeviantArtCrawlIdentity:
    def test_source_type(self):
        assert DeviantArtCrawl().get_source_type() == "platform_crawl"

    def test_source_name(self):
        assert DeviantArtCrawl().get_source_name() == "deviantart"

    def test_tag_lists_not_empty(self):
        assert len(ALL_TAGS) > 0

    def test_no_oauth_state(self):
        """RSS crawler has no token attributes."""
        crawl = DeviantArtCrawl()
        assert not hasattr(crawl, "_token")
        assert not hasattr(crawl, "_token_expires")


# ---------------------------------------------------------------------------
# Registry integration
# ---------------------------------------------------------------------------

class TestDeviantArtRegistry:
    def test_registered_in_platform_scrapers(self):
        from src.discovery import PLATFORM_SCRAPERS
        assert "deviantart" in PLATFORM_SCRAPERS
        assert isinstance(PLATFORM_SCRAPERS["deviantart"], DeviantArtCrawl)

    def test_rate_limiter_configured(self):
        from src.utils.rate_limiter import RATE_LIMITERS
        assert "deviantart" in RATE_LIMITERS
        assert RATE_LIMITERS["deviantart"].rate == 2.0
        assert RATE_LIMITERS["deviantart"].max_tokens == 10.0

    def test_config_max_pages_exist(self):
        from src.config import Settings
        s = Settings()
        assert s.deviantart_max_pages == 50
        assert s.deviantart_high_damage_pages == 1000
        assert s.deviantart_medium_damage_pages == 100
        assert s.deviantart_low_damage_pages == 10
        assert s.deviantart_concurrency == 5


# ---------------------------------------------------------------------------
# RSS page fetching
# ---------------------------------------------------------------------------

class TestFetchRssPage:
    @pytest.mark.asyncio
    async def test_parses_items_with_media_content(self):
        """RSS items with media:content are returned as DiscoveredImageResult."""
        crawl = DeviantArtCrawl()

        items = [
            _rss_item("Portrait 1", "https://img.da.net/1.jpg", "https://da.com/art/1"),
            _rss_item("Portrait 2", "https://img.da.net/2.jpg", "https://da.com/art/2"),
        ]
        xml = _rss_feed(items, has_next=True)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=xml))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert len(results) == 2
        assert results[0].source_url == "https://img.da.net/1.jpg"
        assert results[0].page_url == "https://da.com/art/1"
        assert results[0].page_title == "Portrait 1"
        assert results[0].platform == "deviantart"
        assert has_next is True

    @pytest.mark.asyncio
    async def test_returns_false_when_no_next_link(self):
        """When there's no atom:link rel=next, has_next should be False."""
        crawl = DeviantArtCrawl()

        items = [_rss_item("Last Page", "https://img.da.net/last.jpg")]
        xml = _rss_feed(items, has_next=False)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=xml))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "portrait", 120
        )

        assert len(results) == 1
        assert has_next is False

    @pytest.mark.asyncio
    async def test_non_200_returns_empty(self):
        """Non-200 returns empty results with has_next=False."""
        crawl = DeviantArtCrawl()

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(status=403))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert results == []
        assert has_next is False

    @pytest.mark.asyncio
    async def test_malformed_xml_returns_empty(self):
        """Malformed XML returns empty results gracefully."""
        crawl = DeviantArtCrawl()

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data="<not valid xml"))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert results == []
        assert has_next is False

    @pytest.mark.asyncio
    async def test_long_title_truncated(self):
        """Titles longer than 200 chars are truncated."""
        crawl = DeviantArtCrawl()

        long_title = "A" * 300
        items = [_rss_item(long_title, "https://img.da.net/1.jpg")]
        xml = _rss_feed(items, has_next=False)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=xml))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert len(results[0].page_title) == 200

    @pytest.mark.asyncio
    async def test_passes_correct_params(self):
        """Verify query and offset params sent to RSS endpoint."""
        crawl = DeviantArtCrawl()

        xml = _rss_feed([], has_next=False)
        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=xml))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "portrait", 120
        )

        call_kwargs = session.get.call_args
        params = call_kwargs.kwargs.get("params") or call_kwargs[1].get("params")
        assert params["q"] == "sort:time tag:portrait"
        assert params["offset"] == "120"

    @pytest.mark.asyncio
    async def test_picks_highest_resolution_image(self):
        """When multiple media:content elements exist, picks the widest."""
        crawl = DeviantArtCrawl()

        # Item with two resolutions
        item_xml = """<item>
            <title>Multi Res</title>
            <link>https://da.com/art/multi</link>
            <media:title type="plain" xmlns:media="http://search.yahoo.com/mrss/">Multi Res</media:title>
            <media:content url="https://img.da.net/thumb.jpg" medium="image" width="150" height="150" xmlns:media="http://search.yahoo.com/mrss/" />
            <media:content url="https://img.da.net/full.jpg" medium="image" width="1200" height="800" xmlns:media="http://search.yahoo.com/mrss/" />
        </item>"""
        xml = _rss_feed([item_xml], has_next=False)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=xml))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_rss_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert len(results) == 1
        assert results[0].source_url == "https://img.da.net/full.jpg"


# ---------------------------------------------------------------------------
# Multi-page tag fetching
# ---------------------------------------------------------------------------

class TestFetchTagPages:
    @pytest.mark.asyncio
    async def test_stops_when_exhausted(self):
        """Multi-page loop stops when has_next=False."""
        crawl = DeviantArtCrawl()

        call_count = 0

        async def mock_fetch_html_page(session, limiter, tag, page):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return [_make_discovered("img.jpg")], True
            return [_make_discovered("last.jpg")], False  # exhausted

        with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html_page):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 10
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "aiart", None
                )

        assert len(results) == 3
        assert final_offset is None  # tag exhausted
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_respects_max_pages(self):
        """Multi-page loop stops at max_pages even if has_next=True."""
        crawl = DeviantArtCrawl()

        call_count = 0

        async def mock_fetch_html_page(session, limiter, tag, page):
            nonlocal call_count
            call_count += 1
            return [_make_discovered("img.jpg")], True  # always has_more

        with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html_page):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 3
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "aiart", None
                )

        assert call_count == 3
        assert len(results) == 3
        # Default is html mode starting at page 1; after 3 pages, cursor is html:4
        assert final_offset == "html:4"

    @pytest.mark.asyncio
    async def test_respects_tag_max_pages_override(self):
        """Per-tag max_pages overrides the global setting."""
        crawl = DeviantArtCrawl()

        call_count = 0

        async def mock_fetch_html_page(session, limiter, tag, page):
            nonlocal call_count
            call_count += 1
            return [_make_discovered("img.jpg")], True

        with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html_page):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 100  # global is high
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "aiart", None, tag_max_pages=2
                )

        assert call_count == 2  # tag_max_pages=2 overrides global 100
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_resumes_from_saved_offset(self):
        """Passes start_offset to first page request."""
        crawl = DeviantArtCrawl()

        offsets_seen = []

        async def mock_fetch_rss_page(session, limiter, tag, offset):
            offsets_seen.append(offset)
            return [], False  # exhausted immediately

        with patch.object(crawl, "_fetch_rss_page", side_effect=mock_fetch_rss_page):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 5
                await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "aiart", "rss:240"
                )

        assert offsets_seen[0] == 240  # resumed from saved offset


# ---------------------------------------------------------------------------
# Full discover() flow
# ---------------------------------------------------------------------------

class TestDiscover:
    @pytest.mark.asyncio
    async def test_crawls_all_tags(self):
        """discover() iterates over all tags concurrently."""
        crawl = DeviantArtCrawl()
        tags_crawled = []

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            tags_crawled.append(tag)
            return [_make_discovered(f"{tag}.jpg")], "html:2"

        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            context = DiscoveryContext(platform="deviantart")
            result = await crawl.discover(context)

        assert set(tags_crawled) == set(ALL_TAGS)
        assert len(result.images) == len(ALL_TAGS)
        assert result.tags_total == len(ALL_TAGS)

    @pytest.mark.asyncio
    async def test_search_cursors_passed_and_returned(self):
        """Saved cursors are passed to tags and updated cursors are returned."""
        crawl = DeviantArtCrawl()

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            if tag == "aiart":
                assert start_offset == "120"
                return [], "180"
            return [], None  # other tags start fresh, exhaust immediately

        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            context = DiscoveryContext(
                platform="deviantart",
                search_cursors={"aiart": "120"},
            )
            result = await crawl.discover(context)

        assert result.search_cursors["aiart"] == "180"
        # Exhausted tags should have None
        exhausted_count = sum(1 for v in result.search_cursors.values() if v is None)
        assert exhausted_count == len(ALL_TAGS) - 1
        assert result.tags_exhausted == len(ALL_TAGS) - 1

    @pytest.mark.asyncio
    async def test_circuit_breaker_stops_remaining_tags(self):
        """CircuitOpenError on one tag prevents remaining tags from running."""
        crawl = DeviantArtCrawl()
        tags_succeeded = []

        # Use a small tag set so we can control concurrency behavior
        test_tags = ["tag_a", "tag_b", "tag_c", "tag_d", "tag_e"]

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            if tag == "tag_a":
                raise CircuitOpenError("deviantart circuit open")
            tags_succeeded.append(tag)
            return [_make_discovered(f"{tag}.jpg")], "html:2"

        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_concurrency = 1  # sequential for predictable behavior
                mock_settings.proxy_url = ""
                context = DiscoveryContext(platform="deviantart", search_terms=test_tags)
                result = await crawl.discover(context)

        # After circuit trips on tag_a, remaining tags should be skipped
        assert len(tags_succeeded) == 0
        assert len(result.images) == 0

    @pytest.mark.asyncio
    async def test_individual_tag_error_continues(self):
        """A non-circuit error on one tag doesn't stop other tags."""
        crawl = DeviantArtCrawl()
        tags_attempted = []

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            tags_attempted.append(tag)
            if tag == ALL_TAGS[1]:  # second tag errors
                raise ValueError("some transient error")
            return [_make_discovered(f"{tag}.jpg")], "html:2"

        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            context = DiscoveryContext(platform="deviantart")
            result = await crawl.discover(context)

        # All tags attempted despite error on second
        assert len(tags_attempted) == len(ALL_TAGS)
        # All but the errored tag returned results
        assert len(result.images) == len(ALL_TAGS) - 1

    @pytest.mark.asyncio
    async def test_empty_search_cursors_treated_as_fresh(self):
        """None search_cursors means all tags start with no saved offset."""
        crawl = DeviantArtCrawl()
        start_offsets_seen = []

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            start_offsets_seen.append(start_offset)
            return [], None

        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            context = DiscoveryContext(platform="deviantart", search_cursors=None)
            await crawl.discover(context)

        assert all(o is None for o in start_offsets_seen)

    @pytest.mark.asyncio
    async def test_uses_custom_search_terms(self):
        """When context has search_terms, those are used instead of ALL_TAGS."""
        crawl = DeviantArtCrawl()
        tags_crawled = []

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            tags_crawled.append(tag)
            return [], None

        custom_terms = ["custom tag one", "custom tag two"]
        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            context = DiscoveryContext(platform="deviantart", search_terms=custom_terms)
            result = await crawl.discover(context)

        assert set(tags_crawled) == set(custom_terms)
        assert result.tags_total == 2

    @pytest.mark.asyncio
    async def test_passes_tag_depths_to_fetch(self):
        """tag_depths from context are passed as tag_max_pages."""
        crawl = DeviantArtCrawl()
        max_pages_seen = {}

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset, tag_max_pages=None):
            max_pages_seen[tag] = tag_max_pages
            return [], None

        with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
            context = DiscoveryContext(
                platform="deviantart",
                search_terms=["nude", "portrait", "stock"],
                tag_depths={"nude": 1000, "portrait": 100, "stock": 10},
            )
            await crawl.discover(context)

        assert max_pages_seen["nude"] == 1000
        assert max_pages_seen["portrait"] == 100
        assert max_pages_seen["stock"] == 10


# ---------------------------------------------------------------------------
# Cursor parsing
# ---------------------------------------------------------------------------

class TestCursorParsing:
    def test_none_returns_html_one(self):
        assert DeviantArtCrawl._parse_cursor(None) == ("html", 1)

    def test_empty_string_returns_html_one(self):
        assert DeviantArtCrawl._parse_cursor("") == ("html", 1)

    def test_rss_cursor(self):
        assert DeviantArtCrawl._parse_cursor("rss:120") == ("rss", 120)

    def test_html_cursor(self):
        assert DeviantArtCrawl._parse_cursor("html:5") == ("html", 5)

    def test_legacy_bare_int(self):
        """Legacy cursors (bare integers) are treated as RSS offsets."""
        assert DeviantArtCrawl._parse_cursor("240") == ("rss", 240)


# ---------------------------------------------------------------------------
# HTML page fetching
# ---------------------------------------------------------------------------

def _html_tag_page(items: list[tuple[str, str]], has_next: bool = True, page: int = 1):
    """Build a mock HTML tag page.

    items: list of (deviation_url, image_url) pairs.
    """
    items_html = ""
    for page_url, image_url in items:
        items_html += f'''
        <div class="_2dF1B">
            <a href="{page_url}" class="_1RICD">
                <img src="{image_url}" alt="thumbnail" />
            </a>
        </div>
        '''

    next_link = ""
    if has_next:
        next_link = f'<a href="https://www.deviantart.com/tag/test?page={page + 1}">Next</a>'

    return f"""<!DOCTYPE html>
    <html><body>
    <div class="gallery">{items_html}</div>
    {next_link}
    </body></html>"""


class TestFetchHtmlPage:
    @pytest.mark.asyncio
    async def test_parses_paired_images(self):
        """HTML page with paired deviation links and wixmp images."""
        crawl = DeviantArtCrawl()

        items = [
            ("https://www.deviantart.com/artist1/art/Portrait-One-12345",
             "https://images-wixmp-abc.wixmp.com/f/uuid/image1.jpg?token=xyz"),
            ("https://www.deviantart.com/artist2/art/Portrait-Two-67890",
             "https://images-wixmp-def.wixmp.com/f/uuid/image2.jpg?token=abc"),
        ]
        html = _html_tag_page(items, has_next=True)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=html))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_html_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "cosplay", 1
        )

        assert len(results) == 2
        assert results[0].page_url == "https://www.deviantart.com/artist1/art/Portrait-One-12345"
        assert "images-wixmp" in results[0].source_url
        assert results[0].page_title == "Portrait One"
        assert results[0].platform == "deviantart"
        assert has_next is True

    @pytest.mark.asyncio
    async def test_no_next_page(self):
        """HTML page without next page link returns has_next=False."""
        crawl = DeviantArtCrawl()

        items = [
            ("https://www.deviantart.com/artist/art/Last-Page-99999",
             "https://images-wixmp-abc.wixmp.com/f/uuid/last.jpg?token=xyz"),
        ]
        html = _html_tag_page(items, has_next=False)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=html))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_html_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "cosplay", 5
        )

        assert len(results) == 1
        assert has_next is False

    @pytest.mark.asyncio
    async def test_non_200_returns_empty(self):
        """Non-200 HTML response returns empty."""
        crawl = DeviantArtCrawl()

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(status=404))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, has_next = await crawl._fetch_html_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "cosplay", 1
        )

        assert results == []
        assert has_next is False

    @pytest.mark.asyncio
    async def test_strips_comment_anchors_from_page_url(self):
        """Page URLs with #comments are cleaned."""
        crawl = DeviantArtCrawl()

        items = [
            ("https://www.deviantart.com/artist/art/Title-123#comments",
             "https://images-wixmp-abc.wixmp.com/f/uuid/img.jpg?token=xyz"),
        ]
        html = _html_tag_page(items, has_next=False)

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=html))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_html_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "cosplay", 1
        )

        assert results[0].page_url == "https://www.deviantart.com/artist/art/Title-123"

    @pytest.mark.asyncio
    async def test_tag_with_spaces_converted_to_hyphens(self):
        """Tags with spaces are converted to hyphens in the URL path."""
        crawl = DeviantArtCrawl()

        html = _html_tag_page([], has_next=False)
        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(text_data=html))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        await crawl._fetch_html_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "ai generated", 1
        )

        call_args = session.get.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url", "")
        assert "ai-generated" in url


# ---------------------------------------------------------------------------
# HTML fallback in tag pages
# ---------------------------------------------------------------------------

class TestHtmlDefault:
    @pytest.mark.asyncio
    async def test_default_starts_in_html_mode(self):
        """Default cursor (None) starts in HTML mode, not RSS."""
        crawl = DeviantArtCrawl()
        methods_called = []

        async def mock_fetch_html(session, limiter, tag, page):
            methods_called.append(("html", page))
            return [_make_discovered("html_img.jpg")], False

        with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 5
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "cosplay", None
                )

        assert methods_called == [("html", 1)]
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_rss_cursor_still_falls_back_to_html(self):
        """When RSS cursor returns empty on first page, falls back to HTML."""
        crawl = DeviantArtCrawl()
        methods_called = []

        async def mock_fetch_rss(session, limiter, tag, offset):
            methods_called.append(("rss", offset))
            return [], False

        async def mock_fetch_html(session, limiter, tag, page):
            methods_called.append(("html", page))
            return [_make_discovered("html_img.jpg")], False

        with patch.object(crawl, "_fetch_rss_page", side_effect=mock_fetch_rss):
            with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html):
                with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                    mock_settings.deviantart_max_pages = 5
                    results, final_offset = await crawl._fetch_tag_pages(
                        MagicMock(), AsyncMock(), "cosplay", "rss:0"
                    )

        assert ("rss", 0) in methods_called
        assert ("html", 1) in methods_called

    @pytest.mark.asyncio
    async def test_html_cursor_resumes_in_html_mode(self):
        """When cursor starts with html:, skips RSS entirely."""
        crawl = DeviantArtCrawl()
        methods_called = []

        async def mock_fetch_html(session, limiter, tag, page):
            methods_called.append(("html", page))
            return [_make_discovered("img.jpg")], False

        with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 5
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "cosplay", "html:3"
                )

        assert methods_called == [("html", 3)]

    @pytest.mark.asyncio
    async def test_html_mode_saves_cursor_at_max_pages(self):
        """HTML mode saves html: prefixed cursor when max_pages reached."""
        crawl = DeviantArtCrawl()

        async def mock_fetch_html(session, limiter, tag, page):
            return [_make_discovered("img.jpg")], True  # always has_next

        with patch.object(crawl, "_fetch_html_page", side_effect=mock_fetch_html):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 3
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "cosplay", "html:1"
                )

        assert final_offset == "html:4"  # started at 1, went through 3 pages


# ---------------------------------------------------------------------------
# Title extraction from URL
# ---------------------------------------------------------------------------

class TestTitleFromUrl:
    def test_extracts_title(self):
        url = "https://www.deviantart.com/artist/art/Triss-Merigold-Cosplay-12345"
        assert DeviantArtCrawl._title_from_url(url) == "Triss Merigold Cosplay"

    def test_handles_comments_anchor(self):
        url = "https://www.deviantart.com/artist/art/Cool-Art-99999#comments"
        assert DeviantArtCrawl._title_from_url(url) == "Cool Art"

    def test_no_art_path_returns_none(self):
        url = "https://www.deviantart.com/artist"
        assert DeviantArtCrawl._title_from_url(url) is None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_discovered(url="https://img.da.net/test.jpg"):
    return DiscoveredImageResult(
        source_url=url,
        page_url="https://www.deviantart.com/art/test",
        page_title="Test",
        platform="deviantart",
    )


# ---------------------------------------------------------------------------
# Circuit breaker integration
# ---------------------------------------------------------------------------

class TestCircuitBreakerIntegration:
    def test_deviantart_circuit_breaker_created_on_demand(self):
        """Circuit breaker for 'deviantart' is created via get_circuit_breaker."""
        from src.utils.retry import get_circuit_breaker
        cb = get_circuit_breaker("deviantart")
        assert cb is not None
        assert cb.is_open is False

    def test_circuit_opens_after_threshold(self):
        """After 5 failures, circuit should be open."""
        from src.utils.retry import CircuitBreaker
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(5):
            cb.record_failure()
        assert cb.is_open is True

    def test_circuit_resets_on_success(self):
        from src.utils.retry import CircuitBreaker
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(4):
            cb.record_failure()
        cb.record_success()
        assert cb.is_open is False
