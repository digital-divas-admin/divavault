"""CivitAI platform crawl discovery source."""

import aiohttp

from src.config import settings
from src.discovery.base import BaseDiscoverySource, DiscoveredImageResult, DiscoveryContext, DiscoveryResult
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import CircuitOpenError, retry_async, with_circuit_breaker

log = get_logger("platform_crawl")

CIVITAI_IMAGES_URL = "https://civitai.com/api/v1/images"
CIVITAI_MODELS_URL = "https://civitai.com/api/v1/models"

# Tags to search for human-producing LoRA models via CivitAI models API
LORA_HUMAN_TAGS = [
    "realistic", "photorealistic", "celebrity", "person",
    "portrait", "photography", "face", "woman", "man",
]

# Targeted image search terms — high-yield queries for face content
DEFAULT_IMAGE_SEARCH_TERMS = [
    "woman", "man", "portrait", "photorealistic face",
    "real person", "headshot", "actress", "model",
]


class CivitAICrawl(BaseDiscoverySource):
    """Platform crawl for CivitAI — high-risk platform for AI-generated likeness content."""

    def __init__(self) -> None:
        self._proxy: str | None = None

    def get_source_type(self) -> str:
        return "platform_crawl"

    def get_source_name(self) -> str:
        return "civitai"

    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        results: list[DiscoveredImageResult] = []
        last_cursor: str | None = None
        search_cursors: dict[str, str | None] | None = None
        limiter = get_limiter("civitai")
        self._proxy = settings.proxy_url or None
        backfill = context.backfill

        estimated_total: int | None = None

        # In backfill mode, use backfill cursors instead of sweep cursors
        effective_search_cursors = context.backfill_cursors if backfill else context.search_cursors
        effective_model_cursors = context.backfill_model_cursors if backfill else context.model_cursors

        async with aiohttp.ClientSession() as session:
            # 1. Paginated global feed (newest images, cursor-resumed)
            try:
                image_results, last_cursor, estimated_total = await self._fetch_images(
                    session, limiter, context.cursor, backfill=backfill,
                )
                results.extend(image_results)
            except CircuitOpenError:
                log.warning("civitai_circuit_open")
                return DiscoveryResult(images=results, next_cursor=last_cursor)
            except Exception as e:
                log.error("civitai_images_error", error=str(e))

            # 2. Targeted image searches (query-based, cursor-resumed per term)
            try:
                search_results, search_cursors = await self._fetch_image_searches(
                    session, limiter, effective_search_cursors,
                    search_terms=context.search_terms if context.search_terms else None,
                    backfill=backfill,
                )
                results.extend(search_results)
            except CircuitOpenError:
                log.warning("civitai_circuit_open")
            except Exception as e:
                log.error("civitai_image_search_error", error=str(e))

            # 3. LoRA model sample images (filtered by human-relevant tags)
            model_cursors: dict[str, str | None] | None = None
            try:
                lora_results, model_cursors = await self._fetch_lora_models_by_tags(
                    session, limiter, effective_model_cursors,
                    tags=context.search_terms if context.search_terms else None,
                    backfill=backfill,
                )
                results.extend(lora_results)
            except CircuitOpenError:
                log.warning("civitai_circuit_open")
            except Exception as e:
                log.error("civitai_lora_error", error=str(e))

        # Compute tag exhaustion stats
        effective_tag_count = len(context.search_terms) if context.search_terms else len(LORA_HUMAN_TAGS)
        tags_total = effective_tag_count
        tags_exhausted_count = 0
        if model_cursors:
            if backfill:
                tags_exhausted_count = sum(1 for c in model_cursors.values() if c == "exhausted")
            else:
                tags_exhausted_count = sum(1 for c in model_cursors.values() if c is None)

        log.info(
            "civitai_crawl_complete",
            results_found=len(results),
            tags_total=tags_total,
            tags_exhausted=tags_exhausted_count,
        )
        return DiscoveryResult(
            images=results,
            next_cursor=last_cursor,
            search_cursors=search_cursors,
            model_cursors=model_cursors,
            tags_total=tags_total,
            tags_exhausted=tags_exhausted_count,
            estimated_total_images=estimated_total,
        )

    async def _fetch_images(
        self,
        session: aiohttp.ClientSession,
        limiter,
        cursor: str | None = None,
        backfill: bool = False,
    ) -> tuple[list[DiscoveredImageResult], str | None, int | None]:
        """Fetch images across multiple pages using cursor pagination.

        Returns (results, last_cursor, estimated_total_images).
        """
        all_results: list[DiscoveredImageResult] = []
        current_cursor = cursor
        last_valid_cursor: str | None = cursor
        max_pages = settings.civitai_backfill_pages if backfill else settings.civitai_max_pages
        nsfw_filter = settings.civitai_nsfw_filter
        estimated_total: int | None = None

        for page in range(1, max_pages + 1):
            try:
                page_results, next_cursor = await self._fetch_images_page(
                    session, limiter, current_cursor, nsfw_filter
                )
                all_results.extend(page_results)

                log.info(
                    "civitai_page_fetched",
                    page=page,
                    count=len(page_results),
                    next_cursor=next_cursor,
                )

                if next_cursor:
                    last_valid_cursor = next_cursor
                    current_cursor = next_cursor
                else:
                    # No more pages
                    if backfill:
                        # In backfill mode, use sentinel to prevent cursor reset
                        last_valid_cursor = "exhausted"
                    else:
                        # Sweep mode: signal fresh start on next crawl
                        last_valid_cursor = None
                    break

            except CircuitOpenError:
                log.warning("civitai_circuit_open_during_pagination", page=page)
                break
            except Exception as e:
                log.error("civitai_page_error", page=page, error=str(e))
                break

        # Capture totalItems from a lightweight API call (page 1, limit 1)
        try:
            await limiter.acquire()
            ssl_check = False if self._proxy else None
            async with session.get(
                CIVITAI_IMAGES_URL,
                params={"limit": 1, "sort": "Newest"},
                proxy=self._proxy,
                ssl=ssl_check,
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    total_items = data.get("metadata", {}).get("totalItems")
                    if total_items is not None:
                        estimated_total = int(total_items)
        except Exception as e:
            log.warning("civitai_total_items_error", error=str(e))

        return all_results, last_valid_cursor, estimated_total

    async def _fetch_image_searches(
        self,
        session: aiohttp.ClientSession,
        limiter,
        incoming_cursors: dict[str, str] | None = None,
        search_terms: list[str] | None = None,
        backfill: bool = False,
    ) -> tuple[list[DiscoveredImageResult], dict[str, str | None]]:
        """Search CivitAI images with face-targeted queries, paginated per term.

        Resumes each term from its saved cursor. Returns updated cursors so the
        next crawl tick picks up where this one left off.  When a term is
        exhausted (cursor=None), next tick restarts it from newest.
        In backfill mode, exhausted terms are marked "exhausted" and skipped.
        """
        all_results: list[DiscoveredImageResult] = []
        nsfw_filter = settings.civitai_nsfw_filter
        pages_per_term = settings.civitai_backfill_pages if backfill else settings.civitai_max_pages
        saved = incoming_cursors or {}
        updated_cursors: dict[str, str | None] = {}
        terms = search_terms if search_terms else DEFAULT_IMAGE_SEARCH_TERMS

        for term in terms:
            # In backfill mode, skip terms already fully exhausted
            if backfill and saved.get(term) == "exhausted":
                updated_cursors[term] = "exhausted"
                continue

            cursor: str | None = saved.get(term)
            term_count = 0

            for page in range(1, pages_per_term + 1):
                try:
                    results, next_cursor = await self._fetch_image_search_page(
                        session, limiter, term, nsfw_filter, cursor
                    )
                    all_results.extend(results)
                    term_count += len(results)

                    if next_cursor:
                        cursor = next_cursor
                    else:
                        # Exhausted this term
                        cursor = "exhausted" if backfill else None
                        break

                except CircuitOpenError:
                    log.warning("civitai_circuit_open_image_search", query=term, page=page)
                    break
                except Exception as e:
                    log.error("civitai_image_search_error", query=term, page=page, error=str(e))
                    break

            updated_cursors[term] = cursor

            if term_count > 0:
                log.info("civitai_image_search", query=term, count=term_count, pages=min(page, pages_per_term))

        return all_results, updated_cursors

    @with_circuit_breaker("civitai")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_image_search_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        query: str,
        nsfw_filter: str = "None",
        cursor: str | None = None,
    ) -> tuple[list[DiscoveredImageResult], str | None]:
        """Fetch one page of image search results for a specific query."""
        results: list[DiscoveredImageResult] = []

        params: dict = {
            "limit": 100,
            "sort": "Newest",
            "query": query,
        }
        if nsfw_filter:
            params["nsfw"] = nsfw_filter
        if cursor:
            params["cursor"] = cursor

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(CIVITAI_IMAGES_URL, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("civitai_image_search_api_error", status=resp.status, query=query)
                return results, None

            data = await resp.json()

        metadata = data.get("metadata", {})
        next_cursor = metadata.get("nextCursor")

        for item in data.get("items", []):
            image_url = item.get("url")
            if not image_url:
                continue

            if item.get("type") == "video":
                continue
            w, h = item.get("width") or 0, item.get("height") or 0
            if 0 < w < 100 or 0 < h < 100:
                continue

            image_id = item.get("id")
            page_url = f"https://civitai.com/images/{image_id}" if image_id else None
            meta = item.get("meta") or {}

            # All results from a face-targeted search are relevant — no filtering needed
            results.append(
                DiscoveredImageResult(
                    source_url=image_url,
                    page_url=page_url,
                    page_title=meta.get("prompt", "")[:200] if meta.get("prompt") else None,
                    platform="civitai",
                    search_term=query,
                )
            )

        return results, next_cursor

    @with_circuit_breaker("civitai")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_images_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        cursor: str | None = None,
        nsfw_filter: str = "None",
    ) -> tuple[list[DiscoveredImageResult], str | None]:
        """Fetch a single page of images from CivitAI API."""
        results: list[DiscoveredImageResult] = []
        next_cursor = None

        params: dict = {
            "limit": 100,
            "sort": "Newest",
        }
        if nsfw_filter:
            params["nsfw"] = nsfw_filter
        if cursor:
            params["cursor"] = cursor

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(CIVITAI_IMAGES_URL, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("civitai_images_api_error", status=resp.status)
                return results, None

            data = await resp.json()

        items = data.get("items", [])
        metadata = data.get("metadata", {})
        next_cursor = metadata.get("nextCursor")

        for item in items:
            image_url = item.get("url")
            if not image_url:
                continue

            if item.get("type") == "video":
                continue
            w, h = item.get("width") or 0, item.get("height") or 0
            if 0 < w < 100 or 0 < h < 100:
                continue

            # Build page URL
            image_id = item.get("id")
            page_url = f"https://civitai.com/images/{image_id}" if image_id else None

            # Check tags/metadata for face-related content
            meta = item.get("meta") or {}
            tags = [str(t).lower() for t in (item.get("tags") or [])]
            prompt = str(meta.get("prompt", "")).lower()

            # Filter for images likely to contain real faces
            face_indicators = [
                "portrait", "face", "person", "photorealistic", "photo",
                "headshot", "selfie", "woman", "man", "girl", "boy",
                "realistic", "real person",
            ]
            has_face_indicator = any(
                indicator in prompt or indicator in " ".join(tags)
                for indicator in face_indicators
            )

            if has_face_indicator or not tags:
                results.append(
                    DiscoveredImageResult(
                        source_url=image_url,
                        page_url=page_url,
                        page_title=meta.get("prompt", "")[:200] if meta.get("prompt") else None,
                        platform="civitai",
                    )
                )

        return results, next_cursor

    @with_circuit_breaker("civitai")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _fetch_lora_models_page(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
        cursor: str | None = None,
    ) -> tuple[list[DiscoveredImageResult], str | None]:
        """Fetch one page of LoRA models filtered by tag."""
        params: dict = {"types": "LORA", "sort": "Newest", "limit": 100, "tag": tag}
        if cursor:
            params["cursor"] = cursor

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(CIVITAI_MODELS_URL, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("civitai_lora_api_error", status=resp.status, tag=tag)
                return [], None
            data = await resp.json()

        next_cursor = data.get("metadata", {}).get("nextCursor")
        results: list[DiscoveredImageResult] = []

        for model in data.get("items", []):
            model_id = model.get("id")
            model_name = model.get("name", "")
            page_url = f"https://civitai.com/models/{model_id}" if model_id else None

            for version in model.get("modelVersions", []):
                for image in version.get("images", []):
                    if image.get("type") == "video":
                        continue
                    image_url = image.get("url")
                    if image_url:
                        results.append(
                            DiscoveredImageResult(
                                source_url=image_url,
                                page_url=page_url,
                                page_title=model_name[:200],
                                platform="civitai",
                                search_term=tag,
                            )
                        )

        return results, next_cursor

    async def _fetch_lora_models_by_tags(
        self,
        session: aiohttp.ClientSession,
        limiter,
        incoming_cursors: dict[str, str] | None = None,
        tags: list[str] | None = None,
        backfill: bool = False,
    ) -> tuple[list[DiscoveredImageResult], dict[str, str | None]]:
        """Crawl LoRA models per human-relevant tag, paginated with cursor resume.

        Each tag gets its own cursor so crawl progress is independent.
        When a tag is exhausted (cursor=None), next tick restarts it from newest.
        In backfill mode, exhausted tags are marked "exhausted" and skipped.
        """
        saved = incoming_cursors or {}
        updated_cursors: dict[str, str | None] = {}
        all_results: list[DiscoveredImageResult] = []
        max_pages = settings.civitai_model_pages_per_tag
        effective_tags = tags if tags else LORA_HUMAN_TAGS

        for tag in effective_tags:
            # In backfill mode, skip tags already fully exhausted
            if backfill and saved.get(tag) == "exhausted":
                updated_cursors[tag] = "exhausted"
                continue

            cursor: str | None = saved.get(tag)
            tag_count = 0

            for page in range(1, max_pages + 1):
                try:
                    results, next_cursor = await self._fetch_lora_models_page(
                        session, limiter, tag, cursor
                    )
                    all_results.extend(results)
                    tag_count += len(results)

                    if next_cursor:
                        cursor = next_cursor
                    else:
                        cursor = "exhausted" if backfill else None
                        break
                except CircuitOpenError:
                    break
                except Exception as e:
                    log.error("civitai_lora_page_error", tag=tag, page=page, error=str(e))
                    break

            updated_cursors[tag] = cursor
            if tag_count > 0:
                log.info("civitai_lora_tag_done", tag=tag, images=tag_count)

        return all_results, updated_cursors
