"""Test ingest pipeline embedding generation and status transitions."""

import numpy as np
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch


class TestDetectAndEmbed:
    """Test the _detect_and_embed function with mocked InsightFace."""

    def test_no_face_returns_none(self, tmp_path):
        """Image with no face should return None."""
        from src.ingest.embeddings import _detect_and_embed

        # Create a dummy image
        import cv2
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        path = tmp_path / "no_face.jpg"
        cv2.imwrite(str(path), img)

        mock_model = MagicMock()
        mock_model.get.return_value = []

        with patch("src.ingest.embeddings.get_model", return_value=mock_model):
            result = _detect_and_embed(path)
            assert result is None

    def test_single_face_returns_embedding(self, tmp_path):
        """Image with one face should return (embedding, score)."""
        from src.ingest.embeddings import _detect_and_embed

        import cv2
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        path = tmp_path / "face.jpg"
        cv2.imwrite(str(path), img)

        mock_face = MagicMock()
        mock_face.normed_embedding = np.random.randn(512).astype(np.float32)
        mock_face.det_score = 0.95

        mock_model = MagicMock()
        mock_model.get.return_value = [mock_face]

        with patch("src.ingest.embeddings.get_model", return_value=mock_model):
            result = _detect_and_embed(path)
            assert isinstance(result, tuple)
            embedding, score = result
            assert embedding.shape == (512,)
            assert score == 0.95

    def test_multiple_faces_returns_string(self, tmp_path):
        """Image with multiple faces should return 'multiple_faces'."""
        from src.ingest.embeddings import _detect_and_embed

        import cv2
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        path = tmp_path / "multi.jpg"
        cv2.imwrite(str(path), img)

        mock_face1 = MagicMock()
        mock_face2 = MagicMock()

        mock_model = MagicMock()
        mock_model.get.return_value = [mock_face1, mock_face2]

        with patch("src.ingest.embeddings.get_model", return_value=mock_model):
            result = _detect_and_embed(path)
            assert result == "multiple_faces"

    def test_corrupt_image_returns_none(self, tmp_path):
        """Corrupt/unreadable image should return None."""
        from src.ingest.embeddings import _detect_and_embed

        path = tmp_path / "corrupt.jpg"
        path.write_bytes(b"not an image")

        result = _detect_and_embed(path)
        assert result is None
