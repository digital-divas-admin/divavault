# Made Of Us — Project Knowledge Document

## Mission

Made Of Us is an AI likeness protection platform. People's faces are being scraped from social media and used without consent to train AI models and generate synthetic content. Made Of Us gives individuals control over their digital likeness through three pillars:

1. **Detection** — Continuously scan 247+ AI platforms (CivitAI, DeviantArt, Reddit, etc.) for unauthorized use of someone's face
2. **Protection** — Automatically file DMCA takedowns when matches are found
3. **Consent Infrastructure** — Maintain a public Consented Identity Registry that AI platforms can query before using someone's likeness

The business model is tiered subscriptions (Free / Protected / Premium) with a free claim flow for anyone to register their face without an account.

---

## Platform Architecture

### Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS v4 + Shadcn/UI (new-york style, dark purple-black theme)
- **Auth + DB + Storage:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Forms:** React Hook Form + Zod v4
- **State:** Zustand with persist middleware (localStorage)
- **Identity Verification:** Veriff InContext SDK
- **Camera:** getUserMedia API + canvas-based quality checks
- **Deployment:** Render (render.yaml)

### Color Palette (Dark Theme, No Light Mode)
- Primary: Purple (#8B5CF6) — CTAs, accents
- Background: Near-black (#09090B)
- Card/Surface: Dark zinc (#18181B)
- Foreground: White (#FAFAFA)
- Muted text: Gray (#A1A1AA)
- Success: Green (#22C55E)
- Destructive: Red (#EF4444)
- Fonts: DM Serif Display (headings), DM Sans (body)

---

## Core User Journeys

### Journey A: Full Signup + Protection
1. Landing page (`/`) — 9-section story: problem, solution, how it works, pricing, FAQ
2. Sign up (`/signup`) — choose tier (Free / Protected / Premium)
3. Onboarding (`/onboarding`) — 5-step flow (see below)
4. Dashboard (`/dashboard`) — protection score, matches, takedowns, settings

### Journey B: Free Claim (No Account)
1. `/claim` — capture selfie via webcam
2. Get a CID (Consented Identity) immediately
3. Optionally provide email for match notifications
4. Upsell to full signup for DMCA takedowns

### Journey C: AI Platform Integration
1. Platform gets API key with scoped permissions
2. Before using a face, queries consent oracle: `GET /api/platform/v1/registry/consent/check?cid=...&use_type=commercial`
3. Gets boolean `allowed` response with consent status
4. Subscribes to webhooks for consent changes

---

## The 5-Step Onboarding Flow

Managed by Zustand store (`src/stores/onboarding-store.ts`), persisted to localStorage so users can resume.

### Step 1: Identity Verification
- Veriff InContext SDK for real KYC (ID check, liveness)
- QR handoff for desktop users to continue on phone
- Dev bypass available for testing
- Events: `MESSAGES.STARTED`, `MESSAGES.FINISHED`, `MESSAGES.CANCELED`

### Step 2: Profile Builder
- Visual demographic pickers (color swatches, chips)
- Hair, eyes, skin tone, body type, age range, gender, ethnicity
- Saves to `contributor_attributes` table

### Step 3: Consent Configuration
- 5 core consents (must accept all): age/identity, AI training, likeness rights, revocation rights, privacy
- 4 granular usage toggles: commercial, editorial, entertainment, e-learning
- Geographic restrictions and content exclusions
- SHA-256 consent hash stored immutably in `contributor_consents`

### Step 4: Photo Capture
- Guided camera with 10 poses (face angles, expressions, upper/full body)
- Real-time quality checks (brightness, sharpness, face detection)
- Minimum 9 photos required
- Fallback: Instagram OAuth import or manual upload
- QR handoff available for desktop users without camera

### Step 5: Completion
- Verifies all steps done
- Creates face embedding anchor (centroid)
- Creates registry identity with CID
- Marks `onboarding_completed = true`
- Redirects to dashboard

---

## Dashboard Features

### Home (`/dashboard`)
- **3 stat cards**: Platforms Monitored, Matches Found, Takedowns Filed
- **Protection Score**: Gamified 0-100 metric based on angle/expression coverage, photo count, quality, embeddings
- **Recent Matches**: Last 5 detected matches
- **Activity Feed**: Recent protection events

### Matches (`/dashboard/matches`)
- Filterable list of detected matches (status, confidence, platform)
- Match detail pages with side-by-side comparison, evidence, takedown timeline
- Actions: request DMCA takedown, dismiss match

### Contributions (`/dashboard/contributions`)
- Photo grid of all uploaded photos with coverage metrics
- Upload additional photos

### Account (`/dashboard/account`)
- Profile management, connected accounts (Instagram), notification preferences

### Privacy (`/dashboard/privacy`)
- Consent summary and modification
- One-click opt-out (stops all scans, revokes consent via registry)
- Data export (GDPR), account deletion

---

## Consented Identity Registry

The registry is the infrastructure layer — a public system AI platforms can query to verify consent before using someone's likeness.

### 5 Core Tables

| Table | Purpose |
|-------|---------|
| `registry_identities` | CID-indexed identities with status (claimed/verified/suspended/revoked) |
| `registry_consent_events` | Hash-linked chain of consent mutations (grant/modify/restrict/revoke/reinstate) |
| `registry_verifications` | KYC verification records (Veriff, selfie liveness) |
| `registry_matches` | Detected matches with similarity scores and confidence tiers |
| `registry_contacts` | Contact info for match notifications (email, webhook) |

### CID Format
`CID-1` followed by 16 lowercase hex characters, e.g. `CID-1a8f3e2b7c9d0f14`. Generated via SHA-256 of seed + timestamp + random bytes.

### Consent Chain (Tamper-Proof)
Events are hash-linked: each event's hash = SHA-256(event data | previous hash). Genesis event uses "GENESIS" as previous. The chain can be verified by replaying all events and checking hashes. Current consent is derived by replaying the event sequence through a state machine.

### ConsentScope Structure (Spec v0.1)
```json
{
  "spec_version": "0.1",
  "use_types": { "commercial": true, "editorial": true, "entertainment": false, "elearning": true },
  "geographic_scope": { "type": "blocklist", "regions": ["CN", "RU"] },
  "content_exclusions": ["adult", "political"],
  "modalities": { "face": true, "voice": true, "body": true },
  "temporal": { "valid_from": "2025-01-01T00:00:00Z", "valid_until": null, "auto_renew": true }
}
```

---

## Platform API (`/api/platform/v1/`)

External API for AI platforms. Authenticated via API keys (`mou_live_{64 hex chars}`) with scoped permissions.

### Key Endpoints

| Endpoint | Method | Scope | Purpose |
|----------|--------|-------|---------|
| `/registry/consent/check` | GET | `registry:consent:read` | Consent oracle — "is use X allowed for CID Y?" |
| `/registry/batch/lookup` | POST | `registry:read` | Bulk CID lookup (up to 100) |
| `/registry/batch/consent` | POST | `registry:consent:read` | Bulk consent check (up to 100) |
| `/registry/stats` | GET | `registry:read` | Registry-wide statistics |
| `/contributors` | GET | `contributors:read` | List verified contributors |
| `/contributors/[id]` | GET | `contributors:read` | Single contributor profile |
| `/contributors/[id]/photos` | GET | `photos:read` | Contributor's photos (signed URLs) |
| `/contributors/[id]/consent` | GET | `consent:read` | Contributor's consent scope |
| `/webhooks` | POST | `webhooks:manage` | Subscribe to events |

### Webhook Events
- `contributor.onboarded`, `contributor.consent_updated`, `contributor.opted_out`, `contributor.photos_added`
- `registry.identity_created`, `registry.consent_updated`, `registry.consent_revoked`
- `bounty.created`, `bounty.submission_reviewed`

Webhooks use HMAC-SHA256 signatures via `X-Webhook-Signature` header.

---

## Marketplace / Bounty System

A marketplace where admins post paid photo requests and contributors submit photos for compensation.

### How It Works
1. Admin creates a **BountyRequest** with targeting criteria (demographics), compensation (per-image or per-set), quality requirements, and deadline
2. Contributors browse available requests, bookmark interesting ones
3. Contributor creates a **BountySubmission** with photos
4. Admin reviews — accepts/rejects individual images with feedback
5. Accepted submissions earn compensation, tracked in `earnings` table
6. PayPal batch payouts for earnings

### Key Tables
- `bounty_requests` — Admin postings with targeting, pay, requirements
- `bounty_submissions` — Contributor submissions with review status
- `submission_images` — Individual photos in submissions
- `bounty_bookmarks` — Saved requests
- `contributor_attributes` — Demographics for matching (with share toggles)

### Compensation Model
- **Per-image** or **per-set** pricing
- Optional speed bonus (early submission deadline)
- Optional quality bonus
- Budget tracking per request

---

## Protection Score System

A gamified 0-100 metric measuring how well-protected a user's face is.

### Scoring (6 components, 100 total):
- Angle Coverage (30 pts) — face front, left, right, up, down
- Expression Coverage (20 pts) — smile, neutral, serious
- Photo Count (15 pts) — more photos = better matching
- Average Quality (20 pts) — brightness/sharpness scores
- Centroid Computed (10 pts) — face embedding anchor exists
- Embedding Rate (5 pts) — % of photos successfully embedded

### Tiers:
Minimal (0-24) → Basic (25-49) → Good (50-69) → Strong (70-84) → Excellent (85-100)

Displayed as a circular progress ring with personalized suggestions for improvement.

---

## Subscription Tiers

| Feature | Free | Protected ($9.99/mo) | Premium ($24.99/mo) |
|---------|------|----------------------|---------------------|
| Scan frequency | Weekly | Daily | Every 6 hours |
| Platforms monitored | 2 | All 247+ | All 247+ |
| Match details | Basic alerts | Full details + evidence | Full details + evidence |
| DMCA takedowns | No | Automated | Automated |
| AI detection | No | Yes | Yes |
| Known accounts | 3 | 10 | 25 |
| Legal consultation | No | No | Yes |
| Multi-person | No | No | Yes |
| API access | No | No | Yes |

---

## Legal Landscape Page (`/legal-landscape`)

Tracks AI likeness rights legislation across all 50 US states and federal level.

- **Interactive US map** color-coded by protection level (none/proposed/enacted)
- **State details** with specific bills, provisions, enforcement
- **Federal bills** tracker
- **Timeline** of legislative developments
- **Glossary** of legal terms
- **Email signup** for legislative update notifications

---

## Integrations

### Veriff (Identity Verification)
- InContext SDK embedded in onboarding step 1
- Webhook at `/api/veriff-webhook` receives KYC decisions
- HMAC-SHA256 signature verification via `x-hmac-signature` header
- Status mapping: approved → green / declined/expired/abandoned → red / resubmission_requested → retry / review → pending

### Instagram (Photo Import)
- OAuth flow for importing existing photos as fallback to camera capture
- `/api/instagram/auth` initiates, `/api/instagram/callback` handles token exchange
- Pulls recent media via Instagram Graph API

### PayPal (Payouts)
- Webhook at `/api/paypal-webhook` handles batch payout status
- Updates earnings records and payout batch status
- Handles individual item statuses (SUCCEEDED, UNCLAIMED, FAILED)

---

## Database Overview

All tables use UUID primary keys with RLS policies restricting users to their own data.

### Core Tables
- `contributors` — User profiles (auth, KYC status, onboarding progress, subscription tier, CID)
- `contributor_attributes` — Demographic profile for marketplace matching
- `contributor_consents` — Immutable consent records with SHA-256 hashes
- `capture_sessions` / `contributor_images` — Guided camera capture tracking
- `uploads` — Legacy photo uploads (Instagram/manual)

### Registry Tables
- `registry_identities`, `registry_consent_events`, `registry_verifications`, `registry_matches`, `registry_contacts`

### Marketplace Tables
- `bounty_requests`, `bounty_submissions`, `submission_images`, `bounty_bookmarks`

### Platform Tables
- `platform_api_keys`, `platform_webhook_endpoints`, `platform_webhook_deliveries`, `platform_usage_events`

### Financial Tables
- `earnings`, `payout_batches`

### Storage Buckets
- `capture-uploads` — Guided camera photos
- `sfw-uploads` — Manual/Instagram uploads
- `bounty-submissions` — Marketplace submission images
- `claim-selfies` — Free claim selfies

---

## Key Architectural Patterns

### Supabase SSR Auth
Three client factories:
- `lib/supabase/client.ts` — Browser client (client components)
- `lib/supabase/server.ts` → `createClient()` — Server client (server components, route handlers)
- `lib/supabase/server.ts` → `createServiceClient()` — Service role (admin ops, webhooks)

Middleware refreshes auth session on every request, protects `/onboarding` and `/dashboard`.

### Zod v4 (Not v3)
Uses `{ message: "..." }` instead of `{ required_error: "..." }`.

### Contributor Row Creation
API routes upsert a `contributors` row on first call since child tables need the foreign key.

### Webhook Dispatch Pattern
`dispatchWebhook()` is fire-and-forget (`.catch()` for error logging). Finds all active endpoints subscribed to the event, creates delivery records, sends with HMAC signature, retries with exponential backoff (up to 5 attempts).

### Registry Consent Chain
Hash-linked events form a tamper-proof audit trail. Current consent derived by replaying events through a state machine. Chain integrity verified by recomputing hashes.

---

## Current Status & Known Limitations

### What's Built and Working
- Full landing page with 9 sections
- Auth (signup/login) with Supabase
- Complete 5-step onboarding flow
- Dashboard with protection score, matches, contributions, account, privacy, help
- Consented Identity Registry (5 tables, service layer, consent chain, CID generation)
- Platform API (contributor endpoints, registry endpoints, consent oracle, bulk operations, stats)
- Webhook system with HMAC signatures and retry logic
- Free claim flow at `/claim`
- Legal landscape page with interactive map
- Developer docs page at `/developers`
- Marketplace/bounty database schema and admin routes

### Not Yet Implemented
- **Payments** — Subscription billing not connected (MVP focuses on data collection)
- **Actual scanning** — Scanner admin panel exists but automated crawling not deployed
- **Face embedding pipeline** — Schema supports embeddings but pipeline not connected
- **Instagram API in production** — Needs Meta app review for Basic Display product
- **Instagram token encryption** — Stored unencrypted
- **Veriff in production** — Dev bypass used; needs live credentials
- **Public marketplace browsing** — Admin-only currently
- **Payout execution** — PayPal webhook handler exists but batch initiation not implemented
