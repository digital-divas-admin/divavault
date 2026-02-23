# Made Of Us

An AI likeness protection platform. Members upload photos and verify their identity to create a facial signature. We then continuously scan AI platforms (CivitAI, DeviantArt, Reddit, 247+) for unauthorized use of their face and file DMCA takedowns automatically. Dark purple-black theme with tiered protection plans (Free / Protected / Premium).

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS v4 + Shadcn/UI (new-york style)
- **Auth + DB + Storage:** Supabase (`@supabase/ssr` for SSR pattern)
- **Forms:** React Hook Form + Zod v4 + `@hookform/resolvers`
- **State:** Zustand with `persist` middleware (localStorage, version 4)
- **Identity Verification:** Veriff (`@veriff/js-sdk` + `@veriff/incontext-sdk`)
- **Camera Capture:** `getUserMedia` API + canvas-based quality checks
- **Deployment:** Render (via `render.yaml`) — not yet deployed; planned for future

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build (Turbopack)
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page (assembles 9 sections)
│   ├── layout.tsx                  # Root layout (dark theme, DM Sans + DM Serif Display fonts)
│   ├── globals.css                 # Tailwind v4 theme (dark purple-black palette)
│   ├── (auth)/login/page.tsx       # Login form (client component)
│   ├── (auth)/signup/page.tsx      # Signup form (client component)
│   ├── onboarding/
│   │   ├── layout.tsx              # Onboarding shell with header
│   │   └── page.tsx                # Multi-step form container (Suspense + handoff support)
│   ├── dashboard/page.tsx          # Post-onboarding (server component)
│   └── api/
│       ├── auth/signout/route.ts   # Sign out handler
│       ├── veriff/session/route.ts  # Veriff session creation
│       ├── veriff-webhook/route.ts # Veriff KYC webhook (HMAC-SHA256 verified)
│       ├── onboarding/
│       │   ├── profile/route.ts    # Save profile → contributor_attributes
│       │   ├── consent/route.ts    # Save consent → contributor_consents (immutable)
│       │   ├── complete/route.ts   # Verify all 5 steps done → mark onboarding_completed
│       │   └── handoff/route.ts    # QR handoff token (POST=generate, GET=validate)
│       ├── capture/
│       │   ├── session/route.ts    # Create/update capture sessions (POST/PATCH)
│       │   └── image/route.ts      # Record captured image metadata
│       └── instagram/
│           ├── auth/route.ts       # Instagram OAuth redirect
│           └── callback/route.ts   # Instagram OAuth callback + media fetch
├── components/
│   ├── ui/                         # Shadcn/UI components
│   ├── landing/                    # Landing page sections (9 total)
│   └── onboarding/
│       ├── identity-verification.tsx  # Step 1: Veriff InContext SDK + dev bypass
│       ├── profile-builder.tsx        # Step 2: Visual demographic pickers
│       ├── consent-configuration.tsx  # Step 3: Granular consent toggles + SHA-256 hash
│       ├── guided-capture.tsx         # Step 4: Camera capture or fallback upload
│       ├── onboarding-complete.tsx    # Step 5: Verification + success screen
│       ├── qr-handoff.tsx             # QR code for desktop→phone handoff
│       ├── photo-guidelines.tsx       # Photo upload guidelines
│       ├── instagram-connect.tsx      # Instagram OAuth connector
│       ├── photo-upload.tsx           # Manual drag-and-drop upload
│       ├── photo-gallery.tsx          # Photo preview gallery
│       ├── progress-bar.tsx           # 5-step progress indicator
│       ├── step-container.tsx         # Shared step layout wrapper
│       └── capture/
│           ├── camera-view.tsx        # getUserMedia + canvas frame capture
│           ├── capture-button.tsx     # Shutter button (green pulse when ready)
│           ├── quality-feedback.tsx   # Real-time quality check overlay
│           ├── step-indicator.tsx     # Capture progress dots + instruction
│           └── pose-guide.tsx         # SVG silhouette overlay (face/upper/full body)
├── lib/
│   ├── supabase/client.ts          # Browser Supabase client
│   ├── supabase/server.ts          # Server Supabase client + service role client
│   ├── supabase/middleware.ts      # Auth session refresh + CSP + camera permissions
│   ├── capture-steps.ts            # 10 capture step configs (MIN_CAPTURE_STEPS = 9)
│   ├── quality-checks.ts           # Brightness, sharpness, face detection checks
│   ├── upload-queue.ts             # IndexedDB-backed upload queue (via idb)
│   ├── identity-match.ts           # Cosine similarity for face embeddings
│   ├── consent-hash.ts             # SHA-256 consent hashing (Web Crypto API)
│   ├── instagram.ts                # Instagram API helpers
│   ├── veriff.ts                    # Veriff webhook verification + status mapping
│   ├── validators.ts               # Zod v4 schemas (signup, login, profile, consent)
│   └── utils.ts                    # Shadcn cn() utility
├── stores/onboarding-store.ts      # Zustand store (persisted, version 2 with migration)
└── types/
    ├── index.ts                    # Contributor + Upload interfaces
    ├── capture.ts                  # CaptureSession, ContributorImage, ContributorConsent, etc.
    └── marketplace.ts              # ContributorAttributes, marketplace types
```

## Important Patterns

### Dark Purple-Black Theme
The app uses a dark theme. No light mode toggle. The color palette is:
- **Primary:** Purple (#8B5CF6) — CTAs, badges, highlights, accent text
- **Secondary:** Dark gray (#27272A) — secondary surfaces
- **Accent:** Green (#22C55E) — success stats, resolved badges
- **Destructive:** Red (#EF4444) — errors, warnings
- **Background:** Near-black (#09090B) — page bg
- **Card/Surface:** Dark zinc (#18181B) — cards, elevated sections
- **Foreground:** White (#FAFAFA) — headings, primary text
- **Muted text:** Gray (#A1A1AA) — body text, descriptions
- **Fonts:** DM Serif Display (headings), DM Sans (body)

CSS utilities: `.card-hover` (shadow + purple top-border on hover), `.section-elevated` (#18181B background for contrast sections).

Badge variants: `success` (green), `warning` (yellow), `purple` (primary accent).

### Supabase SSR Auth
Three Supabase client factories:
- `lib/supabase/client.ts` — browser client (used in `"use client"` components)
- `lib/supabase/server.ts` — server client (used in server components/route handlers)
- `lib/supabase/server.ts` → `createServiceClient()` — service role (admin ops, webhooks)

Middleware at `middleware.ts` (root) refreshes auth session on every request and protects `/onboarding` and `/dashboard` routes.

### Zod v4 (NOT v3)
This project uses Zod v4 which has a different API from v3:
- Use `{ message: "..." }` instead of `{ required_error: "..." }`
- Use `{ message: "..." }` instead of `{ errorMap: () => ... }`

### Onboarding Flow (5 steps)
5-step multi-step form managed by Zustand store (version 4 with persist migration):
1. **Verify ID** — Veriff InContext SDK (`@veriff/incontext-sdk`), QR handoff for desktop→phone. Dev bypass available (`[DEV] Skip verification` button).
2. **Your Profile** — Visual demographic pickers (color swatches, chips) → `contributor_attributes` table
3. **Consent** — Core consents + granular usage categories (commercial/editorial/entertainment/e-learning), geo restrictions, content exclusions. SHA-256 consent hash → `contributor_consents` table (immutable records)
4. **Photo Capture** — Guided camera with quality checks (brightness, sharpness, face detection) OR fallback upload (Instagram + manual, min 25 photos). QR handoff available when no camera. → `capture-uploads` bucket + `contributor_images` table
5. **Complete** — Verifies all steps done, marks `onboarding_completed`

State persists to localStorage so users can resume. On completion, user is redirected to `/dashboard`.

**Veriff InContext SDK events**: `MESSAGES.STARTED` (flow loaded), `MESSAGES.FINISHED` (user completed, awaiting webhook decision), `MESSAGES.CANCELED` (user cancelled).

**QR Handoff** includes the current step number in the signed token so the phone jumps directly to the right step.

### Supabase Storage Buckets
- `sfw-uploads` — Fallback photo uploads (Instagram + manual)
- `capture-uploads` — Guided camera capture photos (stored as `{user_id}/{session_id}/{step}-{timestamp}.jpg`)
- `nsfw-uploads` — Legacy bucket, no longer used

### Contributor Row Creation
API routes (`/api/onboarding/profile`, `/api/onboarding/consent`, `/api/capture/session`) upsert a `contributors` row on first call since the row is needed before child tables (`contributor_attributes`, `contributor_consents`, `capture_sessions`) can reference it via foreign keys. The `full_name` column is nullable to support this.

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (server-only)
VERIFF_API_KEY=                  # Veriff API key (from Customer Portal)
VERIFF_SHARED_SECRET=            # Veriff shared secret (HMAC signing for API + webhooks)
HANDOFF_SECRET=                  # Secret for QR handoff token signing
INSTAGRAM_CLIENT_ID=             # Meta/Instagram app client ID
INSTAGRAM_CLIENT_SECRET=         # Meta/Instagram app client secret
INSTAGRAM_REDIRECT_URI=          # Must match Meta app config
NEXT_PUBLIC_SITE_URL=            # Site URL for QR handoff (dev: http://192.168.10.173:3000)
```

## Database

Schema is in `supabase/schema.sql`. Tables with RLS:
- `contributors` — User profile, KYC status, consent, onboarding progress
- `uploads` — Individual photo records from Instagram/manual upload
- `contributor_attributes` — Demographic profile (hair, eyes, skin, body, age, gender, ethnicity)
- `contributor_consents` — Immutable granular consent records with SHA-256 hash
- `capture_sessions` — Guided capture session tracking (status, device info, image counts)
- `contributor_images` — Captured image metadata (step, quality scores, file path)

RLS policies restrict users to their own data only.

### Running SQL Remotely

There are two methods depending on what you need to modify:

#### Method 1: `exec_sql` RPC (for public schema tables)

A `public.exec_sql(query text)` Postgres function exists. Locked to `service_role` only. Use for DDL/DML on tables in the `public` schema (e.g. `contributors`, `uploads`).

```bash
SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
curl -s -X POST "https://sazywtcvjpnwzhplovvr.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```

Returns `{"success": true}` or `{"success": false, "error": "..."}`.

**Limitation:** `exec_sql` runs as `postgres` (not a superuser on hosted Supabase). It **cannot** modify `storage.objects`, `auth.*`, or other system-owned tables. Use Method 2 for those.

#### Method 2: Supabase Management API (for storage, auth, and system tables)

Uses a personal access token (generate at https://supabase.com/dashboard/account/tokens). This runs SQL as the `supabase_admin` role, which can modify any table including `storage.objects`.

```bash
SUPABASE_TOKEN="sbp_your_token_here"
curl -s -X POST "https://api.supabase.com/v1/projects/sazywtcvjpnwzhplovvr/database/query" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```

Returns a JSON array of result rows, or `[]` for DDL statements.

**Use this for:** storage RLS policies, auth schema changes, extension management, anything `exec_sql` rejects with "must be owner of table".

## Known Limitations

- **Camera requires HTTPS** — `getUserMedia` only works over HTTPS or localhost. Phone camera capture won't work in local dev over network IP. Works on Render (HTTPS automatic).
- **Payments not implemented** — MVP focuses on signup + data collection only.
- **Instagram API requires Meta app review** — For production, the Meta app needs Basic Display product review. Dev uses test users.
- **Instagram tokens stored unencrypted** — Should add encryption for production.
- **Veriff needs live credentials** — Dev bypass available; fill in `VERIFF_API_KEY` and `VERIFF_SHARED_SECRET` for production.

## Scanner Backend (`apps/scanner/`)

Python-based platform scanning backend that crawls AI art platforms, detects faces in generated images using InsightFace, and matches them against contributor face embeddings to find unauthorized usage.

### Scanner Tech Stack

- **Runtime:** Python 3.11+ with asyncio
- **API:** FastAPI (port 8000)
- **ML/Face Detection:** InsightFace `buffalo_sc` model (SCRFD 500M detection + MobileFaceNet W600K recognition), 512-dim ArcFace embeddings
- **GPU:** ONNX Runtime with CUDAExecutionProvider (RTX 4090 local, RunPod A40 remote)
- **Face Matching:** pgvector cosine similarity (`1 - (embedding <=> target)`)
- **Database:** Same Supabase PostgreSQL as frontend (asyncpg + SQLAlchemy)
- **Rate Limiting:** Adaptive token-bucket rate limiter per platform
- **Proxy:** ScraperAPI proxy for rate-limited platforms

### Scanner Commands

```bash
# From apps/scanner/ directory
.venv/Scripts/python.exe -m src.main          # Start FastAPI service (port 8000)
.venv/Scripts/python.exe scripts/crawl_and_backfill.py   # CivitAI full pipeline (crawl → detect → match)
.venv/Scripts/python.exe scripts/crawl_deviantart.py     # DeviantArt crawl with inline face detection
.venv/Scripts/python.exe scripts/process_faces.py        # Face detection backfill only
```

### Scanner Architecture

```
apps/scanner/
├── scripts/
│   ├── crawl_and_backfill.py      # CivitAI: 4-phase pipeline (crawl → two-pass thumbnail detect → match)
│   ├── crawl_deviantart.py        # DeviantArt: crawl with inline face detection (wixmp tokens expire)
│   └── process_faces.py           # Backfill face detection (two-pass for CivitAI, single-pass for others)
├── src/
│   ├── main.py                    # FastAPI app with scheduler, health endpoint
│   ├── config.py                  # Pydantic BaseSettings (reads .env)
│   ├── api/                       # FastAPI routes (admin, match_review)
│   ├── db/                        # SQLAlchemy models, async queries, connection pool
│   ├── discovery/                 # Platform crawlers (CivitAI API, DeviantArt OAuth, reverse image)
│   ├── ingest/                    # Face embedding ingestion + centroid computation
│   ├── matching/                  # Face detection → embedding → comparison pipeline
│   ├── providers/                 # Abstraction layer (InsightFace, Hive AI detection, ML scoring)
│   ├── intelligence/              # ML feedback loop: analyzers → recommendations → auto-apply
│   │   ├── analyzers/             # 7 analyzers: anomalies, false_positives, scheduling, search_terms, sections, sources, threshold
│   │   └── mapper/                # Platform taxonomy mapping (CivitAI tags, DeviantArt categories)
│   ├── scout/                     # Platform Scout: discover new AI platforms via Google CSE, Reddit, CommonCrawl
│   ├── jobs/                      # APScheduler job management + stale job recovery
│   ├── enforcement/               # DMCA takedown template generation
│   ├── evidence/                  # Evidence capture, hashing, S3 storage
│   └── utils/                     # Rate limiter, retry, image download (shared validation + thumbnail), URL parsing
├── tests/                         # Unit (70+), integration (4), smoke (2) tests
├── migrations/                    # SQL migration files
└── .env                           # Scanner-specific env vars
```

### Scanner Database Tables

Scanner-specific tables (in addition to core app tables):
- `discovered_images` — Crawled image URLs with metadata (platform, source_url, faces_detected boolean)
- `discovered_face_embeddings` — 512-dim ArcFace face embeddings (vector type via pgvector)
- `matches` — Potential likeness matches (status: new/confirmed/rejected/false_positive)
- `platform_crawl_schedule` — Crawl scheduling with cursor-based pagination state
- `ml_feedback_signals` — ML feedback events (match_found, faces_detected, matching_completed, etc.)
- `ml_recommendations` — Auto-generated recommendations from analyzers (status: pending/applied/dismissed)
- `ml_model_state` — ML model versioning and training metadata
- `ml_section_profiles` — Platform section risk profiles
- `scout_keywords` — Keywords for platform discovery scouting
- `scout_runs` — Scout execution history
- `scout_discoveries` — Newly discovered AI platforms
- `honeypot_images` — Honeypot images for detection verification

### Scanner Environment Variables

Required in `apps/scanner/.env`:

```
DATABASE_URL=                     # PostgreSQL connection (asyncpg)
DATABASE_SSL=true
SUPABASE_URL=                     # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=        # Service role key for admin operations
TINEYE_API_KEY=                   # TinEye reverse image search
DEVIANTART_CLIENT_ID=             # DeviantArt OAuth app ID
DEVIANTART_CLIENT_SECRET=         # DeviantArt OAuth secret
PROXY_URL=                        # ScraperAPI proxy for rate-limited requests
S3_BUCKET_NAME=                   # Evidence storage bucket
HIVE_API_KEY=                     # Hive AI detection (optional)

# Crawl depth overrides
CIVITAI_MAX_PAGES=5               # Image search pages per term (100 images/page)
CIVITAI_MODEL_PAGES_PER_TAG=3     # Model/LoRA pages per tag
DEVIANTART_MAX_PAGES=10           # Pages per DeviantArt category
DEVIANTART_CONCURRENCY=10         # Parallel DeviantArt requests
```

### Key Scanner Patterns

- **CivitAI uses TWO-PASS thumbnail architecture**: Phase 1 crawls URLs, Phase 2 downloads CDN thumbnails (width=450, ~60KB) for face detection — only downloads full originals (~2MB) for the ~3-4% of images with faces. Phase 3 matches against contributors. CivitAI CDN supports URL-based resizing: replace `/original=true/` with `/width=450/` in image URLs. Validated: thumbnails detect faces as reliably as originals (tested 300+ images, same detection rate at all resolutions). Saves ~93% bandwidth and runs 9x faster (~16 img/sec vs ~1.8 img/sec).
- **DeviantArt uses INLINE face detection**: Detects faces during crawl because wixmp CDN tokens expire quickly. Cannot resume face detection later.
- **Shared image utilities** (`src/utils/image_download.py`): `check_content_type()`, `check_magic_bytes()`, `civitai_thumbnail_url()`, `upload_thumbnail()` — used by both crawlers and `process_faces.py`. DeviantArt refactored to use shared `upload_thumbnail()` instead of a local copy.
- **process_faces.py is the safety net**: If `crawl_and_backfill.py` crashes mid-run, `process_faces.py` picks up all `has_face IS NULL` images with the same two-pass thumbnail architecture. It auto-detects CivitAI thumbable URLs (has `/original=true/`) and uses two-pass; non-CivitAI images use single-pass. Uses subprocess isolation for memory management.
- **API-level pre-filtering**: CivitAI API responses are filtered for `type: "video"` and tiny images (`<100px`) before download — zero-cost filtering on data already in memory.
- **Cursor-based pagination**: Crawl state persists in `platform_crawl_schedule.search_terms` JSONB column so crawls resume where they left off.
- **Scripts run standalone**: `crawl_and_backfill.py` and `crawl_deviantart.py` don't need the FastAPI service running — they connect directly to the database.
- **No proxy needed for image downloads**: ScraperAPI proxy is only used for CivitAI API calls (rate-limited). CDN image/thumbnail downloads go direct — no extra proxy credits for two-pass.
- **Supabase PostgREST row cap**: PostgREST has a server-side `max-rows=1000` that silently truncates results. Use SQL RPC functions (e.g., `get_signal_counts()`) for aggregate queries that may exceed this limit.

### Scanner Command Center (Admin Dashboard)

Located at `/admin/scanner`, the Command Center has 6 tabs:
- **Command** — Pipeline funnel (Discovered → Faces Found → Matched → Confirmed), header stats, trigger buttons
- **Pipeline** — Detailed stage breakdown with per-stage metrics
- **Crawl Map** — Platform crawl job history and success rates
- **ML Intelligence** — ML model state, feedback loop signal counts, recommendations, analyzer status
- **Test Users** — Honeypot image management
- **Scout** — Platform Scout keyword management and discovery results

Dashboard queries are in `src/lib/scanner-command-queries.ts`, components in `src/components/admin/scanner/`.
