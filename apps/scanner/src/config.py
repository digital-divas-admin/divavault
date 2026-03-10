"""Scanner service configuration via environment variables."""

import tempfile
from pathlib import Path

from pydantic_settings import BaseSettings

_DEFAULT_TEMP_DIR = str(Path(tempfile.gettempdir()) / "scanner_images")


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
    scheduler_tick_seconds: int = 30
    ingest_poll_seconds: int = 30

    # Face detection (subprocess isolation)
    face_detection_chunk_size: int = 1000   # images per subprocess
    face_detection_timeout: int = 600       # seconds per subprocess
    face_detection_max_chunks: int = 20     # max subprocess invocations per tick

    # Matching
    matching_batch_size: int = 5000         # face embeddings per local-match batch
    matching_max_per_tick: int = 50000      # max embeddings to process per tick (loop cap)

    # Crawl scheduling (hours between automatic crawls, 0 = manual only)
    civitai_crawl_interval_hours: int = 24
    deviantart_crawl_interval_hours: int = 24
    fourchan_crawl_interval_hours: int = 24

    # CivitAI crawl
    civitai_max_pages: int = 10  # pages per term per tick (100 images/page)
    civitai_model_pages_per_tag: int = 10  # pages per tag per tick (100 models/page)
    civitai_nsfw_filter: str = "None"  # "None", "Soft", "Mature", "X", or "" for all
    civitai_backfill_days: int = 30  # how far back to search during backfill

    # Backfill mode (runs after sweep to fully catalogue platforms)
    backfill_enabled: bool = True
    civitai_backfill_pages: int = 100         # 100 pages/term/tick = ~10,000 images/term
    deviantart_backfill_pages: int = 50       # 50 pages/tag/tick = ~1,200 images/tag

    # 4chan crawl
    fourchan_threads_per_board: int = 10       # threads to drill into per board (sweep)
    fourchan_backfill_threads: int = 150       # threads to drill into per board (backfill) — drill all active threads in one pass

    # Reddit crawl
    reddit_crawl_interval_hours: int = 24      # Daily sweep
    reddit_max_pages: int = 3                  # Pages per sub per tick (sweep) — 100 posts/page = 300 posts/sub
    reddit_backfill_pages: int = 10            # Pages per sub per tick (backfill) — 1000 posts/sub

    # DeviantArt crawl
    deviantart_client_id: str = ""
    deviantart_client_secret: str = ""
    deviantart_max_pages: int = 10  # pages per tag per tick (24 images/page)
    deviantart_high_damage_pages: int = 10  # nude, sexual, deepfake, celebfakes
    deviantart_medium_damage_pages: int = 10  # person-focused: beauty, model, girl, portrait
    deviantart_low_damage_pages: int = 10  # generic: art, photography, stock, CGI
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

    # Deepfake investigation — automated search
    serpapi_api_key: str = ""
    ap_api_key: str = ""

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

    # Per-platform crawl timeout (seconds) — prevents one stuck platform from blocking others.
    # With 100+ mapper terms at 10 pages each (image + model searches), CivitAI needs ~30 min.
    per_platform_crawl_timeout: int = 1800

    # Per-step timeouts (seconds, 0 = no timeout)
    step_timeout_ingest: int = 120
    step_timeout_detection: int = 900        # outer backstop (subprocess has own 600s timeout)
    step_timeout_contributor_scans: int = 300
    step_timeout_taxonomy_mapping: int = 600
    step_timeout_platform_crawls: int = 2100  # must exceed per_platform_crawl_timeout (platforms run in parallel)
    step_timeout_honeypot: int = 60
    step_timeout_ad_intel: int = 300
    step_timeout_ml_intelligence: int = 120
    step_timeout_deepfake_tasks: int = 300
    step_timeout_resilience: int = 120

    # Tick health
    heartbeat_file: str = ""               # path to heartbeat JSON (empty = disabled)
    tick_lag_warning_seconds: float = 120.0
    tick_lag_critical_seconds: float = 300.0

    # Resilience
    resilience_enabled: bool = True
    resilience_tick_interval: int = 10
    resilience_baseline_days: int = 7
    resilience_yield_warning: float = 0.50
    resilience_yield_critical: float = 0.20
    resilience_claude_enabled: bool = False
    resilience_claude_diagnosis_timeout: int = 60
    resilience_claude_patch_timeout: int = 180
    resilience_auto_patch: bool = False
    resilience_auto_promote: bool = False
    resilience_canary_cycles: int = 2
    resilience_canary_threshold: float = 0.80
    resilience_consecutive_failure_warning: int = 3
    resilience_consecutive_failure_critical: int = 5
    resilience_prolonged_outage_hours: int = 12
    ntfy_topic: str = ""

    # Circuit breaker
    circuit_breaker_max_failures: int = 10
    circuit_breaker_base_delay_minutes: int = 30
    circuit_breaker_max_delay_minutes: int = 1440  # 24h cap

    # Logging
    log_level: str = "INFO"

    # Temp directory
    temp_dir: str = _DEFAULT_TEMP_DIR

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
