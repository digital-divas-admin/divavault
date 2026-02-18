"""Ingest pipeline: process new contributor photos into facial embeddings.

Polls contributor_images and uploads for rows with embedding_status='pending',
downloads from Supabase Storage, runs InsightFace face detection + ArcFace
embedding, and stores results in contributor_embeddings.
"""

from pathlib import Path
from uuid import UUID

import numpy as np

from src.config import TIER_CONFIG, settings
from src.db.connection import async_session
from src.db.models import ContributorImage, Upload
from src.db.queries import (
    backfill_contributor_against_discovered,
    contributor_has_embeddings,
    get_contributor,
    get_pending_images,
    get_pending_registry_selfies,
    get_pending_uploads,
    init_scan_schedule,
    insert_embedding,
    insert_match,
    update_image_embedding_status,
    update_primary_embedding,
    update_registry_embedding,
    update_registry_embedding_status,
)
from src.ingest.centroid import compute_centroid_embedding
from src.utils.image_download import download_from_supabase, load_and_resize
from src.utils.logging import get_logger

log = get_logger("ingest")

def init_model(model_name: str | None = None) -> object:
    """Initialize the face detection model. Call once on startup.

    Delegates to the active FaceDetectionProvider.
    """
    from src.providers import get_face_detection_provider

    provider = get_face_detection_provider()
    provider.init_model(model_name)
    return provider.get_model()


def get_model() -> object:
    """Get the loaded face detection model.

    Delegates to the active FaceDetectionProvider.
    """
    from src.providers import get_face_detection_provider

    return get_face_detection_provider().get_model()


async def process_pending_images() -> int:
    """Process all pending contributor_images and uploads. Returns count processed."""
    processed = 0

    async with async_session() as session:
        # Process contributor_images
        images = await get_pending_images(session, limit=50)
        for img in images:
            try:
                await _process_image(session, img)
                processed += 1
            except Exception as e:
                log.error(
                    "ingest_image_error",
                    image_id=str(img.id),
                    contributor_id=str(img.contributor_id),
                    error=str(e),
                )
                await update_image_embedding_status(
                    session, img.id, "failed", f"unexpected_error: {str(e)[:200]}"
                )
            await session.commit()

        # Process uploads
        uploads = await get_pending_uploads(session, limit=50)
        for upload in uploads:
            try:
                await _process_upload(session, upload)
                processed += 1
            except Exception as e:
                log.error(
                    "ingest_upload_error",
                    upload_id=str(upload.id),
                    contributor_id=str(upload.contributor_id),
                    error=str(e),
                )
                await update_image_embedding_status(
                    session, upload.id, "failed", f"unexpected_error: {str(e)[:200]}",
                    is_upload=True,
                )
            await session.commit()

    if processed > 0:
        log.info("ingest_batch_complete", processed=processed)
    return processed


async def process_pending_registry_selfies() -> int:
    """Process pending registry selfies into face embeddings. Returns count processed."""
    processed = 0

    async with async_session() as session:
        selfies = await get_pending_registry_selfies(session, limit=50)
        for identity in selfies:
            try:
                await _process_registry_selfie(session, identity)
                processed += 1
            except Exception as e:
                log.error(
                    "ingest_registry_selfie_error",
                    cid=identity.cid,
                    error=str(e),
                )
                await update_registry_embedding_status(
                    session, identity.cid, "failed", f"unexpected_error: {str(e)[:200]}"
                )
            await session.commit()

    if processed > 0:
        log.info("registry_selfie_batch_complete", processed=processed)
    return processed


async def _process_registry_selfie(session, identity) -> None:
    """Process a single registry selfie into a face embedding on registry_identities."""
    if not identity.selfie_bucket or not identity.selfie_path:
        await update_registry_embedding_status(
            session, identity.cid, "failed", "missing_selfie_path"
        )
        return

    path = await download_from_supabase(identity.selfie_bucket, identity.selfie_path)
    if path is None:
        await update_registry_embedding_status(
            session, identity.cid, "failed", "download_failed"
        )
        return

    try:
        result = _detect_and_embed(path)
        if result is None:
            await update_registry_embedding_status(
                session, identity.cid, "failed", "no_face_detected"
            )
            return
        if result == "multiple_faces":
            await update_registry_embedding_status(
                session, identity.cid, "failed", "multiple_faces"
            )
            return

        embedding, det_score = result
        await update_registry_embedding(
            session,
            cid=identity.cid,
            embedding=embedding,
            detection_score=det_score,
        )

        log.info(
            "registry_selfie_embedded",
            cid=identity.cid,
            detection_score=det_score,
        )
    finally:
        path.unlink(missing_ok=True)


async def _process_image(session, img: ContributorImage) -> None:
    """Process a single contributor_image into an embedding."""
    if not img.file_path or not img.bucket:
        await update_image_embedding_status(session, img.id, "failed", "missing_file_path")
        return

    # Skip full_body captures for embedding (less useful for face matching)
    if img.capture_step == "full_body":
        await update_image_embedding_status(session, img.id, "skipped", "full_body_skipped")
        return

    path = await download_from_supabase(img.bucket, img.file_path)
    if path is None:
        await update_image_embedding_status(session, img.id, "failed", "download_failed")
        return

    try:
        result = _detect_and_embed(path)
        if result is None:
            await update_image_embedding_status(session, img.id, "failed", "no_face_detected")
            return
        if result == "multiple_faces":
            await update_image_embedding_status(session, img.id, "failed", "multiple_faces")
            return

        embedding, det_score = result
        await insert_embedding(
            session,
            contributor_id=img.contributor_id,
            embedding=embedding,
            detection_score=det_score,
            source_image_id=img.id,
        )
        await update_primary_embedding(session, img.contributor_id)
        await compute_centroid_embedding(session, img.contributor_id)
        await update_image_embedding_status(session, img.id, "processed")

        # Initialize scan schedule if this is the contributor's first embedding
        await _maybe_init_schedule(session, img.contributor_id)

        log.info(
            "image_embedded",
            image_id=str(img.id),
            contributor_id=str(img.contributor_id),
            detection_score=det_score,
        )
    finally:
        path.unlink(missing_ok=True)


async def _process_upload(session, upload: Upload) -> None:
    """Process a single upload into an embedding."""
    if not upload.file_path or not upload.bucket:
        await update_image_embedding_status(
            session, upload.id, "failed", "missing_file_path", is_upload=True
        )
        return

    path = await download_from_supabase(upload.bucket, upload.file_path)
    if path is None:
        await update_image_embedding_status(
            session, upload.id, "failed", "download_failed", is_upload=True
        )
        return

    try:
        result = _detect_and_embed(path)
        if result is None:
            await update_image_embedding_status(
                session, upload.id, "failed", "no_face_detected", is_upload=True
            )
            return
        if result == "multiple_faces":
            await update_image_embedding_status(
                session, upload.id, "failed", "multiple_faces", is_upload=True
            )
            return

        embedding, det_score = result
        await insert_embedding(
            session,
            contributor_id=upload.contributor_id,
            embedding=embedding,
            detection_score=det_score,
            source_upload_id=upload.id,
        )
        await update_primary_embedding(session, upload.contributor_id)
        await compute_centroid_embedding(session, upload.contributor_id)
        await update_image_embedding_status(
            session, upload.id, "processed", is_upload=True
        )

        await _maybe_init_schedule(session, upload.contributor_id)

        log.info(
            "upload_embedded",
            upload_id=str(upload.id),
            contributor_id=str(upload.contributor_id),
            detection_score=det_score,
        )
    finally:
        path.unlink(missing_ok=True)


def _detect_and_embed(path: Path) -> tuple[np.ndarray, float] | str | None:
    """Run face detection and embedding on an image file.

    Returns:
        (embedding, detection_score) on success
        "multiple_faces" if >1 face detected
        None if no face detected or image unreadable
    """
    img = load_and_resize(path)
    if img is None:
        return None

    model = get_model()
    faces = model.get(img)

    if len(faces) == 0:
        return None
    if len(faces) > 1:
        return "multiple_faces"

    face = faces[0]
    embedding = face.normed_embedding  # 512-dim normalized vector
    det_score = float(face.det_score)
    return embedding, det_score


async def _maybe_init_schedule(session, contributor_id: UUID) -> None:
    """Initialize scan schedule on first embedding for a contributor."""
    contributor = await get_contributor(session, contributor_id)
    if contributor is None:
        return

    tier = contributor.subscription_tier or "free"
    tier_config = TIER_CONFIG.get(tier, TIER_CONFIG["free"])
    interval = tier_config["reverse_image_interval_hours"]
    priority = 2 if tier == "premium" else (1 if tier == "protected" else 0)

    await init_scan_schedule(
        session,
        contributor_id=contributor_id,
        interval_hours=interval,
        priority=priority,
    )

    # Check if this is the contributor's first embedding — run backfill
    from sqlalchemy import select, func
    from src.db.models import ContributorEmbedding
    count_result = await session.execute(
        select(func.count()).select_from(ContributorEmbedding).where(
            ContributorEmbedding.contributor_id == contributor_id
        )
    )
    embedding_count = count_result.scalar_one()

    if embedding_count == 1:
        await _run_backfill_for_contributor(session, contributor_id)


async def _run_backfill_for_contributor(session, contributor_id: UUID) -> None:
    """Backfill: check new contributor against historical discovered face embeddings."""
    from src.db.models import ContributorEmbedding
    from src.matching.confidence import get_confidence_tier
    from sqlalchemy import select

    # Get the contributor's best embedding (prefer centroid, then highest detection score)
    result = await session.execute(
        select(ContributorEmbedding)
        .where(ContributorEmbedding.contributor_id == contributor_id)
        .order_by(
            (ContributorEmbedding.embedding_type == "centroid").desc(),
            ContributorEmbedding.detection_score.desc().nulls_last(),
        )
        .limit(1)
    )
    best_embedding = result.scalar_one_or_none()
    if best_embedding is None or best_embedding.embedding is None:
        return

    embedding_vec = np.array(best_embedding.embedding)
    backfill_days = settings.civitai_backfill_days

    hits = await backfill_contributor_against_discovered(
        session,
        contributor_id=contributor_id,
        embedding=embedding_vec,
        threshold=settings.match_threshold_low,
        days_back=backfill_days,
    )

    if not hits:
        return

    matches_created = 0
    for hit in hits:
        confidence = get_confidence_tier(hit["similarity"])
        if confidence is None:
            continue

        match = await insert_match(
            session,
            discovered_image_id=hit["discovered_image_id"],
            contributor_id=contributor_id,
            similarity_score=hit["similarity"],
            confidence_tier=confidence,
            best_embedding_id=best_embedding.id,
            face_index=hit["face_index"],
        )
        if match:
            matches_created += 1

    if matches_created > 0:
        log.info(
            "backfill_matches_created",
            contributor_id=str(contributor_id),
            matches=matches_created,
            days_searched=backfill_days,
        )
