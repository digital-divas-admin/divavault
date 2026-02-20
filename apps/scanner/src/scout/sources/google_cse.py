"""Google Custom Search scout source."""

import logging
from urllib.parse import urlparse

import aiohttp

from src.config import settings
from src.scout.base import BaseScoutSource, ScoutCandidate, ScoutSourceResult
from src.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"

# Domains to exclude from results (already-known platforms)
EXCLUDED_DOMAINS = {
    "civitai.com", "deviantart.com", "huggingface.co",
    "github.com", "reddit.com", "youtube.com", "twitter.com",
    "x.com", "instagram.com", "facebook.com", "tiktok.com",
    "wikipedia.org", "google.com", "bing.com",
}


class GoogleCSESource(BaseScoutSource):
    """Discover AI platforms via Google Custom Search dorks."""

    def get_source_name(self) -> str:
        return "google_cse"

    def get_cost_tier(self) -> str:
        return "paid"

    async def discover(self, keywords: list[dict]) -> ScoutSourceResult:
        if not settings.google_cse_api_key or not settings.google_cse_cx:
            return ScoutSourceResult(candidates=[], errors=["Google CSE not configured"])

        # Build search queries from discovery keywords
        search_terms = [
            kw["keyword"]
            for kw in keywords
            if kw.get("use_for") in ("discover", "both") and kw.get("enabled", True)
        ]

        if not search_terms:
            return ScoutSourceResult(candidates=[], errors=["No discovery keywords"])

        # Build Google dork queries
        exclude_clause = " ".join(f"-site:{d}" for d in list(EXCLUDED_DOMAINS)[:10])
        queries = [
            f'inurl:"{term}" {exclude_clause}'
            for term in search_terms[:5]  # Cap at 5 queries
        ]

        candidates: list[ScoutCandidate] = []
        errors: list[str] = []
        seen_domains: set[str] = set()
        limiter = get_limiter("google_cse")

        async with aiohttp.ClientSession() as session:
            for query in queries:
                try:
                    await limiter.acquire()
                    params = {
                        "key": settings.google_cse_api_key,
                        "cx": settings.google_cse_cx,
                        "q": query,
                        "num": 10,
                    }
                    async with session.get(
                        GOOGLE_CSE_URL, params=params, timeout=aiohttp.ClientTimeout(total=15)
                    ) as resp:
                        if resp.status != 200:
                            errors.append(f"Google CSE returned {resp.status} for '{query[:50]}'")
                            continue

                        data = await resp.json()
                        for item in data.get("items", []):
                            link = item.get("link", "")
                            parsed = urlparse(link)
                            domain = parsed.netloc.lower().removeprefix("www.")

                            if domain in seen_domains or domain in EXCLUDED_DOMAINS or not domain:
                                continue
                            seen_domains.add(domain)

                            candidates.append(
                                ScoutCandidate(
                                    domain=domain,
                                    url=link,
                                    name=item.get("title"),
                                    description=item.get("snippet"),
                                    source_query=query[:200],
                                    source_metadata={"display_link": item.get("displayLink")},
                                )
                            )
                except Exception as e:
                    errors.append(f"Google CSE query failed: {str(e)[:200]}")

        logger.info(f"Google CSE: found {len(candidates)} candidate domains")
        return ScoutSourceResult(
            candidates=candidates,
            queries_used=len(queries),
            errors=errors,
        )
