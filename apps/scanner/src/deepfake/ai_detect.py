"""AI-generated content detection for deepfake investigation frames.

Wraps the existing Hive AI detection provider for use in the
deepfake investigation pipeline.
"""

from sqlalchemy import text

from src.db.connection import async_session
from src.config import settings
from src.deepfake.utils import (
    create_signed_storage_url,
    log_activity,
    resolve_storage_path,
    set_task_skipped_result,
    update_task_progress,
)
from src.providers import get_ai_detection_provider
from src.utils.logging import get_logger

log = get_logger("deepfake.ai_detect")


async def run_ai_detection(
    task_id: str,
    investigation_id: str,
    media_id: str | None,
    frame_id: str | None,
    parameters: dict,
) -> None:
    """Run AI detection on a frame or media item.

    Uses the existing Hive AI provider to classify whether content
    is AI-generated, and stores the result as evidence.
    """
    if not settings.hive_api_key:
        log.warning("hive_api_key_not_configured")
        await set_task_skipped_result(
            task_id,
            "Hive API key not configured. Set HIVE_API_KEY in scanner .env to enable AI detection.",
        )
        return

    storage_path = await resolve_storage_path(frame_id, media_id)
    if not storage_path:
        raise ValueError("No storage path found for frame or media")

    await update_task_progress(task_id, 20)

    # Create a signed URL so the external Hive API can fetch the image
    signed_url = await create_signed_storage_url(storage_path, expires_in=300)
    if not signed_url:
        raise ValueError("Could not create signed URL for AI detection")

    # Call AI detection provider
    provider = get_ai_detection_provider()
    classification = await provider.classify(signed_url)

    await update_task_progress(task_id, 70)

    if classification is None:
        log.warning("ai_detection_no_result", frame_id=frame_id, media_id=media_id)
        async with async_session() as session:
            await session.execute(text(
                "INSERT INTO deepfake_evidence "
                "(investigation_id, evidence_type, title, content) "
                "VALUES (:inv_id, 'ai_detection', 'AI Detection — No Result', "
                "'AI detection provider returned no classification. The service may be unavailable or the image format unsupported.')"
            ), {"inv_id": investigation_id})
            await session.commit()
        return

    score = classification.score
    generator = classification.generator
    is_ai = classification.is_ai_generated

    # Build evidence content
    content_parts = [
        f"Score: {score:.1%} likelihood of AI generation",
    ]
    if generator:
        content_parts.append(f"Suspected generator: {generator}")
    content_parts.append(f"Classification: {'AI-generated' if is_ai else 'Likely authentic'}")
    if frame_id:
        content_parts.append(f"Analyzed frame: {frame_id}")
    elif media_id:
        content_parts.append(f"Analyzed media: {media_id}")

    # Insert evidence + log activity
    async with async_session() as session:
        await session.execute(text(
            "INSERT INTO deepfake_evidence "
            "(investigation_id, evidence_type, title, content, ai_detection_score, ai_detection_generator) "
            "VALUES (:inv_id, 'ai_detection', :title, :content, :score, :gen)"
        ), {
            "inv_id": investigation_id,
            "title": f"AI Detection — {score:.0%} {'AI' if is_ai else 'Authentic'}",
            "content": "\n".join(content_parts),
            "score": score,
            "gen": generator,
        })
        await session.commit()

    await update_task_progress(task_id, 90)

    await log_activity(investigation_id, "ai_detection_completed", {
        "frame_id": frame_id,
        "media_id": media_id,
        "score": score,
        "generator": generator,
        "is_ai_generated": is_ai,
    })

    log.info(
        "ai_detection_complete",
        investigation_id=investigation_id,
        frame_id=frame_id,
        score=score,
        generator=generator,
        is_ai=is_ai,
    )
