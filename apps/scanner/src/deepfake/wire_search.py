"""Wire service verification for deepfake investigations.

Searches AP Media API and Getty Images editorial archive to check
if footage exists in legitimate news wire services.
"""

import asyncio

import aiohttp
from sqlalchemy import text

from src.config import settings
from src.db.connection import async_session
from src.deepfake.utils import (
    build_search_query,
    get_investigation_search_context,
    log_activity,
    update_task_progress,
)
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter

log = get_logger("deepfake.wire_search")


async def run_wire_search(
    task_id: str,
    investigation_id: str,
    parameters: dict,
) -> None:
    """Search wire services for matching news content.

    Checks AP Media API and Getty Images editorial archive in parallel.
    If footage exists in wire archives, it's strong evidence of authenticity.
    """
    title, geo_context, _ = await get_investigation_search_context(investigation_id)
    query = build_search_query(title, geo_context)

    await update_task_progress(task_id, 10)

    if not settings.ap_api_key and not settings.getty_api_key:
        log.warning("wire_search_no_apis_configured")
        raise ValueError("No wire service API keys configured (AP_API_KEY or GETTY_API_KEY)")

    # Run AP + Getty in parallel
    ap_coro = _search_ap(query) if settings.ap_api_key else asyncio.sleep(0, result=[])
    getty_coro = _search_getty(query) if settings.getty_api_key else asyncio.sleep(0, result=[])

    ap_results, getty_results = await asyncio.gather(
        ap_coro, getty_coro, return_exceptions=True,
    )

    if isinstance(ap_results, Exception):
        log.error("ap_search_failed", error=str(ap_results))
        ap_results = []
    if isinstance(getty_results, Exception):
        log.error("getty_search_failed", error=str(getty_results))
        getty_results = []

    await update_task_progress(task_id, 70)

    # Insert results
    all_results = ap_results + getty_results
    async with async_session() as session:
        for r in all_results:
            await session.execute(text(
                "INSERT INTO deepfake_reverse_search_results "
                "(investigation_id, engine, result_url, result_domain, result_title, result_date) "
                "VALUES (:inv_id, :engine, :url, :domain, :title, :date)"
            ), {
                "inv_id": investigation_id,
                "engine": r["engine"],
                "url": r["url"],
                "domain": r.get("domain"),
                "title": r.get("title"),
                "date": r.get("date"),
            })
        await session.commit()

    await update_task_progress(task_id, 90)

    await log_activity(investigation_id, "wire_search_completed", {
        "ap_results": len(ap_results),
        "getty_results": len(getty_results),
    })

    log.info(
        "wire_search_complete",
        investigation_id=investigation_id,
        ap_results=len(ap_results),
        getty_results=len(getty_results),
    )


async def _search_ap(query: str) -> list[dict]:
    """Search AP Media API for matching content."""
    limiter = get_limiter("ap_api")
    await limiter.acquire()

    params = {
        "q": query,
        "apikey": settings.ap_api_key,
        "page_size": 10,
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.ap.org/media/v/content/search",
            params=params,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                body = await resp.text()
                log.warning("ap_api_error", status=resp.status, body=body[:500])
                return []

            data = await resp.json()

    results = []
    items = data.get("data", {}).get("items", [])
    for item in items:
        item_data = item.get("item", {})
        results.append({
            "engine": "ap_archive",
            "url": item_data.get("uri", ""),
            "domain": "ap.org",
            "title": item_data.get("headline", ""),
            "date": item_data.get("firstcreated"),
        })

    return results


async def _search_getty(query: str) -> list[dict]:
    """Search Getty Images editorial archive."""
    limiter = get_limiter("getty")
    await limiter.acquire()

    headers = {
        "Api-Key": settings.getty_api_key,
    }
    params = {
        "phrase": query,
        "page_size": 10,
        "sort_order": "best",
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.gettyimages.com/v3/search/images/editorial",
            headers=headers,
            params=params,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                body = await resp.text()
                log.warning("getty_api_error", status=resp.status, body=body[:500])
                return []

            data = await resp.json()

    results = []
    images = data.get("images", [])
    for img in images:
        results.append({
            "engine": "getty_editorial",
            "url": f"https://www.gettyimages.com/detail/news-photo/{img.get('id', '')}",
            "domain": "gettyimages.com",
            "title": img.get("title", ""),
            "date": img.get("date_created"),
        })

    return results
