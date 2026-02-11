"""TinEye reverse image search discovery source."""

import aiohttp

from src.config import settings
from src.discovery.base import BaseDiscoverySource, DiscoveredImageResult, DiscoveryContext, DiscoveryResult
from src.utils.image_download import download_from_supabase
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import CircuitOpenError, retry_async, with_circuit_breaker

log = get_logger("reverse_image")

TINEYE_API_URL = "https://api.tineye.com/rest/search/"


class TinEyeDiscovery(BaseDiscoverySource):
    """Reverse image search via TinEye API."""

    def get_source_type(self) -> str:
        return "reverse_image"

    def get_source_name(self) -> str:
        return "tineye"

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        if not settings.tineye_api_key:
            log.warning("tineye_api_key_not_configured")
            return DiscoveryResult(images=[])

        if not context.images:
            return DiscoveryResult(images=[])

        results: list[DiscoveredImageResult] = []
        limiter = get_limiter("tineye")

        # Limit photos per scan based on tier
        from src.config import get_tier_config

        tier_config = get_tier_config(context.contributor_tier)
        max_photos = tier_config.get("reverse_image_max_photos", 3)
        images_to_search = context.images[:max_photos]

        async with aiohttp.ClientSession() as session:
            for bucket, file_path in images_to_search:
                try:
                    image_results = await self._search_image(session, bucket, file_path, limiter)
                    results.extend(image_results)
                except CircuitOpenError:
                    log.warning("tineye_circuit_open")
                    break
                except Exception as e:
                    log.error("tineye_search_error", file_path=file_path, error=str(e))
                    continue

        log.info(
            "tineye_discovery_complete",
            images_searched=len(images_to_search),
            results_found=len(results),
        )
        return DiscoveryResult(images=results)

    @with_circuit_breaker("tineye")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _search_image(
        self,
        session: aiohttp.ClientSession,
        bucket: str,
        file_path: str,
        limiter,
    ) -> list[DiscoveredImageResult]:
        """Submit a single image to TinEye and return matches."""
        # Download from Supabase first
        local_path = await download_from_supabase(bucket, file_path, session)
        if local_path is None:
            return []

        try:
            await limiter.acquire()

            # TinEye API: upload image as multipart form
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
            results = []
            for match in matches:
                for backlink in match.get("backlinks", []):
                    results.append(
                        DiscoveredImageResult(
                            source_url=match.get("image_url", backlink.get("url", "")),
                            page_url=backlink.get("url"),
                            platform="tineye",
                        )
                    )

            return results
        finally:
            local_path.unlink(missing_ok=True)
