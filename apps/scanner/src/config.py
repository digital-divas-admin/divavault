"""Scanner service configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = ""
    database_ssl: bool = True

    # Supabase (for downloading contributor images from storage)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Evidence storage (Supabase Storage bucket)
    s3_bucket_name: str = "madeofus-evidence"

    # TinEye API
    tineye_api_key: str = ""

    # Hive Moderation API
    hive_api_key: str = ""

    # Matching thresholds
    match_threshold_low: float = 0.50
    match_threshold_medium: float = 0.65
    match_threshold_high: float = 0.85

    # Scan settings
    scan_batch_size: int = 10
    scheduler_tick_seconds: int = 60
    ingest_poll_seconds: int = 30

    # Face detection (subprocess isolation)
    face_detection_chunk_size: int = 1000   # images per subprocess
    face_detection_timeout: int = 600       # seconds per subprocess
    face_detection_max_chunks: int = 5      # max subprocess invocations per tick

    # Matching
    matching_batch_size: int = 500          # face embeddings per match batch

    # Crawl scheduling (hours between automatic crawls, 0 = manual only)
    civitai_crawl_interval_hours: int = 24
    deviantart_crawl_interval_hours: int = 24

    # CivitAI crawl
    civitai_max_pages: int = 1  # pages per term per tick (100 images/page) — set low for test run
    civitai_model_pages_per_tag: int = 1  # pages per tag per tick (100 models/page)
    civitai_nsfw_filter: str = "None"  # "None", "Soft", "Mature", "X", or "" for all
    civitai_backfill_days: int = 30  # how far back to search during backfill

    # DeviantArt crawl
    deviantart_client_id: str = ""
    deviantart_client_secret: str = ""
    deviantart_max_pages: int = 2  # pages per tag per tick (24 images/page) — set low for test run
    deviantart_high_damage_pages: int = 2  # nude, sexual, deepfake, celebfakes
    deviantart_medium_damage_pages: int = 1  # person-focused: beauty, model, girl, portrait
    deviantart_low_damage_pages: int = 1  # generic: art, photography, stock, CGI
    deviantart_concurrency: int = 10  # concurrent tag fetches (ScraperAPI supports 50 concurrent)

    # Proxy for web scraping (used by DeviantArt, CivitAI, etc.)
    # Format: http://user:pass@host:port or http://host:port
    # Supports rotating proxy services (ScraperAPI, Bright Data, SmartProxy, etc.)
    proxy_url: str = ""

    # InsightFace
    insightface_model: str = "buffalo_sc"

    # Provider selection
    face_detection_provider: str = "insightface"
    ai_detection_provider: str = "hive"
    match_scoring_provider: str = "static"

    # Ad Intelligence
    meta_ad_library_access_token: str = ""
    shutterstock_api_key: str = ""
    shutterstock_api_secret: str = ""
    getty_api_key: str = ""
    adobe_stock_api_key: str = ""
    anthropic_api_key: str = ""
    ad_intel_enabled: bool = False

    # ML Intelligence
    auto_apply_low_risk: bool = False

    # Taxonomy mapper
    mapper_interval_hours: int = 168  # Weekly (7 days)

    # Scout — platform discovery
    scout_common_crawl_enabled: bool = True
    scout_link_harvest_enabled: bool = True
    scout_google_cse_enabled: bool = False  # requires API key
    scout_reddit_enabled: bool = True
    google_cse_api_key: str = ""
    google_cse_cx: str = ""  # custom search engine ID
    scout_max_results_per_source: int = 50
    scout_assessment_timeout: int = 15  # seconds per URL

    # Logging
    log_level: str = "INFO"

    # Temp directory
    temp_dir: str = "/tmp/scanner_images"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


# Tier configuration: controls scanner behavior per subscription level
TIER_CONFIG = {
    "free": {
        # Discovery
        "reverse_image_interval_hours": 168,
        "reverse_image_max_photos": 3,
        "platform_crawl_matching": True,
        "crawl_registry_embeddings": 1,
        "url_check": False,
        "max_known_accounts": 3,
        # Post-match behavior
        "store_match": True,
        "notify_on_match": True,
        "capture_evidence": False,
        "ai_detection": False,
        "generate_takedown": False,
        "show_blurred_preview": True,
        "show_full_details": False,
    },
    "protected": {
        "reverse_image_interval_hours": 24,
        "reverse_image_max_photos": 10,
        "platform_crawl_matching": True,
        "crawl_registry_embeddings": "all",
        "url_check": True,
        "url_check_interval_hours": 1,
        "max_known_accounts": 10,
        "store_match": True,
        "notify_on_match": True,
        "capture_evidence": True,
        "ai_detection": True,
        "generate_takedown": True,
        "show_blurred_preview": True,
        "show_full_details": True,
    },
    "premium": {
        "reverse_image_interval_hours": 6,
        "reverse_image_max_photos": 10,
        "platform_crawl_matching": True,
        "crawl_registry_embeddings": "all",
        "url_check": True,
        "url_check_interval_hours": 0.5,
        "max_known_accounts": 25,
        "store_match": True,
        "notify_on_match": True,
        "capture_evidence": True,
        "ai_detection": True,
        "generate_takedown": True,
        "show_blurred_preview": True,
        "show_full_details": True,
        "priority_scanning": True,
        "auto_submit_takedown": False,
        "legal_escalation": True,
    },
}


def get_tier_config(tier: str) -> dict:
    """Get configuration for a subscription tier. Defaults to free."""
    return TIER_CONFIG.get(tier, TIER_CONFIG["free"])


settings = Settings()
