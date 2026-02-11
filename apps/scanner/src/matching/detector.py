"""Face detection on discovered images using the shared InsightFace model."""

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from src.ingest.embeddings import get_model
from src.utils.image_download import load_and_resize
from src.utils.logging import get_logger

log = get_logger("detector")


@dataclass
class DetectedFace:
    """A face detected in an image."""

    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    detection_score: float
    aligned_face: np.ndarray  # Aligned face crop for embedding


def detect_faces(image_path: Path) -> list[DetectedFace]:
    """Detect all faces in an image.

    Args:
        image_path: Path to the image file on disk.

    Returns:
        List of DetectedFace objects. Empty list if no faces found or image unreadable.
    """
    img = load_and_resize(image_path)
    if img is None:
        return []

    try:
        model = get_model()
        faces = model.get(img)
    except Exception as e:
        log.error("face_detection_error", path=str(image_path), error=str(e))
        return []

    results = []
    for face in faces:
        bbox = face.bbox.astype(int)
        results.append(
            DetectedFace(
                bbox=(int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])),
                detection_score=float(face.det_score),
                aligned_face=face.normed_embedding,  # Pre-computed aligned embedding
            )
        )

    return results


def get_face_count(image_path: Path) -> tuple[bool, int]:
    """Quick check: does an image have faces? Returns (has_face, face_count)."""
    faces = detect_faces(image_path)
    return len(faces) > 0, len(faces)
