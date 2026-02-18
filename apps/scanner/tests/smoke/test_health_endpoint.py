"""Smoke test: health endpoint returns valid JSON."""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_health_endpoint_returns_json():
    """Health endpoint should return status and metrics."""
    from httpx import ASGITransport, AsyncClient

    mock_metrics = {
        "embeddings_pending": 0,
        "embeddings_processed_24h": 0,
        "embeddings_failed_24h": 0,
        "scans_completed_24h": 0,
        "scans_failed_24h": 0,
        "images_discovered_24h": 0,
        "images_with_faces_24h": 0,
        "matches_found_24h": 0,
        "matches_known_account_24h": 0,
        "matches_unauthorized_24h": 0,
        "evidence_captured_24h": 0,
        "contributors_in_registry": 0,
        "total_embeddings": 0,
    }

    mock_test_user_stats = {
        "seeded": 0,
        "honeypots": 0,
        "synthetic": 0,
        "honeypot_detection_rate": None,
    }

    with (
        patch("src.main.init_model"),
        patch("src.main.run_scheduler", new_callable=AsyncMock),
        patch("src.main.get_scanner_metrics", new_callable=AsyncMock, return_value=mock_metrics),
        patch("src.main.get_test_user_stats", new_callable=AsyncMock, return_value=mock_test_user_stats),
        patch("src.main.dispose_engine", new_callable=AsyncMock),
        patch("src.main.shutdown_browser", new_callable=AsyncMock),
    ):
        from src.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert "uptime_seconds" in data
        assert "metrics" in data
        assert "test_users" in data


@pytest.mark.asyncio
async def test_health_endpoint_handles_db_error():
    """Health endpoint should handle database errors gracefully."""
    from httpx import ASGITransport, AsyncClient

    with (
        patch("src.main.init_model"),
        patch("src.main.run_scheduler", new_callable=AsyncMock),
        patch(
            "src.main.get_scanner_metrics",
            new_callable=AsyncMock,
            side_effect=Exception("DB connection failed"),
        ),
        patch("src.main.dispose_engine", new_callable=AsyncMock),
        patch("src.main.shutdown_browser", new_callable=AsyncMock),
    ):
        from src.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert "error" in data["metrics"]
