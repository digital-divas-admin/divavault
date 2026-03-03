"""Task queue processor for deepfake analysis tasks.

Polls the deepfake_tasks table for pending tasks, claims them, and processes
them through the appropriate pipeline (download, frame extraction, metadata).
"""

import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.utils.logging import get_logger

log = get_logger("deepfake.processor")


async def process_pending_tasks() -> int:
    """Poll for pending deepfake tasks and process them.

    Returns:
        Number of tasks processed.
    """
    processed = 0

    # Fetch pending tasks
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT id, task_type, investigation_id, media_id, result, frame_id "
            "FROM deepfake_tasks "
            "WHERE status = 'pending' "
            "ORDER BY created_at ASC "
            "LIMIT 10"
        ))
        tasks = result.fetchall()

    if not tasks:
        return 0

    log.info("deepfake_tasks_found", count=len(tasks))

    for task_row in tasks:
        task_id = str(task_row[0])
        task_type = task_row[1]
        investigation_id = str(task_row[2])
        media_id = str(task_row[3]) if task_row[3] else None
        parameters = task_row[4] or {}  # stored in 'result' column as JSONB
        frame_id = str(task_row[5]) if task_row[5] else None

        # Atomically claim the task (skip if already claimed by another worker)
        async with async_session() as session:
            result = await session.execute(text(
                "UPDATE deepfake_tasks "
                "SET status = 'running', started_at = :now "
                "WHERE id = :id AND status = 'pending' "
                "RETURNING id"
            ), {"id": task_id, "now": datetime.now(timezone.utc)})
            claimed = result.fetchone()
            await session.commit()

        if not claimed:
            log.debug("deepfake_task_already_claimed", task_id=task_id)
            continue

        try:
            if task_type == "download_media":
                await _process_download(task_id, investigation_id, media_id, parameters)
            elif task_type == "extract_frames":
                await _process_extract_frames(task_id, investigation_id, media_id, parameters)
            elif task_type == "extract_metadata":
                await _process_extract_metadata(task_id, investigation_id, media_id, parameters)
            elif task_type == "reverse_search":
                from src.deepfake.reverse_search import run_reverse_search
                if not frame_id:
                    raise ValueError("No frame_id for reverse_search task")
                await run_reverse_search(task_id, investigation_id, frame_id, parameters)
            elif task_type == "ai_detection":
                from src.deepfake.ai_detect import run_ai_detection
                await run_ai_detection(task_id, investigation_id, media_id, frame_id, parameters)
            elif task_type == "check_provenance":
                from src.deepfake.provenance import run_provenance_check
                await run_provenance_check(task_id, investigation_id, media_id, parameters)
            elif task_type == "news_search":
                from src.deepfake.news_search import run_news_search
                await run_news_search(task_id, investigation_id, parameters)
            elif task_type == "wire_search":
                from src.deepfake.wire_search import run_wire_search
                await run_wire_search(task_id, investigation_id, parameters)
            else:
                log.warning("unknown_task_type", task_id=task_id, task_type=task_type)
                await _fail_task(task_id, f"Unknown task type: {task_type}")
                continue

            # Mark complete
            async with async_session() as session:
                await session.execute(text(
                    "UPDATE deepfake_tasks "
                    "SET status = 'completed', completed_at = :now, progress = 100 "
                    "WHERE id = :id"
                ), {"id": task_id, "now": datetime.now(timezone.utc)})
                await session.commit()

            processed += 1
            log.info("deepfake_task_completed", task_id=task_id, task_type=task_type)

        except Exception as e:
            log.error("deepfake_task_failed", task_id=task_id, error=str(e))
            await _fail_task(task_id, str(e)[:1000])

    log.info("deepfake_tasks_processed", total=processed)
    return processed


async def _update_progress(task_id: str, progress: int) -> None:
    """Update task progress percentage."""
    async with async_session() as session:
        await session.execute(text(
            "UPDATE deepfake_tasks SET progress = :progress WHERE id = :id"
        ), {"id": task_id, "progress": progress})
        await session.commit()


async def _fail_task(task_id: str, error_message: str) -> None:
    """Mark a task as failed with error details."""
    async with async_session() as session:
        await session.execute(text(
            "UPDATE deepfake_tasks "
            "SET status = 'failed', completed_at = :now, "
            "    result = jsonb_build_object('error', CAST(:error AS text)) "
            "WHERE id = :id"
        ), {
            "id": task_id,
            "now": datetime.now(timezone.utc),
            "error": error_message,
        })
        await session.commit()


async def _process_download(task_id: str, investigation_id: str, media_id: str | None, parameters: dict) -> None:
    """Process a download_media task.

    Uses the task's media_id FK to look up the source URL, downloads it,
    uploads to storage, and updates the media row.
    """
    from src.deepfake.downloader import download_media

    if not media_id:
        raise ValueError("No media_id provided for download task")

    # Get the media row to find the source URL
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT source_url FROM deepfake_media "
            "WHERE id = :id AND download_status = 'pending'"
        ), {"id": media_id})
        media_row = result.fetchone()

    if not media_row:
        raise ValueError(f"Media {media_id} not found or not pending")

    url = media_row[0]

    # Mark as downloading
    async with async_session() as session:
        await session.execute(text(
            "UPDATE deepfake_media SET download_status = 'downloading', updated_at = :now "
            "WHERE id = :id"
        ), {"id": media_id, "now": datetime.now(timezone.utc)})
        await session.commit()

    await _update_progress(task_id, 10)

    tmp_dir = tempfile.mkdtemp(prefix="deepfake_dl_")
    try:
        dl_result = await download_media(url, tmp_dir)
        await _update_progress(task_id, 60)

        file_path = dl_result["file_path"]
        storage_path = f"{investigation_id}/media/{Path(file_path).name}"
        await _upload_to_storage(file_path, storage_path)
        await _update_progress(task_id, 80)

        # Update deepfake_media row with download results
        async with async_session() as session:
            await session.execute(text(
                "UPDATE deepfake_media "
                "SET storage_path = :sp, file_size_bytes = :fs, media_type = :mt, "
                "    download_status = 'completed', updated_at = :now "
                "WHERE id = :id"
            ), {
                "id": media_id,
                "sp": storage_path,
                "fs": dl_result["file_size"],
                "mt": dl_result["media_type"],
                "now": datetime.now(timezone.utc),
            })
            await session.commit()

        # Create follow-up tasks: extract frames + metadata
        async with async_session() as session:
            await session.execute(text(
                "INSERT INTO deepfake_tasks (investigation_id, media_id, task_type) VALUES "
                "(:inv_id, :mid, 'extract_frames'), "
                "(:inv_id, :mid, 'extract_metadata')"
            ), {"inv_id": investigation_id, "mid": media_id})
            await session.commit()

        await _update_progress(task_id, 90)

    except Exception as e:
        # Mark media as failed
        async with async_session() as session:
            await session.execute(text(
                "UPDATE deepfake_media SET download_status = 'failed', "
                "download_error = :err, updated_at = :now WHERE id = :id"
            ), {"id": media_id, "err": str(e)[:500], "now": datetime.now(timezone.utc)})
            await session.commit()
        raise

    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _process_extract_frames(
    task_id: str, investigation_id: str, media_id: str | None, parameters: dict
) -> None:
    """Process an extract_frames task."""
    from src.deepfake.frame_extractor import extract_keyframes

    if not media_id:
        raise ValueError("No media_id provided for frame extraction")

    # Get media storage path from DB
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT storage_path FROM deepfake_media WHERE id = :id AND download_status = 'completed'"
        ), {"id": media_id})
        row = result.fetchone()

    if not row or not row[0]:
        raise ValueError(f"Media {media_id} not found or not downloaded")

    storage_path = row[0]
    await _update_progress(task_id, 10)

    # Download the file from storage to a temp location
    tmp_dir = tempfile.mkdtemp(prefix="deepfake_frames_")
    video_path = os.path.join(tmp_dir, "video.mp4")

    try:
        storage_url = f"{settings.supabase_url}/storage/v1/object/deepfake-evidence/{storage_path}"
        await _download_from_storage(storage_url, video_path)
        await _update_progress(task_id, 20)

        max_frames = parameters.get("max_frames", 50) if parameters else 50
        frames_dir = os.path.join(tmp_dir, "frames")

        frames = await extract_keyframes(video_path, frames_dir, max_frames=max_frames)
        await _update_progress(task_id, 60)

        # Upload frames to storage and create DB rows
        for i, frame in enumerate(frames):
            frame_sp = f"{investigation_id}/frames/{Path(frame['file_path']).name}"
            await _upload_to_storage(frame["file_path"], frame_sp)

            thumb_sp = None
            if frame.get("thumbnail_path") and os.path.exists(frame["thumbnail_path"]):
                thumb_sp = f"{investigation_id}/frames/thumbs/{Path(frame['thumbnail_path']).name}"
                await _upload_to_storage(frame["thumbnail_path"], thumb_sp)

            async with async_session() as session:
                await session.execute(text(
                    "INSERT INTO deepfake_frames "
                    "(media_id, investigation_id, frame_number, timestamp_seconds, storage_path, thumbnail_path) "
                    "VALUES (:mid, :inv_id, :fn, :ts, :fp, :tp)"
                ), {
                    "mid": media_id,
                    "inv_id": investigation_id,
                    "fn": frame["frame_number"],
                    "ts": frame.get("timestamp_seconds"),
                    "fp": frame_sp,
                    "tp": thumb_sp,
                })
                await session.commit()

            progress = 60 + int(30 * (i + 1) / max(len(frames), 1))
            await _update_progress(task_id, min(progress, 90))

    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _process_extract_metadata(
    task_id: str, investigation_id: str, media_id: str | None, parameters: dict
) -> None:
    """Process an extract_metadata task."""
    from src.deepfake.metadata import extract_metadata

    if not media_id:
        raise ValueError("No media_id provided for metadata extraction")

    # Get media storage path from DB
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT storage_path FROM deepfake_media WHERE id = :id AND download_status = 'completed'"
        ), {"id": media_id})
        row = result.fetchone()

    if not row or not row[0]:
        raise ValueError(f"Media {media_id} not found or not downloaded")

    storage_path = row[0]
    await _update_progress(task_id, 10)

    # Download to temp
    tmp_dir = tempfile.mkdtemp(prefix="deepfake_meta_")
    local_path = os.path.join(tmp_dir, "media_file")

    try:
        storage_url = f"{settings.supabase_url}/storage/v1/object/deepfake-evidence/{storage_path}"
        await _download_from_storage(storage_url, local_path)
        await _update_progress(task_id, 30)

        metadata = await extract_metadata(local_path)
        await _update_progress(task_id, 70)

        # Update deepfake_media row with metadata
        import json
        async with async_session() as session:
            await session.execute(text(
                "UPDATE deepfake_media "
                "SET duration_seconds = :dur, fps = :fps, codec = :codec, "
                "    resolution_width = :rw, resolution_height = :rh, "
                "    ffprobe_data = CAST(:ffprobe AS jsonb), exif_data = CAST(:exif AS jsonb), "
                "    updated_at = :now "
                "WHERE id = :id"
            ), {
                "id": media_id,
                "dur": metadata["duration_seconds"],
                "fps": metadata["fps"],
                "codec": metadata["codec"],
                "rw": metadata["resolution_width"],
                "rh": metadata["resolution_height"],
                "ffprobe": json.dumps(metadata["ffprobe_data"]) if metadata["ffprobe_data"] else None,
                "exif": json.dumps(metadata["exif_data"]) if metadata["exif_data"] else None,
                "now": datetime.now(timezone.utc),
            })
            await session.commit()

        await _update_progress(task_id, 90)

    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _upload_to_storage(local_path: str, storage_path: str) -> str:
    """Upload a file to the deepfake-evidence Supabase Storage bucket.

    Returns the storage URL.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase credentials not configured")

    import aiohttp

    url = f"{settings.supabase_url}/storage/v1/object/deepfake-evidence/{storage_path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/octet-stream",
    }

    async with aiohttp.ClientSession() as session:
        with open(local_path, "rb") as f:
            async with session.put(url, headers=headers, data=f) as resp:
                if resp.status not in (200, 201):
                    body = await resp.text()
                    raise RuntimeError(f"Storage upload failed ({resp.status}): {body[:200]}")

    storage_url = f"{settings.supabase_url}/storage/v1/object/deepfake-evidence/{storage_path}"
    log.debug("file_uploaded", path=storage_path)
    return storage_url


async def _download_from_storage(storage_url: str, local_path: str) -> None:
    """Download a file from Supabase Storage to a local path."""
    import aiohttp

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
