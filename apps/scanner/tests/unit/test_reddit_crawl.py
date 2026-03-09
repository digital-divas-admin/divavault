"""Unit tests for Reddit platform crawler."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.discovery.base import DetectionStrategy, DiscoveryContext
from src.discovery.reddit_crawl import (
    IMAGE_DOMAINS,
    TARGET_SUBREDDITS,
    RedditCrawl,
)


class TestRedditCrawlMetadata:
    def test_source_type(self):
        crawler = RedditCrawl()
        assert crawler.get_source_type() == "platform_crawl"

    def test_source_name(self):
        crawler = RedditCrawl()
        assert crawler.get_source_name() == "reddit"

    def test_detection_strategy_deferred(self):
        crawler = RedditCrawl()
        assert crawler.get_detection_strategy() == DetectionStrategy.DEFERRED


class TestExtractImages:
    def setup_method(self):
        self.crawler = RedditCrawl()

    def test_extracts_iredd_image(self):
        post = {
            "name": "t3_abc123",
            "url": "https://i.redd.it/abc123.jpg",
            "permalink": "/r/aiNSFW/comments/abc123/test_post/",
            "title": "Test AI Generated",
            "post_hint": "image",
            "is_video": False,
        }
        results = self.crawler._extract_images("aiNSFW", post)
        assert len(results) == 1
        assert results[0].source_url == "https://i.redd.it/abc123.jpg"
        assert results[0].platform == "reddit"
        assert results[0].search_term == "r/aiNSFW"
        assert "reddit.com" in results[0].page_url
        assert results[0].page_title == "Test AI Generated"

    def test_extracts_imgur_image(self):
        post = {
            "name": "t3_xyz",
            "url": "https://i.imgur.com/abc.png",
            "permalink": "/r/CelebsAI/comments/xyz/test/",
            "title": "Test",
            "is_video": False,
        }
        results = self.crawler._extract_images("CelebsAI", post)
        assert len(results) == 1
        assert results[0].source_url == "https://i.imgur.com/abc.png"

    def test_filters_video_posts(self):
        post = {
            "name": "t3_vid",
            "url": "https://v.redd.it/abc123",
            "permalink": "/r/sub/comments/vid/video/",
            "title": "Video post",
            "is_video": True,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 0

    def test_filters_self_posts(self):
        post = {
            "name": "t3_self",
            "url": "https://www.reddit.com/r/sub/comments/self/text_post/",
            "permalink": "/r/sub/comments/self/text_post/",
            "title": "Text only",
            "post_hint": "self",
            "is_video": False,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 0

    def test_filters_non_image_links(self):
        post = {
            "name": "t3_link",
            "url": "https://example.com/article",
            "permalink": "/r/sub/comments/link/article/",
            "title": "Article link",
            "post_hint": "link",
            "is_video": False,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 0

    def test_truncates_long_title(self):
        post = {
            "name": "t3_long",
            "url": "https://i.redd.it/long.jpg",
            "permalink": "/r/sub/comments/long/x/",
            "title": "A" * 300,
            "is_video": False,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 1
        assert len(results[0].page_title) == 200

    def test_handles_missing_permalink(self):
        post = {
            "name": "t3_no_link",
            "url": "https://i.redd.it/img.jpg",
            "title": "No permalink",
            "is_video": False,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 1
        assert results[0].page_url is None

    def test_accepts_generic_image_extension(self):
        """URLs with image extensions on non-standard domains should be accepted."""
        post = {
            "name": "t3_ext",
            "url": "https://cdn.somesite.com/photo.jpg",
            "permalink": "/r/sub/comments/ext/photo/",
            "title": "External image",
            "is_video": False,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 1

    def test_accepts_webp_extension(self):
        post = {
            "name": "t3_webp",
            "url": "https://i.redd.it/test.webp",
            "permalink": "/r/sub/comments/webp/test/",
            "title": "WebP image",
            "is_video": False,
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 1


class TestGalleryExtraction:
    def setup_method(self):
        self.crawler = RedditCrawl()

    def test_extracts_gallery_images(self):
        post = {
            "name": "t3_gallery",
            "permalink": "/r/sub/comments/gallery/my_gallery/",
            "title": "Gallery post",
            "is_video": False,
            "gallery_data": {
                "items": [
                    {"media_id": "img1", "id": 1},
                    {"media_id": "img2", "id": 2},
                ]
            },
            "media_metadata": {
                "img1": {
                    "m": "image/jpeg",
                    "s": {"u": "https://preview.redd.it/img1.jpg?auto=webp&s=abc"},
                },
                "img2": {
                    "m": "image/png",
                    "s": {"u": "https://preview.redd.it/img2.png?auto=webp&s=def"},
                },
            },
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 2
        assert "img1" in results[0].source_url
        assert "img2" in results[1].source_url

    def test_gallery_skips_video_media(self):
        post = {
            "name": "t3_mixgallery",
            "permalink": "/r/sub/comments/mix/gallery/",
            "title": "Mixed gallery",
            "is_video": False,
            "gallery_data": {
                "items": [
                    {"media_id": "vid1", "id": 1},
                    {"media_id": "img1", "id": 2},
                ]
            },
            "media_metadata": {
                "vid1": {
                    "m": "video/mp4",
                    "s": {"u": "https://preview.redd.it/vid1.mp4"},
                },
                "img1": {
                    "m": "image/jpeg",
                    "s": {"u": "https://preview.redd.it/img1.jpg"},
                },
            },
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 1
        assert "img1" in results[0].source_url

    def test_gallery_missing_metadata(self):
        post = {
            "name": "t3_nometa",
            "permalink": "/r/sub/comments/nometa/gallery/",
            "title": "No metadata",
            "is_video": False,
            "gallery_data": {
                "items": [{"media_id": "img1", "id": 1}]
            },
            # No media_metadata
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 0

    def test_gallery_empty_items(self):
        post = {
            "name": "t3_empty",
            "permalink": "/r/sub/comments/empty/gallery/",
            "title": "Empty gallery",
            "is_video": False,
            "gallery_data": {"items": []},
            "media_metadata": {},
        }
        results = self.crawler._extract_images("sub", post)
        assert len(results) == 0


class TestIsImageUrl:
    def test_iredd_it(self):
        assert RedditCrawl._is_image_url("https://i.redd.it/abc123.jpg") is True

    def test_imgur(self):
        assert RedditCrawl._is_image_url("https://i.imgur.com/abc.png") is True

    def test_non_image_domain(self):
        assert RedditCrawl._is_image_url("https://example.com/page") is False

    def test_image_extension_unknown_domain(self):
        assert RedditCrawl._is_image_url("https://cdn.site.com/img.jpg") is True

    def test_empty_url(self):
        assert RedditCrawl._is_image_url("") is False

    def test_none_url(self):
        assert RedditCrawl._is_image_url(None) is False


class TestParseSubreddits:
    def test_default_subreddits(self):
        subs = RedditCrawl._parse_subreddits(None)
        assert subs == TARGET_SUBREDDITS

    def test_empty_list_uses_default(self):
        subs = RedditCrawl._parse_subreddits([])
        assert subs == TARGET_SUBREDDITS

    def test_r_prefix_format(self):
        subs = RedditCrawl._parse_subreddits(["r/aiNSFW", "r/CelebsAI"])
        assert subs == ["aiNSFW", "CelebsAI"]

    def test_plain_format(self):
        subs = RedditCrawl._parse_subreddits(["aiNSFW", "CelebsAI"])
        assert subs == ["aiNSFW", "CelebsAI"]

    def test_slash_r_prefix(self):
        subs = RedditCrawl._parse_subreddits(["/r/aiNSFW"])
        assert subs == ["aiNSFW"]

    def test_mixed_format(self):
        subs = RedditCrawl._parse_subreddits(["r/aiNSFW", "CelebsAI", "/r/sdnsfw"])
        assert subs == ["aiNSFW", "CelebsAI", "sdnsfw"]


class TestCursorUpdates:
    def setup_method(self):
        self.crawler = RedditCrawl()

    @pytest.mark.asyncio
    async def test_sweep_cursor_saves_newest_post(self):
        """Sweep mode cursor should save the first (newest) post fullname."""
        page_data = {
            "data": {
                "children": [
                    {"data": {
                        "name": "t3_newest",
                        "url": "https://i.redd.it/a.jpg",
                        "permalink": "/r/sub/comments/newest/a/",
                        "title": "Newest",
                        "is_video": False,
                    }},
                    {"data": {
                        "name": "t3_older",
                        "url": "https://i.redd.it/b.jpg",
                        "permalink": "/r/sub/comments/older/b/",
                        "title": "Older",
                        "is_video": False,
                    }},
                ],
                "after": "t3_next_page",
            }
        }

        with patch.object(self.crawler, "_fetch_page", new_callable=AsyncMock) as mock_fetch:
            # Return data for first page, then stop
            mock_fetch.side_effect = [page_data, None]

            images, cursor, exhausted = await self.crawler._crawl_subreddit(
                session=MagicMock(),
                limiter=MagicMock(),
                subreddit="sub",
                after=None,
                max_pages=2,
                backfill=False,
            )

        # In sweep, cursor should be the first (newest) fullname, not the "after" cursor
        assert cursor == "t3_newest"
        assert not exhausted

    @pytest.mark.asyncio
    async def test_backfill_cursor_saves_after_token(self):
        """Backfill mode cursor should save the Reddit 'after' token for deeper pagination."""
        page_data = {
            "data": {
                "children": [
                    {"data": {
                        "name": "t3_post1",
                        "url": "https://i.redd.it/a.jpg",
                        "permalink": "/r/sub/comments/post1/a/",
                        "title": "Post 1",
                        "is_video": False,
                    }},
                ],
                "after": "t3_deep_cursor",
            }
        }

        with patch.object(self.crawler, "_fetch_page", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = [page_data, None]

            images, cursor, exhausted = await self.crawler._crawl_subreddit(
                session=MagicMock(),
                limiter=MagicMock(),
                subreddit="sub",
                after=None,
                max_pages=2,
                backfill=True,
            )

        # In backfill, cursor should be the "after" token (not the first fullname)
        assert cursor == "t3_deep_cursor"


class TestExhaustion:
    def setup_method(self):
        self.crawler = RedditCrawl()

    @pytest.mark.asyncio
    async def test_exhaustion_on_empty_page(self):
        """When Reddit returns an empty children list, mark as exhausted."""
        empty_page = {"data": {"children": [], "after": None}}

        with patch.object(self.crawler, "_fetch_page", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = empty_page

            images, cursor, exhausted = await self.crawler._crawl_subreddit(
                session=MagicMock(),
                limiter=MagicMock(),
                subreddit="sub",
                after=None,
                max_pages=3,
                backfill=True,
            )

        assert exhausted is True
        assert len(images) == 0

    @pytest.mark.asyncio
    async def test_exhaustion_on_no_after_token(self):
        """When Reddit returns no 'after' token, mark as exhausted."""
        last_page = {
            "data": {
                "children": [
                    {"data": {
                        "name": "t3_last",
                        "url": "https://i.redd.it/last.jpg",
                        "permalink": "/r/sub/comments/last/x/",
                        "title": "Last post",
                        "is_video": False,
                    }},
                ],
                "after": None,
            }
        }

        with patch.object(self.crawler, "_fetch_page", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = last_page

            images, cursor, exhausted = await self.crawler._crawl_subreddit(
                session=MagicMock(),
                limiter=MagicMock(),
                subreddit="sub",
                after=None,
                max_pages=3,
                backfill=True,
            )

        assert exhausted is True

    @pytest.mark.asyncio
    async def test_backfill_skips_exhausted_subreddits(self):
        """discover() should skip subreddits marked exhausted in backfill mode."""
        context = DiscoveryContext(
            platform="reddit",
            search_terms=["r/aiNSFW", "r/CelebsAI"],
            backfill=True,
            backfill_cursors={"r/aiNSFW": "exhausted", "r/CelebsAI": "t3_abc"},
        )

        with patch.object(self.crawler, "_crawl_subreddit", new_callable=AsyncMock) as mock_crawl:
            mock_crawl.return_value = ([], "t3_xyz", False)
            result = await self.crawler.discover(context)

            # Should only crawl CelebsAI, not aiNSFW (exhausted)
            assert mock_crawl.call_count == 1
            call_sub = mock_crawl.call_args[1].get("subreddit", mock_crawl.call_args[0][2])
            assert call_sub == "CelebsAI"

        assert result.search_cursors["r/aiNSFW"] == "exhausted"
        assert result.tags_exhausted == 1


class TestDiscoverIntegration:
    """Integration-level tests for the discover() method with mocked HTTP."""

    def setup_method(self):
        self.crawler = RedditCrawl()

    @pytest.mark.asyncio
    async def test_discover_returns_discovery_result(self):
        """discover() should return a DiscoveryResult with correct structure."""
        context = DiscoveryContext(
            platform="reddit",
            search_terms=["r/aiNSFW"],
        )

        page_data = {
            "data": {
                "children": [
                    {"data": {
                        "name": "t3_abc",
                        "url": "https://i.redd.it/test.jpg",
                        "permalink": "/r/aiNSFW/comments/abc/test/",
                        "title": "Test",
                        "is_video": False,
                    }},
                ],
                "after": None,
            }
        }

        with patch.object(self.crawler, "_fetch_page", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = page_data
            result = await self.crawler.discover(context)

        assert len(result.images) == 1
        assert result.search_cursors is not None
        assert "r/aiNSFW" in result.search_cursors
        assert result.tags_total == 1
        assert all(img.platform == "reddit" for img in result.images)
        assert all(img.search_term == "r/aiNSFW" for img in result.images)
