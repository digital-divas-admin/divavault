# Deepfake Investigations / Deepfake Lab

The investigations system is Consented AI's public-facing deepfake debunking tool. Admins create investigations, analyze media for signs of AI generation, annotate frames, collect evidence, and publish findings. Published investigations are viewable at `/investigations` and `/investigations/[slug]`.

## Architecture Overview

Two sides: **Admin** (create & analyze) and **Public** (read published results).

```
Admin: /admin/investigations          → list + stats
       /admin/investigations/new      → create form
       /admin/investigations/[id]     → tabbed dashboard (6 tabs)

Public: /investigations               → published investigation grid
        /investigations/[slug]        → full investigation article
        /investigations/[slug]/opengraph-image → dynamic OG image
```

## Database Tables

All tables prefixed `deepfake_*` in public schema:

| Table | Purpose |
|---|---|
| `deepfake_investigations` | Core investigation record (title, slug, category, status, verdict, confidence, summary, methodology, etc.) |
| `deepfake_media` | Source media attached to an investigation (source URL, platform, download status, storage path, metadata, engagement stats) |
| `deepfake_frames` | Extracted video frames (frame number, timestamp, storage path, thumbnail, annotations, drawing data) |
| `deepfake_evidence` | Evidence items with ordered display (findings, notes, links, screenshots, metadata anomalies, AI detection results, provenance checks) |
| `deepfake_reverse_search_results` | Reverse image search results per frame (TinEye, Google Lens, Yandex, manual, SerpAPI, Wayback, news/wire archives) |
| `deepfake_tasks` | Async processing tasks (download, extract frames, metadata, reverse search, AI detection, provenance, news/wire search) |
| `deepfake_activity_log` | Audit trail of all actions on an investigation |

## Key Types (`src/types/investigations.ts`)

**Statuses:** `draft` → `in_progress` → `review` → `published` → `archived`

**Verdicts:** `confirmed_fake` | `likely_fake` | `inconclusive` | `likely_real` | `confirmed_real`

**Categories:** `war_misinfo` | `political` | `celebrity` | `revenge` | `fraud` | `other`

**Evidence types:** `finding` | `note` | `external_link` | `screenshot` | `metadata_anomaly` | `timeline_entry` | `source_match` | `ai_detection` | `provenance_check`

**Task types:** `download_media` | `extract_frames` | `extract_metadata` | `reverse_search` | `ai_detection` | `check_provenance` | `news_search` | `wire_search`

Display helpers (`VERDICT_LABELS`, `VERDICT_COLORS`, `CATEGORY_LABELS`, etc.) are exported from the same file.

## Supabase Storage

All investigation assets stored in the `deepfake-evidence` bucket:
- `investigations/{id}/media/{mediaId}.{ext}` — downloaded source media
- `investigations/{id}/frames/{mediaId}_frame_{nnnn}.jpg` — extracted frames
- `investigations/{id}/frames/{mediaId}_frame_{nnnn}_thumb.jpg` — frame thumbnails
- Frame annotation images stored at `annotation_image_path`

Signed URLs (1hr TTL) are generated in `investigation-queries.ts` for both admin and public display.

## Admin Dashboard Tabs

The admin investigation detail page (`/admin/investigations/[investigationId]`) renders `InvestigationDashboard` — a client component with 6 tabs:

1. **Overview** (`overview-tab.tsx`) — Edit title, category, description, source URLs, verdict, confidence score, summary, methodology
2. **Media** (`media-tab.tsx`) — Add source URLs, trigger download + frame extraction via process endpoint
3. **Frame Analysis** (`frame-viewer-tab.tsx`) — Browse extracted frames, annotate with drawing tools, mark key evidence, forensic enhance panel
4. **Metadata** (`metadata-tab.tsx`) — View ffprobe/EXIF data, resolution, codec, duration, AI generator duration flags
5. **Evidence** (`evidence-tab.tsx`) — Add/edit/reorder evidence items (findings, notes, links, screenshots, AI detection, provenance)
6. **Publish** (`publish-tab.tsx`) — Preview, publish/unpublish, edit slug

Data loads via `GET /api/admin/investigations/[id]` which calls `getInvestigationById()`.

### Task System

`TaskStatusBar` shows active tasks (pending/running) with a polling mechanism. Tasks are created automatically when media is added or manually via the automated-tasks endpoint.

### Frame Annotation Canvas

`FrameAnnotationCanvas` (`frame-annotation-canvas.tsx`) provides:
- Zoom/pan (scroll wheel + drag)
- Drawing tools (rectangle, circle, arrow, freehand) with color picker
- Annotations saved as `drawing_data` JSON + rasterized `annotation_image_path`
- Annotation image uploaded to storage via `POST /api/admin/.../annotation-image`

### Forensic Enhancement

`ForensicEnhancePanel` (`forensic-enhance-panel.tsx`) applies forensic filters to frames server-side:
- **Sharpen** — Unsharp mask
- **Edge Detect** — Colormix edge detection (reveals manipulation boundaries)
- **Denoise** — HQ 3D denoise
- **Histogram Equalize** — Reveal hidden detail
- **Color Amplify** — Boost saturation/contrast for color inconsistencies
- **ELA (Error Level Analysis)** — JPEG re-compression difference to detect manipulated regions

Filters implemented in `src/lib/forensic-filters.ts` using `ffmpeg-static`. API at `POST /api/admin/.../frames/[frameId]/enhance`.

## Media Processing Pipeline (`src/lib/media-processor.ts`)

Orchestrated by `processMediaTask()`, triggered via `POST /api/admin/.../media/[mediaId]/process`:

1. **Download** — yt-dlp for social platforms (YouTube, TikTok, X, Instagram, Facebook, Rumble), `fetch()` for direct URLs
2. **Upload** — Store downloaded file in `deepfake-evidence` bucket
3. **Metadata extraction** — ffprobe for duration, FPS, codec, resolution
4. **Frame extraction** — Scene detection first (`gt(scene,0.3)`), fallback to uniform sampling. Smart frame count scaling (5s→30 frames, 120s→120 frames, etc.)
5. **Thumbnails** — 320px-wide thumbnails generated for each frame
6. **Task tracking** — Status updates throughout (pending → running → completed/failed)

Dependencies: `ffmpeg-static`, `ffprobe-static`, `yt-dlp` (auto-downloaded binary cached in `node_modules/.cache/yt-dlp/`).

## Public Investigation Pages

### Listing Page (`/investigations`)
Server component. Calls `getPublishedInvestigations()`. Renders `InvestigationCard` grid.

### Detail Page (`/investigations/[slug]`)
Server component with rich SEO metadata (OpenGraph, Twitter cards, JSON-LD with `ClaimReview` schema). Uses `getInvestigationBySlug()` (cached per-request).

**Components rendered on the detail page:**
- `ReadingProgressBar` — Scroll progress indicator
- `InvestigationHero` — Title, category badge, date, verdict, read time
- `ClaimUnderReview` — Source media embed (Twitter/Instagram/video player) with engagement stats
- `ExecutiveSummary` — Summary + methodology sections
- `EvidenceTimeline` — Ordered evidence items with type badges and attachment images
- `FrameGallery` — Key evidence frames with annotations, lightbox view
- `FrameComparisonSlider` — Before/after comparison slider
- `ConfidenceScoreDisplay` — Animated confidence meter
- `VerdictBanner` — Color-coded verdict display
- `CitationBlock` — Copy-friendly citation in multiple formats
- `TableOfContents` — Floating sidebar nav
- `ShareButtons` — Social sharing (Twitter, Facebook, LinkedIn, copy link)
- `NewsletterSignup` — Email signup CTA
- `InvestigationCTA` — Call to action for protection
- `RelatedInvestigations` — Up to 3 related investigations (same category preferred)

### Social Embeds
- `TwitterEmbed` — Renders tweet via `react-tweet` library
- `InstagramEmbed` — Instagram oEmbed integration
- Engagement stats auto-fetched via `src/lib/fetch-engagement.ts` using Twitter syndication API (no API key needed)

### Dynamic OG Image
`/investigations/[slug]/opengraph-image.tsx` generates a branded OG image using Next.js `ImageResponse`.

## API Routes

All admin routes require authentication + admin role check via `requireAdmin()`.

```
Admin CRUD:
  GET/POST   /api/admin/investigations              — list / create
  GET/PATCH/DELETE  /api/admin/investigations/[id]   — read / update / delete
  GET        /api/admin/investigations/stats         — dashboard stats

Media:
  POST       /api/admin/investigations/[id]/media    — add source URL
  POST       /api/admin/investigations/[id]/media/[mediaId]/process  — trigger download + extraction

Frames:
  GET        /api/admin/investigations/[id]/frames              — list frames
  PATCH      /api/admin/investigations/[id]/frames/[frameId]    — annotate frame
  POST       /api/admin/investigations/[id]/frames/[frameId]/annotation-image  — upload annotation raster
  POST       /api/admin/investigations/[id]/frames/[frameId]/enhance  — forensic filter
  POST       /api/admin/investigations/[id]/frames/[frameId]/upscale  — image upscale

Evidence:
  POST       /api/admin/investigations/[id]/evidence              — create evidence
  PATCH/DELETE  /api/admin/investigations/[id]/evidence/[evidenceId]  — update / delete

Tasks:
  GET        /api/admin/investigations/[id]/tasks           — list tasks
  POST       /api/admin/investigations/[id]/automated-tasks — trigger automated analysis

Publishing:
  POST       /api/admin/investigations/[id]/publish  — publish / unpublish
```

## Lib Files

| File | Purpose |
|---|---|
| `investigation-queries.ts` | All Supabase CRUD + query functions (server-side, uses service client). `getInvestigationBySlug` is cached via React `cache()`. |
| `investigation-utils.ts` | Slug generation, platform detection, reverse search URL builder, tweet/Instagram URL detection, duration formatting, AI generator duration check, reading time estimation, verdict-to-rating mapping |
| `investigation-validators.ts` | Zod v4 schemas for all API inputs (create/update investigation, add media, annotate frame, create/update evidence, add search result, trigger automated tasks) |
| `forensic-filters.ts` | FFmpeg-based forensic image filters (sharpen, edge detect, denoise, histogram eq, color amplify, ELA) |
| `media-processor.ts` | Full media pipeline: download (yt-dlp / fetch), metadata extraction (ffprobe), frame extraction (scene detect + uniform), thumbnail generation, Supabase storage upload |
| `fetch-engagement.ts` | Twitter syndication API engagement stats fetcher (no API key) |
| `hive-ai.ts` | Hive AI detection client + orchestrator. Calls Hive API to detect AI-generated content, creates evidence records with scores. Requires `HIVE_API_KEY` env var. |

## Important Patterns

- **Enum arrays as source of truth** — All enums defined as `const` arrays in `types/investigations.ts`, union types derived with `typeof`. Same arrays used in Zod validators.
- **Activity logging** — Every mutation logs to `deepfake_activity_log` via `logActivity()` helper.
- **Signed URLs everywhere** — All storage paths are signed with 1hr TTL before returning to client. Both admin (`getInvestigationById`) and public (`getInvestigationBySlug`) paths sign URLs.
- **Public page filters key frames** — `getInvestigationBySlug` only returns frames marked `is_key_evidence` or with annotations, not all extracted frames.
- **Engagement stats lazy-fetch** — Tweet engagement stats are fetched on first public page load and cached back to the DB.
- **Verdict color system** — Each verdict has 4 color variants: badge (`VERDICT_COLORS`), text (`VERDICT_TEXT_COLORS`), banner (`VERDICT_BANNER_COLORS`), and the public page uses light-bg variants for readability.
- **ClaimReview structured data** — Published investigations include JSON-LD `ClaimReview` schema for Google Fact Check integration.
