"""Run individual pipeline stages in isolation using fixture files.

Usage:
  python scripts/run_stage.py detect --input fixtures/reddit_sample/fetch.json --output fixtures/reddit_sample/detect.json
  python scripts/run_stage.py match --input fixtures/reddit_sample/detect.json --output fixtures/reddit_sample/match.json
"""

import os
import sys

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SCANNER_ROOT)
sys.path.insert(0, SCANNER_ROOT)

import argparse
import asyncio
import time
from pathlib import Path

from src.utils.logging import get_logger, setup_logging

setup_logging()
log = get_logger("run_stage")


async def run_detect(input_path: Path, output_path: Path) -> None:
    """Run face detection on images from a fetch fixture."""
    from src.fixtures.loader import load_discovery_result
    from src.fixtures.dumper import dump_detection_results
    from src.ingest.embeddings import init_model, get_model
    from src.utils.image_download import load_and_resize

    import aiohttp
    import tempfile

    result = load_discovery_result(input_path)
    print(f"Loaded {len(result.images)} images from fixture")

    print("Loading InsightFace model...")
    init_model()
    model = get_model()
    print("Model loaded.")

    detection_results = []
    temp_dir = Path(tempfile.gettempdir()) / "scanner_stage_detect"
    temp_dir.mkdir(parents=True, exist_ok=True)

    connector = aiohttp.TCPConnector(limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i, img in enumerate(result.images):
            try:
                # Download image
                async with session.get(
                    img.source_url,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status != 200:
                        detection_results.append({
                            "source_url": img.source_url,
                            "has_face": False,
                            "face_count": 0,
                            "faces": [],
                        })
                        continue
                    data = await resp.read()

                # Save temp file
                temp_path = temp_dir / f"{i:06d}.jpg"
                temp_path.write_bytes(data)

                # Run detection
                cv_img = load_and_resize(temp_path)
                if cv_img is None:
                    detection_results.append({
                        "source_url": img.source_url,
                        "has_face": False,
                        "face_count": 0,
                        "faces": [],
                    })
                    temp_path.unlink(missing_ok=True)
                    continue

                faces = model.get(cv_img)
                face_list = [
                    {
                        "index": fi,
                        "embedding": face.normed_embedding,
                        "score": float(face.det_score),
                    }
                    for fi, face in enumerate(faces)
                ]

                detection_results.append({
                    "source_url": img.source_url,
                    "has_face": len(faces) > 0,
                    "face_count": len(faces),
                    "faces": face_list,
                })

                temp_path.unlink(missing_ok=True)

            except Exception as e:
                log.warning("detect_stage_error", url=img.source_url[:100], error=repr(e))
                detection_results.append({
                    "source_url": img.source_url,
                    "has_face": False,
                    "face_count": 0,
                    "faces": [],
                })

            if (i + 1) % 50 == 0:
                faces_found = sum(r["face_count"] for r in detection_results)
                print(f"  Processed {i + 1}/{len(result.images)} | Faces: {faces_found}")

    dump_detection_results(detection_results, output_path)
    total_faces = sum(r["face_count"] for r in detection_results)
    face_positive = sum(1 for r in detection_results if r["has_face"])
    print(f"\nDetection complete:")
    print(f"  Images processed: {len(detection_results)}")
    print(f"  Face-positive: {face_positive}")
    print(f"  Total faces: {total_faces}")
    print(f"  Output: {output_path}")


async def run_match(input_path: Path, output_path: Path) -> None:
    """Run matching on detection results against registry embeddings."""
    from src.fixtures.loader import load_detection_results
    from src.fixtures.dumper import dump_match_results
    from src.matching.confidence import get_confidence_tier

    import numpy as np

    detection_results = load_detection_results(input_path)
    print(f"Loaded {len(detection_results)} detection results")

    # Load registry embeddings from DB
    from sqlalchemy import text
    from src.db.connection import async_session

    registry = []
    async with async_session() as session:
        r = await session.execute(text("""
            SELECT contributor_id, embedding::text
            FROM contributor_embeddings
            WHERE is_primary = true
        """))
        for row in r.fetchall():
            emb = np.array([float(x) for x in row[1].strip("[]").split(",")])
            registry.append({
                "contributor_id": str(row[0]),
                "embedding": emb,
            })

    if not registry:
        print("No registry embeddings found in DB. Nothing to match against.")
        dump_match_results([], output_path)
        return

    print(f"Loaded {len(registry)} registry embeddings")

    # Run matching
    match_results = []
    for det in detection_results:
        if not det["has_face"]:
            continue
        for face in det["faces"]:
            emb = face.get("embedding")
            if emb is None:
                continue
            # Compare against each registry embedding
            for reg in registry:
                reg_emb = reg["embedding"]
                # Cosine similarity
                dot = np.dot(emb, reg_emb)
                norm_a = np.linalg.norm(emb)
                norm_b = np.linalg.norm(reg_emb)
                if norm_a == 0 or norm_b == 0:
                    continue
                similarity = float(dot / (norm_a * norm_b))
                tier = get_confidence_tier(similarity)
                if tier is not None:
                    match_results.append({
                        "image_id": det["source_url"],  # Use source_url as ID for fixtures
                        "contributor_id": reg["contributor_id"],
                        "similarity": similarity,
                        "tier": tier,
                    })

    dump_match_results(match_results, output_path)
    print(f"\nMatching complete:")
    print(f"  Detection inputs: {len(detection_results)}")
    print(f"  Face-positive: {sum(1 for d in detection_results if d['has_face'])}")
    print(f"  Registry embeddings: {len(registry)}")
    print(f"  Matches found: {len(match_results)}")
    print(f"  Output: {output_path}")


async def main():
    parser = argparse.ArgumentParser(
        description="Run individual pipeline stages using fixture files"
    )
    parser.add_argument(
        "stage",
        choices=["detect", "match"],
        help="Pipeline stage to run",
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        required=True,
        help="Input fixture file path",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        required=True,
        help="Output fixture file path",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}")
        sys.exit(1)

    start = time.monotonic()

    if args.stage == "detect":
        await run_detect(input_path, output_path)
    elif args.stage == "match":
        await run_match(input_path, output_path)

    elapsed = time.monotonic() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    except Exception as e:
        log.error("fatal_error", error=repr(e))
        import traceback
        traceback.print_exc()
        sys.exit(1)
