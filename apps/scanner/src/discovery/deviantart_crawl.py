"""DeviantArt platform crawl discovery source.

Uses OAuth2 client_credentials flow and tag-based browsing to discover
AI-generated portrait content. Conservative rate limiting (~2 req/sec).
"""

import time

import aiohttp

from src.config import settings
from src.discovery.base import BaseDiscoverySource, DiscoveredImageResult, DiscoveryContext, DiscoveryResult
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import CircuitOpenError, retry_async, with_circuit_breaker

log = get_logger("deviantart_crawl")

DEVIANTART_TOKEN_URL = "https://www.deviantart.com/oauth2/token"
DEVIANTART_BROWSE_TAGS_URL = "https://www.deviantart.com/api/v1/oauth2/browse/tags"

# AI-generated content tags
AI_BROWSE_TAGS = [
    "aiart", "ai_generated", "aiportrait", "stable_diffusion",
    "midjourney", "ai_face", "deepfake",
]

# Photorealistic human content — high face-yield tags
PHOTO_TAGS = [
    "photography", "photorealistic", "beauty", "glamour",
    "model", "female", "sexy", "alluring",
    "figure", "lingerie", "curves", "nude",
    "naked", "portrait", "headshot", "celebrity",
    "woman", "man", "face", "realistic",
]

ALL_TAGS = AI_BROWSE_TAGS + PHOTO_TAGS


class DeviantArtCrawl(BaseDiscoverySource):
    """Platform crawl for DeviantArt — tag-based browsing with OAuth2 auth."""

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires: float = 0.0

    def get_source_type(self) -> str:
        return "platform_crawl"

    def get_source_name(self) -> str:
        return "deviantart"

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        results: list[DiscoveredImageResult] = []
        limiter = get_limiter("deviantart")
        saved_cursors = context.search_cursors or {}
        updated_cursors: dict[str, str | None] = {}

        async with aiohttp.ClientSession(
            headers={"User-Agent": "MadeOfUs-Scanner/1.0"},
            auto_decompress=True,
        ) as session:
            try:
                await self._ensure_token(session)
            except Exception as e:
                log.error("deviantart_token_error", error=str(e))
                return DiscoveryResult(images=[], tags_total=len(ALL_TAGS))

            for tag in ALL_TAGS:
                start_offset = saved_cursors.get(tag)
                try:
                    tag_results, final_offset = await self._fetch_tag_pages(
                        session, limiter, tag, start_offset
                    )
                    results.extend(tag_results)
                    updated_cursors[tag] = final_offset
                except CircuitOpenError:
                    log.warning("deviantart_circuit_open", tag=tag)
                    updated_cursors[tag] = saved_cursors.get(tag)
                    break
                except Exception as e:
                    log.error("deviantart_tag_error", tag=tag, error=str(e))
                    updated_cursors[tag] = saved_cursors.get(tag)

        tags_exhausted = sum(1 for c in updated_cursors.values() if c is None)

        log.info(
            "deviantart_crawl_complete",
            results_found=len(results),
            tags_total=len(ALL_TAGS),
            tags_exhausted=tags_exhausted,
        )
        return DiscoveryResult(
            images=results,
            search_cursors=updated_cursors,
            tags_total=len(ALL_TAGS),
            tags_exhausted=tags_exhausted,
        )

    async def _ensure_token(self, session: aiohttp.ClientSession) -> None:
        """Ensure we have a valid OAuth2 token, refreshing if expired."""
        if self._token and time.monotonic() < self._token_expires:
            return
        await self._fetch_token(session)

    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_token(self, session: aiohttp.ClientSession) -> None:
        """Fetch OAuth2 client_credentials token from DeviantArt."""
        data = {
            "grant_type": "client_credentials",
            "client_id": settings.deviantart_client_id,
            "client_secret": settings.deviantart_client_secret,
        }
        async with session.post(DEVIANTART_TOKEN_URL, data=data) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"DeviantArt OAuth2 token failed: {resp.status} {body}")
            token_data = await resp.json()

        self._token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        # Subtract 60s buffer to refresh before actual expiry
        self._token_expires = time.monotonic() + expires_in - 60

        log.info("deviantart_token_acquired", expires_in=expires_in)

    async def _fetch_tag_pages(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
        start_offset: str | None,
    ) -> tuple[list[DiscoveredImageResult], str | None]:
        """Fetch multiple pages for a single tag, up to max_pages.

        Returns (results, final_offset). final_offset is None if tag exhausted.
        """
        all_results: list[DiscoveredImageResult] = []
        offset = int(start_offset) if start_offset else 0
        max_pages = settings.deviantart_max_pages

        for page in range(1, max_pages + 1):
            page_results, next_offset = await self._fetch_tag_page(
                session, limiter, tag, offset
            )
            all_results.extend(page_results)

            log.info(
                "deviantart_page_fetched",
                tag=tag,
                page=page,
                offset=offset,
                count=len(page_results),
            )

            if next_offset is not None:
                offset = next_offset
            else:
                # Tag exhausted — restart from 0 next tick
                return all_results, None

        # Reached max_pages — save offset to resume next tick
        return all_results, str(offset)

    @with_circuit_breaker("deviantart")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_tag_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
        offset: int,
    ) -> tuple[list[DiscoveredImageResult], int | None]:
        """Fetch one page of tag browse results.

        Returns (results, next_offset). next_offset is None if no more pages.
        """
        results: list[DiscoveredImageResult] = []

        params = {
            "tag": tag,
            "offset": offset,
            "limit": 24,
            "mature_content": "true",
        }
        headers = {"Authorization": f"Bearer {self._token}"}

        await limiter.acquire()
        async with session.get(DEVIANTART_BROWSE_TAGS_URL, params=params, headers=headers) as resp:
            if resp.status == 401:
                # Token expired mid-crawl — clear and re-raise to trigger retry
                self._token = None
                self._token_expires = 0.0
                raise RuntimeError("DeviantArt token expired (401)")

            if resp.status != 200:
                log.warning("deviantart_api_error", status=resp.status, tag=tag, offset=offset)
                return results, None

            data = await resp.json()

        has_more = data.get("has_more", False)
        next_offset_val = data.get("next_offset")

        for deviation in data.get("results", []):
            # Only include deviations with image content (skip literature/text)
            content = deviation.get("content")
            if not content or not content.get("src"):
                continue

            image_url = content["src"]
            page_url = deviation.get("url")
            title = deviation.get("title")

            results.append(
                DiscoveredImageResult(
                    source_url=image_url,
                    page_url=page_url,
                    page_title=title[:200] if title else None,
                    platform="deviantart",
                )
            )

        if has_more and next_offset_val is not None:
            return results, int(next_offset_val)
        return results, None
