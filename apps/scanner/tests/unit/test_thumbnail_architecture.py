"""Tests for the CivitAI thumbnail-first architecture and pre-filtering.

Covers:
- Validation utility functions (check_content_type, check_magic_bytes, civitai_thumbnail_url)
- API-level video/dimension filtering in CivitAICrawl
- Two-pass download functions (download_thumbnail, download_original)
- Shared upload_thumbnail function
- process_faces.py inline pre-filtering (Content-Type + magic bytes)
"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import aiohttp
import pytest

# ---------------------------------------------------------------------------
# 1. Validation utility functions
# ---------------------------------------------------------------------------

from src.utils.image_download import (
    IMAGE_MAGIC_PREFIXES,
    check_content_type,
    check_magic_bytes,
    civitai_thumbnail_url,
)


class TestCheckContentType:
    def test_none_is_allowed(self):
        """None Content-Type should be allowed (can't filter)."""
        assert check_content_type(None) is True

    def test_image_jpeg_allowed(self):
        assert check_content_type("image/jpeg") is True

    def test_image_png_allowed(self):
        assert check_content_type("image/png") is True

    def test_image_webp_allowed(self):
        assert check_content_type("image/webp") is True

    def test_image_with_charset_allowed(self):
        assert check_content_type("image/jpeg; charset=utf-8") is True

    def test_video_mp4_rejected(self):
        assert check_content_type("video/mp4") is False

    def test_video_webm_rejected(self):
        assert check_content_type("video/webm") is False

    def test_text_html_rejected(self):
        assert check_content_type("text/html") is False

    def test_text_plain_rejected(self):
        assert check_content_type("text/plain") is False

    def test_application_json_rejected(self):
        assert check_content_type("application/json") is False

    def test_application_octet_stream_allowed(self):
        """application/octet-stream should be allowed (common for image downloads)."""
        assert check_content_type("application/octet-stream") is True

    def test_case_insensitive(self):
        assert check_content_type("Video/MP4") is False
        assert check_content_type("TEXT/HTML") is False

    def test_with_params(self):
        assert check_content_type("video/mp4; codecs=avc1") is False


class TestCheckMagicBytes:
    def test_jpeg(self):
        assert check_magic_bytes(b"\xff\xd8\xff\xe0") is True

    def test_png(self):
        assert check_magic_bytes(b"\x89PNG\r\n\x1a\n") is True

    def test_webp(self):
        assert check_magic_bytes(b"RIFF\x00\x00\x00\x00WEBP") is True

    def test_gif(self):
        assert check_magic_bytes(b"GIF89a") is True

    def test_bmp(self):
        assert check_magic_bytes(b"BM\x00\x00") is True

    def test_video_file_rejected(self):
        """MP4 magic bytes should be rejected."""
        assert check_magic_bytes(b"\x00\x00\x00\x1c") is False

    def test_html_rejected(self):
        assert check_magic_bytes(b"<!DOCTYPE html>") is False

    def test_json_rejected(self):
        assert check_magic_bytes(b'{"error":') is False

    def test_empty_rejected(self):
        assert check_magic_bytes(b"") is False

    def test_single_byte_rejected(self):
        assert check_magic_bytes(b"\xff") is False


class TestCivitaiThumbnailUrl:
    def test_replaces_original_with_width(self):
        url = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc123/original=true/def.jpeg"
        result = civitai_thumbnail_url(url)
        assert result == "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc123/width=450/def.jpeg"

    def test_custom_width(self):
        url = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc123/original=true/def.jpeg"
        result = civitai_thumbnail_url(url, width=200)
        assert result == "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc123/width=200/def.jpeg"

    def test_no_original_in_url(self):
        """If URL doesn't contain /original=true/, return unchanged."""
        url = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc123/width=100/def.jpeg"
        result = civitai_thumbnail_url(url)
        assert result == url

    def test_preserves_query_params(self):
        url = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc/original=true/img.jpeg?token=xyz"
        result = civitai_thumbnail_url(url)
        assert "/width=450/" in result
        assert "?token=xyz" in result


class TestImageMagicPrefixes:
    def test_is_tuple(self):
        assert isinstance(IMAGE_MAGIC_PREFIXES, tuple)

    def test_contains_jpeg(self):
        assert b"\xff\xd8" in IMAGE_MAGIC_PREFIXES

    def test_contains_png(self):
        assert b"\x89P" in IMAGE_MAGIC_PREFIXES

    def test_contains_webp(self):
        assert b"RI" in IMAGE_MAGIC_PREFIXES

    def test_contains_gif(self):
        assert b"GI" in IMAGE_MAGIC_PREFIXES

    def test_contains_bmp(self):
        assert b"BM" in IMAGE_MAGIC_PREFIXES


# ---------------------------------------------------------------------------
# 2. API-level video/dimension filtering in CivitAICrawl
# ---------------------------------------------------------------------------

from src.discovery.platform_crawl import CivitAICrawl


def _mock_civitai_response(items, next_cursor=None, status=200):
    """Build a mock aiohttp response for CivitAI API."""
    data = {
        "items": items,
        "metadata": {"nextCursor": next_cursor} if next_cursor else {},
    }
    resp = AsyncMock()
    resp.status = status
    resp.json = AsyncMock(return_value=data)
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=resp)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


class TestCivitAIVideoFiltering:
    @pytest.mark.asyncio
    async def test_global_feed_skips_videos(self):
        """_fetch_images_page skips items with type='video'."""
        crawl = CivitAICrawl()
        items = [
            {"id": 1, "url": "https://img.civitai.com/1.jpg", "type": "image",
             "meta": {"prompt": "portrait photo"}, "tags": ["portrait"]},
            {"id": 2, "url": "https://img.civitai.com/2.mp4", "type": "video",
             "meta": {"prompt": "portrait video"}, "tags": ["portrait"]},
            {"id": 3, "url": "https://img.civitai.com/3.jpg", "type": "image",
             "meta": {"prompt": "realistic woman"}, "tags": []},
        ]

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_civitai_response(items))
        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, cursor = await crawl._fetch_images_page.__wrapped__.__wrapped__(
            crawl, session, limiter, None, "None"
        )

        urls = [r.source_url for r in results]
        assert "https://img.civitai.com/2.mp4" not in urls
        assert "https://img.civitai.com/1.jpg" in urls

    @pytest.mark.asyncio
    async def test_global_feed_skips_tiny_images(self):
        """_fetch_images_page skips items with dimensions < 100."""
        crawl = CivitAICrawl()
        items = [
            {"id": 1, "url": "https://img.civitai.com/normal.jpg",
             "width": 512, "height": 768,
             "meta": {"prompt": "portrait"}, "tags": ["portrait"]},
            {"id": 2, "url": "https://img.civitai.com/icon.jpg",
             "width": 48, "height": 48,
             "meta": {"prompt": "portrait"}, "tags": ["portrait"]},
            {"id": 3, "url": "https://img.civitai.com/wide_tiny.jpg",
             "width": 200, "height": 50,
             "meta": {"prompt": "portrait"}, "tags": ["portrait"]},
        ]

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_civitai_response(items))
        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_images_page.__wrapped__.__wrapped__(
            crawl, session, limiter, None, "None"
        )

        urls = [r.source_url for r in results]
        assert "https://img.civitai.com/normal.jpg" in urls
        assert "https://img.civitai.com/icon.jpg" not in urls
        assert "https://img.civitai.com/wide_tiny.jpg" not in urls

    @pytest.mark.asyncio
    async def test_global_feed_allows_no_dimensions(self):
        """Items without width/height should pass through (not all API results have them)."""
        crawl = CivitAICrawl()
        items = [
            {"id": 1, "url": "https://img.civitai.com/no_dims.jpg",
             "meta": {"prompt": "portrait"}, "tags": ["portrait"]},
        ]

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_civitai_response(items))
        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_images_page.__wrapped__.__wrapped__(
            crawl, session, limiter, None, "None"
        )

        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_search_skips_videos(self):
        """_fetch_image_search_page skips items with type='video'."""
        crawl = CivitAICrawl()
        items = [
            {"id": 1, "url": "https://img.civitai.com/1.jpg", "type": "image", "meta": {}},
            {"id": 2, "url": "https://img.civitai.com/2.mp4", "type": "video", "meta": {}},
        ]

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_civitai_response(items))
        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_image_search_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "portrait", "None"
        )

        assert len(results) == 1
        assert results[0].source_url == "https://img.civitai.com/1.jpg"

    @pytest.mark.asyncio
    async def test_search_skips_tiny(self):
        """_fetch_image_search_page skips tiny images."""
        crawl = CivitAICrawl()
        items = [
            {"id": 1, "url": "https://img.civitai.com/ok.jpg",
             "width": 512, "height": 512, "meta": {}},
            {"id": 2, "url": "https://img.civitai.com/tiny.jpg",
             "width": 32, "height": 32, "meta": {}},
        ]

        session = MagicMock()
        session.get = MagicMock(return_value=_mock_civitai_response(items))
        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_image_search_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "portrait", "None"
        )

        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_lora_skips_videos(self):
        """_fetch_lora_models_page skips video-type images in model versions."""
        crawl = CivitAICrawl()

        data = {
            "items": [{
                "id": 100,
                "name": "Test LoRA",
                "modelVersions": [{
                    "images": [
                        {"url": "https://img.civitai.com/photo.jpg", "type": "image"},
                        {"url": "https://img.civitai.com/clip.mp4", "type": "video"},
                    ]
                }]
            }],
            "metadata": {},
        }
        resp = AsyncMock()
        resp.status = 200
        resp.json = AsyncMock(return_value=data)
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)
        limiter = AsyncMock()
        limiter.acquire = AsyncMock()

        results, _ = await crawl._fetch_lora_models_page.__wrapped__.__wrapped__(
            crawl, session, limiter, "realistic"
        )

        assert len(results) == 1
        assert results[0].source_url == "https://img.civitai.com/photo.jpg"


# ---------------------------------------------------------------------------
# 3. Two-pass download functions (crawl_and_backfill.py)
# ---------------------------------------------------------------------------

# We need to import from scripts which does sys.path manipulation, so we set up the path
import os
import sys

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SCANNER_ROOT not in sys.path:
    sys.path.insert(0, SCANNER_ROOT)


class TestDownloadThumbnail:
    """Test download_thumbnail from crawl_and_backfill.py."""

    @pytest.mark.asyncio
    async def test_converts_url_to_thumbnail(self):
        """Should request width=450 CDN URL, not original."""
        from scripts.crawl_and_backfill import download_thumbnail

        requested_urls = []

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_type = "image/jpeg"
        mock_resp.read = AsyncMock(return_value=b"\xff\xd8" + b"\x00" * 1000)

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()

        def capture_get(url, **kwargs):
            requested_urls.append(url)
            return ctx

        session.get = capture_get

        with patch("scripts.crawl_and_backfill.TEMP_DIR", Path(os.environ.get("TEMP", "/tmp"))):
            path, skip_reason = await download_thumbnail(
                session,
                "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc/original=true/img.jpeg",
                "test-id",
            )

        assert skip_reason is None
        assert path is not None
        assert "/width=450/" in requested_urls[0]
        assert "/original=true/" not in requested_urls[0]

        # Cleanup
        if path and path.exists():
            path.unlink()

    @pytest.mark.asyncio
    async def test_rejects_video_content_type(self):
        """Should return skip_reason when Content-Type is video."""
        from scripts.crawl_and_backfill import download_thumbnail

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_type = "video/mp4"

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        path, skip_reason = await download_thumbnail(session, "https://example.com/original=true/vid.mp4", "id1")

        assert path is None
        assert skip_reason == "content_type:video/mp4"

    @pytest.mark.asyncio
    async def test_rejects_bad_magic_bytes(self):
        """Should reject files that don't start with image magic bytes."""
        from scripts.crawl_and_backfill import download_thumbnail

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_type = "image/jpeg"
        mock_resp.read = AsyncMock(return_value=b'{"error":"not found"}' + b"\x00" * 500)

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        path, skip_reason = await download_thumbnail(session, "https://example.com/original=true/img.jpeg", "id2")

        assert path is None
        assert skip_reason == "magic_bytes"

    @pytest.mark.asyncio
    async def test_rejects_too_small(self):
        """Should reject files smaller than 500 bytes."""
        from scripts.crawl_and_backfill import download_thumbnail

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_type = "image/jpeg"
        mock_resp.read = AsyncMock(return_value=b"\xff\xd8\xff")  # 3 bytes

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        path, skip_reason = await download_thumbnail(session, "https://example.com/original=true/img.jpeg", "id3")

        assert path is None
        assert skip_reason == "too_small"

    @pytest.mark.asyncio
    async def test_rejects_http_error(self):
        """Should return skip_reason on non-200 status."""
        from scripts.crawl_and_backfill import download_thumbnail

        mock_resp = AsyncMock()
        mock_resp.status = 404

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        path, skip_reason = await download_thumbnail(session, "https://example.com/original=true/img.jpeg", "id4")

        assert path is None
        assert skip_reason == "http_404"


class TestDownloadOriginal:
    """Test download_original from crawl_and_backfill.py."""

    @pytest.mark.asyncio
    async def test_downloads_original_url_as_is(self):
        """Should NOT convert to thumbnail — downloads the original."""
        from scripts.crawl_and_backfill import download_original

        requested_urls = []

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_type = "image/jpeg"
        mock_resp.read = AsyncMock(return_value=b"\xff\xd8" + b"\x00" * 2000)

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()

        def capture_get(url, **kwargs):
            requested_urls.append(url)
            return ctx

        session.get = capture_get

        original_url = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/abc/original=true/img.jpeg"
        with patch("scripts.crawl_and_backfill.TEMP_DIR", Path(os.environ.get("TEMP", "/tmp"))):
            path = await download_original(session, original_url, "test-id")

        assert path is not None
        assert requested_urls[0] == original_url  # original URL used as-is
        assert "/width=450/" not in requested_urls[0]

        # Cleanup
        if path and path.exists():
            path.unlink()

    @pytest.mark.asyncio
    async def test_rejects_video_content_type(self):
        """download_original also checks Content-Type."""
        from scripts.crawl_and_backfill import download_original

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_type = "video/mp4"

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        path = await download_original(session, "https://example.com/original=true/vid.mp4", "id1")
        assert path is None


# ---------------------------------------------------------------------------
# 4. Shared upload_thumbnail
# ---------------------------------------------------------------------------

class TestUploadThumbnail:
    @pytest.mark.asyncio
    async def test_returns_none_without_credentials(self):
        """Should return None when Supabase credentials are missing."""
        from src.utils.image_download import upload_thumbnail

        with patch("src.utils.image_download.settings") as mock_settings:
            mock_settings.supabase_url = ""
            mock_settings.supabase_service_role_key = ""
            result = await upload_thumbnail(Path("/tmp/fake.jpg"), platform="civitai")
            assert result is None

    @pytest.mark.asyncio
    async def test_storage_key_includes_platform(self):
        """Storage key should use the platform prefix."""
        from src.utils.image_download import upload_thumbnail

        upload_url_seen = []

        # Create a proper async context manager mock for session.put()
        def mock_put(url, headers=None, data=None):
            upload_url_seen.append(url)
            resp = MagicMock()
            resp.status = 200
            ctx = AsyncMock()
            ctx.__aenter__ = AsyncMock(return_value=resp)
            ctx.__aexit__ = AsyncMock(return_value=False)
            return ctx

        # Create a tiny valid JPEG
        from PIL import Image
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            img = Image.new("RGB", (100, 100), "red")
            img.save(f, "JPEG")
            temp_path = Path(f.name)

        mock_session = MagicMock()
        mock_session.put = mock_put

        mock_limiter = AsyncMock()
        mock_limiter.acquire = AsyncMock()

        with patch("src.utils.image_download.settings") as mock_settings:
            mock_settings.supabase_url = "https://test.supabase.co"
            mock_settings.supabase_service_role_key = "test-key"
            with patch("src.utils.rate_limiter.get_limiter", return_value=mock_limiter):
                result = await upload_thumbnail(
                    temp_path, platform="civitai", http_session=mock_session,
                )

        assert result is not None
        assert result.startswith("civitai/")
        assert result.endswith(".jpg")
        assert "discovered-images/civitai/" in upload_url_seen[0]

        # Cleanup
        temp_path.unlink(missing_ok=True)
        temp_path.with_suffix(".thumb.jpg").unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# 5. _download() Content-Type and magic bytes checks (image_download.py)
# ---------------------------------------------------------------------------

class TestDownloadPreFiltering:
    @pytest.mark.asyncio
    async def test_download_rejects_video_content_type(self):
        """The shared _download function should skip video Content-Types."""
        from src.utils.image_download import _download

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_length = 1000
        mock_resp.content_type = "video/mp4"

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        result = await _download("https://example.com/video.mp4", session)
        assert result is None

    @pytest.mark.asyncio
    async def test_download_rejects_text_html(self):
        """The shared _download function should skip text/html."""
        from src.utils.image_download import _download

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content_length = 5000
        mock_resp.content_type = "text/html; charset=utf-8"

        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        ctx.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx)

        result = await _download("https://example.com/error.html", session)
        assert result is None


# ---------------------------------------------------------------------------
# 6. DeviantArt uses shared upload_thumbnail
# ---------------------------------------------------------------------------

class TestDeviantArtRefactor:
    def test_upload_thumbnail_importable_from_deviantart(self):
        """DeviantArt module should import upload_thumbnail from shared utils."""
        import src.discovery.deviantart_crawl as da
        # Check that the module has access to upload_thumbnail from image_download
        from src.utils.image_download import upload_thumbnail as shared_fn
        assert da.upload_thumbnail is shared_fn

    def test_no_local_upload_thumbnail(self):
        """DeviantArt should NOT have a local _upload_thumbnail function."""
        import src.discovery.deviantart_crawl as da
        assert not hasattr(da, "_upload_thumbnail")

    def test_no_local_thumb_max_px(self):
        """DeviantArt should NOT have a local _THUMB_MAX_PX constant."""
        import src.discovery.deviantart_crawl as da
        assert not hasattr(da, "_THUMB_MAX_PX")


# ---------------------------------------------------------------------------
# 7. Integration: CivitAI pipeline skip tracking
# ---------------------------------------------------------------------------

class TestSkipReasonTracking:
    @pytest.mark.asyncio
    async def test_multiple_skip_reasons_accumulated(self):
        """download_thumbnail should return distinct skip reasons."""
        from scripts.crawl_and_backfill import download_thumbnail

        skip_counts: dict[str, int] = {}

        # Test video Content-Type
        mock_resp_video = AsyncMock()
        mock_resp_video.status = 200
        mock_resp_video.content_type = "video/mp4"
        ctx_video = AsyncMock()
        ctx_video.__aenter__ = AsyncMock(return_value=mock_resp_video)
        ctx_video.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.get = MagicMock(return_value=ctx_video)

        _, reason = await download_thumbnail(session, "https://example.com/original=true/a.mp4", "1")
        if reason:
            skip_counts[reason] = skip_counts.get(reason, 0) + 1

        # Test HTTP error
        mock_resp_404 = AsyncMock()
        mock_resp_404.status = 404
        ctx_404 = AsyncMock()
        ctx_404.__aenter__ = AsyncMock(return_value=mock_resp_404)
        ctx_404.__aexit__ = AsyncMock(return_value=False)

        session2 = MagicMock()
        session2.get = MagicMock(return_value=ctx_404)

        _, reason = await download_thumbnail(session2, "https://example.com/original=true/b.jpg", "2")
        if reason:
            skip_counts[reason] = skip_counts.get(reason, 0) + 1

        assert "content_type:video/mp4" in skip_counts
        assert "http_404" in skip_counts
        assert skip_counts["content_type:video/mp4"] == 1
        assert skip_counts["http_404"] == 1
