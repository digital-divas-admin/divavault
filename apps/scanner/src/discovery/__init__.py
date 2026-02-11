"""Discovery source registry.

Maps platform names to their scraper implementations. Only Phase 1 (crawl)
is site-specific — Phases 2 (face detection) and 3 (matching) operate on
shared DB tables regardless of which platform discovered the images.

To add a new site:
  1. Create a scraper class implementing BaseDiscoverySource
  2. Register it here: PLATFORM_SCRAPERS["mysite"] = MySiteCrawl()
  3. INSERT INTO platform_crawl_schedule (platform, crawl_interval_hours) VALUES ('mysite', 24)
"""

from src.discovery.base import BaseDiscoverySource
from src.discovery.deviantart_crawl import DeviantArtCrawl
from src.discovery.platform_crawl import CivitAICrawl

PLATFORM_SCRAPERS: dict[str, BaseDiscoverySource] = {
    "civitai": CivitAICrawl(),
    "deviantart": DeviantArtCrawl(),
    # "huggingface": HuggingFaceCrawl(),  # future
}
