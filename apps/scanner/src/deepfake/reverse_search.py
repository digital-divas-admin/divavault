"""Automated reverse image search for deepfake investigation frames.

Uses TinEye API, SerpAPI Google Lens, and Wayback Machine CDX to find
original sources and track earliest appearances.
"""

import asyncio
from pathlib import Path
from urllib.parse import quote

import aiohttp
from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.deepfake.utils import (
    deepfake_storage_url,
    download_from_storage,
    get_frame_storage_path,
    log_activity,
    temp_directory,
    update_task_progress,
)
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter

log = get_logger("deepfake.reverse_search")

TINEYE_API_URL = "https://api.tineye.com/rest/search/"


async def run_reverse_search(
    task_id: str,
    investigation_id: str,
    frame_id: str,
    parameters: dict,
) -> None:
    """Run reverse image search for a single frame.

    Searches TinEye + SerpAPI Google Lens in parallel, then checks
    Wayback Machine for earliest archive dates on results.
    """
    storage_path = await get_frame_storage_path(frame_id)
    if not storage_path:
        raise ValueError(f"Frame {frame_id} not found or has no storage path")

    await update_task_progress(task_id, 10)

    async with temp_directory("deepfake_rsearch_") as tmp_dir:
        local_path = Path(tmp_dir) / "frame.jpg"
        await download_from_storage(deepfake_storage_url(storage_path), str(local_path))
        await update_task_progress(task_id, 20)

        # Run TinEye + SerpAPI in parallel
        tineye_results, serpapi_results = await asyncio.gather(
            _search_tineye(str(local_path)),
            _search_serpapi(storage_path),
            return_exceptions=True,
        )

        if isinstance(tineye_results, Exception):
            log.error("tineye_search_failed", error=str(tineye_results))
            tineye_results = []
        if isinstance(serpapi_results, Exception):
            log.error("serpapi_search_failed", error=str(serpapi_results))
            serpapi_results = []

        await update_task_progress(task_id, 60)

        all_results = tineye_results + serpapi_results

        # Check Wayback Machine for earliest archive dates (concurrent with rate limiting)
        wayback_tasks = [
            _check_wayback(r["url"]) for r in all_results if r.get("url")
        ]
        if wayback_tasks:
            wayback_dates = await asyncio.gather(*wayback_tasks, return_exceptions=True)
            url_idx = 0
            for r in all_results:
                if r.get("url"):
                    result = wayback_dates[url_idx]
                    url_idx += 1
                    if isinstance(result, str):
                        r["wayback_date"] = result

        await update_task_progress(task_id, 80)

        # Insert results + log activity in one session
        async with async_session() as session:
            for r in all_results:
                await session.execute(text(
                    "INSERT INTO deepfake_reverse_search_results "
                    "(investigation_id, frame_id, engine, result_url, result_domain, result_title, result_date) "
                    "VALUES (:inv_id, :fid, :engine, :url, :domain, :title, :date)"
                ), {
                    "inv_id": investigation_id,
                    "fid": frame_id,
                    "engine": r["engine"],
                    "url": r["url"],
                    "domain": r.get("domain"),
                    "title": r.get("title"),
                    "date": r.get("date") or r.get("wayback_date"),
                })
            await session.commit()

        log.info(
            "reverse_search_complete",
            frame_id=frame_id,
            results=len(all_results),
            tineye=len(tineye_results),
            serpapi=len(serpapi_results),
        )

        await log_activity(investigation_id, "reverse_search_completed", {
            "frame_id": frame_id,
            "results_count": len(all_results),
        })


async def _search_tineye(local_path: str) -> list[dict]:
    """Search TinEye with a local image file."""
    if not settings.tineye_api_key:
        log.debug("tineye_skipped_no_key")
        return []

    limiter = get_limiter("tineye")
    await limiter.acquire()

    results = []
    async with aiohttp.ClientSession() as session:
        with open(local_path, "rb") as f:
            data = aiohttp.FormData()
            data.add_field("image_upload", f, filename="search.jpg", content_type="image/jpeg")

            headers = {"x-api-key": settings.tineye_api_key}
            async with session.post(TINEYE_API_URL, data=data, headers=headers) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    log.warning("tineye_api_error", status=resp.status, body=body[:500])
                    return []

                result = await resp.json()

    matches = result.get("matches", [])
    for match in matches:
        for backlink in match.get("backlinks", []):
            url = backlink.get("url", "")
            results.append({
                "engine": "tineye",
                "url": url,
                "domain": backlink.get("url_domain"),
                "title": None,
                "date": backlink.get("crawl_date"),
            })

    log.info("tineye_results", count=len(results))
    return results


async def _search_serpapi(storage_path: str) -> list[dict]:
    """Search SerpAPI Google Lens with a public storage URL."""
    if not settings.serpapi_api_key:
        log.debug("serpapi_skipped_no_key")
        return []

    image_url = (
        f"{settings.supabase_url}/storage/v1/object/public/deepfake-evidence/{quote(storage_path)}"
    )

    limiter = get_limiter("serpapi")
    await limiter.acquire()

    results = []
    params = {
        "engine": "google_lens",
        "url": image_url,
        "api_key": settings.serpapi_api_key,
    }

    async with aiohttp.ClientSession() as session:
        async with session.get("https://serpapi.com/search", params=params) as resp:
            if resp.status != 200:
                body = await resp.text()
                log.warning("serpapi_api_error", status=resp.status, body=body[:500])
                return []

            data = await resp.json()

    visual_matches = data.get("visual_matches", [])
    for match in visual_matches:
        url = match.get("link", "")
        results.append({
            "engine": "serpapi",
            "url": url,
            "domain": match.get("source"),
            "title": match.get("title"),
            "date": None,
        })

    log.info("serpapi_results", count=len(results))
    return results


async def _check_wayback(url: str) -> str | None:
    """Check Wayback Machine CDX for the earliest archive of a URL."""
    limiter = get_limiter("wayback")
    await limiter.acquire()

    cdx_url = f"https://web.archive.org/cdx/search/cdx?url={quote(url)}&output=json&limit=1&sort="

    async with aiohttp.ClientSession() as session:
        async with session.get(cdx_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()

    # CDX returns [header_row, ...data_rows], each row is a list
    if len(data) < 2:
        return None

    # Timestamp is index 1 in CDX format: [urlkey, timestamp, original, mimetype, statuscode, digest, length]
    timestamp = data[1][1]  # format: YYYYMMDDHHmmss
    if len(timestamp) >= 8:
        return f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}"
    return None
