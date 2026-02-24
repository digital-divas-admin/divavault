"""Process unprocessed discovered images for face detection.

Uses subprocess isolation — processes images in chunks in child
processes that exit completely, releasing all memory. Fully resumable.

CivitAI images use two-pass architecture: download ~60KB CDN thumbnail
for face detection, then only download full original for face-positive
images (~22-78% savings depending on content mix).

Usage:
    .venv/bin/python scripts/process_faces.py
    .venv/bin/python scripts/process_faces.py --chunk-size 500 --max-chunks 5
"""

import argparse
import os
import subprocess
import sys
import time

SCANNER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace("\\", "/")


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


def process_chunk(chunk_size: int) -> tuple[int, int, int, int]:
    """Run face detection on a chunk in a subprocess.

    Returns (processed, faces, thumbs_checked, originals_saved).
    """
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

# --- Download helpers ---

async def download_thumb(session, url, img_id):
    \"\"\"Download CivitAI CDN thumbnail (width=450) for face detection only.\"\"\"
    thumb_url = url.replace("/original=true/", "/width=450/")
    try:
        async with session.get(thumb_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200: return None
            ct = (resp.content_type or "").split(";")[0].strip().lower()
            if ct.startswith("video/") or ct.startswith("text/") or ct.startswith("application/json"):
                return None
            data = await resp.read()
            if len(data) < 500: return None
            if len(data) >= 2 and data[:2] not in (b"\\xff\\xd8", b"\\x89P", b"RI", b"GI", b"BM"):
                return None
            path = TEMP_DIR / f"{{img_id}}_thumb.jpg"
            path.write_bytes(data)
            return path
    except: return None

async def download_orig(session, url, img_id):
    \"\"\"Download full-resolution original for embedding extraction.\"\"\"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200: return None
            ct = (resp.content_type or "").split(";")[0].strip().lower()
            if ct.startswith("video/") or ct.startswith("text/") or ct.startswith("application/json"):
                return None
            data = await resp.read()
            if len(data) < 1000: return None
            if len(data) >= 2 and data[:2] not in (b"\\xff\\xd8", b"\\x89P", b"RI", b"GI", b"BM"):
                return None
            path = TEMP_DIR / f"{{img_id}}.jpg"
            path.write_bytes(data)
            return path
    except: return None

async def download_standard(session, url, img_id, stored_url=None):
    \"\"\"Download image via stored URL or source URL (non-CivitAI path).\"\"\"
    dl_url = url
    headers = {{}}
    if stored_url:
        dl_url = f"{{settings.supabase_url}}/storage/v1/object/authenticated/discovered-images/{{stored_url}}"
        headers = {{
            "Authorization": f"Bearer {{settings.supabase_service_role_key}}",
            "apikey": settings.supabase_service_role_key,
        }}
    try:
        async with session.get(dl_url, timeout=aiohttp.ClientTimeout(total=15), headers=headers) as resp:
            if resp.status != 200:
                if stored_url and url:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp2:
                        if resp2.status != 200: return None
                        ct2 = (resp2.content_type or "").split(";")[0].strip().lower()
                        if ct2.startswith("video/") or ct2.startswith("text/") or ct2.startswith("application/json"):
                            return None
                        data = await resp2.read()
                        if len(data) < 1000: return None
                        if len(data) >= 2 and data[:2] not in (b"\\xff\\xd8", b"\\x89P", b"RI", b"GI", b"BM"):
                            return None
                        path = TEMP_DIR / f"{{img_id}}.jpg"
                        path.write_bytes(data)
                        return path
                return None
            ct = (resp.content_type or "").split(";")[0].strip().lower()
            if ct.startswith("video/") or ct.startswith("text/") or ct.startswith("application/json"):
                return None
            data = await resp.read()
            if len(data) < 1000: return None
            if len(data) >= 2 and data[:2] not in (b"\\xff\\xd8", b"\\x89P", b"RI", b"GI", b"BM"):
                return None
            path = TEMP_DIR / f"{{img_id}}.jpg"
            path.write_bytes(data)
            return path
    except: return None

# --- Single-pass processor (non-CivitAI or stored URLs) ---

async def process_standard(db, model, img, path, stats):
    \"\"\"Single-pass: detect + embed from one download.\"\"\"
    stats["processed"] += 1
    if path is None:
        await db.execute(text("UPDATE discovered_images SET has_face = false WHERE id = :id"), {{"id": img["id"]}})
        return
    try:
        cv_img = load_and_resize(path)
        if cv_img is None:
            await db.execute(text("UPDATE discovered_images SET has_face = false WHERE id = :id"), {{"id": img["id"]}})
            return
        detected = model.get(cv_img)
        if len(detected) == 0:
            await db.execute(text("UPDATE discovered_images SET has_face = false, face_count = 0 WHERE id = :id"), {{"id": img["id"]}})
        else:
            await db.execute(text("UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"), {{"id": img["id"], "fc": len(detected)}})
            for fi, face in enumerate(detected):
                await insert_discovered_face_embedding(db, img["id"], fi, face.normed_embedding, float(face.det_score))
                stats["faces"] += 1
        del cv_img, detected
    except:
        await db.execute(text("UPDATE discovered_images SET has_face = false WHERE id = :id"), {{"id": img["id"]}})
    finally:
        if path: path.unlink(missing_ok=True)

# --- Main ---

async def main():
    model = init_model()
    stats = {{"processed": 0, "faces": 0, "thumbs_checked": 0, "originals_saved": 0}}

    async with async_session() as db:
        r = await db.execute(text(
            "SELECT id, source_url, image_stored_url FROM discovered_images WHERE has_face IS NULL ORDER BY discovered_at DESC LIMIT :lim"
        ), {{"lim": {chunk_size}}})
        batch = [dict(id=row[0], url=row[1], stored_url=row[2]) for row in r.fetchall()]

    if not batch:
        print("0,0,0,0")
        return

    connector = aiohttp.TCPConnector(limit=50)

    # Split entire batch: CivitAI thumbable vs standard
    thumbable = []
    standard = []
    for img in batch:
        if not img.get("stored_url") and img.get("url") and "/original=true/" in img["url"]:
            thumbable.append(img)
        else:
            standard.append(img)

    async with aiohttp.ClientSession(connector=connector) as http:

        # --- Two-pass for CivitAI thumbable images ---
        if thumbable:
            # Pass 1: Download all thumbnails concurrently, detect faces
            thumb_paths = await asyncio.gather(*[
                download_thumb(http, img["url"], img["id"]) for img in thumbable
            ])

            face_positive = []
            async with async_session() as db:
                for img, thumb_path in zip(thumbable, thumb_paths):
                    stats["processed"] += 1
                    stats["thumbs_checked"] += 1
                    if thumb_path is None:
                        await db.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {{"id": img["id"]}})
                        stats["originals_saved"] += 1
                        continue
                    try:
                        cv_img = load_and_resize(thumb_path)
                        if cv_img is None:
                            await db.execute(text(
                                "UPDATE discovered_images SET has_face = false WHERE id = :id"
                            ), {{"id": img["id"]}})
                            stats["originals_saved"] += 1
                            continue
                        detected = model.get(cv_img)
                        if len(detected) == 0:
                            await db.execute(text(
                                "UPDATE discovered_images SET has_face = false, face_count = 0 WHERE id = :id"
                            ), {{"id": img["id"]}})
                            stats["originals_saved"] += 1
                        else:
                            face_positive.append((img, len(detected)))
                        del cv_img, detected
                    except:
                        await db.execute(text(
                            "UPDATE discovered_images SET has_face = false WHERE id = :id"
                        ), {{"id": img["id"]}})
                        stats["originals_saved"] += 1
                    finally:
                        if thumb_path: thumb_path.unlink(missing_ok=True)
                await db.commit()

            # Pass 2: Download originals for face-positive only, extract embeddings
            if face_positive:
                orig_paths = await asyncio.gather(*[
                    download_orig(http, img["url"], img["id"]) for img, _ in face_positive
                ])

                async with async_session() as db:
                    for (img, thumb_fc), orig_path in zip(face_positive, orig_paths):
                        if orig_path is None:
                            await db.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {{"id": img["id"], "fc": thumb_fc}})
                            continue
                        try:
                            cv_img = load_and_resize(orig_path)
                            if cv_img is None:
                                await db.execute(text(
                                    "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                                ), {{"id": img["id"], "fc": thumb_fc}})
                                continue
                            detected = model.get(cv_img)
                            fc = len(detected) if len(detected) > 0 else thumb_fc
                            await db.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {{"id": img["id"], "fc": fc}})
                            for fi, face in enumerate(detected):
                                await insert_discovered_face_embedding(
                                    db, img["id"], fi, face.normed_embedding, float(face.det_score)
                                )
                                stats["faces"] += 1
                            del cv_img, detected
                        except:
                            await db.execute(text(
                                "UPDATE discovered_images SET has_face = true, face_count = :fc WHERE id = :id"
                            ), {{"id": img["id"], "fc": thumb_fc}})
                        finally:
                            if orig_path: orig_path.unlink(missing_ok=True)
                    await db.commit()

        # --- Single-pass for standard images (stored URLs, non-CivitAI) ---
        if standard:
            paths = await asyncio.gather(*[
                download_standard(http, img["url"], img["id"], img.get("stored_url"))
                for img in standard
            ])
            async with async_session() as db:
                for img, path in zip(standard, paths):
                    await process_standard(db, model, img, path, stats)
                await db.commit()

    gc.collect()

    print(f"{{stats['processed']}},{{stats['faces']}},{{stats['thumbs_checked']}},{{stats['originals_saved']}}")

asyncio.run(main())
"""],
        capture_output=True, text=True, timeout=600
    )

    if result.returncode != 0:
        print(f"  Subprocess error: {result.stderr[-500:]}", flush=True)
        return (0, 0, 0, 0)

    # Parse last line for results: processed,faces,thumbs_checked,originals_saved
    for line in reversed(result.stdout.strip().split("\n")):
        if "," in line:
            parts = line.strip().split(",")
            try:
                processed = int(parts[0])
                faces = int(parts[1])
                thumbs = int(parts[2]) if len(parts) > 2 else 0
                saved = int(parts[3]) if len(parts) > 3 else 0
                return (processed, faces, thumbs, saved)
            except ValueError:
                continue
    return (0, 0, 0, 0)


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
    total_thumbs = 0
    total_saved = 0
    start = time.time()
    chunk_num = 0

    while True:
        chunk_num += 1

        if max_chunks > 0 and chunk_num > max_chunks:
            print(f"Reached max chunks ({max_chunks}), stopping.", flush=True)
            break

        print(f"\n--- Chunk {chunk_num} (subprocess) ---", flush=True)

        processed, faces, thumbs, saved = process_chunk(chunk_size)

        if processed == 0:
            print("No more images to process.")
            break

        total_processed += processed
        total_faces += faces
        total_thumbs += thumbs
        total_saved += saved
        elapsed = time.time() - start
        rate = total_processed / elapsed if elapsed > 0 else 0
        remaining_est = get_remaining_count()

        print(f"  Chunk done: {processed} images, {faces} faces", flush=True)
        if thumbs > 0:
            print(f"  Two-pass:  {thumbs} thumbnails checked, {saved} originals skipped", flush=True)
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
    if total_thumbs > 0:
        print(f"  Thumbnails used:  {total_thumbs}")
        print(f"  Originals saved:  {total_saved}")
    if elapsed > 0:
        print(f"  Rate:             {total_processed / elapsed:.1f} img/sec")


if __name__ == "__main__":
    main()
