"""Supabase Storage evidence file upload."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import aiohttp

from src.config import settings
from src.evidence.hasher import hash_file
from src.utils.logging import get_logger

log = get_logger("evidence_storage")


async def upload_evidence(
    local_path: Path,
    contributor_id: UUID,
    match_id: UUID,
    evidence_type: str,
) -> dict | None:
    """Upload an evidence file to Supabase Storage.

    Args:
        local_path: Path to the local file.
        contributor_id: Contributor UUID.
        match_id: Match UUID.
        evidence_type: Type of evidence (screenshot, page_archive, image_copy, metadata).

    Returns:
        Dict with 'storage_url', 'sha256_hash', 'file_size_bytes', or None on failure.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        log.warning("supabase_credentials_not_configured")
        return None

    try:
        sha256 = hash_file(local_path)
        file_size = local_path.stat().st_size
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        suffix = local_path.suffix or ".png"

        key = f"evidence/{contributor_id}/{match_id}/{evidence_type}_{timestamp}{suffix}"

        url = f"{settings.supabase_url}/storage/v1/object/{settings.s3_bucket_name}/{key}"
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": _content_type(suffix),
        }

        async with aiohttp.ClientSession() as session:
            with open(local_path, "rb") as f:
                async with session.put(url, headers=headers, data=f) as resp:
                    if resp.status not in (200, 201):
                        body = await resp.text()
                        log.error("evidence_upload_failed", status=resp.status, body=body)
                        return None

        storage_url = f"{settings.supabase_url}/storage/v1/object/{settings.s3_bucket_name}/{key}"

        log.info(
            "evidence_uploaded",
            key=key,
            size=file_size,
            sha256=sha256[:16],
        )

        return {
            "storage_url": storage_url,
            "sha256_hash": sha256,
            "file_size_bytes": file_size,
        }

    except Exception as e:
        log.error("evidence_upload_error", error=str(e))
        return None


def _content_type(suffix: str) -> str:
    """Map file extension to MIME type."""
    types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".html": "text/html",
        ".json": "application/json",
    }
    return types.get(suffix.lower(), "application/octet-stream")
