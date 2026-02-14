"""Ad Intelligence pipeline orchestrator.

Runs one stage per tick in priority order (process existing before discovering more):
  1. Match: cross-match faces with candidates but no matches
  2. Search: stock search for described but unsearched faces
  3. Describe: Claude description for undescribed faces
  4. Detect: face detection + AI classification on pending ads
  5. Scan: discover new ads (only if no pending work above)
"""

import numpy as np
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from src.ad_intelligence.queries import (
    get_config,
    get_pending_ads,
    get_undescribed_faces,
    get_unmatched_faces,
    get_unsearched_faces,
    insert_activity_log,
    insert_face,
    mark_face_matched,
    mark_face_searched,
    update_ad_status,
    update_face_description,
)
from src.config import settings
from src.db.connection import async_session
from src.detection.ai_classifier import classify_ai_generated
from src.matching.detector import detect_faces
from src.matching.embedder import get_face_embedding
from src.utils.image_download import download_image
from src.utils.logging import get_logger

log = get_logger("ad_intel_scheduler")


async def run_ad_intel_tick(job_store) -> None:
    """Main entry point for ad intelligence processing.

    Reads config, then runs one stage per tick in priority order.
    Each stage processes a batch then returns.
    """
    async with async_session() as session:
        config = await get_config(session)

    batch_size = config.get("batch_size", 5)
    if isinstance(batch_size, dict):
        batch_size = batch_size.get("value", 5)

    # Check for manually-triggered stage jobs
    async with async_session() as session:
        result = await session.execute(sa_text("""
            SELECT id, stage FROM scan_jobs
            WHERE scan_type = 'ad_intel' AND status = 'pending' AND stage IS NOT NULL
            ORDER BY created_at LIMIT 1
        """))
        manual_job = result.first()

    if manual_job:
        job_id, stage = manual_job
        log.info("manual_stage_job", job_id=str(job_id), stage=stage)

        # Mark as running
        from src.db.queries import update_scan_job
        async with async_session() as session:
            await update_scan_job(session, job_id, status="running")
            await session.commit()

        try:
            stage_runners = {
                "discover": lambda: _stage_scan(config, job_store),
                "detect": lambda: _run_stage_detect(batch_size),
                "describe": lambda: _run_stage_describe(batch_size),
                "search": lambda: _run_stage_search(batch_size),
                "match": lambda: _run_stage_match(batch_size, config),
            }

            runner = stage_runners.get(stage)
            if runner:
                await runner()

            async with async_session() as session:
                await update_scan_job(session, job_id, status="completed")
                await insert_activity_log(
                    session,
                    event_type="stage_completed",
                    title=f"{stage} stage completed",
                    description=f"Manually triggered {stage} stage finished",
                    stage=stage,
                    metadata={"job_id": str(job_id)},
                )
                await session.commit()

        except Exception as e:
            async with async_session() as session:
                await update_scan_job(
                    session, job_id,
                    status="failed",
                    error_message=str(e)[:500],
                )
                await insert_activity_log(
                    session,
                    event_type="error",
                    title=f"{stage} stage failed",
                    description=str(e)[:200],
                    stage=stage,
                    metadata={"job_id": str(job_id)},
                )
                await session.commit()

        return

    # Stage 1: Match — cross-match faces with candidates but no matches
    async with async_session() as session:
        unmatched = await get_unmatched_faces(session, limit=batch_size)

    if unmatched:
        log.info("ad_intel_stage", stage="match", count=len(unmatched))
        await _stage_match(unmatched, config)
        return

    # Stage 2: Search — stock search for described but unsearched faces
    async with async_session() as session:
        unsearched = await get_unsearched_faces(session, limit=batch_size)

    if unsearched:
        log.info("ad_intel_stage", stage="search", count=len(unsearched))
        await _stage_search(unsearched)
        return

    # Stage 3: Describe — Claude for undescribed faces
    async with async_session() as session:
        undescribed = await get_undescribed_faces(session, limit=batch_size)

    if undescribed:
        log.info("ad_intel_stage", stage="describe", count=len(undescribed))
        await _stage_describe(undescribed)
        return

    # Stage 4: Detect — face detection on pending ads
    async with async_session() as session:
        pending = await get_pending_ads(session, limit=batch_size)

    if pending:
        log.info("ad_intel_stage", stage="detect", count=len(pending))
        await _stage_detect(pending)
        return

    # Stage 5: Scan — discover new ads (only if no pending work above)
    log.info("ad_intel_stage", stage="scan")
    await _stage_scan(config, job_store)


async def _stage_match(unmatched: list[dict], config: dict) -> None:
    """Cross-match faces that have been searched but not yet matched."""
    from src.ad_intelligence.cross_matcher import cross_match_face

    for entry in unmatched:
        face_id = entry["id"]
        embedding = entry["embedding"]

        try:
            async with async_session() as session:
                count = await cross_match_face(session, face_id, embedding, config)
                await mark_face_matched(session, face_id)
                await session.commit()

            log.info("face_matched", face_id=str(face_id), matches=count)

        except Exception as e:
            log.error("match_error", face_id=str(face_id), error=str(e))


async def _stage_search(unsearched: list) -> None:
    """Search stock platforms for described but unsearched faces."""
    from src.ad_intelligence.stock_searcher import StockSearcher

    searcher = StockSearcher()

    for face in unsearched:
        face_id = face.id
        keywords = face.description_keywords or []

        if not keywords:
            async with async_session() as session:
                await mark_face_searched(session, face_id)
                await session.commit()
            continue

        try:
            async with async_session() as session:
                count = await searcher.search(session, face_id, keywords)
                await mark_face_searched(session, face_id)
                await session.commit()

            log.info("face_searched", face_id=str(face_id), candidates=count)

        except Exception as e:
            log.error("search_error", face_id=str(face_id), error=str(e))


async def _stage_describe(undescribed: list) -> None:
    """Describe undescribed faces using Claude vision."""
    from src.ad_intelligence.prompt_reconstructor import describe_face

    for face in undescribed:
        face_id = face.id
        ad_id = face.ad_id

        try:
            # Get the ad's creative image to extract face region
            async with async_session() as session:
                from sqlalchemy import select
                from src.ad_intelligence.models import AdIntelAd
                ad = await session.execute(
                    select(AdIntelAd.creative_stored_path, AdIntelAd.creative_url)
                    .where(AdIntelAd.id == ad_id)
                )
                ad_row = ad.first()

            if not ad_row:
                continue

            stored_path, creative_url = ad_row[0], ad_row[1]

            # Download the image
            image_url = creative_url
            if stored_path:
                image_url = f"{settings.supabase_url}/storage/v1/object/authenticated/ad-intel-images/{stored_path}"

            if not image_url:
                continue

            local_path = await download_image(image_url)
            if not local_path:
                continue

            try:
                image_bytes = local_path.read_bytes()
                result = await describe_face(image_bytes)

                if result:
                    async with async_session() as session:
                        await update_face_description(
                            session,
                            face_id,
                            result["description"],
                            result["keywords"],
                            result.get("demographics"),
                        )
                        await session.commit()

                    log.info(
                        "face_described",
                        face_id=str(face_id),
                        keywords=len(result["keywords"]),
                    )
                else:
                    # Mark as described with empty data to avoid retrying
                    async with async_session() as session:
                        await update_face_description(
                            session, face_id, "", [], None,
                        )
                        await session.commit()

            finally:
                local_path.unlink(missing_ok=True)

        except Exception as e:
            log.error("describe_error", face_id=str(face_id), error=str(e))


async def _stage_detect(pending: list) -> None:
    """Run face detection and AI classification on pending ads."""
    for ad in pending:
        ad_id = ad.id

        try:
            stored_path = ad.creative_stored_path
            creative_url = ad.creative_url

            image_url = creative_url
            if stored_path:
                image_url = f"{settings.supabase_url}/storage/v1/object/authenticated/ad-intel-images/{stored_path}"

            if not image_url:
                async with async_session() as session:
                    await update_ad_status(session, ad_id, "failed", error_message="no_image_url")
                    await session.commit()
                continue

            local_path = await download_image(image_url)
            if not local_path:
                async with async_session() as session:
                    await update_ad_status(session, ad_id, "failed", error_message="download_failed")
                    await session.commit()
                continue

            try:
                # Face detection
                faces = detect_faces(local_path)

                # AI classification
                ai_result = await classify_ai_generated(image_url)
                is_ai = ai_result.get("is_ai_generated") if ai_result else None
                ai_score = ai_result.get("score") if ai_result else None
                ai_gen = ai_result.get("generator") if ai_result else None

                # Update ad with results
                async with async_session() as session:
                    await update_ad_status(
                        session, ad_id, "processed",
                        face_count=len(faces),
                        is_ai_generated=is_ai,
                        ai_detection_score=ai_score,
                        ai_generator=ai_gen,
                    )

                    # Insert face records with embeddings
                    for face_idx, face in enumerate(faces):
                        embedding = get_face_embedding(face)
                        det_score = float(face.det_score) if hasattr(face, "det_score") else None

                        await insert_face(
                            session,
                            ad_id=ad_id,
                            face_index=face_idx,
                            embedding=embedding.tolist() if embedding is not None else None,
                            detection_score=det_score,
                        )

                    await session.commit()

                log.info(
                    "ad_detected",
                    ad_id=str(ad_id),
                    faces=len(faces),
                    is_ai=is_ai,
                )

            finally:
                local_path.unlink(missing_ok=True)

        except Exception as e:
            log.error("detect_error", ad_id=str(ad_id), error=str(e))
            async with async_session() as session:
                await update_ad_status(
                    session, ad_id, "failed",
                    error_message=str(e)[:500],
                )
                await session.commit()


async def _stage_scan(config: dict, job_store) -> None:
    """Discover new ads from Meta Ad Library."""
    from src.ad_intelligence.ad_scanner import MetaAdScanner

    search_terms = config.get("search_terms", ["AI generated", "model", "portrait"])
    if isinstance(search_terms, dict):
        search_terms = search_terms.get("value", ["AI generated", "model", "portrait"])

    max_ads = config.get("max_ads_per_scan", 50)
    if isinstance(max_ads, dict):
        max_ads = max_ads.get("value", 50)

    scanner = MetaAdScanner()

    # Create a scan job for tracking
    from src.db.queries import create_scan_job, update_scan_job

    async with async_session() as session:
        job = await create_scan_job(session, scan_type="ad_intel", source_name="meta_ad_library")
        await update_scan_job(session, job.id, status="running")
        await session.commit()
        job_id = job.id

    try:
        async with async_session() as session:
            inserted = await scanner.scan(session, search_terms, max_ads)
            await session.commit()

        async with async_session() as session:
            await update_scan_job(
                session, job_id,
                status="completed",
                images_processed=inserted,
            )
            await session.commit()

        log.info("ad_intel_scan_complete", new_ads=inserted)

    except Exception as e:
        async with async_session() as session:
            await update_scan_job(
                session, job_id,
                status="failed",
                error_message=str(e)[:500],
            )
            await session.commit()
        raise


async def _run_stage_detect(batch_size: int) -> None:
    """Helper: run detect stage for manual trigger."""
    async with async_session() as session:
        pending = await get_pending_ads(session, limit=batch_size)
    if pending:
        await _stage_detect(pending)


async def _run_stage_describe(batch_size: int) -> None:
    """Helper: run describe stage for manual trigger."""
    async with async_session() as session:
        undescribed = await get_undescribed_faces(session, limit=batch_size)
    if undescribed:
        await _stage_describe(undescribed)


async def _run_stage_search(batch_size: int) -> None:
    """Helper: run search stage for manual trigger."""
    async with async_session() as session:
        unsearched = await get_unsearched_faces(session, limit=batch_size)
    if unsearched:
        await _stage_search(unsearched)


async def _run_stage_match(batch_size: int, config: dict) -> None:
    """Helper: run match stage for manual trigger."""
    async with async_session() as session:
        unmatched = await get_unmatched_faces(session, limit=batch_size)
    if unmatched:
        await _stage_match(unmatched, config)
