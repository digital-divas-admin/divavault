"""Test image download resilience."""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest

from src.utils.image_download import (
    MAX_FILE_SIZE,
    _get_suffix,
    _validate_image,
    cleanup_old_temp_files,
)


class TestGetSuffix:
    def test_jpg(self):
        assert _get_suffix("https://example.com/photo.jpg") == ".jpg"

    def test_png(self):
        assert _get_suffix("https://example.com/photo.png") == ".png"

    def test_webp(self):
        assert _get_suffix("https://example.com/photo.webp") == ".webp"

    def test_query_params(self):
        assert _get_suffix("https://example.com/photo.jpg?w=100") == ".jpg"

    def test_no_extension(self):
        assert _get_suffix("https://example.com/photo") == ".jpg"

    def test_uppercase(self):
        assert _get_suffix("https://example.com/PHOTO.JPEG") == ".jpeg"


class TestMaxFileSize:
    def test_max_file_size_is_20mb(self):
        assert MAX_FILE_SIZE == 20 * 1024 * 1024


class TestCleanup:
    def test_cleanup_nonexistent_dir(self, tmp_path):
        """Should not crash on nonexistent directory."""
        with patch("src.utils.image_download._temp_dir", tmp_path / "nonexistent"):
            count = cleanup_old_temp_files()
            assert count == 0

    def test_cleanup_old_files(self, tmp_path):
        """Old files should be deleted."""
        import os
        import time

        with patch("src.utils.image_download._temp_dir", tmp_path):
            # Create a file
            f = tmp_path / "old_file.jpg"
            f.write_text("test")
            # Set mtime to the past
            old_time = time.time() - 600
            os.utime(f, (old_time, old_time))

            count = cleanup_old_temp_files(max_age_seconds=300)
            assert count == 1
            assert not f.exists()

    def test_cleanup_keeps_recent_files(self, tmp_path):
        """Recent files should be kept."""
        with patch("src.utils.image_download._temp_dir", tmp_path):
            f = tmp_path / "recent_file.jpg"
            f.write_text("test")

            count = cleanup_old_temp_files(max_age_seconds=300)
            assert count == 0
            assert f.exists()
