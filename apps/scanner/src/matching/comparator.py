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


def batch_compare_local(
    query_matrix: np.ndarray,
    ref_matrix: np.ndarray,
    registry_entries: list[dict],
    threshold: float,
    ref_normalized: bool = False,
) -> dict[int, list[dict]]:
    """Compare N query embeddings against M reference embeddings locally via numpy.

    Args:
        query_matrix: (N, 512) query embeddings.
        ref_matrix: (M, 512) reference embeddings (pre-built from registry_entries).
        registry_entries: List of registry dicts with contributor_id, source, id, is_primary.
        threshold: Minimum cosine similarity to report.
        ref_normalized: If True, skip L2-normalizing ref_matrix (caller already did it).

    Returns:
        Dict mapping query index → list of hit dicts (source, contributor_id, similarity, etc.)
    """
    if query_matrix.shape[0] == 0 or ref_matrix.shape[0] == 0:
        return {}

    # L2-normalize query embeddings (ArcFace should already be normalized)
    q_norms = np.linalg.norm(query_matrix, axis=1, keepdims=True)
    q_norms = np.where(q_norms == 0, 1, q_norms)
    query_normed = query_matrix / q_norms

    if ref_normalized:
        ref_normed = ref_matrix
    else:
        r_norms = np.linalg.norm(ref_matrix, axis=1, keepdims=True)
        r_norms = np.where(r_norms == 0, 1, r_norms)
        ref_normed = ref_matrix / r_norms

    # (N, M) cosine similarity matrix — single numpy op
    similarities = query_normed @ ref_normed.T

    hits: dict[int, list[dict]] = {}
    # Find indices where similarity exceeds threshold
    query_indices, ref_indices = np.where(similarities > threshold)
    for qi, ri in zip(query_indices, ref_indices):
        qi_int = int(qi)
        entry = registry_entries[int(ri)]
        sim = float(similarities[qi_int, int(ri)])
        hit = {
            "source": entry["source"],
            "contributor_id": entry["contributor_id"],
            "similarity": sim,
            "embedding_id": entry.get("id"),
            "is_primary": entry.get("is_primary", False),
        }
        hits.setdefault(qi_int, []).append(hit)

    return hits
