"""Deserialize pipeline stage fixtures from JSON files."""

import base64
import json
from pathlib import Path

import numpy as np

from src.discovery.base import DiscoveredImageResult, DiscoveryResult
from src.utils.logging import get_logger

log = get_logger("fixtures.loader")


def _deserialize_embedding(b64: str | None) -> np.ndarray | None:
    """Decode a base64-encoded float32 embedding back to numpy array."""
    if b64 is None:
        return None
    raw = base64.b64decode(b64)
    return np.frombuffer(raw, dtype=np.float32).copy()


def load_discovery_result(path: Path) -> DiscoveryResult:
    """Load a DiscoveryResult from a JSON fixture file."""
    data = json.loads(path.read_text())
    images = [
        DiscoveredImageResult(
            source_url=img["source_url"],
            page_url=img.get("page_url"),
            page_title=img.get("page_title"),
            platform=img.get("platform"),
            image_stored_url=img.get("image_stored_url"),
            search_term=img.get("search_term"),
        )
        for img in data.get("images", [])
    ]
    result = DiscoveryResult(
        images=images,
        next_cursor=data.get("next_cursor"),
        search_cursors=data.get("search_cursors"),
        model_cursors=data.get("model_cursors"),
        tags_total=data.get("tags_total", 0),
        tags_exhausted=data.get("tags_exhausted", 0),
        estimated_total_images=data.get("estimated_total_images"),
    )
    log.info("fixture_loaded", stage="fetch", path=str(path), images=len(images))
    return result


def load_detection_results(path: Path) -> list[dict]:
    """Load face detection results from a JSON fixture file.

    Returns list of dicts with numpy embeddings restored.
    """
    data = json.loads(path.read_text())
    results = []
    for item in data.get("results", []):
        faces = []
        for face in item.get("faces", []):
            faces.append({
                "index": face.get("index", 0),
                "embedding": _deserialize_embedding(face.get("embedding_b64")),
                "score": face.get("score", 0.0),
            })
        results.append({
            "source_url": item.get("source_url", ""),
            "has_face": item.get("has_face", False),
            "face_count": item.get("face_count", 0),
            "faces": faces,
        })
    log.info("fixture_loaded", stage="detect", path=str(path), results=len(results))
    return results


def load_match_input(path: Path) -> tuple[list[dict], list[dict]]:
    """Load match stage input (discovered + registry embeddings).

    Returns (discovered_list, registry_list) with numpy embeddings restored.
    """
    data = json.loads(path.read_text())
    discovered = [
        {
            "image_id": d.get("image_id", ""),
            "face_index": d.get("face_index", 0),
            "embedding": _deserialize_embedding(d.get("embedding_b64")),
        }
        for d in data.get("discovered", [])
    ]
    registry = [
        {
            "contributor_id": r.get("contributor_id", ""),
            "embedding": _deserialize_embedding(r.get("embedding_b64")),
        }
        for r in data.get("registry", [])
    ]
    log.info(
        "fixture_loaded", stage="match_input", path=str(path),
        discovered=len(discovered), registry=len(registry),
    )
    return discovered, registry


def load_match_results(path: Path) -> list[dict]:
    """Load match results from a JSON fixture file."""
    data = json.loads(path.read_text())
    results = data.get("results", [])
    log.info("fixture_loaded", stage="match", path=str(path), results=len(results))
    return results
