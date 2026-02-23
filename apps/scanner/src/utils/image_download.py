"""Resilient image downloader with streaming, validation, and cleanup."""

import asyncio
import atexit
import os
import shutil
import tempfile
import time
from pathlib import Path
from uuid import uuid4

import aiohttp
import cv2
import numpy as np
from PIL import Image

from src.config import settings
from src.utils.logging import get_logger

log = get_logger("image_download")

# Limits
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
DOWNLOAD_TIMEOUT = 10  # seconds
MAX_IMAGE_DIMENSION = 8192
RESIZE_TARGET = 4096  # resize long edge to this if > MAX_IMAGE_DIMENSION
MAX_CONCURRENT = 5

# Image validation constants
IMAGE_MAGIC_PREFIXES = (b"\xff\xd8", b"\x89P", b"RI", b"GI", b"BM")


def check_content_type(content_type: str | None) -> bool:
    """Return False if Content-Type is definitely not an image."""
    if content_type is None:
        return True
    ct = content_type.split(";")[0].strip().lower()
    return not ct.startswith(("video/", "text/", "application/json"))


def check_magic_bytes(data: bytes) -> bool:
    """Return True if first bytes match JPEG/PNG/WebP/GIF/BMP."""
    return len(data) >= 2 and data[:2] in IMAGE_MAGIC_PREFIXES


def civitai_thumbnail_url(original_url: str, width: int = 450) -> str:
    """Convert CivitAI CDN URL from /original=true/ to /width=N/."""
    return original_url.replace("/original=true/", f"/width={width}/")

# Semaphore to limit concurrent downloads
_download_semaphore = asyncio.Semaphore(MAX_CONCURRENT)

# Ensure temp dir exists
_temp_dir = Path(settings.temp_dir)
_temp_dir.mkdir(parents=True, exist_ok=True)


def _cleanup_temp_dir():
    """Remove temp directory on exit."""
    try:
        if _temp_dir.exists():
            shutil.rmtree(_temp_dir, ignore_errors=True)
    except Exception:
        pass


atexit.register(_cleanup_temp_dir)


def cleanup_old_temp_files(max_age_seconds: int = 300) -> int:
    """Delete temp files older than max_age_seconds. Returns count deleted."""
    if not _temp_dir.exists():
        return 0
    count = 0
    cutoff = time.time() - max_age_seconds
    for f in _temp_dir.iterdir():
        try:
            if f.is_file() and f.stat().st_mtime < cutoff:
                f.unlink()
                count += 1
        except OSError:
            continue
    return count


async def download_image(
    url: str,
    session: aiohttp.ClientSession | None = None,
) -> Path | None:
    """Download an image from URL to temp directory.

    Returns path to the downloaded file, or None on failure.
    Validates Content-Length, file integrity, and dimensions.
    """
    async with _download_semaphore:
        own_session = session is None
        if own_session:
            session = aiohttp.ClientSession()
        try:
            return await _download(url, session)
        except Exception as e:
            log.warning("download_failed", url=url, error=str(e))
            return None
        finally:
            if own_session:
                await session.close()


async def _download(url: str, session: aiohttp.ClientSession) -> Path | None:
    """Internal download with timeout and validation."""
    try:
        async with asyncio.timeout(DOWNLOAD_TIMEOUT):
            async with session.get(url) as resp:
                if resp.status != 200:
                    log.debug("download_non_200", url=url, status=resp.status)
                    return None

                # Check Content-Length before downloading
                content_length = resp.content_length
                if content_length and content_length > MAX_FILE_SIZE:
                    log.debug("download_too_large", url=url, size=content_length)
                    return None

                if not check_content_type(resp.content_type):
                    log.debug("download_content_type_skip", url=url, ct=resp.content_type)
                    return None

                # Stream to temp file
                suffix = _get_suffix(url)
                dest = _temp_dir / f"{uuid4().hex}{suffix}"
                total = 0

                with open(dest, "wb") as f:
                    async for chunk in resp.content.iter_chunked(8192):
                        total += len(chunk)
                        if total > MAX_FILE_SIZE:
                            log.debug("download_exceeded_max", url=url, size=total)
                            dest.unlink(missing_ok=True)
                            return None
                        f.write(chunk)

    except (asyncio.TimeoutError, TimeoutError):
        log.debug("download_timeout", url=url)
        return None
    except aiohttp.ClientError as e:
        log.debug("download_client_error", url=url, error=str(e))
        return None

    # Quick magic bytes check before full validation
    with open(dest, "rb") as f:
        if not check_magic_bytes(f.read(4)):
            log.debug("download_magic_bytes_skip", url=url)
            dest.unlink(missing_ok=True)
            return None

    # Validate image integrity
    if not _validate_image(dest):
        dest.unlink(missing_ok=True)
        return None

    return dest


def _get_suffix(url: str) -> str:
    """Extract file extension from URL."""
    path = url.split("?")[0].split("#")[0]
    if "." in path.split("/")[-1]:
        ext = "." + path.split("/")[-1].rsplit(".", 1)[-1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"):
            return ext
    return ".jpg"


def _validate_image(path: Path) -> bool:
    """Validate that the file is a readable image."""
    try:
        img = cv2.imread(str(path))
        if img is None:
            log.debug("image_corrupt", path=str(path))
            return False
        return True
    except Exception:
        log.debug("image_validation_error", path=str(path))
        return False


def load_and_resize(path: Path, max_edge: int = RESIZE_TARGET) -> np.ndarray | None:
    """Load an image from disk, resize if needed for face detection.

    Returns BGR numpy array (OpenCV format) or None if unreadable.
    """
    try:
        img = cv2.imread(str(path))
        if img is None:
            return None

        h, w = img.shape[:2]
        if max(h, w) > max_edge:
            scale = max_edge / max(h, w)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        return img
    except Exception:
        return None


async def download_and_store(
    url: str,
    bucket: str,
    storage_path: str,
    session: aiohttp.ClientSession | None = None,
) -> str | None:
    """Download an image from URL and upload it to Supabase Storage.

    Returns the storage path on success, or None on failure.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        log.warning("supabase_credentials_missing_for_store")
        return None

    # Download to temp file first
    local_path = await download_image(url, session)
    if local_path is None:
        return None

    try:
        upload_url = (
            f"{settings.supabase_url}/storage/v1/object/{bucket}/{storage_path}"
        )
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        }

        own_session = session is None
        if own_session:
            session = aiohttp.ClientSession()
        try:
            with open(local_path, "rb") as f:
                async with session.put(upload_url, headers=headers, data=f) as resp:
                    if resp.status not in (200, 201):
                        body = await resp.text()
                        log.warning(
                            "store_upload_failed",
                            status=resp.status,
                            path=storage_path,
                            body=body[:200],
                        )
                        return None
        finally:
            if own_session:
                await session.close()

        log.debug("image_stored", bucket=bucket, path=storage_path)
        return storage_path
    except Exception as e:
        log.warning("store_upload_error", path=storage_path, error=str(e))
        return None
    finally:
        local_path.unlink(missing_ok=True)


async def upload_thumbnail(
    path: Path,
    platform: str = "unknown",
    http_session: aiohttp.ClientSession | None = None,
    max_px: int = 512,
) -> str | None:
    """Resize to max_px and upload to Supabase Storage discovered-images/{platform}/{uuid}.jpg.

    Returns the storage key (e.g. 'civitai/{uuid}.jpg') or None on failure.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    thumb_path = path.with_suffix(".thumb.jpg")
    try:
        img = Image.open(path)
        img.thumbnail((max_px, max_px), Image.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(thumb_path, "JPEG", quality=80)
        img.close()

        storage_key = f"{platform}/{uuid4().hex}.jpg"
        url = (
            f"{settings.supabase_url}/storage/v1/object"
            f"/discovered-images/{storage_key}"
        )
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": "image/jpeg",
        }

        from src.utils.rate_limiter import get_limiter

        limiter = get_limiter("supabase_storage")
        await limiter.acquire()

        async def _do_upload(sess: aiohttp.ClientSession) -> str | None:
            with open(thumb_path, "rb") as f:
                async with sess.put(url, headers=headers, data=f) as resp:
                    if resp.status not in (200, 201):
                        body = await resp.text()
                        log.warning("thumbnail_upload_failed", status=resp.status, body=body[:200])
                        thumb_path.unlink(missing_ok=True)
                        return None
            thumb_path.unlink(missing_ok=True)
            return storage_key

        if http_session is not None:
            return await _do_upload(http_session)
        else:
            async with aiohttp.ClientSession() as session:
                return await _do_upload(session)

    except Exception as e:
        log.warning("thumbnail_upload_error", error=str(e))
        if thumb_path.exists():
            thumb_path.unlink(missing_ok=True)
        return None


async def download_from_supabase(
    bucket: str,
    file_path: str,
    session: aiohttp.ClientSession | None = None,
) -> Path | None:
    """Download a file from Supabase Storage using the service role key.

    Constructs: GET {SUPABASE_URL}/storage/v1/object/authenticated/{bucket}/{file_path}
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        log.error("supabase_credentials_missing")
        return None

    url = f"{settings.supabase_url}/storage/v1/object/authenticated/{bucket}/{file_path}"

    own_session = session is None
    if own_session:
        session = aiohttp.ClientSession()
    try:
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
        }
        async with _download_semaphore:
            try:
                async with asyncio.timeout(DOWNLOAD_TIMEOUT):
                    async with session.get(url, headers=headers) as resp:
                        if resp.status != 200:
                            log.warning(
                                "supabase_download_failed",
                                bucket=bucket,
                                file_path=file_path,
                                status=resp.status,
                            )
                            return None

                        suffix = _get_suffix(file_path)
                        dest = _temp_dir / f"{uuid4().hex}{suffix}"
                        total = 0

                        with open(dest, "wb") as f:
                            async for chunk in resp.content.iter_chunked(8192):
                                total += len(chunk)
                                if total > MAX_FILE_SIZE:
                                    dest.unlink(missing_ok=True)
                                    return None
                                f.write(chunk)

            except (asyncio.TimeoutError, TimeoutError):
                log.warning("supabase_download_timeout", bucket=bucket, file_path=file_path)
                return None

        if not _validate_image(dest):
            dest.unlink(missing_ok=True)
            return None

        return dest
    finally:
        if own_session:
            await session.close()
