"""Face detection on discovered images.

Thin wrapper around the active FaceDetectionProvider.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np


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
    from src.providers import get_face_detection_provider

    return get_face_detection_provider().detect(image_path)


def get_face_count(image_path: Path) -> tuple[bool, int]:
    """Quick check: does an image have faces? Returns (has_face, face_count)."""
    faces = detect_faces(image_path)
    return len(faces) > 0, len(faces)
