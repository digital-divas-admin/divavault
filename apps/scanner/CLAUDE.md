# Scanner Backend

Python-based platform scanning backend for the Made Of Us AI likeness protection platform. Crawls AI art platforms (CivitAI, DeviantArt, Reddit, 247+), detects faces in generated images using InsightFace, and matches them against contributor face embeddings to find unauthorized usage.

## Why This Exists

The scanner exists to combat **non-consensual deepfake content** — illicit sexual deepfakes, unauthorized use of real people's faces in AI-generated ads, and other forms of AI likeness abuse. Women and young women are overwhelmingly the most targeted population; this is not abstract — it is an active, escalating harm.

The scanner targets **high-risk platforms** where AI-generated face content concentrates: CivitAI, DeviantArt, and others as they're added. The goal is not selective searching — it is **full cataloguing**. Every face on these platforms should be embedded and indexed so any registered contributor's likeness can be matched against the complete corpus.

**Scanning priority is always new content.** Initial platform crawls are expensive and comprehensive, but once a site is fully catalogued, the database acts as a persistent map. Subsequent runs only process newly posted content, making ongoing monitoring cheap and fast. The end state for any platform is: fully indexed, with lightweight daily scans catching new uploads.

## Tech Stack

- **Runtime:** Python 3.11+ with asyncio
- **API:** FastAPI + uvicorn (port 8000)
- **Database:** PostgreSQL + asyncpg + SQLAlchemy 2.0 async ORM + pgvector
- **ML/Face Detection:** InsightFace `buffalo_sc` model (SCRFD 500M detection + MobileFaceNet W600K recognition), 512-dim ArcFace embeddings
- **GPU:** ONNX Runtime with CUDAExecutionProvider (RTX 4090 local, RunPod A40 remote)
- **Face Matching:** pgvector cosine similarity (`1 - (embedding <=> target)`)
- **Web Scraping:** aiohttp (HTTP), Playwright (screenshots), BeautifulSoup (DeviantArt HTML)
- **Storage:** Supabase Storage + aioboto3 (S3-compatible)
- **Logging:** structlog (JSON to stdout)
- **Retry:** tenacity (exponential backoff + circuit breaker)
- **Config:** pydantic-settings (env vars → BaseSettings)
- **Proxy:** ScraperAPI for rate-limited API calls only (not image downloads)

## Commands

```bash
# All commands run from apps/scanner/ directory
.venv/Scripts/python.exe -m src.main                     # Start FastAPI service (port 8000)
.venv/Scripts/python.exe scripts/crawl_and_backfill.py   # CivitAI full pipeline (crawl → detect → match)
.venv/Scripts/python.exe scripts/crawl_deviantart.py     # DeviantArt crawl with inline face detection
.venv/Scripts/python.exe scripts/process_faces.py        # Face detection backfill (safety net)
```

Scripts run **standalone** — they don't need the FastAPI service. They connect directly to the database.

### Running Tests

```bash
pytest tests/ -v                          # All tests
pytest tests/unit/ -v                     # 70+ unit tests (~10s, no external deps)
pytest tests/integration/ -v              # 4 integration tests (needs PostgreSQL)
pytest tests/smoke/ -v                    # 2 smoke tests (health, basic crawl)
pytest tests/ --cov=src --cov-report=html # With coverage
```

Test fixtures in `tests/conftest.py` provide deterministic 512-dim embeddings (`sample_embedding_alice`, `sample_embedding_bob`) and mocked settings.

## Project Structure

```
apps/scanner/
├── scripts/
│   ├── crawl_and_backfill.py        # CivitAI: 4-phase pipeline (crawl → two-pass thumbnail detect → match)
│   ├── crawl_deviantart.py          # DeviantArt: crawl with inline face detection (wixmp tokens expire)
│   ├── process_faces.py             # Backfill face detection (two-pass for CivitAI, single-pass for others)
│   └── instrumented_test_crawl.py   # Debug instrumentation for CivitAI pipeline
├── src/
│   ├── main.py                      # FastAPI app + scheduler startup/shutdown
│   ├── config.py                    # Pydantic BaseSettings + TIER_CONFIG (free/protected/premium)
│   ├── db/
│   │   ├── connection.py            # SQLAlchemy async engine (pool_size=10, overflow=20, recycle=300s)
│   │   ├── models.py               # SQLAlchemy 2.0 ORM models
│   │   └── queries.py              # Reusable async query functions (~1500 lines)
│   ├── api/
│   │   ├── admin.py                 # Admin routes: seeding, mapper, ML intelligence (x-service-key auth)
│   │   └── match_review.py          # Match review endpoints
│   ├── matching/
│   │   ├── detector.py              # Face detection wrapper
│   │   ├── embedder.py              # Extract 512-dim embeddings from detected faces
│   │   ├── comparator.py            # pgvector cosine similarity matching
│   │   └── confidence.py            # Confidence tier scoring + allowlist checking
│   ├── ingest/
│   │   ├── embeddings.py            # Poll pending images → detect → embed → store
│   │   └── centroid.py              # Quality-weighted centroid computation (≥3 embeddings)
│   ├── discovery/
│   │   ├── base.py                  # Abstract discovery source interface
│   │   ├── platform_crawl.py        # CivitAI crawler
│   │   ├── deviantart_crawl.py      # DeviantArt crawler (inline detection, hybrid RSS + HTML)
│   │   ├── reverse_image.py         # TinEye reverse image search
│   │   ├── url_check.py             # User-submitted URL validation
│   │   └── __init__.py              # PLATFORM_SCRAPERS registry
│   ├── intelligence/
│   │   ├── observer.py              # Event buffer → batch flush to ml_feedback_signals (30s or 50 events)
│   │   ├── recommender.py           # Analyzer orchestration → recommendations
│   │   ├── applier.py               # Apply approved/auto-approvable recommendations
│   │   ├── analyzers/
│   │   │   ├── base.py              # BaseAnalyzer interface
│   │   │   ├── anomalies.py         # Statistical anomaly detection
│   │   │   ├── false_positives.py   # False positive pattern filtering
│   │   │   ├── scheduling.py        # Crawl frequency optimization
│   │   │   ├── search_terms.py      # New search term recommendations
│   │   │   ├── sections.py          # Platform section risk ranking
│   │   │   ├── sources.py           # Discovery source reliability
│   │   │   └── threshold.py         # Similarity threshold optimization
│   │   └── mapper/
│   │       ├── base.py              # Base taxonomy mapper
│   │       ├── civitai.py           # CivitAI tags → search terms
│   │       ├── deviantart.py        # DeviantArt categories → tags
│   │       └── orchestrator.py      # Mapper coordination + API
│   ├── scout/
│   │   ├── base.py                  # BaseScoutSource interface
│   │   ├── assess.py                # Platform assessment (AI detection, content analysis)
│   │   ├── queries.py               # Scout database operations
│   │   └── sources/
│   │       ├── common_crawl.py      # CommonCrawl platform discovery
│   │       ├── google_cse.py        # Google Custom Search Engine
│   │       ├── link_harvest.py      # HTML link harvesting
│   │       └── reddit.py            # Reddit subreddit scraping
│   ├── providers/
│   │   ├── __init__.py              # Singleton factory: get_face_detection_provider(), etc.
│   │   ├── base.py                  # Abstract provider interfaces
│   │   ├── face_detection/
│   │   │   └── insightface.py       # InsightFace buffalo_sc (GPU/CPU, auto nvidia DLL path setup)
│   │   ├── ai_detection/
│   │   │   └── hive.py              # Hive AI classification
│   │   └── match_scoring/
│   │       ├── static.py            # Static threshold-based scorer
│   │       └── ml_scorer.py         # ML-based confidence scorer
│   ├── evidence/
│   │   ├── capture.py               # Playwright screenshot capture
│   │   ├── hasher.py                # Perceptual + cryptographic hashing
│   │   └── storage.py               # Supabase Storage upload
│   ├── enforcement/
│   │   ├── takedown.py              # DMCA notice generation
│   │   └── templates.py             # Legal template library
│   ├── jobs/
│   │   ├── scheduler.py             # Main scheduler (priority: detection > matching > crawl)
│   │   ├── store.py                 # PostgreSQL job store + stale job recovery
│   │   └── cleanup.py               # Periodic cleanup routines
│   ├── detection/
│   │   └── ai_classifier.py         # AI-generated image detection
│   ├── ad_intelligence/             # Ad platform scanning (Meta Ad Library, stock sites)
│   ├── seeding/
│   │   └── seed_manager.py          # Test user + honeypot generation
│   └── utils/
│       ├── logging.py               # structlog setup (JSON output, module= key)
│       ├── rate_limiter.py          # Token bucket rate limiter (per platform)
│       ├── retry.py                 # Exponential backoff + circuit breaker
│       ├── image_download.py        # HTTP image download + validation + thumbnail helpers
│       └── url_parser.py            # Domain parsing + allowlist matching
├── tests/
│   ├── conftest.py                  # Shared pytest fixtures (embeddings, mocks)
│   ├── unit/                        # 70+ unit tests
│   ├── integration/                 # 4 integration tests
│   └── smoke/                       # 2 smoke tests
├── migrations/                      # SQL DDL files
├── pyproject.toml                   # pytest + ruff config
├── requirements.txt                 # Core deps
├── requirements-dev.txt             # pytest, pytest-asyncio, pytest-cov
├── Dockerfile                       # GPU-optimized (RTX 4090)
├── docker-compose.yml               # Full stack (scanner + postgres + minio)
└── .env                             # Scanner-specific env vars
```

## Key Patterns

### Three-Phase Pipeline (scheduler.py)

The scanner runs in three phases, prioritized: **Detection > Matching > Crawl** (process existing before discovering more).

1. **Crawl** — Site-specific scraper → INSERT into `discovered_images`
2. **Detect** — Subprocess-isolated face detection on `has_face IS NULL` images → store in `discovered_face_embeddings`
3. **Match** — Compare embeddings against contributor registry via pgvector

### CivitAI: Two-Pass Thumbnail Architecture

The most important optimization in the codebase:

1. **Phase 1 (Crawl):** Crawl CivitAI API → store image URLs in `discovered_images`
2. **Phase 2a (Thumbnail Detection):** Download CDN thumbnails (width=450, ~60KB) for face detection
3. **Phase 2b:** Only download full originals (~2MB) for the **~3-4% of images with detected faces**

CivitAI CDN supports URL-based resizing: replace `/original=true/` with `/width=450/` in image URLs.

**Performance:** Saves ~93% bandwidth, runs 9x faster (~16 img/sec vs ~1.8 img/sec). Validated on 300+ images — thumbnails detect faces as reliably as originals.

### DeviantArt: Inline Face Detection

DeviantArt detects faces **during** crawl (not after) because wixmp CDN tokens expire quickly. Uses hybrid RSS + HTML scraping with regex pair extraction (link + image URL from same `<a>` element). No API key required.

### process_faces.py: The Safety Net

If `crawl_and_backfill.py` crashes mid-run, `process_faces.py` picks up all `has_face IS NULL` images:
- Auto-detects CivitAI images (has `/original=true/` in URL) → uses two-pass thumbnail architecture
- Non-CivitAI images → single-pass (download and detect)
- Uses **subprocess isolation** for memory management (configurable chunk size + timeout)

### Provider Factory Pattern

Three singleton factories in `src/providers/__init__.py`:
- `get_face_detection_provider()` — InsightFace by default
- `get_ai_detection_provider()` — Hive AI by default
- `get_match_scoring_provider()` — Static thresholds by default

Pluggable design. Can be used standalone (no FastAPI) — critical for subprocess scripts.

### Centroid Embedding Strategy

When a contributor has ≥3 embeddings:
- Compute quality-weighted centroid embedding
- Outlier rejection: drop embeddings with cosine similarity <0.50 to centroid
- More robust than single best-detection-score embedding
- Stored as `embedding_type='centroid'` with metadata (count, outliers, avg score)

### Database Connection

```python
# SQLAlchemy 2.0 async pattern — always use context manager
async with async_session() as session:
    # ... queries ...
    await session.commit()
```

Engine: pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=300s. Session factory uses `expire_on_commit=False`.

### ML Feedback Loop

- **Observer** (`intelligence/observer.py`): Buffers pipeline events → batch-flush every 30s or 50 events to `ml_feedback_signals`
- **Recommender** (`intelligence/recommender.py`): Orchestrates 7 analyzers → generates recommendations
- **Applier** (`intelligence/applier.py`): Auto-applies low-risk recommendations if `auto_apply_low_risk=True`
- All failures are logged but **never block the pipeline** (try/except everywhere)

### Tiered Access Control

`TIER_CONFIG` in `config.py` controls scanner behavior per subscription level:
- **Free:** Weekly reverse image scans, basic matching, no evidence/AI detection
- **Protected:** Daily scans, AI detection, evidence capture, DMCA drafts
- **Premium:** 6-hourly scans, URL checks, priority scanning, legal escalation

Applied at query time in `matching/confidence.py` and the scheduler.

### Logging

structlog with JSON output. All logs include `module=<name>` for filtering:
```json
{"timestamp": "...", "level": "info", "module": "crawler.civitai", "event": "civitai_crawl_complete", "results_found": 150}
```

### Shared Image Utilities

`src/utils/image_download.py` provides shared helpers used by all crawlers and `process_faces.py`:
- `check_content_type()` — Validate HTTP content-type header
- `check_magic_bytes()` — Validate image magic bytes
- `civitai_thumbnail_url()` — Convert CivitAI full URL to thumbnail URL
- `upload_thumbnail()` — Download, validate, and optionally store a thumbnail

### API-Level Pre-Filtering

CivitAI API responses are filtered for `type: "video"` and tiny images (`<100px`) **before** download — zero-cost filtering on data already in memory.

### Cursor-Based Pagination

Crawl state persists in `platform_crawl_schedule.search_terms` JSONB column so crawls resume where they left off after crashes or restarts.

## Database Tables

### Read-Only (shared with web app)
- `contributors` — User profile + KYC status
- `contributor_images` — Captured photos (embedding_status)
- `uploads` — Instagram/manual upload photos
- `capture_sessions` — Session metadata

### Scanner-Owned
- `discovered_images` — Crawled image URLs with metadata (platform, source_url, has_face boolean)
- `discovered_face_embeddings` — 512-dim ArcFace vectors (pgvector type)
- `matches` — Potential likeness matches (status: new/confirmed/rejected/false_positive)
- `contributor_embeddings` — Contributor face vectors for matching registry
- `platform_crawl_schedule` — Crawl scheduling + cursor-based pagination state
- `evidence` — Screenshot + metadata (hash, URL, captured_at)
- `ml_feedback_signals` — Pipeline events (signal_type, entity_type, context JSON)
- `ml_recommendations` — Auto-generated suggestions (status: pending/applied/dismissed)
- `ml_model_state` — Model versioning + training metadata
- `ml_section_profiles` — Platform section risk profiles
- `scout_keywords` — Keywords for platform discovery
- `scout_runs` — Scout execution history
- `scout_discoveries` — Newly discovered AI platforms
- `honeypot_images` — Honeypot images for detection verification

## Environment Variables

Required in `apps/scanner/.env`:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/postgres
DATABASE_SSL=true
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# External APIs
TINEYE_API_KEY=                      # TinEye reverse image search
HIVE_API_KEY=                        # Hive AI detection (optional)
DEVIANTART_CLIENT_ID=                # DeviantArt OAuth app ID
DEVIANTART_CLIENT_SECRET=            # DeviantArt OAuth secret
PROXY_URL=                           # ScraperAPI proxy (API calls only, not image downloads)
S3_BUCKET_NAME=madeofus-evidence     # Evidence storage bucket

# Crawl depth (increase for production runs)
CIVITAI_MAX_PAGES=5                  # Image search pages per term (100 images/page)
CIVITAI_MODEL_PAGES_PER_TAG=3        # Model/LoRA pages per tag
DEVIANTART_MAX_PAGES=10              # Pages per DeviantArt category
DEVIANTART_CONCURRENCY=10            # Parallel DeviantArt requests

# Scout (platform discovery)
GOOGLE_CSE_API_KEY=                  # Google Custom Search (optional)
GOOGLE_CSE_CX=                       # Custom Search Engine ID (optional)
```

## Common Pitfalls

1. **pgvector `<=>` returns distance, not similarity** — Compute similarity as `1 - (embedding <=> target)`. Range is 0-2 for normalized vectors.
2. **PostgREST 1000-row cap** — Silently truncates results. Use SQL RPC functions (e.g., `get_signal_counts()`) for aggregates.
3. **Never call sync I/O in async context** — Don't use `requests`, `cv2.imread()`, or `Image.open()` directly. Use `run_in_executor()` or the thread-pool wrappers.
4. **Subprocess output is bytes** — `subprocess.run()` returns bytes; decode to str.
5. **Circuit breaker on CivitAI** — Rate limits hard; catch `CircuitOpenError` from tenacity.
6. **Always check for empty face list** — Face detection can return `[]` for corrupted/unsupported images.
7. **Only primary embeddings match** — Set `is_primary=True` on contributor embeddings before matching.
8. **Use `await session.flush()` before accessing IDs** — SQLAlchemy won't populate auto-generated IDs until flush.
9. **Temp file cleanup** — `cleanup_old_temp_files()` is called periodically; don't assume temp files persist.
10. **No proxy for image downloads** — ScraperAPI proxy is only for CivitAI API calls. CDN image/thumbnail downloads go direct.

## GPU/ONNX Setup

- **CPU only (default):** Works out of the box with `CPUExecutionProvider`
- **GPU (RTX 4090):** Set ONNX providers to `["CUDAExecutionProvider", "CPUExecutionProvider"]`
- `InsightFaceProvider._add_nvidia_dll_paths()` auto-adds nvidia-cudnn + nvidia-cublas to PATH
- See `SETUP-4090.md` in repo root for full Windows 11 + RTX 4090 setup guide

## API Endpoints

**Health:** `GET /health` — Returns uptime, metrics, GPU status, ONNX provider info

**Admin Routes** (`/admin/`, authenticated via `x-service-key` header):
- `POST /admin/seed/contributor` — Create test user with photos
- `POST /admin/seed/honeypot` — Plant honeypot image
- `POST /admin/seed/synthetic` — Generate synthetic embeddings
- `GET /admin/mapper/maps` — Latest taxonomy map
- `POST /admin/mapper/sections/{platform}` — Toggle section scanning

## Admin Dashboard (Next.js Frontend)

The Scanner Command Center lives in the Next.js app at `/admin/scanner` with 6 tabs:
- **Command** — Pipeline funnel, header stats, manual trigger buttons
- **Pipeline** — Per-stage metrics
- **Crawl Map** — Job history and success rates
- **ML Intelligence** — Feedback signals, recommendations, analyzer status
- **Test Users** — Honeypot management
- **Scout** — Keyword management and discovery results

Dashboard queries: `src/lib/scanner-command-queries.ts`, components: `src/components/admin/scanner/`.
