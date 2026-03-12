"""Serialize pipeline stage outputs to JSON files for offline testing."""

import base64
import json
from pathlib import Path
from typing import Any

import numpy as np

from src.utils.logging import get_logger

log = get_logger("fixtures.dumper")


def _serialize_embedding(emb: np.ndarray) -> str:
    """Encode a numpy embedding as base64 string (compact, portable)."""
    return base64.b64encode(emb.astype(np.float32).tobytes()).decode("ascii")


def dump_discovery_result(result, path: Path) -> None:
    """Serialize a DiscoveryResult to JSON.

    Args:
        result: DiscoveryResult from a crawler's discover() method
        path: Output JSON file path
    """
    data = {
        "stage": "fetch",
        "next_cursor": result.next_cursor,
        "search_cursors": result.search_cursors,
        "model_cursors": result.model_cursors,
        "tags_total": result.tags_total,
        "tags_exhausted": result.tags_exhausted,
        "estimated_total_images": result.estimated_total_images,
        "images": [
            {
                "source_url": img.source_url,
                "page_url": img.page_url,
                "page_title": img.page_title,
                "platform": img.platform,
                "image_stored_url": img.image_stored_url,
                "search_term": img.search_term,
            }
            for img in result.images
        ],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    log.info("fixture_dumped", stage="fetch", path=str(path), images=len(data["images"]))


def dump_detection_results(results: list[dict], path: Path) -> None:
    """Serialize face detection results to JSON with base64 embeddings.

    Expected input format per item:
        {
            "source_url": str,
            "has_face": bool,
            "face_count": int,
            "faces": [{"index": int, "embedding": np.ndarray, "score": float}]
        }
    """
    serialized = []
    for item in results:
        faces = []
        for face in item.get("faces", []):
            emb = face.get("embedding")
            faces.append({
                "index": face.get("index", 0),
                "embedding_b64": _serialize_embedding(emb) if emb is not None else None,
                "score": face.get("score", 0.0),
            })
        serialized.append({
            "source_url": item.get("source_url", ""),
            "has_face": item.get("has_face", False),
            "face_count": item.get("face_count", 0),
            "faces": faces,
        })

    data = {"stage": "detect", "results": serialized}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    log.info("fixture_dumped", stage="detect", path=str(path), results=len(serialized))


def dump_match_input(discovered: list[dict], registry: list[dict], path: Path) -> None:
    """Serialize match stage input (discovered + registry embeddings).

    discovered items: {"image_id": str, "face_index": int, "embedding": np.ndarray}
    registry items: {"contributor_id": str, "embedding": np.ndarray}
    """
    data = {
        "stage": "match_input",
        "discovered": [
            {
                "image_id": str(d.get("image_id", "")),
                "face_index": d.get("face_index", 0),
                "embedding_b64": _serialize_embedding(d["embedding"]) if d.get("embedding") is not None else None,
            }
            for d in discovered
        ],
        "registry": [
            {
                "contributor_id": str(r.get("contributor_id", "")),
                "embedding_b64": _serialize_embedding(r["embedding"]) if r.get("embedding") is not None else None,
            }
            for r in registry
        ],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    log.info("fixture_dumped", stage="match_input", path=str(path),
             discovered=len(data["discovered"]), registry=len(data["registry"]))


def dump_match_results(results: list[dict], path: Path) -> None:
    """Serialize match results to JSON."""
    data = {
        "stage": "match",
        "results": [
            {
                "image_id": str(r.get("image_id", "")),
                "contributor_id": str(r.get("contributor_id", "")),
                "similarity": r.get("similarity", 0.0),
                "tier": r.get("tier", ""),
            }
            for r in results
        ],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    log.info("fixture_dumped", stage="match", path=str(path), results=len(data["results"]))
