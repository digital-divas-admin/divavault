"""CivitAI taxonomy mapper — discovers content sections via lightweight API probes."""

import aiohttp

from src.intelligence.mapper.base import BasePlatformMapper, PlatformMap, Section
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async, with_circuit_breaker

log = get_logger("civitai_mapper")

CIVITAI_MODELS_URL = "https://civitai.com/api/v1/models"
CIVITAI_IMAGES_URL = "https://civitai.com/api/v1/images"

# Section definitions: section_id -> (name, query_type, query_params)
# query_type: "models" queries /api/v1/models, "images" queries /api/v1/images
SECTION_RULES: dict[str, dict] = {
    "civitai:lora_real_person": {
        "name": "LoRA - Real Person",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "real person", "limit": 1},
        "tags": ["real person", "realistic portrait", "real face"],
        "content_types": ["lora"],
    },
    "civitai:lora_celebrity": {
        "name": "LoRA - Celebrity",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "celebrity", "limit": 1},
        "tags": ["celebrity", "famous", "actor", "actress", "singer"],
        "content_types": ["lora"],
    },
    "civitai:lora_instagram": {
        "name": "LoRA - Instagram/Influencer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "instagram", "limit": 1},
        "tags": ["instagram", "influencer", "tiktoker", "social media"],
        "content_types": ["lora"],
    },
    "civitai:lora_nsfw_person": {
        "name": "LoRA - NSFW Person",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nsfw", "limit": 1, "query": "real person"},
        "tags": ["nsfw", "real", "person"],
        "content_types": ["lora"],
    },
    "civitai:lora_nsfw_deepfake": {
        "name": "LoRA - NSFW Deepfake",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "deepfake", "limit": 1},
        "tags": ["deepfake", "face swap"],
        "content_types": ["lora"],
    },
    "civitai:lora_nsfw_other": {
        "name": "LoRA - NSFW Other",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nsfw", "limit": 1},
        "tags": ["nsfw"],
        "content_types": ["lora"],
    },
    "civitai:lora_portrait": {
        "name": "LoRA - Portrait",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "portrait", "limit": 1},
        "tags": ["portrait", "face", "headshot", "photorealistic"],
        "content_types": ["lora"],
    },
    "civitai:lora_anime": {
        "name": "LoRA - Anime",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "anime", "limit": 1},
        "tags": ["anime", "cartoon", "manga", "illustration", "2d"],
        "content_types": ["lora"],
    },
    "civitai:lora_style": {
        "name": "LoRA - Style/Concept",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "style", "limit": 1},
        "tags": ["style", "concept", "aesthetic", "art style"],
        "content_types": ["lora"],
    },
    "civitai:checkpoint_realistic": {
        "name": "Checkpoint - Realistic",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "realistic", "limit": 1},
        "tags": ["realistic", "photorealistic", "real"],
        "content_types": ["checkpoint"],
    },
    "civitai:checkpoint_anime": {
        "name": "Checkpoint - Anime",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "anime", "limit": 1},
        "tags": ["anime", "cartoon"],
        "content_types": ["checkpoint"],
    },
    "civitai:ti_person": {
        "name": "TI - Person",
        "query_type": "models",
        "params": {"types": "TextualInversion", "tag": "person", "limit": 1},
        "tags": ["person", "face", "portrait"],
        "content_types": ["textual_inversion"],
    },
    "civitai:gallery_recent": {
        "name": "Gallery - Recent",
        "query_type": "images",
        "params": {"sort": "Newest", "limit": 1},
        "tags": ["recent", "newest"],
        "content_types": ["image"],
    },
    "civitai:gallery_popular": {
        "name": "Gallery - Popular",
        "query_type": "images",
        "params": {"sort": "Most Reactions", "limit": 1},
        "tags": ["popular", "most reactions"],
        "content_types": ["image"],
    },
}

# Maps section_id -> search terms the crawler should use for that section
SECTION_TO_SEARCH_TERMS: dict[str, list[str]] = {
    "civitai:lora_real_person": ["real person", "realistic portrait", "real face"],
    "civitai:lora_celebrity": ["celebrity", "famous", "actor", "actress", "singer"],
    "civitai:lora_instagram": ["instagram", "influencer", "tiktoker"],
    "civitai:lora_nsfw_person": ["nsfw real person", "nsfw person"],
    "civitai:lora_nsfw_deepfake": ["deepfake", "face swap"],
    "civitai:lora_nsfw_other": ["nsfw"],
    "civitai:lora_portrait": ["portrait", "face", "headshot", "photorealistic"],
    "civitai:lora_anime": ["anime", "cartoon", "manga"],
    "civitai:lora_style": ["style", "concept", "aesthetic"],
    "civitai:checkpoint_realistic": ["realistic", "photorealistic"],
    "civitai:checkpoint_anime": ["anime", "cartoon"],
    "civitai:ti_person": ["person", "face", "portrait"],
    "civitai:gallery_recent": ["woman", "man", "portrait", "photorealistic face"],
    "civitai:gallery_popular": ["woman", "man", "portrait", "model"],
}


class CivitAIMapper(BasePlatformMapper):
    """Maps CivitAI's content taxonomy via lightweight API probes."""

    def get_platform(self) -> str:
        return "civitai"

    async def build_map(self) -> PlatformMap:
        """Probe each section via models/images API to get content counts."""
        sections: list[Section] = []
        limiter = get_limiter("civitai_mapper")

        async with aiohttp.ClientSession() as session:
            for section_id, rule in SECTION_RULES.items():
                try:
                    total = await self._probe_section(session, limiter, rule)
                    sections.append(
                        Section(
                            section_id=section_id,
                            section_name=rule["name"],
                            platform="civitai",
                            total_content=total,
                            tags=rule["tags"],
                            content_types=rule["content_types"],
                        )
                    )
                    log.info("civitai_section_probed", section=section_id, total=total)
                except Exception as e:
                    log.error("civitai_section_probe_error", section=section_id, error=str(e))
                    # Still add section with 0 count so it appears in the map
                    sections.append(
                        Section(
                            section_id=section_id,
                            section_name=rule["name"],
                            platform="civitai",
                            total_content=0,
                            tags=rule["tags"],
                            content_types=rule["content_types"],
                        )
                    )

        log.info("civitai_map_complete", sections=len(sections))
        return PlatformMap(platform="civitai", sections=sections)

    @with_circuit_breaker("civitai_mapper")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _probe_section(
        self,
        session: aiohttp.ClientSession,
        limiter,
        rule: dict,
    ) -> int:
        """Probe a single section to get its total content count."""
        query_type = rule["query_type"]
        params = dict(rule["params"])

        url = CIVITAI_MODELS_URL if query_type == "models" else CIVITAI_IMAGES_URL

        await limiter.acquire()
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                log.warning("civitai_probe_error", status=resp.status, params=params)
                return 0
            data = await resp.json()

        return data.get("metadata", {}).get("totalItems", 0)
