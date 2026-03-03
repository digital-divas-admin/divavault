"""News source matching for deepfake investigations.

Uses SerpAPI Google News engine to find news coverage related
to the investigation's subject.
"""

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

log = get_logger("deepfake.news_search")


async def run_news_search(
    task_id: str,
    investigation_id: str,
    parameters: dict,
) -> None:
    """Search Google News for coverage related to the investigation.

    Fetches the investigation's title and geographic context to build
    a search query, then uses SerpAPI's Google News engine.
    """
    if not settings.serpapi_api_key:
        log.warning("serpapi_api_key_not_configured")
        raise ValueError("SerpAPI key not configured — cannot run news search")

    title, geo_context, _ = await get_investigation_search_context(investigation_id)
    query = build_search_query(title, geo_context)

    await update_task_progress(task_id, 20)

    # Call SerpAPI Google News
    limiter = get_limiter("serpapi")
    await limiter.acquire()

    params = {
        "engine": "google",
        "tbm": "nws",
        "q": query,
        "api_key": settings.serpapi_api_key,
        "num": 20,
    }

    async with aiohttp.ClientSession() as http:
        async with http.get("https://serpapi.com/search", params=params) as resp:
            if resp.status != 200:
                body = await resp.text()
                log.warning("serpapi_news_error", status=resp.status, body=body[:500])
                raise RuntimeError(f"SerpAPI news search failed ({resp.status})")

            data = await resp.json()

    await update_task_progress(task_id, 60)

    news_results = data.get("news_results", [])

    # Insert results + log activity
    async with async_session() as session:
        for article in news_results:
            url = article.get("link", "")
            if not url:
                continue
            await session.execute(text(
                "INSERT INTO deepfake_reverse_search_results "
                "(investigation_id, engine, result_url, result_domain, result_title, result_date) "
                "VALUES (:inv_id, 'news_search', :url, :domain, :title, :date)"
            ), {
                "inv_id": investigation_id,
                "url": url,
                "domain": article.get("source", {}).get("name") if isinstance(article.get("source"), dict) else article.get("source"),
                "title": article.get("title"),
                "date": article.get("date"),
            })
        await session.commit()

    await update_task_progress(task_id, 80)

    await log_activity(investigation_id, "news_search_completed", {
        "query": query,
        "results_count": len(news_results),
    })

    log.info(
        "news_search_complete",
        investigation_id=investigation_id,
        query=query,
        results=len(news_results),
    )
