"""Link harvest scout source — mine external domains from existing crawl data."""

import logging
from urllib.parse import urlparse

from sqlalchemy import select, func

from src.db.connection import async_session
from src.db.models import DiscoveredImage
from src.scout.base import BaseScoutSource, ScoutCandidate, ScoutSourceResult
from src.scout.queries import get_known_platforms

logger = logging.getLogger(__name__)


class LinkHarvestSource(BaseScoutSource):
    """Discover new platforms from URLs already in our crawl data."""

    def get_source_name(self) -> str:
        return "link_harvest"

    def get_cost_tier(self) -> str:
        return "free"

    async def discover(self, keywords: list[dict]) -> ScoutSourceResult:
        known_platforms = await get_known_platforms()

        async with async_session() as session:
            # Get distinct domains from page_url
            result = await session.execute(
                select(DiscoveredImage.page_url)
                .where(DiscoveredImage.page_url.isnot(None))
                .distinct()
                .limit(5000)
            )
            urls = [r[0] for r in result.all()]

        # Extract unique domains
        domain_urls: dict[str, str] = {}
        for url in urls:
            try:
                parsed = urlparse(url)
                domain = parsed.netloc.lower().removeprefix("www.")
                if domain and domain not in known_platforms and domain not in domain_urls:
                    domain_urls[domain] = url
            except Exception:
                continue

        candidates = [
            ScoutCandidate(
                domain=domain,
                url=f"https://{domain}",
                source_metadata={"sample_page_url": sample_url},
            )
            for domain, sample_url in domain_urls.items()
        ]

        logger.info(f"Link harvest: found {len(candidates)} candidate domains from existing data")
        return ScoutSourceResult(candidates=candidates, queries_used=0)
