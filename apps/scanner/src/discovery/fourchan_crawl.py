"""4chan platform crawl discovery source.

Crawls 4chan boards via the read-only JSON API for images containing
real human faces. Uses DEFERRED detection strategy — CDN image URLs
are stable, so face detection happens in a later subprocess pass.

API docs: https://github.com/4chan/4chan-API
Rate limit: 1 request/second (strict, IP-level).
"""

import asyncio
import time

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

log = get_logger("crawler.fourchan")

FOURCHAN_API = "https://a.4cdn.org"
FOURCHAN_CDN = "https://i.4cdn.org"

# Boards with significant real-person imagery
TARGET_BOARDS = [
    "pol", "int", "b", "soc", "s4s",  # SFW (mostly)
    "s", "hc", "hm", "hr", "gif", "r",  # NSFW
]

VIDEO_EXTENSIONS = {".webm", ".mp4"}
MIN_FILE_SIZE = 5000  # bytes — too small for usable face content

# User-Agent required by 4chan API
USER_AGENT = "ConsentedAI-Scanner/1.0 (face-protection; contact@consentedai.com)"


class FourChanCrawl(BaseDiscoverySource):
    """Platform crawl for 4chan — high-traffic imageboard with real-person content."""

    def get_source_type(self) -> str:
        return "platform_crawl"

    def get_source_name(self) -> str:
        return "fourchan"

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        """Crawl 4chan boards: fetch catalogs, extract OP images, drill into threads."""
        results: list[DiscoveredImageResult] = []
        limiter = get_limiter("fourchan")
        backfill = context.backfill

        # Board list from search_terms or default
        boards = self._parse_boards(context.search_terms)

        # Load cursors (per-board highest thread no seen)
        effective_cursors = (
            context.backfill_cursors if backfill else context.search_cursors
        ) or {}

        threads_per_board = (
            settings.fourchan_backfill_threads if backfill
            else settings.fourchan_threads_per_board
        )

        updated_cursors: dict[str, str | None] = {}
        tags_total = len(boards)
        tags_exhausted = 0

        # In backfill mode, limit boards per tick and rotate through them.
        # Pre-populate cursors for boards we'll skip so state is preserved.
        if backfill:
            boards_to_crawl = self._select_backfill_boards(
                boards, effective_cursors, settings.fourchan_backfill_boards_per_tick,
            )
            boards_to_crawl_set = set(boards_to_crawl)
            for board in boards:
                board_key = f"/{board}/"
                if board not in boards_to_crawl_set:
                    cursor_val = effective_cursors.get(board_key)
                    if cursor_val == "exhausted":
                        updated_cursors[board_key] = "exhausted"
                        tags_exhausted += 1
                    elif cursor_val is not None:
                        updated_cursors[board_key] = cursor_val
        else:
            boards_to_crawl = boards

        # Graceful timeout: stop early if we've used >80% of the platform timeout budget.
        # This lets us return partial results with cursors intact instead of being hard-cancelled.
        crawl_deadline = time.monotonic() + settings.per_platform_crawl_timeout * 0.8

        headers = {"User-Agent": USER_AGENT}
        timeout = aiohttp.ClientTimeout(total=15)

        concurrency_sem = asyncio.Semaphore(settings.fourchan_concurrency)
        deadline_hit = False

        async def _crawl_one_board(board: str) -> None:
            nonlocal tags_exhausted, deadline_hit
            board_key = f"/{board}/"

            # In backfill mode, skip exhausted boards
            if backfill and effective_cursors.get(board_key) == "exhausted":
                updated_cursors[board_key] = "exhausted"
                tags_exhausted += 1
                return

            # Graceful timeout check
            if time.monotonic() > crawl_deadline:
                if not deadline_hit:
                    deadline_hit = True
                    log.warning(
                        "fourchan_graceful_timeout",
                        images_so_far=len(results),
                    )
                # Preserve cursor for boards we didn't reach
                if board_key not in updated_cursors:
                    updated_cursors[board_key] = effective_cursors.get(board_key)
                return

            cursor_val = effective_cursors.get(board_key)
            last_seen_no = int(cursor_val) if cursor_val and cursor_val != "exhausted" else 0

            async with concurrency_sem:
                try:
                    board_images, new_cursor, exhausted = await self._crawl_board(
                        http_session, limiter, board, last_seen_no,
                        threads_per_board, backfill,
                    )
                    results.extend(board_images)

                    if exhausted and backfill:
                        updated_cursors[board_key] = "exhausted"
                        tags_exhausted += 1
                    elif new_cursor is not None:
                        updated_cursors[board_key] = str(new_cursor)
                    else:
                        updated_cursors[board_key] = cursor_val

                    log.info(
                        "fourchan_board_done",
                        board=board,
                        images=len(board_images),
                        cursor=updated_cursors.get(board_key),
                    )
                except Exception as e:
                    log.error("fourchan_board_error", board=board, error=str(e))
                    updated_cursors[board_key] = cursor_val

        _managed_session = context.http_session_override is None
        if _managed_session:
            http_session = aiohttp.ClientSession(headers=headers, timeout=timeout)
        else:
            http_session = context.http_session_override
        try:
            await asyncio.gather(*[_crawl_one_board(board) for board in boards_to_crawl])
        finally:
            if _managed_session:
                await http_session.close()

        log.info(
            "fourchan_crawl_complete",
            results_found=len(results),
            boards_crawled=sum(1 for k in updated_cursors if updated_cursors[k] != effective_cursors.get(k)),
            boards_total=len(boards),
            tags_exhausted=tags_exhausted,
            mode="backfill" if backfill else "sweep",
        )

        return DiscoveryResult(
            images=results,
            search_cursors=updated_cursors,
            tags_total=tags_total,
            tags_exhausted=tags_exhausted,
        )

    @staticmethod
    def _select_backfill_boards(
        all_boards: list[str],
        cursors: dict[str, str | None],
        max_boards: int,
    ) -> list[str]:
        """Select a subset of boards for this backfill tick.

        Prioritises non-exhausted boards that haven't been crawled yet (no cursor),
        then boards with existing cursors (partially done). Rotates through boards
        across ticks so all boards eventually get backfilled.
        """
        # Split into: no cursor yet, partially done, exhausted
        uncrawled = []
        partial = []
        for board in all_boards:
            key = f"/{board}/"
            val = cursors.get(key)
            if val == "exhausted":
                continue
            elif val is None:
                uncrawled.append(board)
            else:
                partial.append(board)

        # Prioritise: finish partial boards first, then start new ones
        selected = (partial + uncrawled)[:max_boards]

        if selected:
            log.info(
                "fourchan_backfill_board_selection",
                selected=selected,
                uncrawled=len(uncrawled),
                partial=len(partial),
                exhausted=len(all_boards) - len(uncrawled) - len(partial),
            )

        return selected

    async def _crawl_board(
        self,
        session: aiohttp.ClientSession,
        limiter,
        board: str,
        last_seen_no: int,
        max_threads: int,
        backfill: bool,
    ) -> tuple[list[DiscoveredImageResult], int | None, bool]:
        """Crawl a single board: catalog + thread drill-in.

        Returns (images, max_thread_no_seen, is_exhausted).
        """
        # Fetch catalog
        catalog = await self._fetch_catalog(session, limiter, board)
        if catalog is None:
            return [], None, False

        # Flatten all threads from catalog pages
        all_threads = []
        for page in catalog:
            all_threads.extend(page.get("threads", []))

        if not all_threads:
            return [], None, backfill  # empty board = exhausted in backfill

        # Track max thread no for cursor
        max_no = max(t.get("no", 0) for t in all_threads)

        # Extract OP images from catalog (free — no extra API calls)
        images = self._extract_images(board, all_threads)

        # Filter threads for drill-in (both sweep and backfill use cursor)
        new_threads = [t for t in all_threads if t.get("no", 0) > last_seen_no]

        # Sort by thread no descending (newest first), limit
        new_threads.sort(key=lambda t: t.get("no", 0), reverse=True)
        drill_threads = new_threads[:max_threads]

        # Drill into threads for reply images
        for thread in drill_threads:
            thread_no = thread.get("no", 0)
            try:
                posts = await self._fetch_thread(session, limiter, board, thread_no)
                if posts:
                    # Skip OP (index 0) — already got from catalog
                    reply_images = self._extract_images(board, posts[1:])
                    images.extend(reply_images)
            except Exception as e:
                log.warning(
                    "fourchan_thread_error",
                    board=board, thread=thread_no, error=str(e),
                )

        # In backfill: exhausted when we drilled into ALL new threads
        exhausted = backfill and len(new_threads) <= max_threads

        return images, max_no, exhausted

    async def _fetch_catalog(
        self,
        session: aiohttp.ClientSession,
        limiter,
        board: str,
    ) -> list[dict] | None:
        """Fetch board catalog. Returns list of page objects or None on failure."""
        url = f"{FOURCHAN_API}/{board}/catalog.json"
        await limiter.acquire()
        try:
            async with session.get(url) as resp:
                if resp.status == 404:
                    log.warning("fourchan_board_not_found", board=board)
                    return None
                if resp.status == 429:
                    log.warning("fourchan_rate_limited", method="_fetch_catalog", board=board)
                    await asyncio.sleep(30)
                    return None
                if resp.status >= 500:
                    log.warning("fourchan_server_error", method="_fetch_catalog", board=board, status=resp.status)
                    return None  # Transient; will be retried on next tick
                if resp.status != 200:
                    log.warning("fourchan_catalog_error", board=board, status=resp.status)
                    return None
                try:
                    return await resp.json()
                except (aiohttp.ContentTypeError, ValueError) as e:
                    log.warning("fourchan_json_decode_error", method="_fetch_catalog", board=board, error=repr(e))
                    return None
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            log.warning("fourchan_catalog_fetch_error", board=board, error=str(e))
            return None

    async def _fetch_thread(
        self,
        session: aiohttp.ClientSession,
        limiter,
        board: str,
        thread_no: int,
    ) -> list[dict] | None:
        """Fetch all posts in a thread. Returns list of post dicts or None."""
        url = f"{FOURCHAN_API}/{board}/thread/{thread_no}.json"
        await limiter.acquire()
        try:
            async with session.get(url) as resp:
                if resp.status == 404:
                    return None  # thread was deleted/archived
                if resp.status == 429:
                    log.warning("fourchan_rate_limited", method="_fetch_thread", board=board, thread=thread_no)
                    await asyncio.sleep(30)
                    return None
                if resp.status >= 500:
                    log.warning("fourchan_server_error", method="_fetch_thread", board=board, thread=thread_no, status=resp.status)
                    return None  # Transient; will be retried on next tick
                if resp.status != 200:
                    log.warning(
                        "fourchan_thread_fetch_error",
                        board=board, thread=thread_no, status=resp.status,
                    )
                    return None
                try:
                    data = await resp.json()
                except (aiohttp.ContentTypeError, ValueError) as e:
                    log.warning("fourchan_json_decode_error", method="_fetch_thread", board=board, thread=thread_no, error=repr(e))
                    return None
                return data.get("posts", [])
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            log.warning(
                "fourchan_thread_fetch_error",
                board=board, thread=thread_no, error=str(e),
            )
            return None

    def _extract_images(
        self, board: str, posts: list[dict]
    ) -> list[DiscoveredImageResult]:
        """Extract image results from a list of posts.

        Filters out videos and tiny files.
        """
        results: list[DiscoveredImageResult] = []
        for post in posts:
            tim = post.get("tim")
            ext = post.get("ext")
            if not tim or not ext:
                continue

            # Skip video files
            if ext.lower() in VIDEO_EXTENSIONS:
                continue

            # Skip tiny files (< 5KB)
            fsize = post.get("fsize", 0)
            if fsize < MIN_FILE_SIZE:
                continue

            thread_no = post.get("resto") or post.get("no")
            post_no = post.get("no")

            source_url = f"{FOURCHAN_CDN}/{board}/{tim}{ext}"
            page_url = f"https://boards.4chan.org/{board}/thread/{thread_no}#p{post_no}"

            # Build title from subject or filename
            title = post.get("sub") or post.get("filename") or ""
            if title:
                title = title[:200]

            results.append(
                DiscoveredImageResult(
                    source_url=source_url,
                    page_url=page_url,
                    page_title=title if title else None,
                    platform="fourchan",
                    search_term=f"/{board}/",
                )
            )

        return results

    @staticmethod
    def _parse_boards(search_terms: list[str] | None) -> list[str]:
        """Parse board list from search_terms or fall back to TARGET_BOARDS.

        Accepts formats: "/s/", "s", "/s"
        """
        if not search_terms:
            return TARGET_BOARDS

        boards = []
        for term in search_terms:
            board = term.strip("/").strip()
            if board:
                boards.append(board)
        return boards if boards else TARGET_BOARDS
