"""C2PA content provenance checking for deepfake investigations.

Uses the c2pa-python library to check for Content Credentials
(C2PA manifests) embedded in media files.
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import text

from src.db.connection import async_session
from src.deepfake.utils import (
    deepfake_storage_url,
    download_from_storage,
    get_media_storage_path,
    log_activity,
    temp_directory,
    update_task_progress,
)
from src.utils.logging import get_logger

log = get_logger("deepfake.provenance")


async def run_provenance_check(
    task_id: str,
    investigation_id: str,
    media_id: str | None,
    parameters: dict,
) -> None:
    """Check media for C2PA Content Credentials.

    Downloads the media file and uses c2pa-python to inspect
    embedded provenance data.
    """
    if not media_id:
        raise ValueError("No media_id provided for provenance check")

    storage_path = await get_media_storage_path(media_id)
    if not storage_path:
        raise ValueError(f"Media {media_id} not found or not downloaded")

    await update_task_progress(task_id, 10)

    async with temp_directory("deepfake_c2pa_") as tmp_dir:
        local_path = Path(tmp_dir) / f"media{Path(storage_path).suffix or '.bin'}"
        await download_from_storage(deepfake_storage_url(storage_path), str(local_path))
        await update_task_progress(task_id, 30)

        # Run c2pa check in executor (c2pa is synchronous)
        loop = asyncio.get_running_loop()
        c2pa_result = await loop.run_in_executor(None, _check_c2pa, str(local_path))
        await update_task_progress(task_id, 70)

        if c2pa_result is None:
            # No Content Credentials found
            async with async_session() as session:
                await session.execute(text(
                    "INSERT INTO deepfake_evidence "
                    "(investigation_id, evidence_type, title, content) "
                    "VALUES (:inv_id, 'provenance_check', :title, :content)"
                ), {
                    "inv_id": investigation_id,
                    "title": "No Content Credentials",
                    "content": (
                        "No C2PA Content Credentials were found in this media file. "
                        "This means the file either never had credentials embedded, or they were stripped "
                        "during editing/re-encoding. Most AI-generated content and social media uploads "
                        "lack Content Credentials."
                    ),
                })
                await session.commit()
        else:
            # Content Credentials found
            provenance_json = json.dumps(c2pa_result)
            signer = c2pa_result.get("signer", "Unknown")
            title = f"Content Credentials Found — Signed by {signer}"

            content_parts = []
            if c2pa_result.get("signer"):
                content_parts.append(f"Signer: {c2pa_result['signer']}")
            if c2pa_result.get("timestamp"):
                content_parts.append(f"Signed at: {c2pa_result['timestamp']}")
            if c2pa_result.get("claim_generator"):
                content_parts.append(f"Tool: {c2pa_result['claim_generator']}")
            if c2pa_result.get("actions"):
                content_parts.append(f"Edit actions: {', '.join(c2pa_result['actions'])}")

            async with async_session() as session:
                await session.execute(text(
                    "INSERT INTO deepfake_evidence "
                    "(investigation_id, evidence_type, title, content, provenance_data) "
                    "VALUES (:inv_id, 'provenance_check', :title, :content, :prov::jsonb)"
                ), {
                    "inv_id": investigation_id,
                    "title": title,
                    "content": "\n".join(content_parts) if content_parts else "Content Credentials present.",
                    "prov": provenance_json,
                })
                await session.commit()

        await update_task_progress(task_id, 90)

        await log_activity(investigation_id, "provenance_checked", {
            "media_id": media_id,
            "has_credentials": c2pa_result is not None,
        })

        log.info(
            "provenance_check_complete",
            media_id=media_id,
            has_credentials=c2pa_result is not None,
        )


def _check_c2pa(file_path: str) -> dict | None:
    """Check a file for C2PA Content Credentials (synchronous)."""
    try:
        import c2pa

        reader = c2pa.Reader.from_file(file_path)
        manifest = reader.get_active_manifest()

        if manifest is None:
            return None

        result = {}

        if hasattr(manifest, "claim_generator"):
            result["claim_generator"] = manifest.claim_generator
        if hasattr(manifest, "title"):
            result["title"] = manifest.title

        # Extract signature info
        if hasattr(manifest, "signature_info") and manifest.signature_info:
            sig = manifest.signature_info
            if hasattr(sig, "issuer"):
                result["signer"] = sig.issuer
            if hasattr(sig, "time"):
                result["timestamp"] = str(sig.time)

        # Extract actions
        if hasattr(manifest, "assertions"):
            actions = []
            for assertion in manifest.assertions:
                if hasattr(assertion, "label") and "actions" in assertion.label:
                    if hasattr(assertion, "data") and isinstance(assertion.data, dict):
                        for action in assertion.data.get("actions", []):
                            if isinstance(action, dict) and "action" in action:
                                actions.append(action["action"])
            if actions:
                result["actions"] = actions

        return result if result else {"raw": "Credentials present but could not parse details"}

    except ImportError:
        log.warning("c2pa_not_installed")
        return None
    except Exception as e:
        log.debug("c2pa_check_error", error=str(e))
        return None
