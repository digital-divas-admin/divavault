"""DeviantArt platform crawl discovery source.

HTML-first scraping with RSS fallback (no API key required).
HTML tag pages are sorted by newest by default and are more resilient through proxies.

HTML endpoint: https://www.deviantart.com/tag/{tag}?page={n}
RSS endpoint:  https://backend.deviantart.com/rss.xml?q=sort:time+tag:{tag}&offset={n}

HTML returns ~24 items per page with wixmp image URLs inside <a> deviation links.
RSS returns 60 items per page with <media:content> image URLs (fallback only).
"""

import asyncio
import gc
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import aiohttp
import numpy as np
from src.config import settings
from src.discovery.base import (
    BaseDiscoverySource,
    DetectionStrategy,
    DiscoveredImageResult,
    DiscoveryContext,
    DiscoveryResult,
    InlineDetectedFace,
    InlineDetectedImage,
    InlineDiscoveryResult,
)
from src.utils.image_download import upload_thumbnail
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import CircuitOpenError, retry_async, with_circuit_breaker

log = get_logger("deviantart_crawl")

DEVIANTART_RSS_URL = "https://backend.deviantart.com/rss.xml"
DEVIANTART_TAG_URL = "https://www.deviantart.com/tag"
RSS_PAGE_SIZE = 60   # DeviantArt RSS returns 60 items per page
HTML_PAGE_SIZE = 24  # DeviantArt HTML tag pages return ~24 items per page

# XML namespaces used in DeviantArt RSS
NS = {
    "media": "http://search.yahoo.com/mrss/",
    "atom": "http://www.w3.org/2005/Atom",
}

# Browser User-Agent — DeviantArt blocks requests without one
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/133.0.0.0 Safari/537.36"
)

# Regex for extracting paired (deviation_link, image_url) from HTML tag pages.
# Matches <a href="deviation_url"> ... <img src="wixmp_url"> within the same <a>.
_HTML_PAIR_RE = re.compile(
    r'<a[^>]+href="(https://www\.deviantart\.com/[^/]+/art/[^"]+)"[^>]*>'
    r'(?:(?!</a>).)*?'
    r'<img[^>]+src="(https://images-wixmp[^"]+)"',
    re.DOTALL,
)

# Extract title from a deviation URL slug: /username/art/Title-With-Dashes-12345
_TITLE_FROM_URL_RE = re.compile(r'/art/(.+)-\d+(?:#.*)?$')

# ---------------------------------------------------------------------------
# Tags derived from the mapper taxonomy (single source of truth).
# DeviantArt tags are single concatenated words — no spaces, no hyphens.
# ---------------------------------------------------------------------------

from src.intelligence.mapper.deviantart import SECTION_TO_SEARCH_TERMS as _DA_SECTION_TERMS

ALL_TAGS: list[str] = sorted({tag for tags in _DA_SECTION_TERMS.values() for tag in tags})

# Early-stop: if this fraction of a page's images are already processed, stop the tag
DEDUP_STOP_RATIO = 0.8

class DeviantArtCrawl(BaseDiscoverySource):
    """Platform crawl for DeviantArt — hybrid RSS + HTML tag scraping."""

    def __init__(self) -> None:
        self._proxy: str | None = None

    def get_source_type(self) -> str:
        return "platform_crawl"

    def get_source_name(self) -> str:
        return "deviantart"

    def get_detection_strategy(self) -> DetectionStrategy:
        return DetectionStrategy.INLINE

    async def discover_with_detection(
        self, context: DiscoveryContext, face_model
    ) -> InlineDiscoveryResult:
        """Crawl DeviantArt AND detect faces inline (wixmp URLs expire).

        Downloads images while CDN tokens are fresh, runs InsightFace detection
        in a thread pool, and returns images with face data already attached.
        """
        effective_tags = context.search_terms if context.search_terms else ALL_TAGS
        tag_depths = context.tag_depths or {}
        saved_cursors = context.search_cursors or {}
        self._proxy = settings.proxy_url or None

        limiter = get_limiter("deviantart")
        semaphore = asyncio.Semaphore(settings.deviantart_concurrency)
        circuit_tripped = asyncio.Event()

        # Shared state
        all_images: list[InlineDetectedImage] = []
        images_lock = asyncio.Lock()
        updated_cursors: dict[str, str | None] = {}
        cursors_lock = asyncio.Lock()
        inline_stats = {"downloaded": 0, "failures": 0, "faces": 0}
        stats_lock = asyncio.Lock()

        # Thread pool for CPU-bound face detection (limits RAM usage)
        detection_pool = ThreadPoolExecutor(max_workers=4)
        download_sem = asyncio.Semaphore(30)
        temp_dir = Path(settings.temp_dir)
        temp_dir.mkdir(parents=True, exist_ok=True)

        async def _download_one(
            session: aiohttp.ClientSession, url: str
        ) -> Path | None:
            try:
                async with download_sem:
                    async with session.get(
                        url, timeout=aiohttp.ClientTimeout(total=15)
                    ) as resp:
                        if resp.status != 200:
                            return None
                        data = await resp.read()
                        if len(data) < 1000:
                            return None
                        if data[:2] not in (b"\xff\xd8", b"\x89P", b"RI"):
                            return None
                        path = temp_dir / f"{uuid4().hex[:8]}.jpg"
                        path.write_bytes(data)
                        return path
            except Exception:
                return None

        def _detect_sync(model, image_path: Path) -> list:
            try:
                from src.utils.image_download import load_and_resize

                img = load_and_resize(image_path)
                if img is None:
                    return []
                return model.get(img)
            except Exception:
                return []

        async def _get_known_urls(page_urls: list[str]) -> set[str]:
            if not page_urls:
                return set()
            from sqlalchemy import text as sa_text
            from src.db.connection import async_session

            async with async_session() as db:
                phs = ", ".join(f":u{i}" for i in range(len(page_urls)))
                params = {f"u{i}": url for i, url in enumerate(page_urls)}
                result = await db.execute(
                    sa_text(
                        f"SELECT page_url FROM discovered_images "
                        f"WHERE page_url IN ({phs}) AND face_count IS NOT NULL"
                    ),
                    params,
                )
                return {row[0] for row in result.fetchall()}

        thumb_sem = asyncio.Semaphore(10)

        async def _process_page(
            http_session: aiohttp.ClientSession,
            page_results: list[DiscoveredImageResult],
            known: set[str],
            tag: str | None = None,
        ) -> tuple[list[InlineDetectedImage], dict]:
            ps = {"downloaded": 0, "failures": 0, "faces": 0, "dedup": 0}
            to_process = []
            for img in page_results:
                if img.page_url and img.page_url in known:
                    ps["dedup"] += 1
                else:
                    to_process.append(img)

            if not to_process:
                return [], ps

            # Download batch
            dl_tasks = [_download_one(http_session, img.source_url) for img in to_process]
            paths = await asyncio.gather(*dl_tasks)

            loop = asyncio.get_event_loop()
            # Phase 1: Run face detection, collect (image_data, path) pairs
            pending_uploads: list[tuple[InlineDetectedImage, Path]] = []

            for img, path in zip(to_process, paths):
                if path is None:
                    ps["failures"] += 1
                    continue
                ps["downloaded"] += 1

                try:
                    faces_raw = await loop.run_in_executor(
                        detection_pool, _detect_sync, face_model, path
                    )
                    has_face = len(faces_raw) > 0
                    face_list = []
                    for fi, face in enumerate(faces_raw):
                        face_list.append(
                            InlineDetectedFace(
                                face_index=fi,
                                embedding=face.normed_embedding,
                                detection_score=float(face.det_score),
                            )
                        )

                    if has_face:
                        ps["faces"] += len(faces_raw)

                    detected_img = InlineDetectedImage(
                        source_url=img.source_url,
                        page_url=img.page_url,
                        page_title=img.page_title,
                        has_face=has_face,
                        face_count=len(faces_raw),
                        faces=face_list,
                        image_stored_url=None,
                        search_term=tag,
                    )
                    pending_uploads.append((detected_img, path))
                except Exception as e:
                    log.error("inline_detect_error", error=str(e))
                    path.unlink(missing_ok=True)

            if not pending_uploads:
                return [], ps

            # Phase 2: Upload thumbnails concurrently (semaphore caps in-flight)
            async def _upload_and_cleanup(
                det_img: InlineDetectedImage, path: Path
            ) -> InlineDetectedImage:
                try:
                    async with thumb_sem:
                        stored_url = await upload_thumbnail(path, platform="deviantart", http_session=http_session)
                    det_img.image_stored_url = stored_url
                except Exception as e:
                    log.warning("thumbnail_concurrent_error", error=str(e))
                finally:
                    path.unlink(missing_ok=True)
                return det_img

            upload_tasks = [
                _upload_and_cleanup(det_img, path)
                for det_img, path in pending_uploads
            ]
            results = await asyncio.gather(*upload_tasks, return_exceptions=True)

            detected: list[InlineDetectedImage] = []
            for r in results:
                if isinstance(r, Exception):
                    log.error("thumbnail_upload_exception", error=repr(r))
                else:
                    detected.append(r)

            return detected, ps

        async def _crawl_tag_inline(
            http_session: aiohttp.ClientSession,
            tag: str,
        ) -> None:
            if circuit_tripped.is_set():
                async with cursors_lock:
                    updated_cursors[tag] = saved_cursors.get(tag)
                return

            async with semaphore:
                if circuit_tripped.is_set():
                    async with cursors_lock:
                        updated_cursors[tag] = saved_cursors.get(tag)
                    return

                max_pages = tag_depths.get(tag, settings.deviantart_max_pages)
                start_offset = saved_cursors.get(tag)
                mode, position = self._parse_cursor(start_offset)

                try:
                    for page_num in range(1, max_pages + 1):
                        # Fetch page
                        if mode == "rss":
                            page_results, has_next = await self._fetch_rss_page(
                                http_session, limiter, tag, position
                            )
                            if not page_results and page_num == 1 and position == 0:
                                mode = "html"
                                position = 1
                                page_results, has_next = await self._fetch_html_page(
                                    http_session, limiter, tag, position
                                )
                        else:
                            page_results, has_next = await self._fetch_html_page(
                                http_session, limiter, tag, position
                            )

                        if not page_results:
                            if not has_next:
                                async with cursors_lock:
                                    updated_cursors[tag] = None
                                return
                            if mode == "rss":
                                position += RSS_PAGE_SIZE
                            else:
                                position += 1
                            continue

                        # Dedup check
                        page_urls = [r.page_url for r in page_results if r.page_url]
                        known = await _get_known_urls(page_urls)

                        # Download + detect + collect
                        detected, ps = await _process_page(http_session, page_results, known, tag=tag)

                        async with images_lock:
                            all_images.extend(detected)
                        async with stats_lock:
                            inline_stats["downloaded"] += ps["downloaded"]
                            inline_stats["failures"] += ps["failures"]
                            inline_stats["faces"] += ps["faces"]

                        # Early stop on mostly-known content
                        if len(page_results) > 0 and page_num > 1:
                            dedup_ratio = ps["dedup"] / len(page_results)
                            if dedup_ratio >= DEDUP_STOP_RATIO:
                                async with cursors_lock:
                                    updated_cursors[tag] = f"{mode}:{position}"
                                return

                        # Advance
                        if has_next and len(page_results) > 0:
                            if mode == "rss":
                                position += RSS_PAGE_SIZE
                            else:
                                position += 1
                        else:
                            async with cursors_lock:
                                updated_cursors[tag] = None
                            return

                    # Reached max_pages
                    async with cursors_lock:
                        updated_cursors[tag] = f"{mode}:{position}"

                except CircuitOpenError:
                    circuit_tripped.set()
                    async with cursors_lock:
                        updated_cursors[tag] = saved_cursors.get(tag)
                except Exception as e:
                    log.error("inline_tag_error", tag=tag, error=repr(e))
                    async with cursors_lock:
                        updated_cursors[tag] = saved_cursors.get(tag)
                finally:
                    gc.collect()

        # Run all tags
        connector = aiohttp.TCPConnector(limit=30)
        async with aiohttp.ClientSession(
            headers={"User-Agent": USER_AGENT},
            auto_decompress=True,
            connector=connector,
        ) as http_session:
            tasks = [_crawl_tag_inline(http_session, tag) for tag in effective_tags]
            await asyncio.gather(*tasks)

        detection_pool.shutdown(wait=False)
        gc.collect()

        tags_exhausted = sum(1 for c in updated_cursors.values() if c is None)

        log.info(
            "deviantart_inline_complete",
            images=len(all_images),
            downloaded=inline_stats["downloaded"],
            failures=inline_stats["failures"],
            faces=inline_stats["faces"],
            tags_total=len(effective_tags),
            tags_exhausted=tags_exhausted,
        )

        return InlineDiscoveryResult(
            images=all_images,
            search_cursors=updated_cursors,
            tags_total=len(effective_tags),
            tags_exhausted=tags_exhausted,
            images_downloaded=inline_stats["downloaded"],
            download_failures=inline_stats["failures"],
            faces_found=inline_stats["faces"],
        )

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        results: list[DiscoveredImageResult] = []
        results_lock = asyncio.Lock()
        limiter = get_limiter("deviantart")
        saved_cursors = context.search_cursors or {}
        updated_cursors: dict[str, str | None] = {}
        cursors_lock = asyncio.Lock()
        effective_tags = context.search_terms if context.search_terms else ALL_TAGS
        tag_depths = context.tag_depths or {}
        self._proxy = settings.proxy_url or None
        circuit_tripped = asyncio.Event()
        semaphore = asyncio.Semaphore(settings.deviantart_concurrency)

        async def _fetch_one_tag(
            session: aiohttp.ClientSession,
            tag: str,
        ) -> None:
            if circuit_tripped.is_set():
                async with cursors_lock:
                    updated_cursors[tag] = saved_cursors.get(tag)
                return

            async with semaphore:
                if circuit_tripped.is_set():
                    async with cursors_lock:
                        updated_cursors[tag] = saved_cursors.get(tag)
                    return

                start_offset = saved_cursors.get(tag)
                tag_max = tag_depths.get(tag)
                try:
                    tag_results, final_offset = await self._fetch_tag_pages(
                        session, limiter, tag, start_offset, tag_max_pages=tag_max
                    )
                    async with results_lock:
                        results.extend(tag_results)
                    async with cursors_lock:
                        updated_cursors[tag] = final_offset
                except CircuitOpenError:
                    log.warning("deviantart_circuit_open", tag=tag)
                    circuit_tripped.set()
                    async with cursors_lock:
                        updated_cursors[tag] = saved_cursors.get(tag)
                except Exception as e:
                    log.error("deviantart_tag_error", tag=tag, error=repr(e))
                    async with cursors_lock:
                        updated_cursors[tag] = saved_cursors.get(tag)

        async with aiohttp.ClientSession(
            headers={"User-Agent": USER_AGENT},
            auto_decompress=True,
        ) as session:
            # Tags arrive pre-sorted by priority; semaphore FIFO ensures
            # highest-priority tags start first.
            tasks = [_fetch_one_tag(session, tag) for tag in effective_tags]
            await asyncio.gather(*tasks)

        tags_exhausted = sum(1 for c in updated_cursors.values() if c is None)

        log.info(
            "deviantart_crawl_complete",
            results_found=len(results),
            tags_total=len(effective_tags),
            tags_exhausted=tags_exhausted,
        )
        return DiscoveryResult(
            images=results,
            search_cursors=updated_cursors,
            tags_total=len(effective_tags),
            tags_exhausted=tags_exhausted,
        )

    async def _fetch_tag_pages(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
        start_offset: str | None,
        tag_max_pages: int | None = None,
    ) -> tuple[list[DiscoveredImageResult], str | None]:
        """Fetch multiple pages for a single tag, up to max_pages.

        Returns (results, final_offset). final_offset is None if tag exhausted.
        Cursor format: "rss:{offset}" for RSS mode, "html:{page}" for HTML mode.
        """
        all_results: list[DiscoveredImageResult] = []
        max_pages = tag_max_pages or settings.deviantart_max_pages

        # Parse cursor to determine mode and position
        mode, position = self._parse_cursor(start_offset)

        for page_num in range(1, max_pages + 1):
            if mode == "rss":
                page_results, has_next = await self._fetch_rss_page(
                    session, limiter, tag, position
                )
                # If RSS returned 403 (empty results on first try), switch to HTML
                if not page_results and page_num == 1 and position == 0:
                    log.info("deviantart_rss_fallback", tag=tag)
                    mode = "html"
                    position = 1
                    page_results, has_next = await self._fetch_html_page(
                        session, limiter, tag, position
                    )
            else:
                page_results, has_next = await self._fetch_html_page(
                    session, limiter, tag, position
                )

            all_results.extend(page_results)

            log.info(
                "deviantart_page_fetched",
                tag=tag,
                page=page_num,
                mode=mode,
                position=position,
                count=len(page_results),
            )

            if has_next and len(page_results) > 0:
                if mode == "rss":
                    position += RSS_PAGE_SIZE
                else:
                    position += 1
            else:
                return all_results, None

        # Reached max_pages — save cursor to resume next tick
        return all_results, f"{mode}:{position}"

    @staticmethod
    def _parse_cursor(cursor: str | None) -> tuple[str, int]:
        """Parse a cursor string into (mode, position).

        Formats: "rss:120", "html:3", or legacy bare int "120" (treated as rss).
        Returns ("html", 1) for None/empty — HTML is the default mode.
        """
        if not cursor:
            return "html", 1
        if ":" in cursor:
            mode, pos_str = cursor.split(":", 1)
            return mode, int(pos_str) if pos_str.isdigit() else 0
        # Legacy bare integer — treat as RSS offset
        return "rss", int(cursor) if cursor.isdigit() else 0

    @with_circuit_breaker("deviantart")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_rss_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
        offset: int,
    ) -> tuple[list[DiscoveredImageResult], bool]:
        """Fetch one page of RSS results for a tag.

        Returns (results, has_next_page).
        """
        results: list[DiscoveredImageResult] = []

        params = {
            "q": f"sort:time tag:{tag}",
            "offset": str(offset),
        }

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(DEVIANTART_RSS_URL, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("deviantart_rss_error", status=resp.status, tag=tag, offset=offset)
                return results, False

            xml_text = await resp.text()

        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            log.error("deviantart_xml_parse_error", tag=tag, offset=offset, error=repr(e))
            return results, False

        channel = root.find("channel")
        if channel is None:
            return results, False

        # Check for next page link
        has_next = False
        for link in channel.findall("atom:link", NS):
            if link.get("rel") == "next":
                has_next = True
                break

        # Parse items
        for item in channel.findall("item"):
            image_url = self._extract_best_image(item)
            if not image_url:
                continue

            page_url = None
            link_el = item.find("link")
            if link_el is not None and link_el.text:
                page_url = link_el.text.strip()

            title = None
            title_el = item.find("media:title", NS)
            if title_el is not None and title_el.text:
                title = title_el.text.strip()

            results.append(
                DiscoveredImageResult(
                    source_url=image_url,
                    page_url=page_url,
                    page_title=title[:200] if title else None,
                    platform="deviantart",
                )
            )

        return results, has_next

    @with_circuit_breaker("deviantart")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_html_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
        page: int,
    ) -> tuple[list[DiscoveredImageResult], bool]:
        """Fetch one page of HTML tag results as fallback when RSS returns 403.

        Scrapes https://www.deviantart.com/tag/{tag}?page={n}.
        Returns (results, has_next_page).
        """
        results: list[DiscoveredImageResult] = []

        # Build URL — spaces in tags become hyphens in the URL path
        tag_slug = tag.replace(" ", "-")
        url = f"{DEVIANTART_TAG_URL}/{tag_slug}"
        params = {"page": str(page)} if page > 1 else {}

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(url, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("deviantart_html_error", status=resp.status, tag=tag, page=page)
                return results, False

            html = await resp.text()

        # Extract paired (deviation_link, image_url) from HTML
        for match in _HTML_PAIR_RE.finditer(html):
            page_url = match.group(1).split("#")[0]  # Strip #comments
            image_url = match.group(2)

            title = self._title_from_url(page_url)

            results.append(
                DiscoveredImageResult(
                    source_url=image_url,
                    page_url=page_url,
                    page_title=title[:200] if title else None,
                    platform="deviantart",
                )
            )

        # Check for next page link
        next_page = page + 1
        has_next = f"page={next_page}" in html

        return results, has_next

    @staticmethod
    def _title_from_url(deviation_url: str) -> str | None:
        """Extract a human-readable title from a deviation URL.

        /username/art/Triss-Merigold-Cosplay-12345 → "Triss Merigold Cosplay"
        """
        m = _TITLE_FROM_URL_RE.search(deviation_url)
        if m:
            return m.group(1).replace("-", " ")
        return None

    @staticmethod
    def _extract_best_image(item: ET.Element) -> str | None:
        """Extract the highest-resolution image URL from an RSS item.

        DeviantArt RSS includes multiple <media:content> elements at different
        resolutions. We pick the one with the largest width, or fall back to
        the first one with a url attribute.
        """
        best_url: str | None = None
        best_width = 0

        for content in item.findall("media:content", NS):
            url = content.get("url")
            if not url:
                continue

            medium = content.get("medium", "image")
            if medium != "image":
                continue

            width_str = content.get("width")
            if width_str and width_str.isdigit():
                width = int(width_str)
                if width > best_width:
                    best_width = width
                    best_url = url
            elif best_url is None:
                best_url = url

        return best_url
