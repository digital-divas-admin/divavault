"""Integration test: end-to-end pipeline from pending image to notification.

Requires PostgreSQL (via docker-compose).
"""

import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.config import TIER_CONFIG


@pytest.mark.asyncio
class TestFullPipeline:
    """Test the full matching pipeline with mocked external services."""

    async def test_pending_image_to_embedding(self):
        """Verify that a pending image can be processed into an embedding."""
        # This is a conceptual test — full integration requires a running DB
        from src.ingest.embeddings import _detect_and_embed

        # Mock the face model
        mock_face = MagicMock()
        mock_face.normed_embedding = np.random.randn(512).astype(np.float32)
        mock_face.det_score = 0.92

        mock_model = MagicMock()
        mock_model.get.return_value = [mock_face]

        import tempfile
        from pathlib import Path
        import cv2

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a test image
            img = np.zeros((300, 300, 3), dtype=np.uint8)
            path = Path(tmpdir) / "test.jpg"
            cv2.imwrite(str(path), img)

            with patch("src.ingest.embeddings.get_model", return_value=mock_model):
                result = _detect_and_embed(path)

            assert result is not None
            assert isinstance(result, tuple)
            embedding, score = result
            assert embedding.shape == (512,)
            assert 0 < score <= 1.0

    async def test_match_pipeline_stores_known_account(self):
        """A match from a known account should be flagged correctly."""
        from src.matching.confidence import should_notify, should_capture_evidence

        tier_config = TIER_CONFIG["protected"]

        # Known account match
        assert should_notify("high", True, tier_config) is False
        assert should_capture_evidence("high", True, tier_config) is False

    async def test_match_pipeline_processes_unknown(self):
        """A match from an unknown source should trigger notifications."""
        from src.matching.confidence import should_notify, should_capture_evidence

        tier_config = TIER_CONFIG["protected"]

        assert should_notify("high", False, tier_config) is True
        assert should_capture_evidence("high", False, tier_config) is True

    async def test_free_tier_no_evidence(self):
        """Free tier matches should store but not capture evidence."""
        from src.matching.confidence import (
            should_capture_evidence,
            should_run_ai_detection,
        )

        tier_config = TIER_CONFIG["free"]

        assert should_capture_evidence("high", False, tier_config) is False
        assert should_run_ai_detection("high", False, tier_config) is False
