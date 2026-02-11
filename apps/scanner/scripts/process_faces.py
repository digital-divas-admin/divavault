"""Process unprocessed discovered images for face detection.

Uses subprocess isolation — processes images in chunks in child
processes that exit completely, releasing all memory. Fully resumable.

Usage:
    .venv/bin/python scripts/process_faces.py
    .venv/bin/python scripts/process_faces.py --chunk-size 500 --max-chunks 5
"""

import argparse
import os
import subprocess
import sys
import time

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_remaining_count() -> int:
    """Quick check of how many images still need processing."""
    result = subprocess.run(
        [sys.executable, "-c", f"""
import os, sys
sys.path.insert(0, "{SCANNER_ROOT}")
os.chdir("{SCANNER_ROOT}")
import asyncio
from sqlalchemy import text
from src.db.connection import async_session
async def count():
    async with async_session() as s:
        r = await s.execute(text("SELECT count(*) FROM discovered_images WHERE has_face IS NULL"))
        print(r.scalar())
asyncio.run(count())
"""],
        capture_output=True, text=True
    )
    return int(result.stdout.strip())


def process_chunk(chunk_size: int) -> tuple[int, int]:
    """Run face detection on a chunk in a subprocess. Returns (processed, faces)."""
    result = subprocess.run(
        [sys.executable, "-c", f"""
import os, sys, gc
sys.path.insert(0, "{SCANNER_ROOT}")
os.chdir("{SCANNER_ROOT}")

import asyncio, time
from pathlib import Path
import aiohttp
from sqlalchemy import text
from src.config import settings
from src.db.connection import async_session
from src.db.queries import insert_discovered_face_embedding
from src.ingest.embeddings import init_model
from src.utils.image_download import load_and_resize

TEMP_DIR = Path(settings.temp_dir)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

async def download(session, url, img_id):
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200: return None
            data = await resp.read()
            if len(data) < 1000: return None
            path = TEMP_DIR / f"{{img_id}}.jpg"
            path.write_bytes(data)
            return path
    except: return None

async def main():
    model = init_model()
    processed = 0
    faces = 0

    async with async_session() as db:
        r = await db.execute(text(
            "SELECT id, source_url FROM discovered_images WHERE has_face IS NULL ORDER BY discovered_at DESC LIMIT :lim"
        ), {{"lim": {chunk_size}}})
        batch = [dict(id=row[0], url=row[1]) for row in r.fetchall()]

    if not batch:
        print("0,0")
        return

    connector = aiohttp.TCPConnector(limit=5)
    # Process in mini-batches of 50 for download concurrency
    for i in range(0, len(batch), 50):
        mini = batch[i:i+50]
        async with aiohttp.ClientSession(connector=connector) as http:
            paths = await asyncio.gather(*[download(http, img["url"], img["id"]) for img in mini])

        async with async_session() as db:
            for img, path in zip(mini, paths):
                processed += 1
                if path is None:
                    await db.execute(text("UPDATE discovered_images SET has_face = false WHERE id = :id"), {{"id": img["id"]}})
                    continue
                try:
                    cv_img = load_and_resize(path)
                    if cv_img is None:
                        await db.execute(text("UPDATE discovered_images SET has_face = false WHERE id = :id"), {{"id": img["id"]}})
                        continue
                    detected = model.get(cv_img)
                    if len(detected) == 0:
                        await db.execute(text("UPDATE discovered_images SET has_face = false, face_count = 0 WHERE id = :id"), {{"id": img["id"]}})
                    else:
                        await db.execute(text("UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"), {{"id": img["id"], "fc": len(detected)}})
                        for fi, face in enumerate(detected):
                            await insert_discovered_face_embedding(db, img["id"], fi, face.normed_embedding, float(face.det_score))
                            faces += 1
                    del cv_img, detected
                except Exception as e:
                    await db.execute(text("UPDATE discovered_images SET has_face = false WHERE id = :id"), {{"id": img["id"]}})
                finally:
                    if path: path.unlink(missing_ok=True)
            await db.commit()
        gc.collect()

    print(f"{{processed}},{{faces}}")

asyncio.run(main())
"""],
        capture_output=True, text=True, timeout=600
    )

    if result.returncode != 0:
        print(f"  Subprocess error: {result.stderr[-200:]}", flush=True)
        return (0, 0)

    # Parse last line for results
    for line in reversed(result.stdout.strip().split("\n")):
        if "," in line:
            parts = line.strip().split(",")
            try:
                return (int(parts[0]), int(parts[1]))
            except ValueError:
                continue
    return (0, 0)


def main():
    parser = argparse.ArgumentParser(description="Process discovered images for face detection")
    parser.add_argument("--chunk-size", type=int, default=1000, help="Images per subprocess (default: 1000)")
    parser.add_argument("--max-chunks", type=int, default=0, help="Max subprocess invocations, 0=unlimited (default: 0)")
    args = parser.parse_args()

    chunk_size = args.chunk_size
    max_chunks = args.max_chunks

    remaining = get_remaining_count()
    print(f"Unprocessed images: {remaining}")
    if remaining == 0:
        print("Nothing to process.")
        return

    total_processed = 0
    total_faces = 0
    start = time.time()
    chunk_num = 0

    while True:
        chunk_num += 1

        if max_chunks > 0 and chunk_num > max_chunks:
            print(f"Reached max chunks ({max_chunks}), stopping.", flush=True)
            break

        print(f"\n--- Chunk {chunk_num} (subprocess) ---", flush=True)

        processed, faces = process_chunk(chunk_size)

        if processed == 0:
            print("No more images to process.")
            break

        total_processed += processed
        total_faces += faces
        elapsed = time.time() - start
        rate = total_processed / elapsed if elapsed > 0 else 0
        remaining_est = get_remaining_count()

        print(f"  Chunk done: {processed} images, {faces} faces", flush=True)
        print(f"  Total: {total_processed} processed, {total_faces} faces, "
              f"{rate:.1f} img/sec, {elapsed:.0f}s elapsed", flush=True)
        print(f"  Remaining: ~{remaining_est}", flush=True)

        if remaining_est == 0:
            break

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"COMPLETE ({elapsed:.0f}s)")
    print(f"  Images processed: {total_processed}")
    print(f"  Faces found:      {total_faces}")
    if elapsed > 0:
        print(f"  Rate:             {total_processed / elapsed:.1f} img/sec")


if __name__ == "__main__":
    main()
