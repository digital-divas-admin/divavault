"""Scout source registry."""

from src.config import settings
from src.scout.base import BaseScoutSource
from src.scout.sources.common_crawl import CommonCrawlSource
from src.scout.sources.link_harvest import LinkHarvestSource
from src.scout.sources.google_cse import GoogleCSESource
from src.scout.sources.reddit import RedditSource


def get_scout_sources() -> list[BaseScoutSource]:
    """Get enabled scout sources based on config."""
    sources: list[BaseScoutSource] = []

    if settings.scout_common_crawl_enabled:
        sources.append(CommonCrawlSource())
    if settings.scout_link_harvest_enabled:
        sources.append(LinkHarvestSource())
    if settings.scout_google_cse_enabled and settings.google_cse_api_key:
        sources.append(GoogleCSESource())
    if settings.scout_reddit_enabled:
        sources.append(RedditSource())

    return sources
