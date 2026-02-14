"""Stock photography platform searcher for finding candidate matches."""

from uuid import UUID

import aiohttp
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from src.ad_intelligence.queries import insert_stock_candidate
from src.config import settings
from src.matching.detector import detect_faces
from src.matching.embedder import get_face_embedding
from src.utils.image_download import download_image
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async, with_circuit_breaker

log = get_logger("stock_searcher")


class StockSearcher:
    """Searches stock photography platforms for face matches."""

    async def search(
        self,
        session: AsyncSession,
        face_id: UUID,
        keywords: list[str],
        max_results: int = 10,
    ) -> int:
        """Search all enabled stock platforms for matching faces.

        Args:
            session: Database session.
            face_id: Ad intel face ID to search for.
            keywords: Search keywords from face description.
            max_results: Max results per platform.

        Returns:
            Total candidates found across all platforms.
        """
        total = 0
        search_query = " ".join(keywords[:5])  # Use top 5 keywords

        if settings.shutterstock_api_key:
            try:
                count = await self._search_shutterstock(
                    session, face_id, search_query, max_results,
                )
                total += count
            except Exception as e:
                log.error("shutterstock_search_error", error=str(e))

        if settings.getty_api_key:
            try:
                count = await self._search_getty(
                    session, face_id, search_query, max_results,
                )
                total += count
            except Exception as e:
                log.error("getty_search_error", error=str(e))

        if settings.adobe_stock_api_key:
            try:
                count = await self._search_adobe(
                    session, face_id, search_query, max_results,
                )
                total += count
            except Exception as e:
                log.error("adobe_search_error", error=str(e))

        log.info("stock_search_complete", face_id=str(face_id), total_candidates=total)
        return total

    @with_circuit_breaker("shutterstock")
    @retry_async(max_attempts=2, min_wait=1.0, max_wait=15.0, retry_on=(aiohttp.ClientError,))
    async def _search_shutterstock(
        self,
        session: AsyncSession,
        face_id: UUID,
        query: str,
        max_results: int,
    ) -> int:
        """Search Shutterstock for stock images matching keywords.

        Uses HTTP Basic auth with API key and secret.
        """
        limiter = get_limiter("shutterstock")
        await limiter.acquire()

        auth = aiohttp.BasicAuth(
            settings.shutterstock_api_key,
            settings.shutterstock_api_secret,
        )

        params = {
            "query": query,
            "image_type": "photo",
            "people_number": "1",
            "per_page": str(max_results),
            "sort": "relevance",
        }

        count = 0
        async with aiohttp.ClientSession(auth=auth) as http_session:
            async with http_session.get(
                "https://api.shutterstock.com/v2/images/search",
                params=params,
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    log.warning("shutterstock_api_error", status=resp.status, body=body[:200])
                    return 0
                data = await resp.json()

            for item in data.get("data", []):
                image_id = str(item.get("id", ""))
                if not image_id:
                    continue

                assets = item.get("assets", {})
                preview = assets.get("preview", {}) or assets.get("large_thumb", {})
                preview_url = preview.get("url")
                if not preview_url:
                    continue

                contributor_info = item.get("contributor", {})
                photographer = contributor_info.get("id")

                embedding, similarity = await self._process_preview(preview_url)

                candidate = await insert_stock_candidate(
                    session,
                    face_id=face_id,
                    stock_platform="shutterstock",
                    stock_image_id=image_id,
                    stock_image_url=preview_url,
                    photographer=photographer,
                    license_type=item.get("media_type", "photo"),
                    embedding=embedding.tolist() if embedding is not None else None,
                    similarity_score=similarity,
                )
                if candidate:
                    count += 1

        return count

    @with_circuit_breaker("getty")
    @retry_async(max_attempts=2, min_wait=1.0, max_wait=15.0, retry_on=(aiohttp.ClientError,))
    async def _search_getty(
        self,
        session: AsyncSession,
        face_id: UUID,
        query: str,
        max_results: int,
    ) -> int:
        """Search Getty Images for stock images matching keywords."""
        limiter = get_limiter("getty")
        await limiter.acquire()

        headers = {
            "Api-Key": settings.getty_api_key,
        }

        params = {
            "phrase": query,
            "number_of_people": "one",
            "page_size": str(max_results),
            "sort_order": "best_match",
            "fields": "id,title,display_sizes,artist,max_dimensions",
        }

        count = 0
        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(
                "https://api.gettyimages.com/v3/search/images/creative",
                headers=headers,
                params=params,
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    log.warning("getty_api_error", status=resp.status, body=body[:200])
                    return 0
                data = await resp.json()

            for item in data.get("images", []):
                image_id = str(item.get("id", ""))
                if not image_id:
                    continue

                display_sizes = item.get("display_sizes", [])
                preview_url = None
                for ds in display_sizes:
                    if ds.get("name") == "comp":
                        preview_url = ds.get("uri")
                        break
                if not preview_url and display_sizes:
                    preview_url = display_sizes[0].get("uri")
                if not preview_url:
                    continue

                photographer = item.get("artist")

                embedding, similarity = await self._process_preview(preview_url)

                candidate = await insert_stock_candidate(
                    session,
                    face_id=face_id,
                    stock_platform="getty",
                    stock_image_id=image_id,
                    stock_image_url=preview_url,
                    photographer=photographer,
                    license_type="creative",
                    embedding=embedding.tolist() if embedding is not None else None,
                    similarity_score=similarity,
                )
                if candidate:
                    count += 1

        return count

    @with_circuit_breaker("adobe_stock")
    @retry_async(max_attempts=2, min_wait=1.0, max_wait=15.0, retry_on=(aiohttp.ClientError,))
    async def _search_adobe(
        self,
        session: AsyncSession,
        face_id: UUID,
        query: str,
        max_results: int,
    ) -> int:
        """Search Adobe Stock for stock images matching keywords."""
        limiter = get_limiter("adobe_stock")
        await limiter.acquire()

        headers = {
            "x-api-key": settings.adobe_stock_api_key,
            "x-product": "MadeOfUs/1.0",
        }

        params = {
            "search_parameters[words]": query,
            "search_parameters[filters][content_type:photo]": "1",
            "search_parameters[filters][people]": "true",
            "search_parameters[limit]": str(max_results),
            "result_columns[]": ["id", "title", "thumbnail_url", "creator_name", "comp_url"],
        }

        count = 0
        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(
                "https://stock.adobe.io/Rest/Media/1/Search/Files",
                headers=headers,
                params=params,
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    log.warning("adobe_api_error", status=resp.status, body=body[:200])
                    return 0
                data = await resp.json()

            for item in data.get("files", []):
                image_id = str(item.get("id", ""))
                if not image_id:
                    continue

                preview_url = item.get("comp_url") or item.get("thumbnail_url")
                if not preview_url:
                    continue

                photographer = item.get("creator_name")

                embedding, similarity = await self._process_preview(preview_url)

                candidate = await insert_stock_candidate(
                    session,
                    face_id=face_id,
                    stock_platform="adobe_stock",
                    stock_image_id=image_id,
                    stock_image_url=preview_url,
                    photographer=photographer,
                    license_type="standard",
                    embedding=embedding.tolist() if embedding is not None else None,
                    similarity_score=similarity,
                )
                if candidate:
                    count += 1

        return count

    async def _process_preview(
        self,
        preview_url: str,
    ) -> tuple[np.ndarray | None, float | None]:
        """Download a preview image, detect faces, and extract embedding.

        Returns:
            Tuple of (embedding, detection_score) or (None, None).
        """
        local_path = await download_image(preview_url)
        if local_path is None:
            return None, None

        try:
            faces = detect_faces(local_path)
            if not faces:
                return None, None

            # Use the first (most prominent) face
            face = faces[0]
            embedding = get_face_embedding(face)
            score = float(face.det_score) if hasattr(face, "det_score") else None

            return embedding, score

        except Exception as e:
            log.warning("preview_process_error", url=preview_url, error=str(e))
            return None, None
        finally:
            local_path.unlink(missing_ok=True)
