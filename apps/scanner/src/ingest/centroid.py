"""Centroid embedding computation for contributors with multiple face embeddings.

When a contributor has >= 3 single embeddings, computes a quality-weighted
centroid that becomes the new primary embedding for matching. This is more
robust than using a single best-detection-score embedding.
"""

from datetime import datetime, timezone
from uuid import UUID

import numpy as np
from sqlalchemy import delete, select, update

from src.db.models import ContributorEmbedding
from src.utils.logging import get_logger

log = get_logger("centroid")

# Minimum single embeddings required before computing a centroid
MIN_EMBEDDINGS = 3

# Cosine similarity threshold for outlier rejection
OUTLIER_SIMILARITY_THRESHOLD = 0.50


async def compute_centroid_embedding(session, contributor_id: UUID) -> bool:
    """Compute a quality-weighted centroid embedding for a contributor.

    Algorithm:
    1. Fetch all single embeddings for the contributor
    2. If < 3, skip (single primary is fine)
    3. Compute quality-weighted mean, L2-normalize
    4. Outlier rejection: drop embeddings with cosine sim < 0.50 to centroid
       (keep all if too many rejected)
    5. Recompute weighted centroid from kept embeddings, L2-normalize
    6. Clear is_primary on all existing embeddings
    7. Delete any existing centroid row
    8. Insert new centroid row as primary

    Returns True if centroid was created, False if skipped.
    """
    # 1. Fetch all single embeddings
    result = await session.execute(
        select(ContributorEmbedding)
        .where(
            ContributorEmbedding.contributor_id == contributor_id,
            ContributorEmbedding.embedding_type == "single",
        )
    )
    singles = list(result.scalars().all())

    # 2. Skip if not enough embeddings
    if len(singles) < MIN_EMBEDDINGS:
        return False

    # Parse embeddings and scores into numpy arrays
    embeddings = []
    scores = []
    for emb in singles:
        vec = np.array(emb.embedding, dtype=np.float64)
        embeddings.append(vec)
        # Use detection_score as weight; default to 0.5 if missing
        scores.append(emb.detection_score if emb.detection_score is not None else 0.5)

    embeddings = np.array(embeddings)  # shape: (N, 512)
    scores = np.array(scores, dtype=np.float64)

    # 3. Compute quality-weighted mean centroid
    weighted_sum = np.sum(scores[:, np.newaxis] * embeddings, axis=0)
    centroid = weighted_sum / np.sum(scores)
    # L2-normalize
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm

    # 4. Outlier rejection: cosine similarity of each embedding to centroid
    similarities = embeddings @ centroid  # dot product (embeddings are already normalized)
    keep_mask = similarities >= OUTLIER_SIMILARITY_THRESHOLD
    kept_count = int(np.sum(keep_mask))

    # If too many rejected (< MIN_EMBEDDINGS remaining), keep all
    if kept_count < MIN_EMBEDDINGS:
        keep_mask = np.ones(len(singles), dtype=bool)
        kept_count = len(singles)
        outliers_rejected = 0
    else:
        outliers_rejected = len(singles) - kept_count

    # 5. Recompute weighted centroid from kept embeddings
    kept_embeddings = embeddings[keep_mask]
    kept_scores = scores[keep_mask]
    weighted_sum = np.sum(kept_scores[:, np.newaxis] * kept_embeddings, axis=0)
    centroid = weighted_sum / np.sum(kept_scores)
    # L2-normalize
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm

    avg_detection_score = float(np.mean(kept_scores))

    # 6. Clear is_primary on all existing embeddings for this contributor
    await session.execute(
        update(ContributorEmbedding)
        .where(
            ContributorEmbedding.contributor_id == contributor_id,
            ContributorEmbedding.is_primary == True,  # noqa: E712
        )
        .values(is_primary=False)
    )

    # 7. Delete any existing centroid row
    await session.execute(
        delete(ContributorEmbedding)
        .where(
            ContributorEmbedding.contributor_id == contributor_id,
            ContributorEmbedding.embedding_type == "centroid",
        )
    )

    # 8. Insert new centroid row
    centroid_row = ContributorEmbedding(
        contributor_id=contributor_id,
        source_image_id=None,
        source_upload_id=None,
        embedding=centroid.tolist(),
        detection_score=avg_detection_score,
        is_primary=True,
        embedding_type="centroid",
        centroid_metadata={
            "embeddings_used": kept_count,
            "embeddings_total": len(singles),
            "outliers_rejected": outliers_rejected,
            "avg_detection_score": round(avg_detection_score, 4),
            "computed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    session.add(centroid_row)
    await session.flush()

    log.info(
        "centroid_computed",
        contributor_id=str(contributor_id),
        embeddings_used=kept_count,
        embeddings_total=len(singles),
        outliers_rejected=outliers_rejected,
        avg_detection_score=round(avg_detection_score, 4),
    )

    return True
