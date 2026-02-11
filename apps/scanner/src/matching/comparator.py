"""Cosine similarity matching against the contributor embedding registry."""

from uuid import UUID

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.queries import find_similar_embeddings
from src.utils.logging import get_logger

log = get_logger("comparator")


async def compare_against_registry(
    session: AsyncSession,
    query_embedding: np.ndarray,
    threshold: float | None = None,
    primary_only: bool = False,
    limit: int = 5,
) -> list[dict]:
    """Compare a face embedding against the full contributor registry.

    Args:
        session: Database session.
        query_embedding: 512-dim face embedding to match.
        threshold: Minimum similarity score. Defaults to MATCH_THRESHOLD_LOW.
        primary_only: If True, only compare against primary embeddings (free tier optimization).
        limit: Max results to return.

    Returns:
        List of match dicts with contributor_id, embedding_id, similarity.
    """
    if threshold is None:
        threshold = settings.match_threshold_low

    matches = await find_similar_embeddings(
        session,
        query_embedding=query_embedding,
        threshold=threshold,
        limit=limit,
        primary_only=primary_only,
    )

    if matches:
        log.info(
            "registry_matches_found",
            count=len(matches),
            top_similarity=matches[0]["similarity"] if matches else 0,
            primary_only=primary_only,
        )

    return matches


async def compare_against_contributor(
    session: AsyncSession,
    query_embedding: np.ndarray,
    contributor_id: UUID,
    threshold: float | None = None,
) -> dict | None:
    """Compare a face embedding against a specific contributor's embeddings.

    Used for reverse image search results where we know which contributor to check first.

    Returns:
        Best match dict or None.
    """
    if threshold is None:
        threshold = settings.match_threshold_low

    # Get all matches and filter for this contributor
    matches = await find_similar_embeddings(
        session,
        query_embedding=query_embedding,
        threshold=threshold,
        limit=50,
        primary_only=False,
    )

    # Filter to specific contributor
    contributor_matches = [m for m in matches if m["contributor_id"] == contributor_id]

    if contributor_matches:
        # Return best match
        return max(contributor_matches, key=lambda m: m["similarity"])

    return None
