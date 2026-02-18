"""DeviantArt taxonomy mapper — discovers content sections via tag browse probes."""

import time

import aiohttp

from src.config import settings
from src.intelligence.mapper.base import BasePlatformMapper, PlatformMap, Section
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async

log = get_logger("deviantart_mapper")

DEVIANTART_TOKEN_URL = "https://www.deviantart.com/oauth2/token"
DEVIANTART_BROWSE_TAGS_URL = "https://www.deviantart.com/api/v1/oauth2/browse/tags"

# Section definitions
DEVIANTART_SECTIONS: dict[str, dict] = {
    "deviantart:ai_portraits": {
        "name": "AI Portraits",
        "probe_tag": "aiportrait",
        "tags": ["aiportrait", "ai_face", "stable_diffusion"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_realistic": {
        "name": "AI Realistic",
        "probe_tag": "photorealistic",
        "tags": ["photorealistic", "realistic", "ai_generated"],
        "content_types": ["deviation"],
    },
    "deviantart:faceswap": {
        "name": "Faceswap/Deepfake",
        "probe_tag": "deepfake",
        "tags": ["deepfake", "photomanipulation"],
        "content_types": ["deviation"],
    },
    "deviantart:celeb": {
        "name": "Celebrity",
        "probe_tag": "celebrity",
        "tags": ["celebrity", "famous"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_fantasy": {
        "name": "AI Fantasy",
        "probe_tag": "fantasy",
        "tags": ["fantasy", "fictional", "ai_generated"],
        "content_types": ["deviation"],
    },
    "deviantart:portraits": {
        "name": "Portraits",
        "probe_tag": "portrait",
        "tags": ["portrait", "headshot", "face"],
        "content_types": ["deviation"],
    },
    "deviantart:figure": {
        "name": "Figure",
        "probe_tag": "figure",
        "tags": ["figure", "lingerie", "curves", "nude"],
        "content_types": ["deviation"],
    },
}

# Maps section_id -> search tags the crawler should use for that section
SECTION_TO_SEARCH_TERMS: dict[str, list[str]] = {
    "deviantart:ai_portraits": ["aiportrait", "ai_face", "stable_diffusion"],
    "deviantart:ai_realistic": ["photorealistic", "realistic", "ai_generated"],
    "deviantart:faceswap": ["deepfake", "photomanipulation"],
    "deviantart:celeb": ["celebrity", "famous"],
    "deviantart:ai_fantasy": ["fantasy", "fictional"],
    "deviantart:portraits": ["portrait", "headshot", "face"],
    "deviantart:figure": ["figure", "lingerie", "curves", "nude"],
}


class DeviantArtMapper(BasePlatformMapper):
    """Maps DeviantArt's content taxonomy via tag browse probes."""

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires: float = 0.0

    def get_platform(self) -> str:
        return "deviantart"

    async def build_map(self) -> PlatformMap:
        """Probe each section via tag browse API to estimate content counts."""
        sections: list[Section] = []
        limiter = get_limiter("deviantart_mapper")

        async with aiohttp.ClientSession(
            headers={"User-Agent": "MadeOfUs-Scanner/1.0"},
        ) as session:
            try:
                await self._ensure_token(session)
            except Exception as e:
                log.error("deviantart_mapper_token_error", error=str(e))
                return PlatformMap(platform="deviantart", sections=[])

            for section_id, rule in DEVIANTART_SECTIONS.items():
                try:
                    total = await self._probe_section(session, limiter, rule)
                    sections.append(
                        Section(
                            section_id=section_id,
                            section_name=rule["name"],
                            platform="deviantart",
                            total_content=total,
                            tags=rule["tags"],
                            content_types=rule["content_types"],
                        )
                    )
                    log.info("deviantart_section_probed", section=section_id, total=total)
                except Exception as e:
                    log.error("deviantart_section_probe_error", section=section_id, error=str(e))
                    sections.append(
                        Section(
                            section_id=section_id,
                            section_name=rule["name"],
                            platform="deviantart",
                            total_content=0,
                            tags=rule["tags"],
                            content_types=rule["content_types"],
                        )
                    )

        log.info("deviantart_map_complete", sections=len(sections))
        return PlatformMap(platform="deviantart", sections=sections)

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
        self._token_expires = time.monotonic() + expires_in - 60
        log.info("deviantart_mapper_token_acquired", expires_in=expires_in)

    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _probe_section(
        self,
        session: aiohttp.ClientSession,
        limiter,
        rule: dict,
    ) -> int:
        """Probe a single section by querying its primary tag to estimate content count.

        DeviantArt browse/tags returns results array + has_more flag.
        We request limit=24 (max page) and estimate from items + pagination.
        """
        tag = rule["probe_tag"]
        params = {
            "tag": tag,
            "offset": 0,
            "limit": 24,
            "mature_content": "true",
        }
        headers = {"Authorization": f"Bearer {self._token}"}

        await limiter.acquire()
        async with session.get(DEVIANTART_BROWSE_TAGS_URL, params=params, headers=headers) as resp:
            if resp.status == 401:
                self._token = None
                self._token_expires = 0.0
                raise RuntimeError("DeviantArt token expired (401)")

            if resp.status != 200:
                log.warning("deviantart_probe_error", status=resp.status, tag=tag)
                return 0

            data = await resp.json()

        # Try estimated_total first (may exist on some endpoints)
        estimated = data.get("estimated_total")
        if estimated and estimated > 0:
            return estimated

        # Fall back to counting items + has_more pagination
        items_count = len(data.get("results", []))
        has_more = data.get("has_more", False)

        if has_more and items_count >= 24:
            # More than one page — estimate conservatively
            return items_count * 20
        return items_count
