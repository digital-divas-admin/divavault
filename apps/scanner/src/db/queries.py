"""Reusable async query functions for the scanner service."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import numpy as np
from sqlalchemy import and_, delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Contributor,
    ContributorEmbedding,
    ContributorImage,
    ContributorKnownAccount,
    DiscoveredFaceEmbedding,
    DiscoveredImage,
    Evidence,
    Match,
    PlatformCrawlSchedule,
    RegistryIdentity,
    RegistryMatch,
    ScanJob,
    ScannerNotification,
    ScanSchedule,
    Upload,
)


# --- Ingest queries ---


async def get_pending_images(session: AsyncSession, limit: int = 50) -> list[ContributorImage]:
    """Get contributor_images with embedding_status='pending'."""
    result = await session.execute(
        select(ContributorImage)
        .where(ContributorImage.embedding_status == "pending")
        .order_by(ContributorImage.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_pending_uploads(session: AsyncSession, limit: int = 50) -> list[Upload]:
    """Get uploads with embedding_status='pending' and status='active'."""
    result = await session.execute(
        select(Upload)
        .where(
            and_(
                Upload.embedding_status == "pending",
                Upload.status == "active",
            )
        )
        .order_by(Upload.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_image_embedding_status(
    session: AsyncSession,
    image_id: UUID,
    status: str,
    error: str | None = None,
    *,
    is_upload: bool = False,
) -> None:
    """Update embedding_status on contributor_images or uploads."""
    table = Upload if is_upload else ContributorImage
    await session.execute(
        update(table)
        .where(table.id == image_id)
        .values(embedding_status=status, embedding_error=error)
    )


async def insert_embedding(
    session: AsyncSession,
    contributor_id: UUID,
    embedding: np.ndarray,
    detection_score: float,
    source_image_id: UUID | None = None,
    source_upload_id: UUID | None = None,
) -> ContributorEmbedding:
    """Insert a new embedding into contributor_embeddings."""
    row = ContributorEmbedding(
        contributor_id=contributor_id,
        source_image_id=source_image_id,
        source_upload_id=source_upload_id,
        embedding=embedding.tolist(),
        detection_score=detection_score,
        is_primary=False,
    )
    session.add(row)
    await session.flush()
    return row


async def update_primary_embedding(session: AsyncSession, contributor_id: UUID) -> None:
    """Set is_primary on the highest detection_score embedding for a contributor."""
    # Clear existing primary
    await session.execute(
        update(ContributorEmbedding)
        .where(
            and_(
                ContributorEmbedding.contributor_id == contributor_id,
                ContributorEmbedding.is_primary == True,  # noqa: E712
            )
        )
        .values(is_primary=False)
    )
    # Find best
    best = await session.execute(
        select(ContributorEmbedding.id)
        .where(ContributorEmbedding.contributor_id == contributor_id)
        .order_by(ContributorEmbedding.detection_score.desc().nulls_last())
        .limit(1)
    )
    best_id = best.scalar_one_or_none()
    if best_id:
        await session.execute(
            update(ContributorEmbedding)
            .where(ContributorEmbedding.id == best_id)
            .values(is_primary=True)
        )


async def get_contributor(session: AsyncSession, contributor_id: UUID) -> Contributor | None:
    """Get a contributor by ID."""
    result = await session.execute(
        select(Contributor).where(Contributor.id == contributor_id)
    )
    return result.scalar_one_or_none()


async def contributor_has_embeddings(session: AsyncSession, contributor_id: UUID) -> bool:
    """Check if a contributor already has embeddings."""
    result = await session.execute(
        select(func.count()).select_from(ContributorEmbedding).where(
            ContributorEmbedding.contributor_id == contributor_id
        )
    )
    return result.scalar_one() > 0


# --- Scan schedule queries ---


async def init_scan_schedule(
    session: AsyncSession,
    contributor_id: UUID,
    interval_hours: int = 168,
    priority: int = 0,
) -> None:
    """Initialize scan_schedule for a contributor (idempotent)."""
    stmt = insert(ScanSchedule).values(
        contributor_id=contributor_id,
        scan_type="reverse_image",
        next_scan_at=func.now(),
        scan_interval_hours=interval_hours,
        priority=priority,
    ).on_conflict_do_nothing()
    await session.execute(stmt)


async def get_due_scans(
    session: AsyncSession,
    batch_size: int = 10,
) -> list[ScanSchedule]:
    """Get scan_schedule rows where next_scan_at has passed, ordered by priority."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(ScanSchedule)
        .where(ScanSchedule.next_scan_at <= now)
        .order_by(ScanSchedule.priority.desc(), ScanSchedule.next_scan_at)
        .limit(batch_size)
    )
    return list(result.scalars().all())


async def update_scan_schedule_after_run(
    session: AsyncSession,
    contributor_id: UUID,
    scan_type: str,
    interval_hours: int,
) -> None:
    """Update scan_schedule after a completed scan."""
    now = datetime.now(timezone.utc)
    await session.execute(
        update(ScanSchedule)
        .where(
            and_(
                ScanSchedule.contributor_id == contributor_id,
                ScanSchedule.scan_type == scan_type,
            )
        )
        .values(
            last_scan_at=now,
            next_scan_at=now + timedelta(hours=interval_hours),
        )
    )


# --- Platform crawl schedule queries ---


async def get_due_crawls(session: AsyncSession) -> list[PlatformCrawlSchedule]:
    """Get platform_crawl_schedule rows that are due."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(PlatformCrawlSchedule)
        .where(
            and_(
                PlatformCrawlSchedule.enabled == True,  # noqa: E712
                PlatformCrawlSchedule.next_crawl_at <= now,
            )
        )
    )
    return list(result.scalars().all())


async def update_crawl_schedule_after_run(
    session: AsyncSession,
    platform: str,
    search_terms: dict | None = None,
) -> None:
    """Update platform_crawl_schedule after a completed crawl."""
    now = datetime.now(timezone.utc)
    values: dict = {"last_crawl_at": now}
    if search_terms is not None:
        values["search_terms"] = search_terms

    # Read current interval to compute next_crawl_at
    result = await session.execute(
        select(PlatformCrawlSchedule.crawl_interval_hours)
        .where(PlatformCrawlSchedule.platform == platform)
    )
    interval = result.scalar_one_or_none() or 24
    values["next_crawl_at"] = now + timedelta(hours=interval)

    await session.execute(
        update(PlatformCrawlSchedule)
        .where(PlatformCrawlSchedule.platform == platform)
        .values(**values)
    )


# --- Scan job queries ---


async def create_scan_job(
    session: AsyncSession,
    scan_type: str,
    source_name: str,
    contributor_id: UUID | None = None,
) -> ScanJob:
    """Create a new scan job."""
    job = ScanJob(
        contributor_id=contributor_id,
        scan_type=scan_type,
        source_name=source_name,
        status="pending",
    )
    session.add(job)
    await session.flush()
    return job


async def update_scan_job(
    session: AsyncSession,
    job_id: UUID,
    *,
    status: str | None = None,
    images_processed: int | None = None,
    matches_found: int | None = None,
    error_message: str | None = None,
) -> None:
    """Update scan job fields."""
    values: dict = {}
    if status is not None:
        values["status"] = status
        if status == "running":
            values["started_at"] = datetime.now(timezone.utc)
        elif status in ("completed", "failed"):
            values["completed_at"] = datetime.now(timezone.utc)
    if images_processed is not None:
        values["images_processed"] = images_processed
    if matches_found is not None:
        values["matches_found"] = matches_found
    if error_message is not None:
        values["error_message"] = error_message

    if values:
        await session.execute(
            update(ScanJob).where(ScanJob.id == job_id).values(**values)
        )


async def recover_stale_jobs(session: AsyncSession, max_age_minutes: int = 30) -> int:
    """Reset stale running/interrupted jobs to failed."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
    result = await session.execute(
        update(ScanJob)
        .where(
            and_(
                ScanJob.status.in_(["running", "interrupted"]),
                ScanJob.started_at < cutoff,
            )
        )
        .values(
            status="failed",
            error_message="stale_job_recovered",
            completed_at=datetime.now(timezone.utc),
        )
    )
    return result.rowcount


# --- Discovered images queries ---


async def insert_discovered_image(
    session: AsyncSession,
    source_url: str,
    scan_job_id: UUID | None = None,
    page_url: str | None = None,
    page_title: str | None = None,
    platform: str | None = None,
) -> DiscoveredImage | None:
    """Insert a discovered image (URL dedup via unique index). Returns None on conflict."""
    stmt = (
        insert(DiscoveredImage)
        .values(
            scan_job_id=scan_job_id,
            source_url=source_url,
            page_url=page_url,
            page_title=page_title,
            platform=platform,
        )
        .on_conflict_do_nothing(index_elements=[text("md5(source_url)")])
        .returning(DiscoveredImage)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def find_phash_duplicate(
    session: AsyncSession,
    phash_bits: str,
    max_distance: int = 5,
    days_back: int = 14,
) -> UUID | None:
    """Find a visually duplicate discovered_image by perceptual hash."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    # asyncpg can't bind bit(64) directly; use a validated literal in SQL
    if len(phash_bits) != 64 or not all(c in "01" for c in phash_bits):
        return None
    result = await session.execute(
        text(f"""
            SELECT id FROM discovered_images
            WHERE phash IS NOT NULL
              AND bit_count(phash # B'{phash_bits}') <= :max_distance
              AND discovered_at > :cutoff
            LIMIT 1
        """),
        {"max_distance": max_distance, "cutoff": cutoff},
    )
    row = result.first()
    return row[0] if row else None


async def update_discovered_image(
    session: AsyncSession,
    image_id: UUID,
    **kwargs,
) -> None:
    """Update fields on a discovered_image."""
    if kwargs:
        # asyncpg requires BitString for BIT columns, not plain strings
        if "phash" in kwargs and isinstance(kwargs["phash"], str):
            from asyncpg import BitString
            kwargs["phash"] = BitString.from_int(int(kwargs["phash"], 2), length=64)
        await session.execute(
            update(DiscoveredImage)
            .where(DiscoveredImage.id == image_id)
            .values(**kwargs)
        )


# --- Match queries ---


async def insert_match(
    session: AsyncSession,
    discovered_image_id: UUID,
    contributor_id: UUID,
    similarity_score: float,
    confidence_tier: str,
    best_embedding_id: UUID | None = None,
    face_index: int = 0,
) -> Match | None:
    """Insert a match (dedup via unique index). Returns None on conflict."""
    stmt = (
        insert(Match)
        .values(
            discovered_image_id=discovered_image_id,
            contributor_id=contributor_id,
            similarity_score=similarity_score,
            confidence_tier=confidence_tier,
            best_embedding_id=best_embedding_id,
            face_index=face_index,
        )
        .on_conflict_do_nothing()
        .returning(Match)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def update_match(session: AsyncSession, match_id: UUID, **kwargs) -> None:
    """Update fields on a match."""
    if kwargs:
        await session.execute(
            update(Match).where(Match.id == match_id).values(**kwargs)
        )


# --- Known account queries ---


async def get_known_accounts(
    session: AsyncSession,
    contributor_id: UUID,
) -> list[ContributorKnownAccount]:
    """Get all known accounts for a contributor."""
    result = await session.execute(
        select(ContributorKnownAccount)
        .where(ContributorKnownAccount.contributor_id == contributor_id)
    )
    return list(result.scalars().all())


# --- Evidence queries ---


async def insert_evidence(
    session: AsyncSession,
    match_id: UUID,
    evidence_type: str,
    storage_url: str,
    sha256_hash: str,
    file_size_bytes: int | None = None,
) -> Evidence:
    """Insert an evidence record."""
    row = Evidence(
        match_id=match_id,
        evidence_type=evidence_type,
        storage_url=storage_url,
        sha256_hash=sha256_hash,
        file_size_bytes=file_size_bytes,
    )
    session.add(row)
    await session.flush()
    return row


# --- Notification queries ---


async def create_notification(
    session: AsyncSession,
    contributor_id: UUID,
    notification_type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> ScannerNotification:
    """Create a notification for a contributor."""
    row = ScannerNotification(
        contributor_id=contributor_id,
        notification_type=notification_type,
        title=title,
        body=body,
        data=data,
    )
    session.add(row)
    await session.flush()
    return row


# --- Embedding comparison queries ---


async def find_similar_embeddings(
    session: AsyncSession,
    query_embedding: np.ndarray,
    threshold: float = 0.50,
    limit: int = 5,
    primary_only: bool = False,
) -> list[dict]:
    """Find contributor embeddings similar to query_embedding via pgvector cosine distance."""
    embedding_str = "[" + ",".join(str(x) for x in query_embedding.tolist()) + "]"

    primary_filter = "AND ce.is_primary = true" if primary_only else ""

    result = await session.execute(
        text(f"""
            SELECT ce.contributor_id, ce.id as embedding_id,
                   1 - (ce.embedding <=> CAST(:embedding AS vector(512))) as similarity
            FROM contributor_embeddings ce
            JOIN contributors c ON c.id = ce.contributor_id
            WHERE 1 - (ce.embedding <=> CAST(:embedding AS vector(512))) > :threshold
              AND c.opted_out = false
              AND c.suspended = false
              {primary_filter}
            ORDER BY ce.embedding <=> CAST(:embedding AS vector(512))
            LIMIT :limit
        """),
        {
            "embedding": embedding_str,
            "threshold": threshold,
            "limit": limit,
        },
    )
    rows = result.fetchall()
    return [
        {
            "contributor_id": row[0],
            "embedding_id": row[1],
            "similarity": row[2],
        }
        for row in rows
    ]


# --- Cleanup queries ---


async def cleanup_old_discovered_images(
    session: AsyncSession,
    no_face_days: int = 7,
    no_match_days: int = 30,
    batch_size: int = 10000,
) -> dict[str, int]:
    """Delete old discovered_images per retention policy. Returns counts."""
    now = datetime.now(timezone.utc)
    counts = {}

    # No face detected
    result = await session.execute(
        delete(DiscoveredImage)
        .where(
            and_(
                DiscoveredImage.has_face == False,  # noqa: E712
                DiscoveredImage.discovered_at < now - timedelta(days=no_face_days),
            )
        )
        .execution_options(synchronize_session=False)
    )
    counts["no_face_deleted"] = result.rowcount

    # Has face but no match (and no stored face embeddings within backfill window)
    result = await session.execute(
        text("""
            DELETE FROM discovered_images
            WHERE id IN (
                SELECT di.id FROM discovered_images di
                LEFT JOIN matches m ON m.discovered_image_id = di.id
                LEFT JOIN discovered_face_embeddings dfe ON dfe.discovered_image_id = di.id
                WHERE di.has_face = true
                  AND m.id IS NULL
                  AND dfe.id IS NULL
                  AND di.discovered_at < :cutoff
                LIMIT :batch_size
            )
        """),
        {
            "cutoff": now - timedelta(days=no_match_days),
            "batch_size": batch_size,
        },
    )
    counts["no_match_deleted"] = result.rowcount

    return counts


async def cleanup_old_scan_jobs(
    session: AsyncSession,
    completed_days: int = 30,
    batch_size: int = 10000,
) -> int:
    """Delete old completed/failed scan jobs."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=completed_days)
    result = await session.execute(
        text("""
            DELETE FROM scan_jobs
            WHERE id IN (
                SELECT id FROM scan_jobs
                WHERE status IN ('completed', 'failed')
                  AND completed_at < :cutoff
                LIMIT :batch_size
            )
        """),
        {"cutoff": cutoff, "batch_size": batch_size},
    )
    return result.rowcount


async def cleanup_read_notifications(
    session: AsyncSession,
    read_days: int = 90,
    batch_size: int = 10000,
) -> int:
    """Delete old read notifications."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=read_days)
    result = await session.execute(
        text("""
            DELETE FROM scanner_notifications
            WHERE id IN (
                SELECT id FROM scanner_notifications
                WHERE read = true
                  AND created_at < :cutoff
                LIMIT :batch_size
            )
        """),
        {"cutoff": cutoff, "batch_size": batch_size},
    )
    return result.rowcount


# --- Discovered face embedding queries ---


async def insert_discovered_face_embedding(
    session: AsyncSession,
    discovered_image_id: UUID,
    face_index: int,
    embedding: np.ndarray,
    detection_score: float | None = None,
) -> DiscoveredFaceEmbedding | None:
    """Insert a discovered face embedding (dedup via unique index). Returns None on conflict."""
    stmt = (
        insert(DiscoveredFaceEmbedding)
        .values(
            discovered_image_id=discovered_image_id,
            face_index=face_index,
            embedding=embedding.tolist(),
            detection_score=detection_score,
        )
        .on_conflict_do_nothing(index_elements=["discovered_image_id", "face_index"])
        .returning(DiscoveredFaceEmbedding)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def backfill_contributor_against_discovered(
    session: AsyncSession,
    contributor_id: UUID,
    embedding: np.ndarray,
    threshold: float = 0.50,
    days_back: int = 30,
    limit: int = 100,
) -> list[dict]:
    """Find discovered face embeddings similar to a contributor's embedding for backfill."""
    embedding_str = "[" + ",".join(str(x) for x in embedding.tolist()) + "]"
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

    result = await session.execute(
        text("""
            SELECT dfe.discovered_image_id, dfe.face_index,
                   1 - (dfe.embedding <=> CAST(:embedding AS vector(512))) as similarity
            FROM discovered_face_embeddings dfe
            JOIN discovered_images di ON di.id = dfe.discovered_image_id
            WHERE 1 - (dfe.embedding <=> CAST(:embedding AS vector(512))) > :threshold
              AND dfe.created_at > :cutoff
            ORDER BY dfe.embedding <=> CAST(:embedding AS vector(512))
            LIMIT :limit
        """),
        {
            "embedding": embedding_str,
            "threshold": threshold,
            "cutoff": cutoff,
            "limit": limit,
        },
    )
    rows = result.fetchall()
    return [
        {
            "discovered_image_id": row[0],
            "face_index": row[1],
            "similarity": row[2],
        }
        for row in rows
    ]


async def batch_insert_discovered_images(
    session: AsyncSession,
    images: list[dict],
    platform: str,
    batch_size: int = 500,
) -> int:
    """Batch insert discovered images with URL dedup. Returns count of new rows.

    Each dict in images should have: source_url, page_url (optional), page_title (optional),
    image_stored_url (optional).
    Uses ON CONFLICT (md5(source_url)) DO NOTHING for dedup.
    """
    total_inserted = 0

    for i in range(0, len(images), batch_size):
        chunk = images[i : i + batch_size]
        values = [
            {
                "source_url": img["source_url"],
                "page_url": img.get("page_url"),
                "page_title": img.get("page_title"),
                "platform": platform,
                "image_stored_url": img.get("image_stored_url"),
            }
            for img in chunk
        ]

        stmt = (
            insert(DiscoveredImage)
            .values(values)
            .on_conflict_do_nothing(index_elements=[text("md5(source_url)")])
        )
        result = await session.execute(stmt)
        total_inserted += result.rowcount

    return total_inserted


async def get_unmatched_face_embeddings(
    session: AsyncSession,
    limit: int = 500,
) -> list[dict]:
    """Get discovered face embeddings that haven't been matched yet.

    Parses pgvector string format '[0.1,0.2,...]' into Python float lists.
    """
    result = await session.execute(
        text("""
            SELECT dfe.id, dfe.embedding::text, dfe.discovered_image_id, dfe.face_index,
                   di.page_url
            FROM discovered_face_embeddings dfe
            JOIN discovered_images di ON di.id = dfe.discovered_image_id
            WHERE dfe.matched_at IS NULL
            ORDER BY dfe.created_at
            LIMIT :limit
        """),
        {"limit": limit},
    )
    rows = result.fetchall()
    results = []
    for row in rows:
        # Parse pgvector string "[0.1,0.2,...]" into list of floats
        emb_str = row[1]
        if isinstance(emb_str, str):
            embedding = [float(x) for x in emb_str.strip("[]").split(",")]
        else:
            embedding = list(emb_str)
        results.append({
            "id": row[0],
            "embedding": embedding,
            "discovered_image_id": row[2],
            "face_index": row[3],
            "page_url": row[4],
        })
    return results


async def mark_face_embeddings_matched(
    session: AsyncSession,
    ids: list[UUID],
) -> None:
    """Mark discovered face embeddings as matched."""
    if not ids:
        return
    await session.execute(
        text("""
            UPDATE discovered_face_embeddings
            SET matched_at = now()
            WHERE id = ANY(:ids)
        """),
        {"ids": ids},
    )


async def update_crawl_coverage(
    session: AsyncSession,
    platform: str,
    total_images: int,
    tags_total: int,
    tags_exhausted: int,
) -> None:
    """Update coverage stats on platform_crawl_schedule."""
    await session.execute(
        update(PlatformCrawlSchedule)
        .where(PlatformCrawlSchedule.platform == platform)
        .values(
            total_images_discovered=PlatformCrawlSchedule.total_images_discovered + total_images,
            tags_total=tags_total,
            tags_exhausted=tags_exhausted,
        )
    )


async def count_pending_face_detection(session: AsyncSession) -> int:
    """Count discovered images where face detection hasn't run yet."""
    result = await session.execute(
        text("SELECT count(*) FROM discovered_images WHERE has_face IS NULL")
    )
    return result.scalar_one()


async def count_unmatched_face_embeddings(session: AsyncSession) -> int:
    """Count discovered face embeddings that haven't been matched yet."""
    result = await session.execute(
        text("SELECT count(*) FROM discovered_face_embeddings WHERE matched_at IS NULL")
    )
    return result.scalar_one()


async def cleanup_old_discovered_face_embeddings(
    session: AsyncSession,
    max_age_days: int = 60,
    batch_size: int = 10000,
) -> int:
    """Delete old discovered face embeddings past retention."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    result = await session.execute(
        text("""
            DELETE FROM discovered_face_embeddings
            WHERE id IN (
                SELECT id FROM discovered_face_embeddings
                WHERE created_at < :cutoff
                LIMIT :batch_size
            )
        """),
        {"cutoff": cutoff, "batch_size": batch_size},
    )
    return result.rowcount


# --- Registry queries ---


async def get_pending_registry_selfies(
    session: AsyncSession, limit: int = 50
) -> list[RegistryIdentity]:
    """Get registry identities with pending selfies ready for embedding."""
    result = await session.execute(
        select(RegistryIdentity)
        .where(
            and_(
                RegistryIdentity.embedding_status == "pending",
                RegistryIdentity.selfie_bucket.isnot(None),
                RegistryIdentity.selfie_path.isnot(None),
                RegistryIdentity.status.in_(["claimed", "verified"]),
            )
        )
        .order_by(RegistryIdentity.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_registry_embedding(
    session: AsyncSession,
    cid: str,
    embedding: np.ndarray,
    detection_score: float,
) -> None:
    """Store face embedding + detection score on a registry identity."""
    await session.execute(
        update(RegistryIdentity)
        .where(RegistryIdentity.cid == cid)
        .values(
            face_embedding=embedding.tolist(),
            detection_score=detection_score,
            embedding_status="processed",
            embedding_error=None,
        )
    )


async def update_registry_embedding_status(
    session: AsyncSession,
    cid: str,
    status: str,
    error: str | None = None,
) -> None:
    """Update embedding_status on a registry identity."""
    await session.execute(
        update(RegistryIdentity)
        .where(RegistryIdentity.cid == cid)
        .values(embedding_status=status, embedding_error=error)
    )


async def insert_registry_match(
    session: AsyncSession,
    cid: str,
    discovered_image_id: UUID,
    similarity_score: float,
    confidence_tier: str,
    face_index: int = 0,
    source_url: str | None = None,
    page_url: str | None = None,
    platform: str | None = None,
) -> RegistryMatch | None:
    """Insert a registry match (dedup via cid + discovered_image_id + face_index)."""
    stmt = (
        insert(RegistryMatch)
        .values(
            cid=cid,
            discovered_image_id=discovered_image_id,
            source_url=source_url,
            page_url=page_url,
            platform=platform,
            similarity_score=similarity_score,
            confidence_tier=confidence_tier,
            face_index=face_index,
        )
        .on_conflict_do_nothing()
        .returning(RegistryMatch)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def find_all_similar_embeddings(
    session: AsyncSession,
    query_embedding: np.ndarray,
    threshold: float = 0.50,
    limit: int = 5,
    primary_only: bool = False,
) -> list[dict]:
    """Find similar embeddings across BOTH contributor_embeddings AND registry_identities.

    Returns dicts with source='contributor' or source='registry' to route match handling.
    """
    embedding_str = "[" + ",".join(str(x) for x in query_embedding.tolist()) + "]"

    primary_filter = "AND ce.is_primary = true" if primary_only else ""

    result = await session.execute(
        text(f"""
            (
                SELECT ce.contributor_id::text AS identity_id,
                       ce.id AS embedding_id,
                       1 - (ce.embedding <=> CAST(:embedding AS vector(512))) AS similarity,
                       'contributor' AS source
                FROM contributor_embeddings ce
                JOIN contributors c ON c.id = ce.contributor_id
                WHERE 1 - (ce.embedding <=> CAST(:embedding AS vector(512))) > :threshold
                  AND c.opted_out = false
                  AND c.suspended = false
                  {primary_filter}
            )
            UNION ALL
            (
                SELECT ri.cid AS identity_id,
                       NULL::uuid AS embedding_id,
                       1 - (ri.face_embedding <=> CAST(:embedding AS vector(512))) AS similarity,
                       'registry' AS source
                FROM registry_identities ri
                WHERE ri.face_embedding IS NOT NULL
                  AND ri.embedding_status = 'processed'
                  AND ri.status IN ('claimed', 'verified')
                  AND 1 - (ri.face_embedding <=> CAST(:embedding AS vector(512))) > :threshold
            )
            ORDER BY similarity DESC
            LIMIT :limit
        """),
        {
            "embedding": embedding_str,
            "threshold": threshold,
            "limit": limit,
        },
    )
    rows = result.fetchall()
    results = []
    for row in rows:
        entry = {
            "identity_id": row[0],
            "embedding_id": row[1],
            "similarity": row[2],
            "source": row[3],
        }
        if row[3] == "contributor":
            entry["contributor_id"] = UUID(row[0])
        else:
            entry["registry_cid"] = row[0]
        results.append(entry)
    return results


# --- Metrics queries ---


async def get_scanner_metrics(session: AsyncSession) -> dict:
    """Get operational metrics for the health endpoint."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    metrics = {}

    # Pending embeddings (from both tables)
    r = await session.execute(
        text("""
            SELECT
              (SELECT count(*) FROM contributor_images WHERE embedding_status = 'pending') +
              (SELECT count(*) FROM uploads WHERE embedding_status = 'pending')
        """)
    )
    metrics["embeddings_pending"] = r.scalar_one()

    # Processed embeddings in 24h
    r = await session.execute(
        text("""
            SELECT count(*) FROM contributor_embeddings WHERE created_at > :since
        """),
        {"since": day_ago},
    )
    metrics["embeddings_processed_24h"] = r.scalar_one()

    # Failed embeddings in 24h
    r = await session.execute(
        text("""
            SELECT
              (SELECT count(*) FROM contributor_images
               WHERE embedding_status = 'failed' AND created_at > :since) +
              (SELECT count(*) FROM uploads
               WHERE embedding_status = 'failed' AND created_at > :since)
        """),
        {"since": day_ago},
    )
    metrics["embeddings_failed_24h"] = r.scalar_one()

    # Scans in 24h
    r = await session.execute(
        text("SELECT count(*) FROM scan_jobs WHERE status = 'completed' AND completed_at > :since"),
        {"since": day_ago},
    )
    metrics["scans_completed_24h"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM scan_jobs WHERE status = 'failed' AND completed_at > :since"),
        {"since": day_ago},
    )
    metrics["scans_failed_24h"] = r.scalar_one()

    # Discovery stats
    r = await session.execute(
        text("SELECT count(*) FROM discovered_images WHERE discovered_at > :since"),
        {"since": day_ago},
    )
    metrics["images_discovered_24h"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM discovered_images WHERE has_face = true AND discovered_at > :since"),
        {"since": day_ago},
    )
    metrics["images_with_faces_24h"] = r.scalar_one()

    # Match stats
    r = await session.execute(
        text("SELECT count(*) FROM matches WHERE created_at > :since"),
        {"since": day_ago},
    )
    metrics["matches_found_24h"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM matches WHERE is_known_account = true AND created_at > :since"),
        {"since": day_ago},
    )
    metrics["matches_known_account_24h"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM matches WHERE is_known_account = false AND created_at > :since"),
        {"since": day_ago},
    )
    metrics["matches_unauthorized_24h"] = r.scalar_one()

    # Evidence
    r = await session.execute(
        text("SELECT count(*) FROM evidence WHERE captured_at > :since"),
        {"since": day_ago},
    )
    metrics["evidence_captured_24h"] = r.scalar_one()

    # Registry size
    r = await session.execute(
        text("""
            SELECT
              (SELECT count(DISTINCT contributor_id) FROM contributor_embeddings),
              (SELECT count(*) FROM contributor_embeddings)
        """)
    )
    row = r.first()
    metrics["contributors_in_registry"] = row[0]
    metrics["total_embeddings"] = row[1]

    # Registry (claim user) stats
    r = await session.execute(
        text("""
            SELECT count(*) FROM registry_identities
            WHERE embedding_status = 'pending' AND selfie_bucket IS NOT NULL
        """)
    )
    metrics["registry_selfies_pending"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM registry_identities WHERE face_embedding IS NOT NULL")
    )
    metrics["registry_identities_with_embedding"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM registry_matches WHERE discovered_at > :since"),
        {"since": day_ago},
    )
    metrics["registry_matches_24h"] = r.scalar_one()

    return metrics


# --- ML metrics queries ---


async def get_test_user_stats(session: AsyncSession) -> dict:
    """Get test user aggregate stats for the health endpoint."""
    stats: dict = {}

    r = await session.execute(
        text("""
            SELECT
              count(*) FILTER (WHERE test_user_type = 'seeded') AS seeded,
              count(*) FILTER (WHERE test_user_type = 'honeypot') AS honeypots,
              count(*) FILTER (WHERE test_user_type = 'synthetic') AS synthetic
            FROM contributors WHERE is_test_user = true
        """)
    )
    row = r.first()
    stats["seeded"] = row[0] if row else 0
    stats["honeypots"] = row[1] if row else 0
    stats["synthetic"] = row[2] if row else 0

    r = await session.execute(
        text("""
            SELECT
              count(*) AS total,
              count(*) FILTER (WHERE detected = true) AS detected
            FROM test_honeypot_items
        """)
    )
    row = r.first()
    total = row[0] if row else 0
    detected = row[1] if row else 0
    stats["honeypot_detection_rate"] = round(detected / total, 4) if total > 0 else None

    return stats


async def get_ml_metrics(session: AsyncSession) -> dict:
    """Get ML observer metrics for the health endpoint."""
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    metrics = {}

    r = await session.execute(
        text("SELECT count(*) FROM ml_feedback_signals")
    )
    metrics["signals_total"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ml_feedback_signals WHERE created_at > :since"),
        {"since": day_ago},
    )
    metrics["signals_24h"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ml_recommendations WHERE status = 'pending'")
    )
    metrics["pending_recommendations"] = r.scalar_one()

    return metrics
