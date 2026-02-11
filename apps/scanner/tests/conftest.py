"""Shared test fixtures for the scanner test suite."""

import asyncio
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import numpy as np
import pytest

# Test fixtures directory
FIXTURES_DIR = Path(__file__).parent / "fixtures"
IMAGES_DIR = FIXTURES_DIR / "images"
EMBEDDINGS_DIR = FIXTURES_DIR / "embeddings"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_embedding_alice():
    """A deterministic 512-dim embedding representing 'Alice'."""
    rng = np.random.RandomState(42)
    emb = rng.randn(512).astype(np.float32)
    emb /= np.linalg.norm(emb)
    return emb


@pytest.fixture
def sample_embedding_alice_angled():
    """A slightly different embedding for 'Alice' (different angle).
    Should have high similarity (>0.70) with sample_embedding_alice."""
    rng = np.random.RandomState(42)
    base = rng.randn(512).astype(np.float32)
    # Add small perturbation
    rng2 = np.random.RandomState(43)
    noise = rng2.randn(512).astype(np.float32) * 0.15
    emb = base + noise
    emb /= np.linalg.norm(emb)
    return emb


@pytest.fixture
def sample_embedding_bob():
    """A 512-dim embedding representing 'Bob' (different person).
    Should have low similarity (<0.50) with Alice embeddings."""
    rng = np.random.RandomState(999)
    emb = rng.randn(512).astype(np.float32)
    emb /= np.linalg.norm(emb)
    return emb


@pytest.fixture
def sample_contributor_id():
    return uuid4()


@pytest.fixture
def sample_match_id():
    return uuid4()


@pytest.fixture
def sample_discovered_image_id():
    return uuid4()


@pytest.fixture
def sample_known_accounts():
    """Sample known accounts for allowlist testing."""
    return [
        {
            "id": uuid4(),
            "platform": "instagram",
            "handle": "alice_creates",
            "domain": "instagram.com",
        },
        {
            "id": uuid4(),
            "platform": "twitter",
            "handle": "alice_art",
            "domain": "twitter.com",
        },
        {
            "id": uuid4(),
            "platform": "personal_website",
            "handle": None,
            "domain": "alicecreates.com",
        },
    ]


@pytest.fixture
def mock_settings():
    """Mock settings with test values."""
    with patch("src.config.settings") as mock:
        mock.match_threshold_low = 0.50
        mock.match_threshold_medium = 0.65
        mock.match_threshold_high = 0.85
        mock.supabase_url = "https://test.supabase.co"
        mock.supabase_service_role_key = "test-key"
        mock.tineye_api_key = "test-tineye-key"
        mock.hive_api_key = "test-hive-key"
        mock.s3_endpoint_url = "http://localhost:9000"
        mock.s3_access_key_id = "minioadmin"
        mock.s3_secret_access_key = "minioadmin"
        mock.s3_bucket_name = "test-evidence"
        mock.insightface_model = "buffalo_sc"
        mock.temp_dir = "/tmp/scanner_test"
        mock.scan_batch_size = 10
        mock.scheduler_tick_seconds = 1
        mock.ingest_poll_seconds = 1
        mock.log_level = "DEBUG"
        mock.database_url = "postgresql+asyncpg://postgres:postgres@localhost:5433/postgres"
        yield mock


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors. Utility for tests."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def log_similarity(name: str, score: float):
    """Log a similarity score for threshold tuning analysis."""
    print(f"SIMILARITY [{name}]: {score:.6f}")
