"""Test DeviantArt discovery source with mocked API responses."""

import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

from src.discovery.base import DiscoveredImageResult, DiscoveryContext, DiscoveryResult
from src.utils.retry import CircuitOpenError
from src.discovery.deviantart_crawl import (
    AI_BROWSE_TAGS,
    ALL_TAGS,
    DEVIANTART_BROWSE_TAGS_URL,
    DEVIANTART_TOKEN_URL,
    DeviantArtCrawl,
    PHOTO_TAGS,
)


# ---------------------------------------------------------------------------
# Helpers: build mock aiohttp responses
# ---------------------------------------------------------------------------

def _mock_response(status=200, json_data=None, text_data=""):
    """Create a mock aiohttp response as an async context manager."""
    resp = AsyncMock()
    resp.status = status
    resp.json = AsyncMock(return_value=json_data or {})
    resp.text = AsyncMock(return_value=text_data)
    # Make it usable as `async with session.get(...) as resp:`
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=resp)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


def _token_response(access_token="test_token_abc", expires_in=3600):
    return _mock_response(json_data={
        "access_token": access_token,
        "expires_in": expires_in,
        "token_type": "bearer",
    })


def _browse_tags_response(deviations, has_more=True, next_offset=24):
    """Build a mock /browse/tags response."""
    return _mock_response(json_data={
        "has_more": has_more,
        "next_offset": next_offset,
        "results": deviations,
    })


def _make_deviation(title="AI Portrait", image_url="https://img.deviantart.net/abc/image.jpg", page_url="https://www.deviantart.com/artist/art/test-123"):
    """Build a single deviation object matching DA API shape."""
    return {
        "title": title,
        "url": page_url,
        "content": {"src": image_url},
    }


def _make_text_deviation(title="My Poem"):
    """A literature deviation with no content.src — should be skipped."""
    return {
        "title": title,
        "url": "https://www.deviantart.com/artist/art/poem-456",
        # no "content" key
    }


# ---------------------------------------------------------------------------
# Basic identity tests
# ---------------------------------------------------------------------------

class TestDeviantArtCrawlIdentity:
    def test_source_type(self):
        assert DeviantArtCrawl().get_source_type() == "platform_crawl"

    def test_source_name(self):
        assert DeviantArtCrawl().get_source_name() == "deviantart"

    def test_initial_token_state(self):
        crawl = DeviantArtCrawl()
        assert crawl._token is None
        assert crawl._token_expires == 0.0

    def test_tag_lists_not_empty(self):
        assert len(AI_BROWSE_TAGS) > 0
        assert len(PHOTO_TAGS) > 0
        assert ALL_TAGS == AI_BROWSE_TAGS + PHOTO_TAGS


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

    def test_config_fields_exist(self):
        from src.config import Settings
        s = Settings()
        assert hasattr(s, "deviantart_client_id")
        assert hasattr(s, "deviantart_client_secret")
        assert s.deviantart_max_pages == 50


# ---------------------------------------------------------------------------
# OAuth2 token management
# ---------------------------------------------------------------------------

class TestTokenManagement:
    @pytest.mark.asyncio
    async def test_fetch_token_success(self):
        """_fetch_token sets _token and _token_expires on success."""
        crawl = DeviantArtCrawl()
        session = MagicMock()
        session.post = MagicMock(return_value=_token_response("my_token", 7200))

        await crawl._fetch_token.__wrapped__(crawl, session)

        assert crawl._token == "my_token"
        # expires_in=7200 minus 60s buffer
        assert crawl._token_expires > time.monotonic()
        assert crawl._token_expires <= time.monotonic() + 7200

    @pytest.mark.asyncio
    async def test_fetch_token_failure_raises(self):
        """_fetch_token raises RuntimeError on non-200."""
        crawl = DeviantArtCrawl()
        session = MagicMock()
        session.post = MagicMock(return_value=_mock_response(
            status=401, text_data="invalid_client"
        ))

        with pytest.raises(RuntimeError, match="OAuth2 token failed"):
            await crawl._fetch_token.__wrapped__(crawl, session)

        assert crawl._token is None

    @pytest.mark.asyncio
    async def test_ensure_token_skips_if_valid(self):
        """_ensure_token does not fetch if token is still valid."""
        crawl = DeviantArtCrawl()
        crawl._token = "existing_token"
        crawl._token_expires = time.monotonic() + 3600  # valid for 1hr

        session = MagicMock()
        session.post = MagicMock()

        await crawl._ensure_token(session)

        # Should NOT have called post
        session.post.assert_not_called()
        assert crawl._token == "existing_token"

    @pytest.mark.asyncio
    async def test_ensure_token_refreshes_if_expired(self):
        """_ensure_token fetches new token when expired."""
        crawl = DeviantArtCrawl()
        crawl._token = "old_token"
        crawl._token_expires = time.monotonic() - 10  # expired

        session = MagicMock()
        session.post = MagicMock(return_value=_token_response("new_token", 3600))

        await crawl._ensure_token(session)

        assert crawl._token == "new_token"


# ---------------------------------------------------------------------------
# Tag page fetching
# ---------------------------------------------------------------------------

class TestFetchTagPage:
    @pytest.mark.asyncio
    async def test_parses_deviations_with_content(self):
        """Deviations with content.src are returned as DiscoveredImageResult."""
        crawl = DeviantArtCrawl()
        crawl._token = "test_token"

        deviations = [
            _make_deviation("Portrait 1", "https://img.da.net/1.jpg", "https://da.com/art/1"),
            _make_deviation("Portrait 2", "https://img.da.net/2.jpg", "https://da.com/art/2"),
        ]
        session = MagicMock()
        session.get = MagicMock(return_value=_browse_tags_response(
            deviations, has_more=True, next_offset=24
        ))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, next_offset = await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert len(results) == 2
        assert results[0].source_url == "https://img.da.net/1.jpg"
        assert results[0].page_url == "https://da.com/art/1"
        assert results[0].page_title == "Portrait 1"
        assert results[0].platform == "deviantart"
        assert next_offset == 24

    @pytest.mark.asyncio
    async def test_skips_text_deviations(self):
        """Deviations without content (literature) are skipped."""
        crawl = DeviantArtCrawl()
        crawl._token = "test_token"

        deviations = [
            _make_deviation("Real Image", "https://img.da.net/real.jpg"),
            _make_text_deviation("My Poem"),
            {"title": "Empty Content", "url": "https://da.com/art/empty", "content": {}},
        ]
        session = MagicMock()
        session.get = MagicMock(return_value=_browse_tags_response(
            deviations, has_more=False
        ))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, next_offset = await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert len(results) == 1
        assert results[0].page_title == "Real Image"
        assert next_offset is None  # has_more=False

    @pytest.mark.asyncio
    async def test_returns_none_offset_when_exhausted(self):
        """When has_more=False, next_offset should be None."""
        crawl = DeviantArtCrawl()
        crawl._token = "test_token"

        session = MagicMock()
        session.get = MagicMock(return_value=_browse_tags_response(
            [_make_deviation()], has_more=False, next_offset=None
        ))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, next_offset = await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "portrait", 48
        )

        assert len(results) == 1
        assert next_offset is None

    @pytest.mark.asyncio
    async def test_401_clears_token_and_raises(self):
        """A 401 response clears the cached token and raises for retry."""
        crawl = DeviantArtCrawl()
        crawl._token = "expired_token"
        crawl._token_expires = time.monotonic() + 3600

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(status=401))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        with pytest.raises(RuntimeError, match="token expired"):
            await crawl._fetch_tag_page.__wrapped__.__wrapped__(
                crawl, session, limiter, "aiart", 0
            )

        assert crawl._token is None
        assert crawl._token_expires == 0.0

    @pytest.mark.asyncio
    async def test_non_200_returns_empty(self):
        """Non-200 non-401 returns empty results with None offset."""
        crawl = DeviantArtCrawl()
        crawl._token = "test_token"

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_response(status=500))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, next_offset = await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert results == []
        assert next_offset is None

    @pytest.mark.asyncio
    async def test_long_title_truncated(self):
        """Titles longer than 200 chars are truncated."""
        crawl = DeviantArtCrawl()
        crawl._token = "test_token"

        long_title = "A" * 300
        deviations = [_make_deviation(long_title, "https://img.da.net/1.jpg")]
        session = MagicMock()
        session.get = MagicMock(return_value=_browse_tags_response(
            deviations, has_more=False
        ))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        assert len(results[0].page_title) == 200

    @pytest.mark.asyncio
    async def test_sends_auth_header(self):
        """Verify Authorization bearer header is sent."""
        crawl = DeviantArtCrawl()
        crawl._token = "my_secret_token"

        session = MagicMock()
        mock_ctx = _browse_tags_response([], has_more=False)
        session.get = MagicMock(return_value=mock_ctx)

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "aiart", 0
        )

        call_kwargs = session.get.call_args
        assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer my_secret_token"

    @pytest.mark.asyncio
    async def test_passes_correct_params(self):
        """Verify tag, offset, limit, mature_content params."""
        crawl = DeviantArtCrawl()
        crawl._token = "token"

        session = MagicMock()
        session.get = MagicMock(return_value=_browse_tags_response([], has_more=False))

        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        await crawl._fetch_tag_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "portrait", 96
        )

        call_kwargs = session.get.call_args
        params = call_kwargs.kwargs["params"]
        assert params["tag"] == "portrait"
        assert params["offset"] == 96
        assert params["limit"] == 24
        assert params["mature_content"] == "true"


# ---------------------------------------------------------------------------
# Multi-page tag fetching
# ---------------------------------------------------------------------------

class TestFetchTagPages:
    @pytest.mark.asyncio
    async def test_stops_when_exhausted(self):
        """Multi-page loop stops when has_more=False."""
        crawl = DeviantArtCrawl()
        crawl._token = "token"

        call_count = 0

        async def mock_fetch_tag_page(session, limiter, tag, offset):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return [_make_discovered("img.jpg")], offset + 24
            return [_make_discovered("last.jpg")], None  # exhausted

        with patch.object(crawl, "_fetch_tag_page", side_effect=mock_fetch_tag_page):
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
        """Multi-page loop stops at max_pages even if has_more=True."""
        crawl = DeviantArtCrawl()
        crawl._token = "token"

        call_count = 0

        async def mock_fetch_tag_page(session, limiter, tag, offset):
            nonlocal call_count
            call_count += 1
            return [_make_discovered("img.jpg")], offset + 24  # always has_more

        with patch.object(crawl, "_fetch_tag_page", side_effect=mock_fetch_tag_page):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 3
                results, final_offset = await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "aiart", None
                )

        assert call_count == 3
        assert len(results) == 3
        # Should save offset for resume
        assert final_offset == str(24 * 3)

    @pytest.mark.asyncio
    async def test_resumes_from_saved_offset(self):
        """Passes start_offset to first page request."""
        crawl = DeviantArtCrawl()
        crawl._token = "token"

        offsets_seen = []

        async def mock_fetch_tag_page(session, limiter, tag, offset):
            offsets_seen.append(offset)
            return [], None  # exhausted immediately

        with patch.object(crawl, "_fetch_tag_page", side_effect=mock_fetch_tag_page):
            with patch("src.discovery.deviantart_crawl.settings") as mock_settings:
                mock_settings.deviantart_max_pages = 5
                await crawl._fetch_tag_pages(
                    MagicMock(), AsyncMock(), "aiart", "240"
                )

        assert offsets_seen[0] == 240  # resumed from saved offset


# ---------------------------------------------------------------------------
# Full discover() flow
# ---------------------------------------------------------------------------

class TestDiscover:
    @pytest.mark.asyncio
    async def test_token_failure_returns_empty(self):
        """If OAuth2 token fails, discover returns empty result."""
        crawl = DeviantArtCrawl()

        with patch.object(crawl, "_ensure_token", side_effect=RuntimeError("auth failed")):
            context = DiscoveryContext(platform="deviantart")
            result = await crawl.discover(context)

        assert result.images == []
        assert result.tags_total == len(ALL_TAGS)

    @pytest.mark.asyncio
    async def test_crawls_all_tags(self):
        """discover() iterates over all tags."""
        crawl = DeviantArtCrawl()
        tags_crawled = []

        async def mock_ensure_token(session):
            crawl._token = "token"

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset):
            tags_crawled.append(tag)
            return [_make_discovered(f"{tag}.jpg")], "24"

        with patch.object(crawl, "_ensure_token", side_effect=mock_ensure_token):
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

        async def mock_ensure_token(session):
            crawl._token = "token"

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset):
            if tag == "aiart":
                assert start_offset == "48"
                return [], "72"
            return [], None  # other tags start fresh, exhaust immediately

        with patch.object(crawl, "_ensure_token", side_effect=mock_ensure_token):
            with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
                context = DiscoveryContext(
                    platform="deviantart",
                    search_cursors={"aiart": "48"},
                )
                result = await crawl.discover(context)

        assert result.search_cursors["aiart"] == "72"
        # Exhausted tags should have None
        exhausted_count = sum(1 for v in result.search_cursors.values() if v is None)
        assert exhausted_count == len(ALL_TAGS) - 1
        assert result.tags_exhausted == len(ALL_TAGS) - 1

    @pytest.mark.asyncio
    async def test_circuit_breaker_stops_remaining_tags(self):
        """CircuitOpenError on one tag breaks out of the tag loop."""
        crawl = DeviantArtCrawl()
        tags_attempted = []

        async def mock_ensure_token(session):
            crawl._token = "token"

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset):
            tags_attempted.append(tag)
            if tag == ALL_TAGS[2]:  # third tag triggers circuit
                raise CircuitOpenError("deviantart circuit open")
            return [_make_discovered(f"{tag}.jpg")], "24"

        with patch.object(crawl, "_ensure_token", side_effect=mock_ensure_token):
            with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
                context = DiscoveryContext(platform="deviantart")
                result = await crawl.discover(context)

        # Should have stopped after the third tag (circuit break)
        assert len(tags_attempted) == 3
        # First two tags returned results
        assert len(result.images) == 2

    @pytest.mark.asyncio
    async def test_individual_tag_error_continues(self):
        """A non-circuit error on one tag doesn't stop other tags."""
        crawl = DeviantArtCrawl()
        tags_attempted = []

        async def mock_ensure_token(session):
            crawl._token = "token"

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset):
            tags_attempted.append(tag)
            if tag == ALL_TAGS[1]:  # second tag errors
                raise ValueError("some transient error")
            return [_make_discovered(f"{tag}.jpg")], "24"

        with patch.object(crawl, "_ensure_token", side_effect=mock_ensure_token):
            with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
                context = DiscoveryContext(platform="deviantart")
                result = await crawl.discover(context)

        # All tags attempted despite error on second
        assert len(tags_attempted) == len(ALL_TAGS)
        # All but the errored tag returned results
        assert len(result.images) == len(ALL_TAGS) - 1

    @pytest.mark.asyncio
    async def test_empty_search_cursors_treated_as_fresh(self):
        """None search_cursors means all tags start from offset 0."""
        crawl = DeviantArtCrawl()
        start_offsets_seen = []

        async def mock_ensure_token(session):
            crawl._token = "token"

        async def mock_fetch_tag_pages(session, limiter, tag, start_offset):
            start_offsets_seen.append(start_offset)
            return [], None

        with patch.object(crawl, "_ensure_token", side_effect=mock_ensure_token):
            with patch.object(crawl, "_fetch_tag_pages", side_effect=mock_fetch_tag_pages):
                context = DiscoveryContext(platform="deviantart", search_cursors=None)
                await crawl.discover(context)

        assert all(o is None for o in start_offsets_seen)


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
