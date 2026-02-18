"""CivitAI taxonomy mapper — discovers content sections via lightweight API probes.

Sections are organized by likeness-violation risk:
  CRITICAL: Direct person-specific models (LoRA trained on a real individual)
  HIGH:     Category-level face content (portraits, photorealistic people)
  MEDIUM:   Broad content that may contain faces (checkpoints, galleries)
  LOW:      Unlikely to contain face-specific content (anime, style, non-face)
"""

import aiohttp

from src.intelligence.mapper.base import BasePlatformMapper, PlatformMap, Section
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async, with_circuit_breaker

log = get_logger("civitai_mapper")

CIVITAI_MODELS_URL = "https://civitai.com/api/v1/models"
CIVITAI_IMAGES_URL = "https://civitai.com/api/v1/images"

# ---------------------------------------------------------------------------
# Section definitions
#
# query_type: "models" queries /api/v1/models, "images" queries /api/v1/images
# params:     API query parameters (limit is overridden by _probe_section)
# tags:       descriptive tags stored in the map snapshot
# content_types: CivitAI content category
# ---------------------------------------------------------------------------

SECTION_RULES: dict[str, dict] = {
    # === CRITICAL — direct person-specific LoRAs ===
    "civitai:lora_real_person": {
        "name": "LoRA — Real Person",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "real person"},
        "tags": ["real person", "realistic portrait", "real face"],
        "content_types": ["lora"],
    },
    "civitai:lora_specific_person": {
        "name": "LoRA — Specific Person",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "specific person"},
        "tags": ["specific person", "named person", "likeness"],
        "content_types": ["lora"],
    },
    "civitai:lora_celebrity": {
        "name": "LoRA — Celebrity",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "celebrity"},
        "tags": ["celebrity", "famous", "public figure"],
        "content_types": ["lora"],
    },
    "civitai:lora_actress": {
        "name": "LoRA — Actress/Actor",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "actress"},
        "tags": ["actress", "actor", "movie star"],
        "content_types": ["lora"],
    },
    "civitai:lora_singer": {
        "name": "LoRA — Singer/Musician",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "singer"},
        "tags": ["singer", "musician", "kpop", "idol"],
        "content_types": ["lora"],
    },
    "civitai:lora_youtuber": {
        "name": "LoRA — YouTuber/Streamer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "youtuber"},
        "tags": ["youtuber", "streamer", "content creator"],
        "content_types": ["lora"],
    },
    "civitai:lora_instagram": {
        "name": "LoRA — Instagram/Influencer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "instagram"},
        "tags": ["instagram", "influencer", "tiktoker", "social media"],
        "content_types": ["lora"],
    },
    "civitai:lora_idol": {
        "name": "LoRA — Idol/K-pop",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "idol"},
        "tags": ["idol", "kpop", "jpop", "celebrity"],
        "content_types": ["lora"],
    },
    "civitai:lora_athlete": {
        "name": "LoRA — Athlete",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "athlete"},
        "tags": ["athlete", "sports", "player"],
        "content_types": ["lora"],
    },
    "civitai:lora_deepfake": {
        "name": "LoRA — Deepfake/Face Swap",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "deepfake"},
        "tags": ["deepfake", "face swap", "faceswap"],
        "content_types": ["lora"],
    },

    # === HIGH — face-heavy categories ===
    "civitai:lora_portrait": {
        "name": "LoRA — Portrait",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "portrait"},
        "tags": ["portrait", "face", "headshot"],
        "content_types": ["lora"],
    },
    "civitai:lora_photorealistic": {
        "name": "LoRA — Photorealistic",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "photorealistic"},
        "tags": ["photorealistic", "realistic", "photo"],
        "content_types": ["lora"],
    },
    "civitai:lora_woman": {
        "name": "LoRA — Woman",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "woman"},
        "tags": ["woman", "female", "girl"],
        "content_types": ["lora"],
    },
    "civitai:lora_man": {
        "name": "LoRA — Man",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "man"},
        "tags": ["man", "male", "boy"],
        "content_types": ["lora"],
    },
    "civitai:lora_cosplay": {
        "name": "LoRA — Cosplay",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "cosplay"},
        "tags": ["cosplay", "costume", "character"],
        "content_types": ["lora"],
    },
    "civitai:lora_selfie": {
        "name": "LoRA — Selfie",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "selfie"},
        "tags": ["selfie", "self portrait", "personal"],
        "content_types": ["lora"],
    },
    "civitai:lora_nsfw_person": {
        "name": "LoRA — NSFW Person",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nsfw", "query": "real person"},
        "tags": ["nsfw", "real person", "adult"],
        "content_types": ["lora"],
    },

    # === MEDIUM — checkpoints and other model types ===
    "civitai:checkpoint_realistic": {
        "name": "Checkpoint — Realistic",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "realistic"},
        "tags": ["realistic", "photorealistic", "checkpoint"],
        "content_types": ["checkpoint"],
    },
    "civitai:checkpoint_portrait": {
        "name": "Checkpoint — Portrait",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "portrait"},
        "tags": ["portrait", "face", "checkpoint"],
        "content_types": ["checkpoint"],
    },
    "civitai:checkpoint_celebrity": {
        "name": "Checkpoint — Celebrity",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "celebrity"},
        "tags": ["celebrity", "famous", "checkpoint"],
        "content_types": ["checkpoint"],
    },
    "civitai:locon_woman": {
        "name": "LoCon — Woman/Man",
        "query_type": "models",
        "params": {"types": "LoCon", "tag": "woman"},
        "tags": ["locon", "woman", "face"],
        "content_types": ["locon"],
    },
    "civitai:dora_person": {
        "name": "DoRA — Person",
        "query_type": "models",
        "params": {"types": "DoRA", "tag": "woman"},
        "tags": ["dora", "person", "face"],
        "content_types": ["dora"],
    },
    "civitai:ti_person": {
        "name": "TI — Person",
        "query_type": "models",
        "params": {"types": "TextualInversion", "tag": "person"},
        "tags": ["person", "face", "textual inversion"],
        "content_types": ["textual_inversion"],
    },

    # === Gallery feeds ===
    "civitai:gallery_recent": {
        "name": "Gallery — Recent Images",
        "query_type": "images",
        "params": {"sort": "Newest"},
        "tags": ["recent", "newest", "all"],
        "content_types": ["image"],
    },
    "civitai:gallery_popular": {
        "name": "Gallery — Popular Images",
        "query_type": "images",
        "params": {"sort": "Most Reactions"},
        "tags": ["popular", "trending", "most reactions"],
        "content_types": ["image"],
    },
    "civitai:gallery_most_commented": {
        "name": "Gallery — Most Commented",
        "query_type": "images",
        "params": {"sort": "Most Comments"},
        "tags": ["discussed", "controversial", "most comments"],
        "content_types": ["image"],
    },

    # === LOW — non-face content (tracked for coverage) ===
    "civitai:lora_nsfw_other": {
        "name": "LoRA — NSFW Other",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nsfw"},
        "tags": ["nsfw", "adult"],
        "content_types": ["lora"],
    },
    "civitai:lora_anime": {
        "name": "LoRA — Anime",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "anime"},
        "tags": ["anime", "cartoon", "manga", "2d"],
        "content_types": ["lora"],
    },
    "civitai:lora_style": {
        "name": "LoRA — Style/Concept",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "style"},
        "tags": ["style", "concept", "aesthetic"],
        "content_types": ["lora"],
    },
    "civitai:checkpoint_anime": {
        "name": "Checkpoint — Anime",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "anime"},
        "tags": ["anime", "cartoon", "checkpoint"],
        "content_types": ["checkpoint"],
    },
    "civitai:lora_model": {
        "name": "LoRA — Model/Fashion",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "model"},
        "tags": ["model", "fashion", "beauty"],
        "content_types": ["lora"],
    },
    "civitai:controlnet": {
        "name": "ControlNet",
        "query_type": "models",
        "params": {"types": "Controlnet"},
        "tags": ["controlnet", "pose", "structure"],
        "content_types": ["controlnet"],
    },
    "civitai:poses": {
        "name": "Poses",
        "query_type": "models",
        "params": {"types": "Poses"},
        "tags": ["poses", "body", "position"],
        "content_types": ["poses"],
    },
}


# Maps section_id -> search terms the crawler should use when scanning that section
SECTION_TO_SEARCH_TERMS: dict[str, list[str]] = {
    # CRITICAL
    "civitai:lora_real_person": ["real person", "realistic portrait", "real face"],
    "civitai:lora_specific_person": ["specific person", "named person", "likeness"],
    "civitai:lora_celebrity": ["celebrity", "famous", "public figure"],
    "civitai:lora_actress": ["actress", "actor", "movie star"],
    "civitai:lora_singer": ["singer", "musician", "kpop"],
    "civitai:lora_youtuber": ["youtuber", "streamer", "content creator"],
    "civitai:lora_instagram": ["instagram", "influencer", "tiktoker"],
    "civitai:lora_idol": ["idol", "kpop", "jpop"],
    "civitai:lora_athlete": ["athlete", "sports", "player"],
    "civitai:lora_deepfake": ["deepfake", "face swap", "faceswap"],
    # HIGH
    "civitai:lora_portrait": ["portrait", "face", "headshot"],
    "civitai:lora_photorealistic": ["photorealistic", "realistic", "photo"],
    "civitai:lora_woman": ["woman", "female", "girl"],
    "civitai:lora_man": ["man", "male", "boy"],
    "civitai:lora_cosplay": ["cosplay", "costume", "character"],
    "civitai:lora_selfie": ["selfie", "self portrait"],
    "civitai:lora_nsfw_person": ["nsfw real person", "nsfw person"],
    # MEDIUM
    "civitai:checkpoint_realistic": ["realistic", "photorealistic"],
    "civitai:checkpoint_portrait": ["portrait", "face", "headshot"],
    "civitai:checkpoint_celebrity": ["celebrity", "famous"],
    "civitai:locon_woman": ["woman", "female", "face"],
    "civitai:dora_person": ["woman", "man", "person", "face"],
    "civitai:ti_person": ["person", "face", "portrait"],
    # Gallery
    "civitai:gallery_recent": ["woman", "man", "portrait", "photorealistic face"],
    "civitai:gallery_popular": ["woman", "man", "portrait", "model"],
    "civitai:gallery_most_commented": ["woman", "man", "portrait", "controversial"],
    # LOW
    "civitai:lora_nsfw_other": ["nsfw"],
    "civitai:lora_anime": ["anime", "cartoon", "manga"],
    "civitai:lora_style": ["style", "concept", "aesthetic"],
    "civitai:checkpoint_anime": ["anime", "cartoon"],
    "civitai:lora_model": ["model", "fashion", "beauty"],
    "civitai:controlnet": ["controlnet", "pose"],
    "civitai:poses": ["pose", "body"],
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
        """Probe a single section to get its total content count.

        CivitAI uses cursor-based pagination and no longer returns totalItems.
        We request limit=100 and estimate total from items returned + pagination.
        """
        query_type = rule["query_type"]
        params = dict(rule["params"])
        params["limit"] = 100  # Override to get a meaningful count

        url = CIVITAI_MODELS_URL if query_type == "models" else CIVITAI_IMAGES_URL

        await limiter.acquire()
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                log.warning("civitai_probe_error", status=resp.status, params=params)
                return 0
            data = await resp.json()

        items_count = len(data.get("items", []))
        has_more = "nextCursor" in data.get("metadata", {})

        if has_more and items_count >= 100:
            # More than one page — estimate conservatively (10x first page)
            return items_count * 10
        return items_count
