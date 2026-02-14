"""Meta Ad Library scanner for discovering ads with face imagery."""

from datetime import datetime, timezone
from uuid import uuid4

import aiohttp
from sqlalchemy.ext.asyncio import AsyncSession

from src.ad_intelligence.queries import insert_ad
from src.config import settings
from src.utils.image_download import download_and_store, download_image
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async, with_circuit_breaker

log = get_logger("ad_scanner")

META_AD_LIBRARY_URL = "https://graph.facebook.com/v19.0/ads_archive"


class MetaAdScanner:
    """Scans Meta Ad Library for ads containing face imagery."""

    def __init__(self):
        self._limiter = get_limiter("meta_ad_library")

    @with_circuit_breaker("meta_ad_library")
    @retry_async(max_attempts=3, min_wait=2.0, max_wait=30.0, retry_on=(aiohttp.ClientError,))
    async def _fetch_page(
        self,
        http_session: aiohttp.ClientSession,
        search_terms: str,
        fields: str,
        limit: int = 25,
        after: str | None = None,
    ) -> dict:
        """Fetch a single page from Meta Ad Library API."""
        await self._limiter.acquire()

        params = {
            "access_token": settings.meta_ad_library_access_token,
            "search_terms": search_terms,
            "ad_reached_countries": '["US"]',
            "ad_type": "POLITICAL_AND_ISSUE_ADS",
            "ad_active_status": "ALL",
            "fields": fields,
            "limit": str(limit),
        }
        if after:
            params["after"] = after

        async with http_session.get(META_AD_LIBRARY_URL, params=params) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def scan(
        self,
        session: AsyncSession,
        search_terms: list[str],
        max_ads: int = 100,
    ) -> int:
        """Scan Meta Ad Library for ads matching search terms.

        Args:
            session: Database session.
            search_terms: List of search terms to query.
            max_ads: Maximum total ads to discover per scan.

        Returns:
            Number of new ads inserted.
        """
        if not settings.meta_ad_library_access_token:
            log.warning("meta_ad_library_access_token_not_configured")
            return 0

        fields = "id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_titles,ad_snapshot_url,page_id,page_name,bylines,ad_delivery_start_time,delivery_by_region,estimated_audience_size"

        total_inserted = 0

        async with aiohttp.ClientSession() as http_session:
            for term in search_terms:
                if total_inserted >= max_ads:
                    break

                after = None
                term_count = 0

                while total_inserted < max_ads:
                    try:
                        data = await self._fetch_page(
                            http_session, term, fields, limit=25, after=after,
                        )
                    except Exception as e:
                        log.error("meta_fetch_error", term=term, error=str(e))
                        break

                    ads = data.get("data", [])
                    if not ads:
                        break

                    for ad_data in ads:
                        if total_inserted >= max_ads:
                            break

                        result = await self._process_ad(session, http_session, ad_data)
                        if result:
                            total_inserted += 1
                            term_count += 1

                    await session.commit()

                    # Check for next page
                    paging = data.get("paging", {})
                    cursors = paging.get("cursors", {})
                    after = cursors.get("after")
                    if not after or "next" not in paging:
                        break

                log.info("meta_term_complete", term=term, ads_found=term_count)

        return total_inserted

    async def _process_ad(
        self,
        session: AsyncSession,
        http_session: aiohttp.ClientSession,
        ad_data: dict,
    ) -> bool:
        """Process a single ad from the API response.

        Returns True if a new ad was inserted.
        """
        platform_ad_id = ad_data.get("id", "")
        if not platform_ad_id:
            return False

        # Extract ad text from creative bodies
        bodies = ad_data.get("ad_creative_bodies", [])
        ad_text = bodies[0] if bodies else None

        # Extract advertiser info
        advertiser_name = ad_data.get("page_name")
        advertiser_id = ad_data.get("page_id")

        # Get snapshot URL as creative URL
        creative_url = ad_data.get("ad_snapshot_url")

        # Extract region data as reached countries
        regions = ad_data.get("delivery_by_region")
        reached_countries = regions if regions else None

        discovered_at = None
        start_time = ad_data.get("ad_delivery_start_time")
        if start_time:
            try:
                discovered_at = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                discovered_at = datetime.now(timezone.utc)
        else:
            discovered_at = datetime.now(timezone.utc)

        # Download and store creative image if available
        creative_stored_path = None
        if creative_url:
            storage_path = f"ads/{platform_ad_id}/{uuid4().hex}.jpg"
            stored = await download_and_store(
                creative_url, "ad-intel-images", storage_path, http_session,
            )
            if stored:
                creative_stored_path = stored

        ad = await insert_ad(
            session,
            platform="meta",
            platform_ad_id=platform_ad_id,
            advertiser_name=advertiser_name,
            advertiser_id=advertiser_id,
            creative_url=creative_url,
            creative_stored_path=creative_stored_path,
            ad_text=ad_text,
            reached_countries=reached_countries,
            discovered_at=discovered_at,
        )

        return ad is not None
