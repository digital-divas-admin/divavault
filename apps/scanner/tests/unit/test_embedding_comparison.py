"""Test embedding comparison accuracy with deterministic fixtures."""

import numpy as np
import pytest

from tests.conftest import cosine_similarity, log_similarity


class TestEmbeddingComparison:
    """Verify that cosine similarity behaves correctly for face matching."""

    def test_same_person_different_angle_high_similarity(
        self, sample_embedding_alice, sample_embedding_alice_angled
    ):
        """Same person, different photos should have similarity > 0.70."""
        score = cosine_similarity(sample_embedding_alice, sample_embedding_alice_angled)
        log_similarity("alice_frontal_vs_angled", score)
        assert score > 0.70, f"Same person similarity {score} should be > 0.70"

    def test_different_people_low_similarity(
        self, sample_embedding_alice, sample_embedding_bob
    ):
        """Different people should have similarity < 0.50."""
        score = cosine_similarity(sample_embedding_alice, sample_embedding_bob)
        log_similarity("alice_vs_bob", score)
        assert score < 0.50, f"Different person similarity {score} should be < 0.50"

    def test_identical_embeddings_score_one(self, sample_embedding_alice):
        """Same embedding compared to itself should score 1.0."""
        score = cosine_similarity(sample_embedding_alice, sample_embedding_alice)
        assert abs(score - 1.0) < 1e-6

    def test_embedding_dimension(self, sample_embedding_alice):
        """Embeddings must be 512-dimensional."""
        assert sample_embedding_alice.shape == (512,)

    def test_embedding_normalized(self, sample_embedding_alice):
        """Embeddings should be L2-normalized."""
        norm = np.linalg.norm(sample_embedding_alice)
        assert abs(norm - 1.0) < 1e-6

    def test_orthogonal_embeddings_zero_similarity(self):
        """Orthogonal vectors should have ~0 similarity."""
        a = np.zeros(512, dtype=np.float32)
        b = np.zeros(512, dtype=np.float32)
        a[0] = 1.0
        b[1] = 1.0
        score = cosine_similarity(a, b)
        assert abs(score) < 1e-6

    def test_opposite_embeddings_negative_similarity(self):
        """Opposite vectors should have similarity of -1."""
        a = np.ones(512, dtype=np.float32)
        a /= np.linalg.norm(a)
        b = -a
        score = cosine_similarity(a, b)
        assert abs(score - (-1.0)) < 1e-6
