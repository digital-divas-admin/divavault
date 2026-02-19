"""CivitAI taxonomy mapper — discovers content sections via lightweight API probes.

Sections are organized by likeness-violation risk:
  CRITICAL: Direct person-specific models (LoRA trained on a real individual)
  HIGH:     Category-level face content (portraits, photorealistic people)
  MEDIUM:   Broad content that may contain faces (checkpoints, other model types)
  LOW:      Unlikely to contain face-specific content (anime, style, non-face)
"""

import aiohttp

from src.config import settings
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

    # =====================================================================
    # CRITICAL — direct person-specific LoRAs (highest likeness risk)
    # =====================================================================

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
    "civitai:lora_actor": {
        "name": "LoRA — Actor",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "actor"},
        "tags": ["actor", "movie star"],
        "content_types": ["lora"],
    },
    "civitai:lora_singer": {
        "name": "LoRA — Singer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "singer"},
        "tags": ["singer", "vocalist", "pop star"],
        "content_types": ["lora"],
    },
    "civitai:lora_musician": {
        "name": "LoRA — Musician",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "musician"},
        "tags": ["musician", "band member", "rapper"],
        "content_types": ["lora"],
    },
    "civitai:lora_youtuber": {
        "name": "LoRA — YouTuber",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "youtuber"},
        "tags": ["youtuber", "content creator", "vlogger"],
        "content_types": ["lora"],
    },
    "civitai:lora_streamer": {
        "name": "LoRA — Streamer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "streamer"},
        "tags": ["streamer", "twitch", "live streamer"],
        "content_types": ["lora"],
    },
    "civitai:lora_instagram": {
        "name": "LoRA — Instagram",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "instagram"},
        "tags": ["instagram", "social media", "ig model"],
        "content_types": ["lora"],
    },
    "civitai:lora_influencer": {
        "name": "LoRA — Influencer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "influencer"},
        "tags": ["influencer", "tiktoker", "social media"],
        "content_types": ["lora"],
    },
    "civitai:lora_idol": {
        "name": "LoRA — Idol",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "idol"},
        "tags": ["idol", "kpop", "jpop"],
        "content_types": ["lora"],
    },
    "civitai:lora_kpop": {
        "name": "LoRA — K-pop",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "kpop"},
        "tags": ["kpop", "korean pop", "k-pop idol"],
        "content_types": ["lora"],
    },
    "civitai:lora_athlete": {
        "name": "LoRA — Athlete",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "athlete"},
        "tags": ["athlete", "sports", "player"],
        "content_types": ["lora"],
    },
    "civitai:lora_politician": {
        "name": "LoRA — Politician",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "politician"},
        "tags": ["politician", "government", "public official"],
        "content_types": ["lora"],
    },
    "civitai:lora_supermodel": {
        "name": "LoRA — Supermodel",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "supermodel"},
        "tags": ["supermodel", "runway", "fashion model"],
        "content_types": ["lora"],
    },
    "civitai:lora_pornstar": {
        "name": "LoRA — Adult Performer",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "pornstar"},
        "tags": ["pornstar", "adult actress", "adult performer"],
        "content_types": ["lora"],
    },
    "civitai:lora_deepfake": {
        "name": "LoRA — Deepfake/Face Swap",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "deepfake"},
        "tags": ["deepfake", "face swap", "faceswap"],
        "content_types": ["lora"],
    },

    # =====================================================================
    # HIGH — face-heavy categories (portraits, demographics, body)
    # =====================================================================

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
    "civitai:lora_realistic": {
        "name": "LoRA — Realistic",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "realistic"},
        "tags": ["realistic", "real", "lifelike"],
        "content_types": ["lora"],
    },
    "civitai:lora_face": {
        "name": "LoRA — Face",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "face"},
        "tags": ["face", "facial", "close-up"],
        "content_types": ["lora"],
    },
    "civitai:lora_headshot": {
        "name": "LoRA — Headshot",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "headshot"},
        "tags": ["headshot", "head shot", "face close-up"],
        "content_types": ["lora"],
    },
    "civitai:lora_beauty": {
        "name": "LoRA — Beauty",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "beauty"},
        "tags": ["beauty", "makeup", "glamour"],
        "content_types": ["lora"],
    },
    "civitai:lora_woman": {
        "name": "LoRA — Woman",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "woman"},
        "tags": ["woman", "female", "adult woman"],
        "content_types": ["lora"],
    },
    "civitai:lora_man": {
        "name": "LoRA — Man",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "man"},
        "tags": ["man", "male", "adult man"],
        "content_types": ["lora"],
    },
    "civitai:lora_girl": {
        "name": "LoRA — Girl",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "girl"},
        "tags": ["girl", "young woman", "female"],
        "content_types": ["lora"],
    },
    "civitai:lora_boy": {
        "name": "LoRA — Boy",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "boy"},
        "tags": ["boy", "young man", "male"],
        "content_types": ["lora"],
    },
    "civitai:lora_asian": {
        "name": "LoRA — Asian",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "asian"},
        "tags": ["asian", "east asian", "southeast asian"],
        "content_types": ["lora"],
    },
    "civitai:lora_latina": {
        "name": "LoRA — Latina",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "latina"},
        "tags": ["latina", "hispanic", "latin"],
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
    "civitai:lora_model": {
        "name": "LoRA — Model/Fashion",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "model"},
        "tags": ["model", "fashion", "runway"],
        "content_types": ["lora"],
    },

    # --- Body content (often contains faces) ---
    "civitai:lora_nude": {
        "name": "LoRA — Nude",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nude"},
        "tags": ["nude", "naked", "unclothed"],
        "content_types": ["lora"],
    },
    "civitai:lora_bikini": {
        "name": "LoRA — Bikini",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "bikini"},
        "tags": ["bikini", "swimwear", "beach"],
        "content_types": ["lora"],
    },
    "civitai:lora_lingerie": {
        "name": "LoRA — Lingerie",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "lingerie"},
        "tags": ["lingerie", "underwear", "intimate"],
        "content_types": ["lora"],
    },
    "civitai:lora_figure": {
        "name": "LoRA — Figure",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "figure"},
        "tags": ["figure", "body", "full body"],
        "content_types": ["lora"],
    },
    "civitai:lora_nsfw_person": {
        "name": "LoRA — NSFW Person",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nsfw", "query": "real person"},
        "tags": ["nsfw", "real person", "adult"],
        "content_types": ["lora"],
    },

    # =====================================================================
    # MEDIUM — checkpoints, other model types, broad categories
    # =====================================================================

    # --- Checkpoints ---
    "civitai:checkpoint_realistic": {
        "name": "Checkpoint — Realistic",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "realistic"},
        "tags": ["realistic", "photorealistic", "checkpoint"],
        "content_types": ["checkpoint"],
    },
    "civitai:checkpoint_photorealistic": {
        "name": "Checkpoint — Photorealistic",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "photorealistic"},
        "tags": ["photorealistic", "photo", "checkpoint"],
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
    "civitai:checkpoint_woman": {
        "name": "Checkpoint — Woman",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "woman"},
        "tags": ["woman", "female", "checkpoint"],
        "content_types": ["checkpoint"],
    },
    "civitai:checkpoint_nsfw": {
        "name": "Checkpoint — NSFW",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "nsfw"},
        "tags": ["nsfw", "adult", "checkpoint"],
        "content_types": ["checkpoint"],
    },

    # --- LoCon ---
    "civitai:locon_woman": {
        "name": "LoCon — Woman",
        "query_type": "models",
        "params": {"types": "LoCon", "tag": "woman"},
        "tags": ["locon", "woman", "face"],
        "content_types": ["locon"],
    },
    "civitai:locon_realistic": {
        "name": "LoCon — Realistic",
        "query_type": "models",
        "params": {"types": "LoCon", "tag": "realistic"},
        "tags": ["locon", "realistic", "face"],
        "content_types": ["locon"],
    },

    # --- DoRA ---
    "civitai:dora_woman": {
        "name": "DoRA — Woman",
        "query_type": "models",
        "params": {"types": "DoRA", "tag": "woman"},
        "tags": ["dora", "woman", "face"],
        "content_types": ["dora"],
    },

    # --- TextualInversion ---
    "civitai:ti_person": {
        "name": "TI — Person",
        "query_type": "models",
        "params": {"types": "TextualInversion", "tag": "person"},
        "tags": ["person", "face", "textual inversion"],
        "content_types": ["textual_inversion"],
    },
    "civitai:ti_realistic": {
        "name": "TI — Realistic",
        "query_type": "models",
        "params": {"types": "TextualInversion", "tag": "realistic"},
        "tags": ["realistic", "photorealistic", "textual inversion"],
        "content_types": ["textual_inversion"],
    },
    "civitai:ti_celebrity": {
        "name": "TI — Celebrity",
        "query_type": "models",
        "params": {"types": "TextualInversion", "tag": "celebrity"},
        "tags": ["celebrity", "famous", "textual inversion"],
        "content_types": ["textual_inversion"],
    },

    # --- Hypernetwork ---
    "civitai:hypernetwork_woman": {
        "name": "Hypernetwork — Woman",
        "query_type": "models",
        "params": {"types": "Hypernetwork", "tag": "woman"},
        "tags": ["hypernetwork", "woman", "face"],
        "content_types": ["hypernetwork"],
    },

    # --- Wildcards ---
    "civitai:wildcards_woman": {
        "name": "Wildcards — Woman",
        "query_type": "models",
        "params": {"types": "Wildcards", "tag": "woman"},
        "tags": ["wildcards", "woman", "prompts"],
        "content_types": ["wildcards"],
    },

    # --- Gallery feeds ---
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
    "civitai:gallery_most_collected": {
        "name": "Gallery — Most Collected",
        "query_type": "images",
        "params": {"sort": "Most Collected"},
        "tags": ["collected", "saved", "bookmarked"],
        "content_types": ["image"],
    },

    # =====================================================================
    # LOW — non-face content (tracked for platform coverage)
    # =====================================================================

    "civitai:lora_nsfw_other": {
        "name": "LoRA — NSFW General",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "nsfw"},
        "tags": ["nsfw", "adult", "explicit"],
        "content_types": ["lora"],
    },
    "civitai:lora_hentai": {
        "name": "LoRA — Hentai",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "hentai"},
        "tags": ["hentai", "ecchi", "adult anime"],
        "content_types": ["lora"],
    },
    "civitai:lora_anime": {
        "name": "LoRA — Anime",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "anime"},
        "tags": ["anime", "cartoon", "manga", "2d"],
        "content_types": ["lora"],
    },
    "civitai:lora_manga": {
        "name": "LoRA — Manga",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "manga"},
        "tags": ["manga", "comic", "japanese art"],
        "content_types": ["lora"],
    },
    "civitai:lora_cartoon": {
        "name": "LoRA — Cartoon",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "cartoon"},
        "tags": ["cartoon", "animated", "toon"],
        "content_types": ["lora"],
    },
    "civitai:lora_furry": {
        "name": "LoRA — Furry",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "furry"},
        "tags": ["furry", "anthro", "fursona"],
        "content_types": ["lora"],
    },
    "civitai:lora_fantasy": {
        "name": "LoRA — Fantasy",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "fantasy"},
        "tags": ["fantasy", "magical", "mythical"],
        "content_types": ["lora"],
    },
    "civitai:lora_style": {
        "name": "LoRA — Style/Concept",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "style"},
        "tags": ["style", "concept", "aesthetic"],
        "content_types": ["lora"],
    },
    "civitai:lora_art_style": {
        "name": "LoRA — Art Style",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "art style"},
        "tags": ["art style", "artistic", "illustration"],
        "content_types": ["lora"],
    },
    "civitai:lora_painting": {
        "name": "LoRA — Painting",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "painting"},
        "tags": ["painting", "oil painting", "watercolor"],
        "content_types": ["lora"],
    },
    "civitai:lora_concept": {
        "name": "LoRA — Concept",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "concept"},
        "tags": ["concept", "idea", "abstract"],
        "content_types": ["lora"],
    },
    "civitai:lora_aesthetic": {
        "name": "LoRA — Aesthetic",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "aesthetic"},
        "tags": ["aesthetic", "vibe", "mood"],
        "content_types": ["lora"],
    },
    "civitai:lora_background": {
        "name": "LoRA — Background",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "background"},
        "tags": ["background", "scenery", "environment"],
        "content_types": ["lora"],
    },
    "civitai:lora_landscape": {
        "name": "LoRA — Landscape",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "landscape"},
        "tags": ["landscape", "nature", "outdoor"],
        "content_types": ["lora"],
    },
    "civitai:lora_architecture": {
        "name": "LoRA — Architecture",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "architecture"},
        "tags": ["architecture", "building", "interior"],
        "content_types": ["lora"],
    },
    "civitai:lora_clothing": {
        "name": "LoRA — Clothing",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "clothing"},
        "tags": ["clothing", "outfit", "fashion"],
        "content_types": ["lora"],
    },
    "civitai:lora_vehicle": {
        "name": "LoRA — Vehicle",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "vehicle"},
        "tags": ["vehicle", "car", "motorcycle"],
        "content_types": ["lora"],
    },
    "civitai:lora_animal": {
        "name": "LoRA — Animal",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "animal"},
        "tags": ["animal", "pet", "wildlife"],
        "content_types": ["lora"],
    },
    "civitai:lora_creature": {
        "name": "LoRA — Creature",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "creature"},
        "tags": ["creature", "monster", "beast"],
        "content_types": ["lora"],
    },
    "civitai:lora_weapon": {
        "name": "LoRA — Weapon",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "weapon"},
        "tags": ["weapon", "sword", "gun"],
        "content_types": ["lora"],
    },
    "civitai:lora_food": {
        "name": "LoRA — Food",
        "query_type": "models",
        "params": {"types": "LORA", "tag": "food"},
        "tags": ["food", "cooking", "dish"],
        "content_types": ["lora"],
    },

    # --- Checkpoint non-face ---
    "civitai:checkpoint_anime": {
        "name": "Checkpoint — Anime",
        "query_type": "models",
        "params": {"types": "Checkpoint", "tag": "anime"},
        "tags": ["anime", "cartoon", "checkpoint"],
        "content_types": ["checkpoint"],
    },

    # --- Other model types (full type, no tag filter) ---
    "civitai:controlnet": {
        "name": "ControlNet (all)",
        "query_type": "models",
        "params": {"types": "Controlnet"},
        "tags": ["controlnet", "pose", "structure"],
        "content_types": ["controlnet"],
    },
    "civitai:poses": {
        "name": "Poses (all)",
        "query_type": "models",
        "params": {"types": "Poses"},
        "tags": ["poses", "body", "position"],
        "content_types": ["poses"],
    },
    "civitai:vae": {
        "name": "VAE (all)",
        "query_type": "models",
        "params": {"types": "VAE"},
        "tags": ["vae", "encoder", "decoder"],
        "content_types": ["vae"],
    },
    "civitai:upscaler": {
        "name": "Upscaler (all)",
        "query_type": "models",
        "params": {"types": "Upscaler"},
        "tags": ["upscaler", "super resolution", "enhance"],
        "content_types": ["upscaler"],
    },
    "civitai:motion_module": {
        "name": "MotionModule (all)",
        "query_type": "models",
        "params": {"types": "MotionModule"},
        "tags": ["motion", "animation", "video"],
        "content_types": ["motion_module"],
    },
    "civitai:aesthetic_gradient": {
        "name": "AestheticGradient (all)",
        "query_type": "models",
        "params": {"types": "AestheticGradient"},
        "tags": ["aesthetic", "gradient", "quality"],
        "content_types": ["aesthetic_gradient"],
    },
}


# Maps section_id -> search terms the crawler should use when scanning that section
SECTION_TO_SEARCH_TERMS: dict[str, list[str]] = {
    # CRITICAL — person-specific
    "civitai:lora_real_person": ["real person", "realistic portrait", "real face"],
    "civitai:lora_specific_person": ["specific person", "named person", "likeness"],
    "civitai:lora_celebrity": ["celebrity", "famous", "public figure"],
    "civitai:lora_actress": ["actress", "movie star", "film star"],
    "civitai:lora_actor": ["actor", "male actor", "movie star"],
    "civitai:lora_singer": ["singer", "vocalist", "pop star"],
    "civitai:lora_musician": ["musician", "rapper", "band member"],
    "civitai:lora_youtuber": ["youtuber", "content creator", "vlogger"],
    "civitai:lora_streamer": ["streamer", "twitch", "live streamer"],
    "civitai:lora_instagram": ["instagram", "ig model", "social media"],
    "civitai:lora_influencer": ["influencer", "tiktoker", "social media star"],
    "civitai:lora_idol": ["idol", "kpop idol", "jpop idol"],
    "civitai:lora_kpop": ["kpop", "korean pop", "k-pop"],
    "civitai:lora_athlete": ["athlete", "sports", "player"],
    "civitai:lora_politician": ["politician", "president", "public official"],
    "civitai:lora_supermodel": ["supermodel", "runway model", "fashion model"],
    "civitai:lora_pornstar": ["pornstar", "adult performer"],
    "civitai:lora_deepfake": ["deepfake", "face swap", "faceswap"],
    # HIGH — face-heavy
    "civitai:lora_portrait": ["portrait", "face", "headshot"],
    "civitai:lora_photorealistic": ["photorealistic", "photo realistic"],
    "civitai:lora_realistic": ["realistic", "real", "lifelike"],
    "civitai:lora_face": ["face", "facial features", "close-up"],
    "civitai:lora_headshot": ["headshot", "head shot"],
    "civitai:lora_beauty": ["beauty", "makeup", "glamour"],
    "civitai:lora_woman": ["woman", "female"],
    "civitai:lora_man": ["man", "male"],
    "civitai:lora_girl": ["girl", "young woman"],
    "civitai:lora_boy": ["boy", "young man"],
    "civitai:lora_asian": ["asian", "east asian", "japanese", "korean", "chinese"],
    "civitai:lora_latina": ["latina", "hispanic", "latin"],
    "civitai:lora_cosplay": ["cosplay", "costume", "character"],
    "civitai:lora_selfie": ["selfie", "self portrait"],
    "civitai:lora_model": ["model", "fashion model", "beauty model"],
    "civitai:lora_nude": ["nude", "naked"],
    "civitai:lora_bikini": ["bikini", "swimwear"],
    "civitai:lora_lingerie": ["lingerie", "underwear"],
    "civitai:lora_figure": ["figure", "body", "full body"],
    "civitai:lora_nsfw_person": ["nsfw real person", "nsfw person"],
    # MEDIUM — other model types
    "civitai:checkpoint_realistic": ["realistic", "photorealistic"],
    "civitai:checkpoint_photorealistic": ["photorealistic", "photo"],
    "civitai:checkpoint_portrait": ["portrait", "face"],
    "civitai:checkpoint_celebrity": ["celebrity", "famous"],
    "civitai:checkpoint_woman": ["woman", "female"],
    "civitai:checkpoint_nsfw": ["nsfw", "adult"],
    "civitai:locon_woman": ["woman", "female", "face"],
    "civitai:locon_realistic": ["realistic", "face"],
    "civitai:dora_woman": ["woman", "man", "person", "face"],
    "civitai:ti_person": ["person", "face", "portrait"],
    "civitai:ti_realistic": ["realistic", "photorealistic"],
    "civitai:ti_celebrity": ["celebrity", "famous"],
    "civitai:hypernetwork_woman": ["woman", "female"],
    "civitai:wildcards_woman": ["woman", "female"],
    # Gallery feeds
    "civitai:gallery_recent": ["woman", "man", "portrait", "photorealistic face"],
    "civitai:gallery_popular": ["woman", "man", "portrait", "model"],
    "civitai:gallery_most_commented": ["woman", "man", "portrait", "controversial"],
    "civitai:gallery_most_collected": ["woman", "man", "portrait", "collected"],
    # LOW — non-face
    "civitai:lora_nsfw_other": ["nsfw"],
    "civitai:lora_hentai": ["hentai", "ecchi"],
    "civitai:lora_anime": ["anime", "cartoon", "manga"],
    "civitai:lora_manga": ["manga", "comic"],
    "civitai:lora_cartoon": ["cartoon", "toon"],
    "civitai:lora_furry": ["furry", "anthro"],
    "civitai:lora_fantasy": ["fantasy", "magical"],
    "civitai:lora_style": ["style", "concept", "aesthetic"],
    "civitai:lora_art_style": ["art style", "artistic"],
    "civitai:lora_painting": ["painting", "oil painting"],
    "civitai:lora_concept": ["concept", "abstract"],
    "civitai:lora_aesthetic": ["aesthetic", "vibe"],
    "civitai:lora_background": ["background", "scenery"],
    "civitai:lora_landscape": ["landscape", "nature"],
    "civitai:lora_architecture": ["architecture", "building"],
    "civitai:lora_clothing": ["clothing", "outfit"],
    "civitai:lora_vehicle": ["vehicle", "car"],
    "civitai:lora_animal": ["animal", "pet"],
    "civitai:lora_creature": ["creature", "monster"],
    "civitai:lora_weapon": ["weapon", "sword"],
    "civitai:lora_food": ["food", "cooking"],
    "civitai:checkpoint_anime": ["anime", "cartoon"],
    "civitai:controlnet": ["controlnet", "pose"],
    "civitai:poses": ["pose", "body"],
    "civitai:vae": ["vae"],
    "civitai:upscaler": ["upscaler"],
    "civitai:motion_module": ["motion", "animation"],
    "civitai:aesthetic_gradient": ["aesthetic", "gradient"],
}


class CivitAIMapper(BasePlatformMapper):
    """Maps CivitAI's content taxonomy via lightweight API probes."""

    def __init__(self) -> None:
        self._proxy: str | None = None

    def get_platform(self) -> str:
        return "civitai"

    async def build_map(self) -> PlatformMap:
        """Probe each section via models/images API to get content counts."""
        sections: list[Section] = []
        limiter = get_limiter("civitai_mapper")
        self._proxy = settings.proxy_url or None

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
        ssl_check = False if self._proxy else None
        async with session.get(url, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("civitai_probe_error", status=resp.status, params=params)
                return 0
            data = await resp.json(content_type=None)

        items_count = len(data.get("items", []))
        has_more = "nextCursor" in data.get("metadata", {})

        if has_more and items_count >= 100:
            # More than one page — estimate conservatively (10x first page)
            return items_count * 10
        return items_count

    async def discover_sections(self) -> list[Section]:
        """Discover new CivitAI model tags not in the hardcoded taxonomy.

        Strategy:
        1. Query /api/v1/models with risk-related tags sorted by newest
        2. Extract tags from returned models that aren't in SECTION_RULES
        3. Probe new tags to estimate content volume
        """
        known_tags = set()
        for rule in SECTION_RULES.values():
            tag_param = rule["params"].get("tag")
            if tag_param:
                known_tags.add(tag_param.lower())
            for t in rule.get("tags", []):
                known_tags.add(t.lower())

        # Risk keyword queries to find new trending content
        risk_queries = [
            "face swap", "real person", "celebrity", "deepfake", "likeness",
            "nsfw person", "realistic portrait", "selfie", "instagram model",
        ]

        # Cross-platform risk terms (injected by orchestrator if available)
        cross_risk: list[str] = getattr(self, "_cross_platform_risk_terms", [])
        risk_queries.extend(cross_risk[:10])

        discovered_tags: dict[str, int] = {}
        limiter = get_limiter("civitai_mapper")
        self._proxy = settings.proxy_url or None

        async with aiohttp.ClientSession() as session:
            for query in risk_queries[:15]:
                try:
                    await limiter.acquire()
                    ssl_check = False if self._proxy else None
                    async with session.get(
                        CIVITAI_MODELS_URL,
                        params={"types": "LORA", "query": query, "limit": 20, "sort": "Newest"},
                        proxy=self._proxy,
                        ssl=ssl_check,
                    ) as resp:
                        if resp.status != 200:
                            continue
                        data = await resp.json(content_type=None)

                    for item in data.get("items", []):
                        for tag in item.get("tags", []):
                            tag_lower = tag.lower().strip()
                            if tag_lower and tag_lower not in known_tags and len(tag_lower) > 2:
                                discovered_tags[tag_lower] = discovered_tags.get(tag_lower, 0) + 1

                except Exception as e:
                    log.error("civitai_discover_error", query=query, error=str(e))

        if not discovered_tags:
            return []

        # Keep tags that appear in 2+ models (not just one-offs)
        frequent_tags = {t: c for t, c in discovered_tags.items() if c >= 2}
        if not frequent_tags:
            return []

        # Probe each to get content counts
        discovered: list[Section] = []
        async with aiohttp.ClientSession() as session:
            for tag, freq in sorted(frequent_tags.items(), key=lambda x: -x[1])[:20]:
                try:
                    rule = {
                        "query_type": "models",
                        "params": {"types": "LORA", "tag": tag},
                    }
                    count = await self._probe_section(session, limiter, rule)
                    if count > 0:
                        section_id = f"civitai:discovered_{tag.replace(' ', '_')}"
                        discovered.append(
                            Section(
                                section_id=section_id,
                                section_name=f"Discovered: {tag}",
                                platform="civitai",
                                total_content=count,
                                tags=[tag],
                                content_types=["lora"],
                                metadata={"source": "discovery", "frequency": freq},
                            )
                        )
                        log.info("civitai_discover_found", tag=tag, count=count, freq=freq)
                except Exception as e:
                    log.error("civitai_discover_probe_error", tag=tag, error=str(e))

        log.info("civitai_discover_complete", found=len(discovered))
        return discovered
