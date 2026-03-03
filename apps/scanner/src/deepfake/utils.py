"""Shared utilities for deepfake investigation task modules."""

import json
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

import aiohttp
from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.utils.logging import get_logger

log = get_logger("deepfake.utils")


async def update_task_progress(task_id: str, progress: int) -> None:
    """Update task progress percentage."""
    async with async_session() as session:
        await session.execute(text(
            "UPDATE deepfake_tasks SET progress = :progress WHERE id = :id"
        ), {"id": task_id, "progress": progress})
        await session.commit()


def deepfake_storage_url(storage_path: str) -> str:
    """Build the full Supabase Storage URL for a deepfake-evidence file."""
    return f"{settings.supabase_url}/storage/v1/object/deepfake-evidence/{storage_path}"


async def download_from_storage(storage_url: str, local_path: str) -> None:
    """Download a file from Supabase Storage to a local path."""
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(storage_url, headers=headers) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"Storage download failed ({resp.status}): {body[:200]}")
            with open(local_path, "wb") as f:
                async for chunk in resp.content.iter_chunked(65536):
                    f.write(chunk)


async def log_activity(
    investigation_id: str,
    event_type: str,
    metadata: dict,
) -> None:
    """Insert an entry into the deepfake activity log."""
    async with async_session() as session:
        await session.execute(text(
            "INSERT INTO deepfake_activity_log (investigation_id, event_type, metadata) "
            "VALUES (:inv_id, :event, :meta::jsonb)"
        ), {
            "inv_id": investigation_id,
            "event": event_type,
            "meta": json.dumps(metadata),
        })
        await session.commit()


async def get_frame_storage_path(frame_id: str) -> str | None:
    """Look up the storage path for a frame."""
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT storage_path FROM deepfake_frames WHERE id = :id"
        ), {"id": frame_id})
        row = result.fetchone()
    return row[0] if row and row[0] else None


async def get_media_storage_path(media_id: str) -> str | None:
    """Look up the storage path for a downloaded media item."""
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT storage_path FROM deepfake_media "
            "WHERE id = :id AND download_status = 'completed'"
        ), {"id": media_id})
        row = result.fetchone()
    return row[0] if row and row[0] else None


async def resolve_storage_path(
    frame_id: str | None,
    media_id: str | None,
) -> str | None:
    """Resolve a storage path from frame_id (preferred) or media_id fallback."""
    if frame_id:
        path = await get_frame_storage_path(frame_id)
        if path:
            return path
    if media_id:
        return await get_media_storage_path(media_id)
    return None


async def get_investigation_search_context(
    investigation_id: str,
) -> tuple[str, str | None, str | None]:
    """Fetch investigation title, geographic_context, date_first_seen.

    Returns (title, geographic_context, date_first_seen).
    Raises ValueError if investigation not found.
    """
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT title, geographic_context, date_first_seen "
            "FROM deepfake_investigations WHERE id = :id"
        ), {"id": investigation_id})
        row = result.fetchone()

    if not row:
        raise ValueError(f"Investigation {investigation_id} not found")

    return row[0], row[1], row[2]


def build_search_query(title: str, geographic_context: str | None) -> str:
    """Build a search query string from investigation details."""
    parts = [title]
    if geographic_context:
        parts.append(geographic_context)
    return " ".join(parts)


@asynccontextmanager
async def temp_directory(prefix: str = "deepfake_"):
    """Async context manager that creates and cleans up a temp directory."""
    tmp_dir = tempfile.mkdtemp(prefix=prefix)
    try:
        yield tmp_dir
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
