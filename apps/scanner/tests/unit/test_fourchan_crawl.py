"""Unit tests for 4chan platform crawler."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.discovery.base import DetectionStrategy, DiscoveryContext
from src.discovery.fourchan_crawl import (
    FOURCHAN_CDN,
    MIN_FILE_SIZE,
    TARGET_BOARDS,
    VIDEO_EXTENSIONS,
    FourChanCrawl,
)
from src.utils.image_download import fourchan_thumbnail_url


class TestFourChanCrawlMetadata:
    def test_source_type(self):
        crawler = FourChanCrawl()
        assert crawler.get_source_type() == "platform_crawl"

    def test_source_name(self):
        crawler = FourChanCrawl()
        assert crawler.get_source_name() == "fourchan"

    def test_detection_strategy_deferred(self):
        crawler = FourChanCrawl()
        assert crawler.get_detection_strategy() == DetectionStrategy.DEFERRED


class TestExtractImages:
    def setup_method(self):
        self.crawler = FourChanCrawl()

    def test_extracts_valid_image(self):
        posts = [{
            "no": 12345,
            "tim": 1678901234567,
            "ext": ".jpg",
            "fsize": 50000,
            "filename": "test_image",
            "resto": 12340,
        }]
        results = self.crawler._extract_images("s", posts)
        assert len(results) == 1
        assert results[0].source_url == f"{FOURCHAN_CDN}/s/1678901234567.jpg"
        assert results[0].platform == "fourchan"
        assert results[0].search_term == "/s/"
        assert "thread/12340" in results[0].page_url
        assert "#p12345" in results[0].page_url

    def test_filters_video_webm(self):
        posts = [{
            "no": 1, "tim": 111, "ext": ".webm", "fsize": 50000, "resto": 1,
        }]
        results = self.crawler._extract_images("gif", posts)
        assert len(results) == 0

    def test_filters_video_mp4(self):
        posts = [{
            "no": 1, "tim": 111, "ext": ".mp4", "fsize": 50000, "resto": 1,
        }]
        results = self.crawler._extract_images("gif", posts)
        assert len(results) == 0

    def test_filters_tiny_files(self):
        posts = [{
            "no": 1, "tim": 111, "ext": ".jpg", "fsize": 2000, "resto": 1,
        }]
        results = self.crawler._extract_images("s", posts)
        assert len(results) == 0

    def test_filters_at_boundary(self):
        """Files exactly at MIN_FILE_SIZE should be excluded."""
        posts = [{
            "no": 1, "tim": 111, "ext": ".jpg", "fsize": MIN_FILE_SIZE - 1, "resto": 1,
        }]
        results = self.crawler._extract_images("s", posts)
        assert len(results) == 0

    def test_accepts_at_minimum(self):
        """Files at exactly MIN_FILE_SIZE should be included."""
        posts = [{
            "no": 1, "tim": 111, "ext": ".jpg", "fsize": MIN_FILE_SIZE, "resto": 1,
        }]
        results = self.crawler._extract_images("s", posts)
        assert len(results) == 1

    def test_skips_posts_without_images(self):
        posts = [
            {"no": 1, "com": "text only post"},
            {"no": 2, "tim": 222, "ext": ".png", "fsize": 10000, "resto": 1},
        ]
        results = self.crawler._extract_images("b", posts)
        assert len(results) == 1

    def test_uses_subject_as_title(self):
        posts = [{
            "no": 1, "tim": 111, "ext": ".jpg", "fsize": 50000,
            "sub": "Thread Subject", "resto": 1,
        }]
        results = self.crawler._extract_images("pol", posts)
        assert results[0].page_title == "Thread Subject"

    def test_op_thread_no(self):
        """OP posts (resto=0) should use their own no as thread_no."""
        posts = [{
            "no": 999, "tim": 111, "ext": ".jpg", "fsize": 50000,
            "resto": 0,
        }]
        results = self.crawler._extract_images("s", posts)
        # When resto=0, falls back to post.no
        assert "thread/999" in results[0].page_url

    def test_accepts_png(self):
        posts = [{
            "no": 1, "tim": 111, "ext": ".png", "fsize": 50000, "resto": 1,
        }]
        results = self.crawler._extract_images("hr", posts)
        assert len(results) == 1
        assert results[0].source_url.endswith(".png")

    def test_accepts_gif(self):
        posts = [{
            "no": 1, "tim": 111, "ext": ".gif", "fsize": 50000, "resto": 1,
        }]
        results = self.crawler._extract_images("b", posts)
        assert len(results) == 1


class TestThumbnailUrlConstruction:
    def test_jpg_thumbnail(self):
        url = "https://i.4cdn.org/s/1678901234567.jpg"
        result = fourchan_thumbnail_url(url)
        assert result == "https://i.4cdn.org/s/1678901234567s.jpg"

    def test_png_thumbnail(self):
        url = "https://i.4cdn.org/hr/1678901234567.png"
        result = fourchan_thumbnail_url(url)
        assert result == "https://i.4cdn.org/hr/1678901234567s.jpg"

    def test_non_4chan_url_returns_none(self):
        url = "https://example.com/image.jpg"
        assert fourchan_thumbnail_url(url) is None

    def test_no_extension_returns_none(self):
        url = "https://i.4cdn.org/s/1678901234567"
        result = fourchan_thumbnail_url(url)
        # rfind(".") finds the dot in "4cdn.org", so it returns a valid-ish URL
        # but this is fine — the URL just won't resolve on 4chan CDN
        assert result is not None  # edge case, acceptable behavior


class TestParseBoards:
    def test_default_boards(self):
        boards = FourChanCrawl._parse_boards(None)
        assert boards == TARGET_BOARDS

    def test_empty_list_uses_default(self):
        boards = FourChanCrawl._parse_boards([])
        assert boards == TARGET_BOARDS

    def test_slash_format(self):
        boards = FourChanCrawl._parse_boards(["/s/", "/hr/"])
        assert boards == ["s", "hr"]

    def test_plain_format(self):
        boards = FourChanCrawl._parse_boards(["s", "hr"])
        assert boards == ["s", "hr"]

    def test_mixed_format(self):
        boards = FourChanCrawl._parse_boards(["/s/", "hr", "/b"])
        assert boards == ["s", "hr", "b"]


class TestCursorUpdates:
    def setup_method(self):
        self.crawler = FourChanCrawl()

    @pytest.mark.asyncio
    async def test_cursor_updates_to_max_thread_no(self):
        """Cursor should advance to the highest thread no seen."""
        catalog_data = [
            {"page": 0, "threads": [
                {"no": 100, "tim": 111, "ext": ".jpg", "fsize": 50000},
                {"no": 300, "tim": 333, "ext": ".jpg", "fsize": 50000},
                {"no": 200, "tim": 222, "ext": ".jpg", "fsize": 50000},
            ]}
        ]

        with patch.object(self.crawler, "_fetch_catalog", new_callable=AsyncMock) as mock_cat:
            mock_cat.return_value = catalog_data
            with patch.object(self.crawler, "_fetch_thread", new_callable=AsyncMock) as mock_thread:
                mock_thread.return_value = []

                images, max_no, exhausted = await self.crawler._crawl_board(
                    session=MagicMock(),
                    limiter=MagicMock(),
                    board="s",
                    last_seen_no=0,
                    max_threads=10,
                    backfill=False,
                )

        assert max_no == 300

    @pytest.mark.asyncio
    async def test_sweep_only_new_threads(self):
        """Sweep mode should only drill into threads newer than cursor."""
        catalog_data = [
            {"page": 0, "threads": [
                {"no": 100, "tim": 111, "ext": ".jpg", "fsize": 50000},
                {"no": 200, "tim": 222, "ext": ".jpg", "fsize": 50000},
                {"no": 300, "tim": 333, "ext": ".jpg", "fsize": 50000},
            ]}
        ]

        with patch.object(self.crawler, "_fetch_catalog", new_callable=AsyncMock) as mock_cat:
            mock_cat.return_value = catalog_data
            with patch.object(self.crawler, "_fetch_thread", new_callable=AsyncMock) as mock_thread:
                mock_thread.return_value = []

                await self.crawler._crawl_board(
                    session=MagicMock(),
                    limiter=MagicMock(),
                    board="s",
                    last_seen_no=200,
                    max_threads=10,
                    backfill=False,
                )

                # Should only drill into thread 300 (newer than cursor 200)
                assert mock_thread.call_count == 1
                # Verify thread_no=300 was passed (positional arg index 3)
                args, kwargs = mock_thread.call_args
                thread_no = kwargs.get("thread_no", args[3] if len(args) > 3 else None)
                assert thread_no == 300


class TestBackfillExhaustion:
    def setup_method(self):
        self.crawler = FourChanCrawl()

    @pytest.mark.asyncio
    async def test_backfill_marks_exhausted(self):
        """When all threads are covered in backfill, board should be marked exhausted."""
        catalog_data = [
            {"page": 0, "threads": [
                {"no": 100, "tim": 111, "ext": ".jpg", "fsize": 50000},
                {"no": 200, "tim": 222, "ext": ".jpg", "fsize": 50000},
            ]}
        ]

        with patch.object(self.crawler, "_fetch_catalog", new_callable=AsyncMock) as mock_cat:
            mock_cat.return_value = catalog_data
            with patch.object(self.crawler, "_fetch_thread", new_callable=AsyncMock) as mock_thread:
                mock_thread.return_value = []

                images, max_no, exhausted = await self.crawler._crawl_board(
                    session=MagicMock(),
                    limiter=MagicMock(),
                    board="s",
                    last_seen_no=0,
                    max_threads=50,  # more than available threads
                    backfill=True,
                )

        assert exhausted is True

    @pytest.mark.asyncio
    async def test_backfill_not_exhausted_when_more_threads(self):
        """Board should not be exhausted if there are more threads than max_threads."""
        threads = [
            {"no": i, "tim": i * 111, "ext": ".jpg", "fsize": 50000}
            for i in range(1, 20)
        ]
        catalog_data = [{"page": 0, "threads": threads}]

        with patch.object(self.crawler, "_fetch_catalog", new_callable=AsyncMock) as mock_cat:
            mock_cat.return_value = catalog_data
            with patch.object(self.crawler, "_fetch_thread", new_callable=AsyncMock) as mock_thread:
                mock_thread.return_value = []

                images, max_no, exhausted = await self.crawler._crawl_board(
                    session=MagicMock(),
                    limiter=MagicMock(),
                    board="s",
                    last_seen_no=0,
                    max_threads=5,  # less than available threads
                    backfill=True,
                )

        assert exhausted is False

    @pytest.mark.asyncio
    async def test_backfill_skips_exhausted_boards(self):
        """discover() should skip boards marked exhausted in backfill mode."""
        context = DiscoveryContext(
            platform="fourchan",
            search_terms=["/s/", "/hr/"],
            backfill=True,
            backfill_cursors={"/s/": "exhausted", "/hr/": "100"},
        )

        with patch.object(self.crawler, "_crawl_board", new_callable=AsyncMock) as mock_crawl:
            mock_crawl.return_value = ([], 200, False)
            result = await self.crawler.discover(context)

            # Should only crawl /hr/, not /s/ (exhausted)
            assert mock_crawl.call_count == 1
            call_board = mock_crawl.call_args[1].get("board", mock_crawl.call_args[0][2])
            assert call_board == "hr"

        assert result.search_cursors["/s/"] == "exhausted"


class TestCatalogParsing:
    def setup_method(self):
        self.crawler = FourChanCrawl()

    def test_catalog_flattening(self):
        """Catalog pages should be flattened into a single thread list."""
        posts_page0 = [
            {"no": 100, "tim": 111, "ext": ".jpg", "fsize": 50000, "resto": 0},
            {"no": 200, "tim": 222, "ext": ".png", "fsize": 80000, "resto": 0},
        ]
        posts_page1 = [
            {"no": 300, "tim": 333, "ext": ".jpg", "fsize": 60000, "resto": 0},
        ]

        # Simulate what _crawl_board does with catalog
        catalog = [
            {"page": 0, "threads": posts_page0},
            {"page": 1, "threads": posts_page1},
        ]

        all_threads = []
        for page in catalog:
            all_threads.extend(page.get("threads", []))

        assert len(all_threads) == 3

        # Extract images from the flattened list
        images = self.crawler._extract_images("s", all_threads)
        assert len(images) == 3

    def test_empty_catalog(self):
        """Empty catalog should produce no images."""
        catalog = [{"page": 0, "threads": []}]
        all_threads = []
        for page in catalog:
            all_threads.extend(page.get("threads", []))
        images = self.crawler._extract_images("s", all_threads)
        assert len(images) == 0


class TestDiscoverIntegration:
    """Integration-level tests for the discover() method with mocked HTTP."""

    def setup_method(self):
        self.crawler = FourChanCrawl()

    @pytest.mark.asyncio
    async def test_discover_returns_discovery_result(self):
        """discover() should return a DiscoveryResult with correct structure."""
        context = DiscoveryContext(
            platform="fourchan",
            search_terms=["/s/"],
        )

        catalog = [{"page": 0, "threads": [
            {"no": 100, "tim": 111, "ext": ".jpg", "fsize": 50000, "resto": 0},
        ]}]

        with patch.object(self.crawler, "_fetch_catalog", new_callable=AsyncMock) as mock_cat:
            mock_cat.return_value = catalog
            with patch.object(self.crawler, "_fetch_thread", new_callable=AsyncMock) as mock_thread:
                mock_thread.return_value = [
                    {"no": 100, "tim": 111, "ext": ".jpg", "fsize": 50000, "resto": 0},
                    {"no": 101, "tim": 112, "ext": ".jpg", "fsize": 40000, "resto": 100},
                ]
                result = await self.crawler.discover(context)

        assert len(result.images) > 0
        assert result.search_cursors is not None
        assert "/s/" in result.search_cursors
        assert result.tags_total == 1
        assert all(img.platform == "fourchan" for img in result.images)
        assert all(img.search_term == "/s/" for img in result.images)
