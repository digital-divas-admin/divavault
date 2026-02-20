"""Common Crawl CDX index scout source."""

import logging
from urllib.parse import urlparse

import aiohttp

from src.config import settings
from src.scout.base import BaseScoutSource, ScoutCandidate, ScoutSourceResult
from src.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)

# Common Crawl CDX API
CDX_API = "https://index.commoncrawl.org/CC-MAIN-2024-51-index"


class CommonCrawlSource(BaseScoutSource):
    """Discover AI platforms via Common Crawl CDX index."""

    def get_source_name(self) -> str:
        return "common_crawl"

    def get_cost_tier(self) -> str:
        return "free"

    async def discover(self, keywords: list[dict]) -> ScoutSourceResult:
        # Filter to discovery keywords
        search_terms = [
            kw["keyword"]
            for kw in keywords
            if kw.get("use_for") in ("discover", "both") and kw.get("enabled", True)
        ]

        if not search_terms:
            return ScoutSourceResult(candidates=[], errors=["No discovery keywords configured"])

        candidates: list[ScoutCandidate] = []
        errors: list[str] = []
        seen_domains: set[str] = set()
        limiter = get_limiter("common_crawl")
        max_results = settings.scout_max_results_per_source

        async with aiohttp.ClientSession() as session:
            for term in search_terms:
                if len(candidates) >= max_results:
                    break

                # CDX query: search for URLs containing the term
                url_pattern = f"*.com/*{term}*"
                params = {
                    "url": url_pattern,
                    "output": "json",
                    "limit": 20,
                    "fl": "url,status,mime",
                }

                try:
                    await limiter.acquire()
                    async with session.get(
                        CDX_API, params=params, timeout=aiohttp.ClientTimeout(total=30)
                    ) as resp:
                        if resp.status != 200:
                            errors.append(f"CDX query '{term}' returned {resp.status}")
                            continue

                        text = await resp.text()
                        for line in text.strip().split("\n"):
                            if not line.strip():
                                continue
                            try:
                                # CDX returns space-separated or JSON lines
                                import json
                                record = json.loads(line)
                                page_url = record.get("url", "")
                            except (json.JSONDecodeError, KeyError):
                                continue

                            if not page_url:
                                continue

                            parsed = urlparse(page_url)
                            domain = parsed.netloc.lower().removeprefix("www.")

                            if domain in seen_domains or not domain:
                                continue
                            seen_domains.add(domain)

                            candidates.append(
                                ScoutCandidate(
                                    domain=domain,
                                    url=f"https://{domain}",
                                    source_query=term,
                                    source_metadata={"cdx_url": page_url},
                                )
                            )

                            if len(candidates) >= max_results:
                                break
                except Exception as e:
                    errors.append(f"CDX query '{term}' failed: {str(e)[:200]}")

        logger.info(f"Common Crawl: found {len(candidates)} candidate domains")
        return ScoutSourceResult(
            candidates=candidates,
            queries_used=len(search_terms),
            errors=errors,
        )
