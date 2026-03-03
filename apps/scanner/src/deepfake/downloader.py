"""Download media from URLs using yt-dlp (video platforms) or direct aiohttp download."""

import os
import tempfile
from pathlib import Path

import aiohttp

from src.utils.logging import get_logger

log = get_logger("deepfake.downloader")

# Platforms handled by yt-dlp
_YTDLP_DOMAINS = {
    "youtube.com", "youtu.be",
    "tiktok.com",
    "twitter.com", "x.com",
    "facebook.com", "fb.watch",
    "instagram.com",
    "rumble.com",
}


def _is_ytdlp_url(url: str) -> bool:
    """Check if the URL should be handled by yt-dlp."""
    from urllib.parse import urlparse
    try:
        host = urlparse(url).hostname or ""
        host = host.lower().removeprefix("www.").removeprefix("m.")
        return host in _YTDLP_DOMAINS
    except Exception:
        return False


def _find_ytdlp() -> str:
    """Find the yt-dlp executable."""
    import shutil
    path = shutil.which("yt-dlp")
    if path:
        return path
    # Check common pip install locations
    for candidate in [
        os.path.expanduser("~/Library/Python/3.9/bin/yt-dlp"),
        os.path.expanduser("~/.local/bin/yt-dlp"),
        "/usr/local/bin/yt-dlp",
    ]:
        if os.path.isfile(candidate):
            return candidate
    raise FileNotFoundError("yt-dlp not found. Install it with: pip3 install yt-dlp")


async def _download_with_ytdlp(url: str, output_dir: str) -> dict:
    """Download media using yt-dlp in a subprocess."""
    import asyncio
    import json

    output_template = os.path.join(output_dir, "%(id)s.%(ext)s")
    ytdlp_bin = _find_ytdlp()

    cmd = [
        ytdlp_bin,
        "--no-playlist",
        "--write-info-json",
        "--output", output_template,
        "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--max-filesize", "500M",
        url,
    ]

    log.info("ytdlp_download_start", url=url)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode(errors="replace")[-500:]
        log.error("ytdlp_download_failed", url=url, error=error_msg)
        raise RuntimeError(f"yt-dlp failed: {error_msg}")

    # Find the downloaded file (largest non-json file in output_dir)
    files = sorted(
        [f for f in Path(output_dir).iterdir() if not f.name.endswith(".json")],
        key=lambda f: f.stat().st_size,
        reverse=True,
    )
    if not files:
        raise RuntimeError("yt-dlp produced no output files")

    downloaded = files[0]
    file_size = downloaded.stat().st_size

    # Try to read info json for metadata
    info_files = [f for f in Path(output_dir).iterdir() if f.name.endswith(".info.json")]
    media_type = "video"
    if info_files:
        try:
            with open(info_files[0]) as f:
                info = json.load(f)
                if info.get("vcodec") == "none" and info.get("acodec") != "none":
                    media_type = "audio"
        except Exception:
            pass

    log.info("ytdlp_download_complete", url=url, file=str(downloaded), size=file_size)

    return {
        "file_path": str(downloaded),
        "file_size": file_size,
        "media_type": media_type,
        "original_url": url,
    }


async def _download_direct(url: str, output_dir: str) -> dict:
    """Download media directly via aiohttp."""
    log.info("direct_download_start", url=url)

    timeout = aiohttp.ClientTimeout(total=120)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url) as resp:
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status} downloading {url}")

            content_type = resp.headers.get("Content-Type", "")
            content_length = resp.headers.get("Content-Length")

            # Determine extension from content type
            ext = _ext_from_content_type(content_type)
            filename = f"media{ext}"
            file_path = os.path.join(output_dir, filename)

            with open(file_path, "wb") as f:
                async for chunk in resp.content.iter_chunked(65536):
                    f.write(chunk)

    file_size = os.path.getsize(file_path)

    # Determine media type
    if content_type.startswith("video/"):
        media_type = "video"
    elif content_type.startswith("image/"):
        media_type = "image"
    else:
        media_type = "video" if ext in (".mp4", ".webm", ".mkv", ".avi", ".mov") else "image"

    log.info("direct_download_complete", url=url, size=file_size, media_type=media_type)

    return {
        "file_path": file_path,
        "file_size": file_size,
        "media_type": media_type,
        "original_url": url,
    }


def _ext_from_content_type(content_type: str) -> str:
    """Map content-type to file extension."""
    ct = content_type.lower().split(";")[0].strip()
    mapping = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/x-matroska": ".mkv",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    return mapping.get(ct, ".bin")


async def download_media(url: str, output_dir: str) -> dict:
    """Download media from a URL.

    Uses yt-dlp for known video platforms, falls back to direct download.

    Returns:
        Dict with: file_path, file_size, media_type, original_url
    """
    os.makedirs(output_dir, exist_ok=True)

    try:
        if _is_ytdlp_url(url):
            return await _download_with_ytdlp(url, output_dir)
        else:
            return await _download_direct(url, output_dir)
    except Exception as e:
        log.error("download_media_failed", url=url, error=str(e))
        raise
