"""Cross-matching between ad faces, stock candidates, and contributor registry."""

from uuid import UUID

import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.ad_intelligence.queries import (
    get_stock_candidates_for_face,
    insert_match,
)
from src.matching.comparator import compare_against_registry
from src.matching.confidence import get_confidence_tier
from src.utils.logging import get_logger

log = get_logger("cross_matcher")


async def cross_match_face(
    session: AsyncSession,
    face_id: UUID,
    face_embedding: list[float] | np.ndarray,
    config: dict,
) -> int:
    """Cross-match a face against stock candidates and contributor registry.

    Path 1: Compare face embedding vs stock candidates' embeddings (cosine similarity).
    Path 2: Compare face embedding vs contributor registry.

    Args:
        session: Database session.
        face_id: Ad intel face ID.
        face_embedding: 512-dim face embedding.
        config: Ad intel config dict.

    Returns:
        Count of matches found.
    """
    if isinstance(face_embedding, list):
        face_embedding = np.array(face_embedding, dtype=np.float32)

    matches_found = 0

    # Get the ad info for this face
    ad_info = await session.execute(
        text("""
            SELECT a.platform, a.advertiser_name
            FROM ad_intel_faces f
            JOIN ad_intel_ads a ON a.id = f.ad_id
            WHERE f.id = :face_id
        """),
        {"face_id": face_id},
    )
    ad_row = ad_info.first()
    ad_platform = ad_row[0] if ad_row else None
    advertiser_name = ad_row[1] if ad_row else None

    # Path 1: Compare face vs stock candidates
    stock_threshold = config.get("stock_match_threshold", 0.60)
    candidates = await get_stock_candidates_for_face(session, face_id)

    for candidate in candidates:
        if candidate["embedding"] is None:
            continue

        candidate_emb = np.array(candidate["embedding"], dtype=np.float32)

        # Cosine similarity
        dot = np.dot(face_embedding, candidate_emb)
        norm_a = np.linalg.norm(face_embedding)
        norm_b = np.linalg.norm(candidate_emb)
        if norm_a == 0 or norm_b == 0:
            continue
        similarity = float(dot / (norm_a * norm_b))

        if similarity < stock_threshold:
            continue

        confidence = get_confidence_tier(similarity)
        if confidence is None:
            continue

        match = await insert_match(
            session,
            ad_face_id=face_id,
            stock_candidate_id=candidate["id"],
            match_type="stock_to_ad",
            similarity_score=similarity,
            confidence_tier=confidence,
            ad_platform=ad_platform,
            advertiser_name=advertiser_name,
        )
        if match:
            matches_found += 1
            log.info(
                "stock_match_found",
                face_id=str(face_id),
                stock_platform=candidate["stock_platform"],
                similarity=round(similarity, 4),
                confidence=confidence,
            )

    # Path 2: Compare face vs contributor registry
    registry_matches = await compare_against_registry(
        session, face_embedding, primary_only=False,
    )

    for m in registry_matches:
        confidence = get_confidence_tier(m["similarity"])
        if confidence is None:
            continue

        match = await insert_match(
            session,
            ad_face_id=face_id,
            contributor_id=m["contributor_id"],
            match_type="contributor_to_ad",
            similarity_score=m["similarity"],
            confidence_tier=confidence,
            ad_platform=ad_platform,
            advertiser_name=advertiser_name,
        )
        if match:
            matches_found += 1
            log.info(
                "contributor_match_found",
                face_id=str(face_id),
                contributor_id=str(m["contributor_id"]),
                similarity=round(m["similarity"], 4),
                confidence=confidence,
            )

    return matches_found
