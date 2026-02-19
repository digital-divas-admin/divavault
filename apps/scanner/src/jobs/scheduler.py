"""Main scheduler loop: coordinates ingest, per-contributor scans, platform crawls, and post-processing.

Platform crawls use a three-phase pipeline:
  Phase 1 (Crawl): Site-specific scraper discovers image URLs → batch INSERT into discovered_images
  Phase 2 (Detect): Subprocess-isolated face detection on discovered_images WHERE has_face IS NULL
  Phase 3 (Match): Compare discovered_face_embeddings WHERE matched_at IS NULL against registry

Priority: Detection > Matching > Crawl (process existing before discovering more).
Only Phase 1 is site-specific. Phases 2 and 3 are shared infrastructure.
"""

import asyncio
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone

import imagehash
import numpy as np
from PIL import Image

from src.config import TIER_CONFIG, get_tier_config, settings
from src.db.connection import async_session
from src.db.queries import (
    batch_insert_discovered_images,
    count_pending_face_detection,
    count_unmatched_face_embeddings,
    create_notification,
    find_all_similar_embeddings,
    get_unmatched_face_embeddings,
    insert_discovered_face_embedding,
    insert_discovered_image,
    insert_evidence,
    insert_match,
    insert_registry_match,
    find_phash_duplicate,
    get_contributor,
    get_scanner_metrics,
    mark_face_embeddings_matched,
    update_crawl_coverage,
    update_discovered_image,
    update_match,
)
from src.detection.ai_classifier import classify_ai_generated
from src.discovery import PLATFORM_SCRAPERS
from src.discovery.base import DiscoveryContext, DiscoveryResult
from src.discovery.reverse_image import TinEyeDiscovery
from src.discovery.url_check import URLCheckDiscovery
from src.evidence.capture import capture_screenshot, shutdown_browser
from src.evidence.storage import upload_evidence
from src.ingest.embeddings import process_pending_images, process_pending_registry_selfies
from src.jobs.cleanup import run_cleanup
from src.jobs.store import JobStore
from src.matching.comparator import compare_against_contributor, compare_against_registry
from src.matching.confidence import (
    check_known_account,
    get_confidence_tier,
    should_capture_evidence,
    should_notify,
    should_run_ai_detection,
)
from src.matching.detector import detect_faces
from src.matching.embedder import get_face_embedding
from src.utils.image_download import cleanup_old_temp_files, download_image
from src.intelligence.observer import observer
from src.utils.logging import get_logger

log = get_logger("scheduler")

# Shutdown flag
shutdown_requested = False

# ML intelligence singletons (lazy-init)
_recommender = None
_applier = None


def handle_shutdown(signum, frame):
    global shutdown_requested
    shutdown_requested = True
    log.info("shutdown_requested", signal=signum)


signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)


# Discovery sources (reverse image + URL check — not platform crawl, which uses the registry)
_tineye = TinEyeDiscovery()
_url_check = URLCheckDiscovery()

# Path to the process_faces script for subprocess invocation
# __file__ = src/jobs/scheduler.py → src/jobs → src → apps/scanner
_SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def run_scheduler(job_store: JobStore) -> None:
    """Main scheduler loop. Runs until shutdown is requested."""
    start_time = time.monotonic()
    last_cleanup = 0.0

    # Recover stale jobs on startup
    recovered = await job_store.recover_stale(max_age_minutes=30)
    if recovered > 0:
        log.info("stale_jobs_recovered", count=recovered)

    log.info("scheduler_started")

    while not shutdown_requested:
        tick_start = time.monotonic()

        try:
            # a. Ingest pending images
            await _run_ingest()

            if shutdown_requested:
                break

            # b. Per-contributor scans
            await _run_contributor_scans(job_store)

            if shutdown_requested:
                break

            # b2. Platform taxonomy mapping (weekly, before crawls)
            await _run_taxonomy_mapping()

            if shutdown_requested:
                break

            # c. Platform crawls
            await _run_platform_crawls(job_store)

            if shutdown_requested:
                break

            # d. Honeypot detection check
            await _check_honeypot_detections()

            if shutdown_requested:
                break

            # e. Ad Intelligence scanning
            if settings.ad_intel_enabled:
                try:
                    from src.ad_intelligence.scheduler import run_ad_intel_tick
                    await run_ad_intel_tick(job_store)
                except Exception as e:
                    log.error("ad_intel_tick_error", error=str(e))

            if shutdown_requested:
                break

            # f. ML Intelligence tick
            await _run_ml_intelligence()

            if shutdown_requested:
                break

            # d. Cleanup (hourly)
            now = time.monotonic()
            if now - last_cleanup > 3600:
                await run_cleanup()
                cleanup_old_temp_files()
                last_cleanup = now

            # Log metrics periodically
            tick_duration = time.monotonic() - tick_start
            uptime = time.monotonic() - start_time
            log.info(
                "scheduler_tick_complete",
                duration_seconds=round(tick_duration, 2),
                uptime_seconds=round(uptime, 0),
            )

        except Exception as e:
            log.error("scheduler_tick_error", error=repr(e))

        # Wait for next tick
        elapsed = time.monotonic() - tick_start
        sleep_time = max(0, settings.scheduler_tick_seconds - elapsed)
        if sleep_time > 0 and not shutdown_requested:
            await asyncio.sleep(sleep_time)

    # Graceful shutdown
    log.info("scheduler_shutting_down")
    interrupted = await job_store.interrupt_running_jobs()
    if interrupted > 0:
        log.info("jobs_interrupted", count=interrupted)
    await shutdown_browser()
    log.info("scheduler_stopped")


async def _run_ingest() -> None:
    """Process pending images into embeddings (contributor + registry selfies)."""
    try:
        processed = await process_pending_images()
        if processed > 0:
            log.info("ingest_tick", processed=processed)
    except Exception as e:
        log.error("ingest_error", error=str(e))

    try:
        registry_processed = await process_pending_registry_selfies()
        if registry_processed > 0:
            log.info("registry_ingest_tick", processed=registry_processed)
    except Exception as e:
        log.error("registry_ingest_error", error=str(e))


async def _run_taxonomy_mapping() -> None:
    """Run platform taxonomy mapping if due. Never blocks pipeline."""
    from src.intelligence.mapper.orchestrator import get_latest_map_time, run_mapper, MAPPERS

    for platform in MAPPERS.keys():
        try:
            last_map = await get_latest_map_time(platform)
            if last_map is not None:
                from datetime import datetime, timezone
                age_hours = (datetime.now(timezone.utc) - last_map).total_seconds() / 3600
                if age_hours < settings.mapper_interval_hours:
                    log.info("mapper_skip_fresh", platform=platform, age_hours=round(age_hours, 1))
                    continue

            log.info("mapper_running", platform=platform)
            result = await run_mapper(platform)
            log.info(
                "mapper_done",
                platform=platform,
                sections=result.sections_discovered,
            )
        except Exception as e:
            log.error("mapper_error", platform=platform, error=str(e))


async def _run_contributor_scans(job_store: JobStore) -> None:
    """Run due per-contributor scans (reverse image search)."""
    due_scans = await job_store.get_due_contributor_scans(settings.scan_batch_size)

    for scan in due_scans:
        if shutdown_requested:
            break

        try:
            await _execute_contributor_scan(job_store, scan)
        except Exception as e:
            log.error(
                "contributor_scan_error",
                contributor_id=str(scan.contributor_id),
                error=str(e),
            )


async def _execute_contributor_scan(job_store, scan) -> None:
    """Execute a single contributor's reverse image scan."""
    job_id = await job_store.mark_scan_started(
        scan.contributor_id, scan.scan_type, "tineye"
    )

    try:
        async with async_session() as session:
            contributor = await get_contributor(session, scan.contributor_id)
            if not contributor:
                await job_store.mark_scan_failed(job_id, "contributor_not_found")
                return

            tier = contributor.subscription_tier or "free"
            tier_config = get_tier_config(tier)

            # Get contributor's reference images for reverse search
            # Check both contributor_images (guided capture) and uploads (manual/Instagram)
            from sqlalchemy import select, union_all
            from src.db.models import ContributorImage, Upload
            max_photos = tier_config.get("reverse_image_max_photos", 3)

            q_images = (
                select(ContributorImage.bucket, ContributorImage.file_path)
                .where(ContributorImage.contributor_id == scan.contributor_id)
                .where(ContributorImage.embedding_status == "processed")
                .where(ContributorImage.file_path.isnot(None))
            )
            q_uploads = (
                select(Upload.bucket, Upload.file_path)
                .where(Upload.contributor_id == scan.contributor_id)
                .where(Upload.embedding_status == "processed")
                .where(Upload.file_path.isnot(None))
            )
            combined = union_all(q_images, q_uploads).limit(max_photos)
            images_result = await session.execute(combined)
            image_rows = images_result.all()

        if not image_rows:
            await job_store.mark_scan_complete(
                job_id, scan.contributor_id, scan.scan_type,
                tier_config["reverse_image_interval_hours"], 0, 0,
            )
            return

        # Discover
        context = DiscoveryContext(
            contributor_id=scan.contributor_id,
            contributor_tier=tier,
            images=[(row[0], row[1]) for row in image_rows],
        )
        discovery_result = await _tineye.discover(context)

        # Process through matching pipeline
        images_processed = 0
        matches_found = 0

        for disc in discovery_result.images:
            if shutdown_requested:
                break
            result = await _process_discovered_image(
                disc.source_url, disc.page_url, disc.page_title,
                disc.platform, job_id, scan.contributor_id,
            )
            images_processed += 1
            if result:
                matches_found += result

        await job_store.mark_scan_complete(
            job_id, scan.contributor_id, scan.scan_type,
            tier_config["reverse_image_interval_hours"],
            images_processed, matches_found,
        )

        try:
            await observer.emit("scan_completed", "contributor", str(scan.contributor_id), {
                "scan_type": scan.scan_type,
                "images_processed": images_processed,
                "matches_found": matches_found,
            })
        except Exception:
            pass

    except Exception as e:
        await job_store.mark_scan_failed(job_id, str(e)[:500])
        raise


async def _check_honeypot_detections() -> None:
    """Check honeypot items for new detections. Never blocks pipeline."""
    try:
        from src.seeding.seed_manager import seed_manager
        report = await seed_manager.check_honeypot_detection()
        if report["total_planted"] > 0:
            log.info(
                "honeypot_check",
                total=report["total_planted"],
                detected=report["total_detected"],
                newly_detected=report["newly_detected"],
                rate=report["detection_rate"],
            )
            try:
                await observer.emit("honeypot_check", "pipeline", "honeypot", {
                    "total_planted": report["total_planted"],
                    "total_detected": report["total_detected"],
                    "detection_rate": report["detection_rate"],
                })
            except Exception:
                pass
    except Exception as e:
        log.error("honeypot_check_error", error=str(e))


async def _run_ml_intelligence() -> None:
    """Run ML analyzers and apply approved recommendations. Never blocks pipeline."""
    global _recommender, _applier
    try:
        from src.intelligence.analyzers.threshold import ThresholdOptimizer
        from src.intelligence.analyzers.sections import SectionRanker
        from src.intelligence.analyzers.search_terms import SearchTermScorer
        from src.intelligence.analyzers.scheduling import CrawlScheduler
        from src.intelligence.analyzers.false_positives import FalsePositiveFilter
        from src.intelligence.analyzers.sources import SourceIntelligence
        from src.intelligence.analyzers.anomalies import AnomalyDetector
        from src.intelligence.recommender import Recommender
        from src.intelligence.applier import Applier

        if _recommender is None:
            _recommender = Recommender([
                ThresholdOptimizer(),
                SectionRanker(),
                SearchTermScorer(),
                CrawlScheduler(),
                FalsePositiveFilter(),
                SourceIntelligence(),
                AnomalyDetector(),
            ])
            _applier = Applier()

        await _recommender.tick()
        await _applier.apply_approved()
        await _applier.check_outcomes()
    except Exception as e:
        log.error("ml_intelligence_error", error=str(e))


async def _run_platform_crawls(job_store: JobStore) -> None:
    """Concurrent platform crawl dispatch.

    Runs up to three workstreams in parallel:
      1. Face detection  (CPU-bound subprocess)
      2. Matching         (DB-bound)
      3. Platform crawls  (I/O-bound HTTP, all platforms in parallel)

    These are naturally independent — crawling writes to discovered_images,
    detection reads pending rows and writes face data, matching reads face
    embeddings. No conflicts.
    """
    import asyncio

    tasks: list[asyncio.Task] = []

    # Face detection
    async with async_session() as session:
        pending_detection = await count_pending_face_detection(session)
    if pending_detection > 0:
        log.info("phase_dispatch", phase="detecting", pending=pending_detection)
        tasks.append(asyncio.create_task(
            _phase_face_detection(job_store, pending_detection)
        ))

    # Matching
    async with async_session() as session:
        pending_matching = await count_unmatched_face_embeddings(session)
    if pending_matching > 0:
        log.info("phase_dispatch", phase="matching", pending=pending_matching)
        tasks.append(asyncio.create_task(
            _phase_matching(job_store)
        ))

    # Platform crawls — all due platforms in parallel
    due_crawls = await job_store.get_due_platform_crawls()
    for crawl in due_crawls:
        if shutdown_requested:
            break
        log.info("phase_dispatch", phase="crawling", platform=crawl.platform)
        tasks.append(asyncio.create_task(
            _safe_crawl(job_store, crawl)
        ))

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                log.error("parallel_phase_error", index=i, error=repr(result))


async def _safe_crawl(job_store: JobStore, crawl) -> None:
    """Wrapper for crawl with error handling (used in gather)."""
    try:
        await _phase_crawl_and_insert(job_store, crawl)
    except Exception as e:
        log.error("platform_crawl_error", platform=crawl.platform, error=repr(e))


async def _phase_crawl_and_insert(job_store: JobStore, crawl) -> None:
    """Phase 1: Run site-specific scraper, batch INSERT discovered images.

    Dispatches to INLINE or DEFERRED strategy based on the scraper's
    detection strategy. No platform-specific branching here.
    """
    scraper = PLATFORM_SCRAPERS.get(crawl.platform)
    if not scraper:
        log.warning("unknown_platform", platform=crawl.platform)
        return

    await job_store.update_crawl_phase(crawl.platform, "crawling")

    async with async_session() as session:
        job = await _create_crawl_job(session, crawl.platform)
        job_id = job.id
        await session.commit()

    try:
        from src.intelligence.mapper.orchestrator import get_search_config, update_section_stats

        config = await get_search_config(crawl.platform)

        # Skip if profiles exist but nothing enabled
        if config.effective_terms is not None and len(config.effective_terms) == 0:
            log.info("crawl_skipped_no_enabled_sections", platform=crawl.platform)
            await job_store.update_crawl_phase(crawl.platform, None)
            async with async_session() as session:
                from src.db.queries import update_scan_job
                await update_scan_job(session, job_id, status="completed", images_processed=0, matches_found=0)
                await session.commit()
            return

        if config.damage_breakdown:
            log.info(
                "prioritized_config",
                platform=crawl.platform,
                total_tags=len(config.effective_terms or []),
                **config.damage_breakdown,
            )

        # Build context
        search_terms_data = crawl.search_terms or {}
        effective_terms = (
            config.effective_terms
            if config.effective_terms is not None
            else list(search_terms_data.get("terms", []))
        )
        context = DiscoveryContext(
            platform=crawl.platform,
            search_terms=effective_terms if effective_terms else None,
            cursor=crawl.cursor,
            search_cursors=search_terms_data.get("search_cursors"),
            model_cursors=search_terms_data.get("model_cursors"),
            tag_depths=config.tag_depths,
        )

        # Strategy dispatch
        from src.discovery.base import DetectionStrategy

        if scraper.get_detection_strategy() == DetectionStrategy.INLINE:
            total_images, new_count, result_cursors, result_tags = await _crawl_inline(
                scraper, context, crawl.platform
            )
        else:
            total_images, new_count, result_cursors, result_tags = await _crawl_deferred(
                scraper, context, crawl.platform
            )

        log.info(
            "phase_crawl_complete",
            platform=crawl.platform,
            strategy=scraper.get_detection_strategy().value,
            total_discovered=total_images,
            new_inserted=new_count,
        )

        try:
            await observer.emit("crawl_completed", "platform", crawl.platform, {
                "total_discovered": total_images,
                "new_inserted": new_count,
                "strategy": scraper.get_detection_strategy().value,
            })
        except Exception:
            pass

        # Persist cursors
        await _persist_crawl_state(
            job_store, crawl, result_cursors, config, total_images, new_count,
            result_tags[0], result_tags[1],
        )

        # Update mapper section stats
        if config.mapper_active:
            try:
                total_faces = result_cursors.get("_faces_found", 0) if isinstance(result_cursors, dict) else 0
                await update_section_stats(
                    crawl.platform,
                    total_scanned=total_images,
                    total_faces=total_faces,
                )
            except Exception as e:
                log.error("mapper_stats_update_error", platform=crawl.platform, error=str(e))

        # Mark job complete
        async with async_session() as session:
            from src.db.queries import update_scan_job
            await update_scan_job(
                session, job_id,
                status="completed",
                images_processed=total_images,
                matches_found=0,
            )
            await session.commit()

        await job_store.update_crawl_phase(crawl.platform, None)

    except Exception as e:
        async with async_session() as session:
            from src.db.queries import update_scan_job
            await update_scan_job(session, job_id, status="failed", error_message=str(e)[:500])
            await session.commit()
        await job_store.update_crawl_phase(crawl.platform, None)
        raise


# Lazy-loaded InsightFace model singleton for inline detection
_face_model = None
_face_model_lock = asyncio.Lock()


async def _get_face_model():
    """Lazy-load InsightFace model (thread-safe singleton)."""
    global _face_model
    if _face_model is not None:
        return _face_model
    async with _face_model_lock:
        if _face_model is not None:
            return _face_model
        log.info("loading_insightface_model")
        from src.ingest.embeddings import init_model
        _face_model = init_model()
        log.info("insightface_model_loaded")
        return _face_model


async def _crawl_inline(
    scraper, context: DiscoveryContext, platform: str
) -> tuple[int, int, dict, tuple[int, int]]:
    """Inline strategy: crawl + detect faces in one pass.

    Returns (total_images, new_count, cursors_dict, (tags_total, tags_exhausted)).
    """
    face_model = await _get_face_model()
    result = await scraper.discover_with_detection(context, face_model)

    # Insert pre-detected images with embeddings
    from src.db.queries import insert_inline_detected_image
    new_count = 0

    for img in result.images:
        faces_data = [
            {
                "face_index": f.face_index,
                "embedding": f.embedding.tolist() if hasattr(f.embedding, "tolist") else list(f.embedding),
                "detection_score": f.detection_score,
            }
            for f in img.faces
        ]
        async with async_session() as session:
            inserted = await insert_inline_detected_image(
                session=session,
                source_url=img.source_url,
                page_url=img.page_url,
                page_title=img.page_title,
                platform=platform,
                has_face=img.has_face,
                face_count=img.face_count,
                faces=faces_data,
            )
            await session.commit()
        if inserted:
            new_count += 1

    # Build cursors dict for persistence
    cursors_dict = {}
    if result.search_cursors:
        cursors_dict["search_cursors"] = {
            k: v for k, v in result.search_cursors.items() if v is not None
        }
    cursors_dict["_faces_found"] = result.faces_found

    return (
        len(result.images),
        new_count,
        cursors_dict,
        (result.tags_total, result.tags_exhausted),
    )


async def _crawl_deferred(
    scraper, context: DiscoveryContext, platform: str
) -> tuple[int, int, dict, tuple[int, int]]:
    """Deferred strategy: crawl only, detect faces in Phase 2 subprocess.

    Returns (total_images, new_count, cursors_dict, (tags_total, tags_exhausted)).
    """
    discovery_result = await scraper.discover(context)

    # Batch insert discovered images (URL dedup at DB level)
    images_for_insert = [
        {
            "source_url": disc.source_url,
            "page_url": disc.page_url,
            "page_title": disc.page_title,
            "image_stored_url": disc.image_stored_url,
        }
        for disc in discovery_result.images
    ]
    new_count = 0
    if images_for_insert:
        async with async_session() as session:
            new_count = await batch_insert_discovered_images(
                session, images_for_insert, platform
            )
            await session.commit()

    # Build cursors dict for persistence
    cursors_dict = {}
    if discovery_result.next_cursor is not None:
        cursors_dict["cursor"] = discovery_result.next_cursor
    if discovery_result.search_cursors:
        active = {k: v for k, v in discovery_result.search_cursors.items() if v is not None}
        if active:
            cursors_dict["search_cursors"] = active
    if discovery_result.model_cursors:
        active = {k: v for k, v in discovery_result.model_cursors.items() if v is not None}
        if active:
            cursors_dict["model_cursors"] = active

    return (
        len(discovery_result.images),
        new_count,
        cursors_dict,
        (discovery_result.tags_total, discovery_result.tags_exhausted),
    )


async def _persist_crawl_state(
    job_store: JobStore,
    crawl,
    result_cursors: dict,
    config,
    total_images: int,
    new_count: int,
    tags_total: int = 0,
    tags_exhausted: int = 0,
) -> None:
    """Persist cursor state and coverage stats after a crawl completes."""
    new_search_terms = dict(crawl.search_terms or {})

    # Merge cursor data (skip internal keys starting with _)
    for key in ("cursor", "search_cursors", "model_cursors"):
        if key in result_cursors:
            new_search_terms[key] = result_cursors[key]
        elif key in new_search_terms:
            del new_search_terms[key]

    await job_store.mark_crawl_complete(crawl.platform, new_search_terms)

    # Update coverage stats
    async with async_session() as session:
        await update_crawl_coverage(
            session,
            platform=crawl.platform,
            total_images=new_count,
            tags_total=tags_total,
            tags_exhausted=tags_exhausted,
        )
        await session.commit()


async def _phase_face_detection(job_store: JobStore, pending: int) -> None:
    """Phase 2: Run face detection in subprocess (memory-isolated).

    Spawns scripts/process_faces.py with --chunk-size and --max-chunks.
    Processes up to max_chunks * chunk_size images per tick.
    Fully resumable via WHERE has_face IS NULL.
    """
    chunk_size = settings.face_detection_chunk_size
    max_chunks = settings.face_detection_max_chunks
    timeout = settings.face_detection_timeout

    script_path = os.path.join(_SCANNER_ROOT, "scripts", "process_faces.py")
    cmd = [
        sys.executable, script_path,
        "--chunk-size", str(chunk_size),
        "--max-chunks", str(max_chunks),
    ]

    log.info(
        "phase_face_detection_start",
        pending=pending,
        chunk_size=chunk_size,
        max_chunks=max_chunks,
    )

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout * max_chunks,  # total timeout scales with chunks
            cwd=_SCANNER_ROOT,
        )

        if result.returncode != 0:
            log.error("phase_face_detection_error", stderr=result.stderr[-500:])
        else:
            # Parse output for stats
            for line in reversed(result.stdout.strip().split("\n")):
                if "Images processed:" in line:
                    log.info("phase_face_detection_complete", output=line.strip())
                    break
            else:
                log.info("phase_face_detection_complete", output=result.stdout[-200:])

        try:
            await observer.emit("faces_detected", "pipeline", "face_detection", {
                "pending": pending,
                "chunk_size": chunk_size,
                "max_chunks": max_chunks,
                "returncode": result.returncode,
            })
        except Exception:
            pass

    except subprocess.TimeoutExpired:
        log.warning("phase_face_detection_timeout", timeout_seconds=timeout * max_chunks)
    except Exception as e:
        log.error("phase_face_detection_error", error=str(e))
    finally:
        # Clear phase
        async with async_session() as session:
            from src.db.models import PlatformCrawlSchedule
            from sqlalchemy import update as sa_update
            await session.execute(
                sa_update(PlatformCrawlSchedule)
                .where(PlatformCrawlSchedule.enabled == True)  # noqa: E712
                .values(crawl_phase=None)
            )
            await session.commit()


async def _phase_matching(job_store: JobStore) -> None:
    """Phase 3: Match unmatched face embeddings against the contributor registry.

    Fetches a batch of unmatched embeddings, runs compare_against_registry for each,
    handles matches (evidence, AI detection, notifications), and marks as matched.
    """
    batch_size = settings.matching_batch_size
    total_matches = 0
    processed_ids = []

    try:
        async with async_session() as session:
            unmatched = await get_unmatched_face_embeddings(session, limit=batch_size)

        log.info("phase_matching_start", batch_size=len(unmatched))

        for entry in unmatched:
            if shutdown_requested:
                break

            embedding_id = entry["id"]
            embedding_raw = entry["embedding"]
            discovered_image_id = entry["discovered_image_id"]
            face_index = entry["face_index"]
            page_url = entry["page_url"]

            # Convert embedding to numpy array
            if isinstance(embedding_raw, (list, tuple)):
                query_embedding = np.array(embedding_raw, dtype=np.float32)
            else:
                query_embedding = np.array(embedding_raw, dtype=np.float32)

            # Compare against BOTH contributor embeddings AND registry identities
            async with async_session() as session:
                all_matches = await find_all_similar_embeddings(
                    session, query_embedding, threshold=settings.match_threshold_low,
                    primary_only=False,
                )
                for m in all_matches:
                    if m["source"] == "contributor":
                        # Standard contributor match — existing flow
                        contributor_match = {
                            "contributor_id": m["contributor_id"],
                            "embedding_id": m["embedding_id"],
                            "similarity": m["similarity"],
                        }
                        result = await _handle_match(
                            session, discovered_image_id, contributor_match,
                            page_url, face_index,
                        )
                        if result:
                            total_matches += 1
                    elif m["source"] == "registry":
                        # Registry (claim user) match — new flow
                        result = await _handle_registry_match(
                            session, discovered_image_id, m,
                            page_url, face_index,
                        )
                        if result:
                            total_matches += 1
                await session.commit()

            processed_ids.append(embedding_id)

        # Mark all processed embeddings as matched (even if no matches found)
        if processed_ids:
            async with async_session() as session:
                await mark_face_embeddings_matched(session, processed_ids)
                await session.commit()

        log.info(
            "phase_matching_complete",
            embeddings_processed=len(processed_ids),
            matches_found=total_matches,
        )

        try:
            await observer.emit("matching_completed", "pipeline", "matching", {
                "embeddings_processed": len(processed_ids),
                "matches_found": total_matches,
            })
        except Exception:
            pass

    except Exception as e:
        log.error("phase_matching_error", error=str(e))
        # Still mark processed ones to avoid reprocessing
        if processed_ids:
            try:
                async with async_session() as session:
                    await mark_face_embeddings_matched(session, processed_ids)
                    await session.commit()
            except Exception:
                pass
    finally:
        # Clear phase
        async with async_session() as session:
            from src.db.models import PlatformCrawlSchedule
            from sqlalchemy import update as sa_update
            await session.execute(
                sa_update(PlatformCrawlSchedule)
                .where(PlatformCrawlSchedule.enabled == True)  # noqa: E712
                .values(crawl_phase=None)
            )
            await session.commit()


async def _create_crawl_job(session, platform: str):
    from src.db.queries import create_scan_job
    job = await create_scan_job(
        session,
        scan_type="platform_crawl",
        source_name=platform,
        contributor_id=None,
    )
    from src.db.queries import update_scan_job
    await update_scan_job(session, job.id, status="running")
    return job


async def _process_discovered_image(
    source_url: str,
    page_url: str | None,
    page_title: str | None,
    platform: str | None,
    scan_job_id,
    target_contributor_id=None,
) -> int:
    """Process a single discovered image through the matching pipeline.

    Returns number of matches found.
    """
    # Insert (URL dedup happens at DB level)
    async with async_session() as session:
        disc_image = await insert_discovered_image(
            session,
            source_url=source_url,
            scan_job_id=scan_job_id,
            page_url=page_url,
            page_title=page_title,
            platform=platform,
        )
        await session.commit()

    if disc_image is None:
        return 0  # URL already exists (dedup)

    # Download image
    local_path = await download_image(source_url)
    if local_path is None:
        async with async_session() as session:
            await update_discovered_image(session, disc_image.id, has_face=False)
            await session.commit()
        return 0

    try:
        # Perceptual hash dedup
        try:
            pil_image = Image.open(local_path)
            phash = imagehash.phash(pil_image)
            phash_bits = bin(int(str(phash), 16))[2:].zfill(64)
            w, h = pil_image.size
            pil_image.close()
        except Exception:
            phash_bits = None
            w, h = None, None

        if phash_bits:
            async with async_session() as session:
                dup_id = await find_phash_duplicate(session, phash_bits)
                await update_discovered_image(
                    session, disc_image.id,
                    phash=phash_bits, width=w, height=h,
                )
                await session.commit()

            if dup_id:
                return 0  # Visual duplicate, skip face detection

        # Minimum dimension check
        if w and h and (w < 200 or h < 200):
            async with async_session() as session:
                await update_discovered_image(session, disc_image.id, has_face=False)
                await session.commit()
            return 0

        # Face detection
        faces = detect_faces(local_path)

        async with async_session() as session:
            await update_discovered_image(
                session, disc_image.id,
                has_face=len(faces) > 0,
                face_count=len(faces),
            )
            await session.commit()

        if not faces:
            return 0

        # Embedding comparison for each face
        total_matches = 0
        for face_idx, face in enumerate(faces):
            embedding = get_face_embedding(face)

            # Store discovered face embedding for future backfill
            async with async_session() as session:
                await insert_discovered_face_embedding(
                    session, disc_image.id, face_idx, embedding,
                    float(face.det_score) if hasattr(face, 'det_score') else None,
                )
                await session.commit()

            async with async_session() as session:
                if target_contributor_id:
                    # Reverse image search: check target contributor first
                    match = await compare_against_contributor(
                        session, embedding, target_contributor_id
                    )
                    if match:
                        result = await _handle_match(
                            session, disc_image.id, match, page_url, face_idx
                        )
                        if result:
                            total_matches += 1

                    # Also check full registry (might match other contributors)
                    all_matches = await compare_against_registry(
                        session, embedding, primary_only=False
                    )
                    for m in all_matches:
                        if m["contributor_id"] != target_contributor_id:
                            result = await _handle_match(
                                session, disc_image.id, m, page_url, face_idx
                            )
                            if result:
                                total_matches += 1
                else:
                    # Platform crawl: check full registry
                    all_matches = await compare_against_registry(
                        session, embedding, primary_only=False
                    )
                    for m in all_matches:
                        result = await _handle_match(
                            session, disc_image.id, m, page_url, face_idx
                        )
                        if result:
                            total_matches += 1

                await session.commit()

        return total_matches

    finally:
        local_path.unlink(missing_ok=True)


async def _handle_match(
    session,
    discovered_image_id,
    match_data: dict,
    page_url: str | None,
    face_index: int,
) -> bool:
    """Handle a single match: confidence check, allowlist, AI detection, evidence, notification.

    Returns True if match was stored.
    """
    contributor_id = match_data["contributor_id"]
    similarity = match_data["similarity"]
    embedding_id = match_data["embedding_id"]

    confidence = get_confidence_tier(similarity)
    if confidence is None:
        return False

    # Get contributor tier config
    contributor = await get_contributor(session, contributor_id)
    if not contributor:
        return False
    tier = contributor.subscription_tier or "free"
    tier_config = get_tier_config(tier)

    # Allowlist check
    known_account = await check_known_account(session, contributor_id, page_url)
    is_known = known_account is not None

    # Insert match
    match = await insert_match(
        session,
        discovered_image_id=discovered_image_id,
        contributor_id=contributor_id,
        similarity_score=similarity,
        confidence_tier=confidence,
        best_embedding_id=embedding_id,
        face_index=face_index,
    )
    if match is None:
        return False  # Dedup

    try:
        await observer.emit("match_found", "match", str(match.id), {
            "contributor_id": str(contributor_id),
            "similarity": round(similarity, 4),
            "confidence": confidence,
            "platform": page_url,
            "is_known_account": is_known,
        })
    except Exception:
        pass

    if is_known:
        await update_match(
            session, match.id,
            is_known_account=True,
            known_account_id=known_account["id"],
        )
        return True  # Match stored but no further action

    # AI detection (paid tiers, medium+ confidence)
    if should_run_ai_detection(confidence, is_known, tier_config):
        from src.db.models import DiscoveredImage
        from sqlalchemy import select
        disc = await session.execute(
            select(DiscoveredImage.image_stored_url, DiscoveredImage.source_url).where(DiscoveredImage.id == discovered_image_id)
        )
        row = disc.one_or_none()
        image_url = (row[0] or row[1]) if row else None
        if image_url:
            # If stored_url is a storage path, build the full Supabase URL
            if image_url and not image_url.startswith("http"):
                from src.config import settings as _settings
                image_url = f"{_settings.supabase_url}/storage/v1/object/authenticated/discovered-images/{image_url}"
            ai_result = await classify_ai_generated(image_url)
            if ai_result:
                await update_match(
                    session, match.id,
                    is_ai_generated=ai_result["is_ai_generated"],
                    ai_detection_score=ai_result["score"],
                    ai_generator=ai_result.get("generator"),
                )

    # Evidence capture (paid tiers, medium+ confidence)
    if should_capture_evidence(confidence, is_known, tier_config) and page_url:
        screenshot = await capture_screenshot(page_url)
        if screenshot:
            upload_result = await upload_evidence(
                screenshot["path"], contributor_id, match.id, "screenshot"
            )
            if upload_result:
                await insert_evidence(
                    session,
                    match_id=match.id,
                    evidence_type="screenshot",
                    storage_url=upload_result["storage_url"],
                    sha256_hash=upload_result["sha256_hash"],
                    file_size_bytes=upload_result["file_size_bytes"],
                )
            screenshot["path"].unlink(missing_ok=True)

    # Notification
    if should_notify(confidence, is_known, tier_config):
        await create_notification(
            session,
            contributor_id=contributor_id,
            notification_type="match_found",
            title="New match detected",
            body=f"A {confidence}-confidence match was found on {page_url or 'an unknown page'}.",
            data={
                "match_id": str(match.id),
                "similarity": similarity,
                "confidence": confidence,
                "page_url": page_url,
                "show_full_details": tier_config.get("show_full_details", False),
            },
        )

    return True


async def _handle_registry_match(
    session,
    discovered_image_id,
    match_data: dict,
    page_url: str | None,
    face_index: int,
) -> bool:
    """Handle a match against a registry (claim) identity.

    Simpler than _handle_match: no allowlist, no evidence capture, no notifications
    (claim users have no contributor row for those features). Just stores the match.

    Returns True if match was stored.
    """
    cid = match_data["registry_cid"]
    similarity = match_data["similarity"]

    confidence = get_confidence_tier(similarity)
    if confidence is None:
        return False

    # Get source_url and platform from the discovered image
    from sqlalchemy import select
    from src.db.models import DiscoveredImage
    disc = await session.execute(
        select(DiscoveredImage.source_url, DiscoveredImage.platform)
        .where(DiscoveredImage.id == discovered_image_id)
    )
    disc_row = disc.one_or_none()
    source_url = disc_row[0] if disc_row else None
    platform = disc_row[1] if disc_row else None

    match = await insert_registry_match(
        session,
        cid=cid,
        discovered_image_id=discovered_image_id,
        similarity_score=similarity,
        confidence_tier=confidence,
        face_index=face_index,
        source_url=source_url,
        page_url=page_url,
        platform=platform,
    )
    if match is None:
        return False  # Dedup

    log.info(
        "registry_match_stored",
        cid=cid,
        similarity=round(similarity, 4),
        confidence=confidence,
        page_url=page_url,
    )

    return True
