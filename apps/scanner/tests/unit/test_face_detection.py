"""Test face detection on various image types."""

import numpy as np
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch


class TestDetectFaces:
    def test_empty_image_no_faces(self, tmp_path):
        """Blank image should have no faces."""
        import cv2
        from src.matching.detector import detect_faces

        img = np.zeros((200, 200, 3), dtype=np.uint8)
        path = tmp_path / "blank.jpg"
        cv2.imwrite(str(path), img)

        mock_model = MagicMock()
        mock_model.get.return_value = []

        with patch("src.matching.detector.get_model", return_value=mock_model):
            faces = detect_faces(path)
            assert len(faces) == 0

    def test_face_detected(self, tmp_path):
        """Image with a face should return DetectedFace objects."""
        import cv2
        from src.matching.detector import detect_faces

        img = np.zeros((200, 200, 3), dtype=np.uint8)
        path = tmp_path / "face.jpg"
        cv2.imwrite(str(path), img)

        mock_face = MagicMock()
        mock_face.bbox = np.array([10, 10, 100, 100])
        mock_face.det_score = 0.95
        mock_face.normed_embedding = np.random.randn(512).astype(np.float32)

        mock_model = MagicMock()
        mock_model.get.return_value = [mock_face]

        with patch("src.matching.detector.get_model", return_value=mock_model):
            faces = detect_faces(path)
            assert len(faces) == 1
            assert faces[0].detection_score == 0.95

    def test_corrupt_image_returns_empty(self, tmp_path):
        """Corrupt image should return empty list, not crash."""
        from src.matching.detector import detect_faces

        path = tmp_path / "corrupt.jpg"
        path.write_bytes(b"corrupted data")

        faces = detect_faces(path)
        assert faces == []

    def test_nonexistent_file_returns_empty(self, tmp_path):
        """Nonexistent file should return empty list."""
        from src.matching.detector import detect_faces

        faces = detect_faces(tmp_path / "does_not_exist.jpg")
        assert faces == []
