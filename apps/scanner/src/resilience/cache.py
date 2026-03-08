"""Healthy page caching for sandbox testing of crawler patches."""

from sqlalchemy import delete, select, func

from src.db.connection import async_session
from src.resilience.models import CrawlerPageCache
from src.utils.logging import get_logger

log = get_logger("resilience.cache")

_MAX_CACHED_PER_KEY = 3


async def cache_healthy_page(
    platform: str,
    search_term: str | None,
    url: str,
    html: str,
    images_found: int,
    status: int,
    size: int,
) -> None:
    """Cache a healthy page snapshot for future sandbox testing. Never raises."""
    try:
        page = CrawlerPageCache(
            platform=platform,
            search_term=search_term,
            url=url,
            html_content=html,
            response_status=status,
            response_bytes=size,
            images_found=images_found,
        )
        async with async_session() as session:
            session.add(page)
            await session.flush()

            # Prune old entries in same session
            await _prune_cached_pages(session, platform, search_term)

            await session.commit()

        log.info(
            "page_cached",
            platform=platform,
            search_term=search_term,
            images_found=images_found,
        )
    except Exception as e:
        log.error("cache_page_error", platform=platform, error=str(e))


async def get_cached_healthy_pages(
    platform: str,
    search_term: str | None = None,
) -> list[CrawlerPageCache]:
    """Retrieve cached healthy pages for sandbox testing."""
    try:
        async with async_session() as session:
            q = (
                select(CrawlerPageCache)
                .where(CrawlerPageCache.platform == platform)
                .order_by(CrawlerPageCache.created_at.desc())
                .limit(10)
            )
            if search_term is not None:
                q = q.where(CrawlerPageCache.search_term == search_term)
            result = await session.execute(q)
            return list(result.scalars().all())
    except Exception as e:
        log.error("cache_get_error", platform=platform, error=str(e))
        return []


async def _prune_cached_pages(session, platform: str, search_term: str | None) -> None:
    """Keep only the most recent N pages per platform/term pair. Uses caller's session."""
    # Get IDs to keep
    keep_q = (
        select(CrawlerPageCache.id)
        .where(CrawlerPageCache.platform == platform)
        .order_by(CrawlerPageCache.created_at.desc())
        .limit(_MAX_CACHED_PER_KEY)
    )
    if search_term is not None:
        keep_q = keep_q.where(CrawlerPageCache.search_term == search_term)
    else:
        keep_q = keep_q.where(CrawlerPageCache.search_term.is_(None))

    keep_result = await session.execute(keep_q)
    keep_ids = [row[0] for row in keep_result.all()]

    if not keep_ids:
        return

    # Delete everything older than the kept entries
    del_q = (
        delete(CrawlerPageCache)
        .where(CrawlerPageCache.platform == platform)
        .where(CrawlerPageCache.id.notin_(keep_ids))
    )
    if search_term is not None:
        del_q = del_q.where(CrawlerPageCache.search_term == search_term)
    else:
        del_q = del_q.where(CrawlerPageCache.search_term.is_(None))

    result = await session.execute(del_q)
    if result.rowcount > 0:
        log.info("cache_pruned", platform=platform, removed=result.rowcount)
