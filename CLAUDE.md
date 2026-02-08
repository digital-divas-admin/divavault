# Made Of Us

A platform for influencers and creators to monetize their likeness through ethical AI training. Contributors upload photos (via guided camera capture, Instagram, or manual upload), complete identity verification, and earn from their data.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS v4 + Shadcn/UI (new-york style)
- **Auth + DB + Storage:** Supabase (`@supabase/ssr` for SSR pattern)
- **Forms:** React Hook Form + Zod v4 + `@hookform/resolvers`
- **State:** Zustand with `persist` middleware (localStorage, version 2)
- **Identity Verification:** SumSub (`@sumsub/websdk`)
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
│   ├── layout.tsx                  # Root layout (light theme, DM Sans + DM Serif Display fonts)
│   ├── globals.css                 # Tailwind v4 theme (cream/teal/coral palette)
│   ├── (auth)/login/page.tsx       # Login form (client component)
│   ├── (auth)/signup/page.tsx      # Signup form (client component)
│   ├── onboarding/
│   │   ├── layout.tsx              # Onboarding shell with header
│   │   └── page.tsx                # Multi-step form container (Suspense + handoff support)
│   ├── dashboard/page.tsx          # Post-onboarding (server component)
│   └── api/
│       ├── auth/signout/route.ts   # Sign out handler
│       ├── sumsub/token/route.ts   # SumSub access token (HMAC-SHA256 signed)
│       ├── sumsub-webhook/route.ts # SumSub KYC webhook (signature-verified)
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
│       ├── identity-verification.tsx  # Step 1: Real SumSub SDK + dev bypass
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
│   ├── sumsub.ts                   # SumSub webhook verification + status mapping
│   ├── validators.ts               # Zod v4 schemas (signup, login, profile, consent)
│   └── utils.ts                    # Shadcn cn() utility
├── stores/onboarding-store.ts      # Zustand store (persisted, version 2 with migration)
└── types/
    ├── index.ts                    # Contributor + Upload interfaces
    ├── capture.ts                  # CaptureSession, ContributorImage, ContributorConsent, etc.
    └── marketplace.ts              # ContributorAttributes, marketplace types
```

## Important Patterns

### Light Cream Theme
The app uses a warm light-mode design. No dark mode toggle. The color palette is:
- **Primary:** Teal (#0D7377) — buttons, links, interactive elements
- **Secondary:** Coral (#E8845C) — accent highlights, icons in dark sections
- **Accent:** Amber (#F0A050) — tertiary highlights
- **Background:** Cream (#F7F5F0)
- **Foreground:** Navy (#1C2333) — text
- **Fonts:** DM Serif Display (headings), DM Sans (body)

CSS utilities: `.card-hover` (shadow + teal top-border on hover), `.section-dark` (navy background for contrast sections).

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
5-step multi-step form managed by Zustand store (version 2 with persist migration):
1. **Verify ID** — Real SumSub Web SDK (`@sumsub/websdk`), QR handoff for desktop→phone. Dev bypass available (`[DEV] Skip verification` button).
2. **Your Profile** — Visual demographic pickers (color swatches, chips) → `contributor_attributes` table
3. **Consent** — Core consents + granular usage categories (commercial/editorial/entertainment/e-learning), geo restrictions, content exclusions. SHA-256 consent hash → `contributor_consents` table (immutable records)
4. **Photo Capture** — Guided camera with quality checks (brightness, sharpness, face detection) OR fallback upload (Instagram + manual, min 25 photos). QR handoff available when no camera. → `capture-uploads` bucket + `contributor_images` table
5. **Complete** — Verifies all steps done, marks `onboarding_completed`

State persists to localStorage so users can resume. On completion, user is redirected to `/dashboard`.

**SumSub SDK events** use `idCheck.` prefix: `idCheck.onError`, `idCheck.onApplicantLoaded`, `idCheck.onApplicantSubmitted`, `idCheck.applicantReviewComplete`.

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
SUMSUB_APP_TOKEN=                # SumSub API token
SUMSUB_SECRET_KEY=               # SumSub API secret (also used for handoff token signing)
SUMSUB_WEBHOOK_SECRET=           # SumSub webhook signing secret
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
- **SumSub needs live credentials** — Dev bypass available; fill in `SUMSUB_APP_TOKEN` and `SUMSUB_SECRET_KEY` for production.
