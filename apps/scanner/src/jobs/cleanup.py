"""Data retention and cleanup tasks."""

from src.db.connection import async_session
from src.db.queries import (
    cleanup_old_discovered_face_embeddings,
    cleanup_old_discovered_images,
    cleanup_old_scan_jobs,
    cleanup_read_notifications,
)
from src.utils.logging import get_logger

log = get_logger("cleanup")


async def run_cleanup() -> dict:
    """Run all cleanup tasks. Returns counts of deleted rows."""
    results = {}

    async with async_session() as session:
        try:
            # Discovered images: 7 days for no-face, 30 days for no-match
            di_counts = await cleanup_old_discovered_images(session)
            results.update(di_counts)
        except Exception as e:
            log.error("cleanup_discovered_images_error", error=str(e))

        try:
            # Discovered face embeddings: 60 days
            dfe_count = await cleanup_old_discovered_face_embeddings(session)
            results["face_embeddings_deleted"] = dfe_count
        except Exception as e:
            log.error("cleanup_discovered_face_embeddings_error", error=str(e))

        try:
            # Scan jobs: 30 days for completed/failed
            sj_count = await cleanup_old_scan_jobs(session)
            results["scan_jobs_deleted"] = sj_count
        except Exception as e:
            log.error("cleanup_scan_jobs_error", error=str(e))

        try:
            # Read notifications: 90 days
            notif_count = await cleanup_read_notifications(session)
            results["notifications_deleted"] = notif_count
        except Exception as e:
            log.error("cleanup_notifications_error", error=str(e))

        await session.commit()

    log.info("cleanup_complete", **results)
    return results
