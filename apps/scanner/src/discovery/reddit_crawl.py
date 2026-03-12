"""Reddit platform crawl discovery source.

Crawls high-risk subreddits via the public JSON API for images containing
real human faces. Uses DEFERRED detection strategy — i.redd.it CDN URLs
are stable, so face detection happens in a later subprocess pass.

API: Append .json to any subreddit URL. No auth required.
Rate limit: 1 request/second (Reddit API rules for unauthenticated access).
"""

import asyncio
from urllib.parse import urlparse

import aiohttp

from src.config import settings
from src.discovery.base import (
    BaseDiscoverySource,
    DiscoveredImageResult,
    DiscoveryContext,
    DiscoveryResult,
)
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter

log = get_logger("crawler.reddit")

REDDIT_BASE = "https://www.reddit.com"

# High-risk subreddits for AI-generated face / deepfake content.
# Many NSFW AI subs get banned frequently — override via platform_crawl_schedule.search_terms JSONB.
TARGET_SUBREDDITS = [
    # AI-generated imagery (active as of 2026-03)
    "aigenerated",
    "sdnsfw",
    "unstable_diffusion",
    "AIgirls",
    "AIart",
    "StableDiffusion",
    # Lower-traffic but still active
    "sdNSFWart",
]

# Domains we accept as direct image links
IMAGE_DOMAINS = {"i.redd.it", "i.imgur.com"}

# User-Agent required by Reddit API
USER_AGENT = "ConsentedAI-Scanner/1.0 (face-protection; contact@consentedai.com)"


class RedditCrawl(BaseDiscoverySource):
    """Platform crawl for Reddit — high-risk subreddits with AI-generated face content."""

    def get_source_type(self) -> str:
        return "platform_crawl"

    def get_source_name(self) -> str:
        return "reddit"

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        """Crawl subreddits: fetch /new.json pages, extract image URLs."""
        results: list[DiscoveredImageResult] = []
        limiter = get_limiter("reddit")
        backfill = context.backfill

        # Subreddit list from search_terms or default
        subreddits = self._parse_subreddits(context.search_terms)

        # Load cursors (per-subreddit "after" fullname)
        effective_cursors = (
            context.backfill_cursors if backfill else context.search_cursors
        ) or {}

        max_pages = (
            settings.reddit_backfill_pages if backfill
            else settings.reddit_max_pages
        )

        updated_cursors: dict[str, str | None] = {}
        tags_total = len(subreddits)
        tags_exhausted = 0

        headers = {"User-Agent": USER_AGENT}
        timeout = aiohttp.ClientTimeout(total=20)

        concurrency_sem = asyncio.Semaphore(settings.reddit_concurrency)

        async def _crawl_one_sub(sub: str) -> None:
            nonlocal tags_exhausted
            sub_key = f"r/{sub}"

            # In backfill mode, skip exhausted subreddits
            if backfill and effective_cursors.get(sub_key) == "exhausted":
                updated_cursors[sub_key] = "exhausted"
                tags_exhausted += 1
                return

            cursor_val = effective_cursors.get(sub_key)
            after = cursor_val if cursor_val and cursor_val != "exhausted" else None

            async with concurrency_sem:
                try:
                    sub_images, new_after, exhausted = await self._crawl_subreddit(
                        http_session, limiter, sub, after, max_pages, backfill,
                    )
                    results.extend(sub_images)

                    if exhausted and backfill:
                        updated_cursors[sub_key] = "exhausted"
                        tags_exhausted += 1
                    elif new_after is not None:
                        updated_cursors[sub_key] = new_after
                    else:
                        updated_cursors[sub_key] = cursor_val

                    log.info(
                        "reddit_subreddit_done",
                        subreddit=sub,
                        images=len(sub_images),
                        cursor=updated_cursors.get(sub_key),
                    )
                except Exception as e:
                    log.error(
                        "reddit_subreddit_error", subreddit=sub, error=str(e),
                        cursor_preserved=cursor_val,
                    )
                    updated_cursors[sub_key] = cursor_val

        _managed_session = context.http_session_override is None
        if _managed_session:
            http_session = aiohttp.ClientSession(headers=headers, timeout=timeout)
        else:
            http_session = context.http_session_override
        try:
            await asyncio.gather(*[_crawl_one_sub(sub) for sub in subreddits])
        finally:
            if _managed_session:
                await http_session.close()

        log.info(
            "reddit_crawl_complete",
            results_found=len(results),
            subreddits=len(subreddits),
            tags_exhausted=tags_exhausted,
        )

        return DiscoveryResult(
            images=results,
            search_cursors=updated_cursors,
            tags_total=tags_total,
            tags_exhausted=tags_exhausted,
        )

    async def _crawl_subreddit(
        self,
        session: aiohttp.ClientSession,
        limiter,
        subreddit: str,
        after: str | None,
        max_pages: int,
        backfill: bool,
    ) -> tuple[list[DiscoveredImageResult], str | None, bool]:
        """Crawl a single subreddit's /new feed.

        Returns (images, last_after_fullname, is_exhausted).
        """
        images: list[DiscoveredImageResult] = []
        current_after = after
        first_fullname = None  # Track the first post for sweep cursor

        for page_num in range(max_pages):
            data = await self._fetch_page(session, limiter, subreddit, current_after)
            if data is None:
                break

            listing = data.get("data", {})
            children = listing.get("children", [])
            if not children:
                # No more posts — exhausted
                return images, current_after, True

            # Extract images from this page
            for child in children:
                post = child.get("data", {})
                if not post:
                    continue

                # Track first fullname for sweep cursor (newest post on first page)
                fullname = post.get("name")
                if page_num == 0 and first_fullname is None and fullname:
                    first_fullname = fullname

                # Extract images from this post
                post_images = self._extract_images(subreddit, post)
                images.extend(post_images)

            # Get next page cursor
            next_after = listing.get("after")
            if not next_after:
                # Reddit returned no "after" — we've hit the end
                return images, first_fullname or current_after, True

            current_after = next_after

        # Reached max_pages without exhausting — not done yet
        # For sweep: save the first (newest) fullname so next sweep starts from there
        # For backfill: save the last "after" cursor so we continue deeper
        final_cursor = current_after if backfill else (first_fullname or current_after)
        return images, final_cursor, False

    async def _fetch_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        subreddit: str,
        after: str | None,
    ) -> dict | None:
        """Fetch one page of /r/{subreddit}/new.json. Returns JSON data or None."""
        url = f"{REDDIT_BASE}/r/{subreddit}/new.json?limit=100&raw_json=1"
        if after:
            url += f"&after={after}"

        await limiter.acquire()
        try:
            async with session.get(url) as resp:
                if resp.status == 403:
                    log.warning("reddit_subreddit_private", subreddit=subreddit)
                    return None
                if resp.status == 404:
                    log.warning("reddit_subreddit_not_found", subreddit=subreddit)
                    return None
                if resp.status == 429:
                    retry_after = int(resp.headers.get("Retry-After", "30"))
                    retry_after = min(retry_after, 120)
                    log.warning("reddit_rate_limited", subreddit=subreddit, retry_after=retry_after)
                    await asyncio.sleep(retry_after)
                    return None
                if resp.status >= 500:
                    log.warning("reddit_server_error", method="_fetch_page", subreddit=subreddit, status=resp.status)
                    return None  # Transient; will be retried on next tick
                if resp.status != 200:
                    log.warning(
                        "reddit_page_error",
                        subreddit=subreddit, status=resp.status,
                    )
                    return None  # Client error; don't retry
                try:
                    return await resp.json()
                except (aiohttp.ContentTypeError, ValueError) as e:
                    log.warning("reddit_json_decode_error", subreddit=subreddit, error=repr(e))
                    return None
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            log.warning("reddit_fetch_error", subreddit=subreddit, error=str(e))
            return None

    def _extract_images(
        self, subreddit: str, post: dict
    ) -> list[DiscoveredImageResult]:
        """Extract image URLs from a single Reddit post.

        Handles:
        - Direct image links (i.redd.it, i.imgur.com)
        - Reddit gallery posts (gallery_data + media_metadata)
        Filters out: videos, self-posts, non-image links.
        """
        results: list[DiscoveredImageResult] = []

        # Skip videos
        if post.get("is_video"):
            return results

        # Skip self-posts (text only)
        post_hint = post.get("post_hint", "")
        if post_hint == "self":
            return results

        permalink = post.get("permalink", "")
        page_url = f"https://www.reddit.com{permalink}" if permalink else None
        title = (post.get("title") or "")[:200] or None

        # Check for gallery posts first
        gallery_images = self._extract_gallery_images(post)
        if gallery_images:
            for img_url in gallery_images:
                results.append(
                    DiscoveredImageResult(
                        source_url=img_url,
                        page_url=page_url,
                        page_title=title,
                        platform="reddit",
                        search_term=f"r/{subreddit}",
                    )
                )
            return results

        # Direct image link
        url = post.get("url") or ""
        if self._is_image_url(url):
            results.append(
                DiscoveredImageResult(
                    source_url=url,
                    page_url=page_url,
                    page_title=title,
                    platform="reddit",
                    search_term=f"r/{subreddit}",
                )
            )

        return results

    @staticmethod
    def _extract_gallery_images(post: dict) -> list[str]:
        """Extract image URLs from a Reddit gallery post.

        Gallery posts have `gallery_data.items` with media_ids, and
        `media_metadata` mapping media_id → image info with `s.u` (full URL).
        """
        gallery_data = post.get("gallery_data")
        media_metadata = post.get("media_metadata")
        if not gallery_data or not media_metadata:
            return []

        items = gallery_data.get("items", [])
        urls: list[str] = []

        for item in items:
            media_id = item.get("media_id")
            if not media_id:
                continue

            meta = media_metadata.get(media_id)
            if not meta:
                continue

            # Skip non-image media (e.g. video in galleries)
            mime = meta.get("m", "")
            if not mime.startswith("image/"):
                continue

            # Get the full-size URL from the "s" (source) field
            source = meta.get("s", {})
            img_url = source.get("u") or source.get("gif")
            if img_url:
                urls.append(img_url)

        return urls

    @staticmethod
    def _is_image_url(url: str) -> bool:
        """Check if URL is a direct image link from known image domains."""
        if not url:
            return False
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ""

            # Known image hosting domains
            if hostname in IMAGE_DOMAINS:
                return True

            # Generic check: URL ends with image extension
            path_lower = parsed.path.lower()
            if any(path_lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp")):
                return True

            return False
        except Exception:
            return False

    @staticmethod
    def _parse_subreddits(search_terms: list[str] | None) -> list[str]:
        """Parse subreddit list from search_terms or fall back to TARGET_SUBREDDITS.

        Accepts formats: "r/sub", "/r/sub", "sub"
        """
        if not search_terms:
            return TARGET_SUBREDDITS

        subs = []
        for term in search_terms:
            sub = term.strip("/").strip()
            # Strip "r/" prefix if present
            if sub.lower().startswith("r/"):
                sub = sub[2:]
            if sub:
                subs.append(sub)
        return subs if subs else TARGET_SUBREDDITS
