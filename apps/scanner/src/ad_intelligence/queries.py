"""Async query functions for the Ad Intelligence module."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.ad_intelligence.models import (
    AdIntelAd,
    AdIntelConfig,
    AdIntelFace,
    AdIntelMatch,
    AdIntelStockCandidate,
)


# --- Ad queries ---


async def insert_ad(session: AsyncSession, **kwargs) -> AdIntelAd | None:
    """Insert an ad with ON CONFLICT DO NOTHING on (platform, platform_ad_id).

    Returns None on conflict.
    """
    stmt = (
        insert(AdIntelAd)
        .values(**kwargs)
        .on_conflict_do_nothing(index_elements=["platform", "platform_ad_id"])
        .returning(AdIntelAd)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_pending_ads(session: AsyncSession, limit: int = 10) -> list[AdIntelAd]:
    """Get ads with processing_status = 'pending'."""
    result = await session.execute(
        select(AdIntelAd)
        .where(AdIntelAd.processing_status == "pending")
        .order_by(AdIntelAd.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_ad_status(
    session: AsyncSession,
    ad_id: UUID,
    status: str,
    **kwargs,
) -> None:
    """Update processing_status and optional fields on an ad."""
    values = {"processing_status": status, "updated_at": datetime.now(timezone.utc)}
    if status == "processed":
        values["processed_at"] = datetime.now(timezone.utc)
    values.update(kwargs)
    await session.execute(
        update(AdIntelAd).where(AdIntelAd.id == ad_id).values(**values)
    )


# --- Face queries ---


async def insert_face(session: AsyncSession, **kwargs) -> AdIntelFace | None:
    """Insert a face with ON CONFLICT DO NOTHING on (ad_id, face_index).

    Returns None on conflict.
    """
    stmt = (
        insert(AdIntelFace)
        .values(**kwargs)
        .on_conflict_do_nothing(index_elements=["ad_id", "face_index"])
        .returning(AdIntelFace)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_undescribed_faces(session: AsyncSession, limit: int = 10) -> list[AdIntelFace]:
    """Get faces where described = false."""
    result = await session.execute(
        select(AdIntelFace)
        .where(AdIntelFace.described == False)  # noqa: E712
        .order_by(AdIntelFace.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_face_description(
    session: AsyncSession,
    face_id: UUID,
    description: str,
    keywords: list[str],
    demographics: dict | None = None,
) -> None:
    """Update face description, keywords, demographics, and mark as described."""
    await session.execute(
        update(AdIntelFace)
        .where(AdIntelFace.id == face_id)
        .values(
            description=description,
            description_keywords=keywords,
            demographics=demographics,
            described=True,
        )
    )


async def get_unsearched_faces(session: AsyncSession, limit: int = 10) -> list[AdIntelFace]:
    """Get faces where described = true AND searched = false."""
    result = await session.execute(
        select(AdIntelFace)
        .where(
            AdIntelFace.described == True,  # noqa: E712
            AdIntelFace.searched == False,  # noqa: E712
        )
        .order_by(AdIntelFace.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def mark_face_searched(session: AsyncSession, face_id: UUID) -> None:
    """Mark a face as searched."""
    await session.execute(
        update(AdIntelFace).where(AdIntelFace.id == face_id).values(searched=True)
    )


async def get_unmatched_faces(session: AsyncSession, limit: int = 10) -> list[dict]:
    """Get faces where searched = true AND matched = false, returning embedding.

    Parses pgvector string format into Python float lists.
    """
    result = await session.execute(
        text("""
            SELECT f.id, f.embedding::text, f.ad_id
            FROM ad_intel_faces f
            WHERE f.searched = true
              AND f.matched = false
              AND f.embedding IS NOT NULL
            ORDER BY f.created_at
            LIMIT :limit
        """),
        {"limit": limit},
    )
    rows = result.fetchall()
    results = []
    for row in rows:
        emb_str = row[1]
        if isinstance(emb_str, str):
            embedding = [float(x) for x in emb_str.strip("[]").split(",")]
        else:
            embedding = list(emb_str)
        results.append({
            "id": row[0],
            "embedding": embedding,
            "ad_id": row[2],
        })
    return results


async def mark_face_matched(session: AsyncSession, face_id: UUID) -> None:
    """Mark a face as matched."""
    await session.execute(
        update(AdIntelFace).where(AdIntelFace.id == face_id).values(matched=True)
    )


# --- Stock candidate queries ---


async def insert_stock_candidate(session: AsyncSession, **kwargs) -> AdIntelStockCandidate | None:
    """Insert a stock candidate with ON CONFLICT DO NOTHING on (face_id, stock_platform, stock_image_id).

    Returns None on conflict.
    """
    stmt = (
        insert(AdIntelStockCandidate)
        .values(**kwargs)
        .on_conflict_do_nothing(index_elements=["face_id", "stock_platform", "stock_image_id"])
        .returning(AdIntelStockCandidate)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_stock_candidates_for_face(
    session: AsyncSession,
    face_id: UUID,
) -> list[dict]:
    """Get stock candidates for a face with embeddings.

    Parses pgvector string format into Python float lists.
    """
    result = await session.execute(
        text("""
            SELECT sc.id, sc.embedding::text, sc.stock_platform, sc.stock_image_id,
                   sc.similarity_score
            FROM ad_intel_stock_candidates sc
            WHERE sc.face_id = :face_id
              AND sc.embedding IS NOT NULL
            ORDER BY sc.similarity_score DESC NULLS LAST
        """),
        {"face_id": face_id},
    )
    rows = result.fetchall()
    results = []
    for row in rows:
        emb_str = row[1]
        if isinstance(emb_str, str) and emb_str:
            embedding = [float(x) for x in emb_str.strip("[]").split(",")]
        else:
            embedding = None
        results.append({
            "id": row[0],
            "embedding": embedding,
            "stock_platform": row[2],
            "stock_image_id": row[3],
            "similarity_score": row[4],
        })
    return results


# --- Match queries ---


async def insert_match(session: AsyncSession, **kwargs) -> AdIntelMatch | None:
    """Insert an ad_intel_matches row."""
    row = AdIntelMatch(**kwargs)
    session.add(row)
    await session.flush()
    return row


async def get_matches_for_review(
    session: AsyncSession,
    status: str = "pending",
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Get matches for review with joined ad and face info."""
    result = await session.execute(
        text("""
            SELECT m.id, m.match_type, m.similarity_score, m.confidence_tier,
                   m.ad_platform, m.advertiser_name, m.review_status,
                   m.created_at, m.reviewer_notes,
                   a.platform_ad_id, a.creative_url, a.ad_text,
                   f.description, f.face_index,
                   sc.stock_platform, sc.stock_image_url, sc.photographer
            FROM ad_intel_matches m
            JOIN ad_intel_faces f ON f.id = m.ad_face_id
            JOIN ad_intel_ads a ON a.id = f.ad_id
            LEFT JOIN ad_intel_stock_candidates sc ON sc.id = m.stock_candidate_id
            WHERE m.review_status = :status
            ORDER BY m.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"status": status, "limit": limit, "offset": offset},
    )
    rows = result.fetchall()
    return [
        {
            "id": row[0],
            "match_type": row[1],
            "similarity_score": row[2],
            "confidence_tier": row[3],
            "ad_platform": row[4],
            "advertiser_name": row[5],
            "review_status": row[6],
            "created_at": row[7],
            "reviewer_notes": row[8],
            "platform_ad_id": row[9],
            "creative_url": row[10],
            "ad_text": row[11],
            "face_description": row[12],
            "face_index": row[13],
            "stock_platform": row[14],
            "stock_image_url": row[15],
            "photographer": row[16],
        }
        for row in rows
    ]


async def update_match_review(
    session: AsyncSession,
    match_id: UUID,
    status: str,
    notes: str | None = None,
    reviewer_id: UUID | None = None,
) -> None:
    """Update match review status."""
    values: dict = {
        "review_status": status,
        "reviewed_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if notes is not None:
        values["reviewer_notes"] = notes
    if reviewer_id is not None:
        values["reviewed_by"] = reviewer_id
    await session.execute(
        update(AdIntelMatch).where(AdIntelMatch.id == match_id).values(**values)
    )


# --- Config queries ---


async def get_config(session: AsyncSession) -> dict:
    """Return all ad_intel_config rows as a dict of key -> value."""
    result = await session.execute(select(AdIntelConfig))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


async def get_config_value(session: AsyncSession, key: str):
    """Get a single config value by key."""
    result = await session.execute(
        select(AdIntelConfig.value).where(AdIntelConfig.key == key)
    )
    return result.scalar_one_or_none()


async def update_config(session: AsyncSession, key: str, value) -> None:
    """Upsert a config key/value."""
    stmt = (
        insert(AdIntelConfig)
        .values(key=key, value=value, updated_at=datetime.now(timezone.utc))
        .on_conflict_do_update(
            index_elements=["key"],
            set_={"value": value, "updated_at": datetime.now(timezone.utc)},
        )
    )
    await session.execute(stmt)


# --- Stats queries ---


async def get_stats(session: AsyncSession) -> dict:
    """Aggregate counts for the ad intel dashboard."""
    stats = {}

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_ads")
    )
    stats["total_ads"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_ads WHERE processing_status = 'pending'")
    )
    stats["pending_ads"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_ads WHERE processing_status = 'processed'")
    )
    stats["processed_ads"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_faces")
    )
    stats["total_faces"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_faces WHERE described = false")
    )
    stats["undescribed_faces"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_faces WHERE searched = false AND described = true")
    )
    stats["unsearched_faces"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_faces WHERE matched = false AND searched = true")
    )
    stats["unmatched_faces"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_stock_candidates")
    )
    stats["total_stock_candidates"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_matches")
    )
    stats["total_matches"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_matches WHERE review_status = 'pending'")
    )
    stats["pending_review"] = r.scalar_one()

    r = await session.execute(
        text("SELECT count(*) FROM ad_intel_matches WHERE review_status = 'confirmed'")
    )
    stats["confirmed_matches"] = r.scalar_one()

    return stats
