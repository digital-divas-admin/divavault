"""Embedding generation for detected faces in discovered images."""

import numpy as np

from src.matching.detector import DetectedFace
from src.utils.logging import get_logger

log = get_logger("embedder")


def get_face_embedding(face: DetectedFace) -> np.ndarray:
    """Get the 512-dim embedding for a detected face.

    InsightFace computes the embedding during detection (normed_embedding),
    so this is just extraction. The aligned_face field already holds
    the normed embedding vector.
    """
    embedding = face.aligned_face
    if embedding is None:
        raise ValueError("Face has no embedding (aligned_face is None)")

    # Ensure it's a proper 512-dim float32 vector
    embedding = np.asarray(embedding, dtype=np.float32).flatten()
    if embedding.shape[0] != 512:
        raise ValueError(f"Expected 512-dim embedding, got {embedding.shape[0]}")

    return embedding
