"""User-submitted URL checker discovery source."""

import re

import aiohttp

from src.discovery.base import BaseDiscoverySource, DiscoveredImageResult, DiscoveryContext, DiscoveryResult
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter

log = get_logger("url_check")

# Regex patterns for extracting image URLs from HTML
IMG_SRC_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
OG_IMAGE_RE = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE
)
OG_IMAGE_ALT_RE = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.IGNORECASE
)


class URLCheckDiscovery(BaseDiscoverySource):
    """Check user-submitted URLs for images containing faces."""

    def get_source_type(self) -> str:
        return "url_check"

    def get_source_name(self) -> str:
        return "url_check"

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        if not context.urls:
            return DiscoveryResult(images=[])

        results: list[DiscoveredImageResult] = []

        async with aiohttp.ClientSession() as session:
            for url in context.urls:
                try:
                    page_results = await self._check_url(session, url)
                    results.extend(page_results)
                except Exception as e:
                    log.error("url_check_error", url=url, error=str(e))
                    continue

        log.info("url_check_complete", urls_checked=len(context.urls), images_found=len(results))
        return DiscoveryResult(images=results)

    async def _check_url(
        self,
        session: aiohttp.ClientSession,
        url: str,
    ) -> list[DiscoveredImageResult]:
        """Fetch a page and extract all image URLs."""
        results: list[DiscoveredImageResult] = []

        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    log.debug("url_check_non_200", url=url, status=resp.status)
                    return results

                content_type = resp.headers.get("Content-Type", "")

                # If the URL is a direct image, return it directly
                if content_type.startswith("image/"):
                    results.append(
                        DiscoveredImageResult(
                            source_url=url,
                            page_url=url,
                            platform="url_check",
                        )
                    )
                    return results

                # Parse HTML for images
                html = await resp.text(errors="replace")

        except Exception as e:
            log.debug("url_check_fetch_error", url=url, error=str(e))
            return results

        page_title = _extract_title(html)

        # Extract image URLs
        image_urls: set[str] = set()

        for match in IMG_SRC_RE.finditer(html):
            image_urls.add(match.group(1))

        for match in OG_IMAGE_RE.finditer(html):
            image_urls.add(match.group(1))

        for match in OG_IMAGE_ALT_RE.finditer(html):
            image_urls.add(match.group(1))

        # Resolve relative URLs and filter
        from urllib.parse import urljoin

        for img_url in image_urls:
            resolved = urljoin(url, img_url)
            # Skip tiny icons, data URIs, SVGs
            if (
                resolved.startswith("data:")
                or resolved.endswith(".svg")
                or "favicon" in resolved.lower()
                or "icon" in resolved.lower().split("/")[-1]
            ):
                continue

            results.append(
                DiscoveredImageResult(
                    source_url=resolved,
                    page_url=url,
                    page_title=page_title,
                    platform="url_check",
                )
            )

        return results


TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _extract_title(html: str) -> str | None:
    """Extract page title from HTML."""
    match = TITLE_RE.search(html)
    if match:
        return match.group(1).strip()[:200]
    return None
