# Diva Vault

A platform for influencers and creators to monetize their likeness through ethical AI training. Contributors upload photos (via Instagram or manual upload), complete identity verification, and earn from their data. Powered by [vixxxen.ai](https://vixxxen.ai).

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS v4 + Shadcn/UI (new-york style)
- **Auth + DB + Storage:** Supabase (`@supabase/ssr` for SSR pattern)
- **Forms:** React Hook Form + Zod v4 + `@hookform/resolvers`
- **State:** Zustand with `persist` middleware (localStorage)
- **Deployment:** Render (via `render.yaml`)

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
│   ├── page.tsx                    # Landing page (assembles 7 sections)
│   ├── layout.tsx                  # Root layout (dark theme, Inter + Space Grotesk fonts)
│   ├── globals.css                 # Tailwind v4 theme + neon glow effects
│   ├── (auth)/login/page.tsx       # Login form (client component)
│   ├── (auth)/signup/page.tsx      # Signup form (client component)
│   ├── onboarding/
│   │   ├── layout.tsx              # Onboarding shell with header
│   │   └── page.tsx                # Multi-step form container (client)
│   ├── dashboard/page.tsx          # Post-onboarding (server component)
│   └── api/
│       ├── auth/signout/route.ts   # Sign out handler
│       ├── sumsub-webhook/route.ts # Sumsub KYC webhook (signature-verified)
│       └── instagram/
│           ├── auth/route.ts       # Instagram OAuth redirect
│           └── callback/route.ts   # Instagram OAuth callback + media fetch
├── components/
│   ├── ui/                         # Shadcn/UI components (11 total)
│   ├── landing/                    # Landing page sections (hero, value-props, etc.)
│   └── onboarding/                 # Step components (track-selection, identity-verification, etc.)
├── lib/
│   ├── supabase/client.ts          # Browser Supabase client
│   ├── supabase/server.ts          # Server Supabase client + service role client
│   ├── supabase/middleware.ts      # Auth session refresh middleware
│   ├── instagram.ts                # Instagram API helpers
│   ├── sumsub.ts                   # Sumsub webhook verification + status mapping
│   ├── validators.ts               # Zod v4 schemas (signup, login, track, consent)
│   └── utils.ts                    # Shadcn cn() utility
├── stores/onboarding-store.ts      # Zustand store (persisted to localStorage)
└── types/index.ts                  # Contributor + Upload TypeScript interfaces
```

## Important Patterns

### Always-Dark Theme
The app is permanently dark-mode. `<html>` has `className="dark"`. There is no light mode toggle. The color scheme uses oklch neon pink/purple (`oklch(0.75 0.18 330)`) as the primary/accent color.

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

### Onboarding Flow
4-step multi-step form managed by Zustand store:
1. **Track Selection** — SFW (Lifestyle) or NSFW (Premium)
2. **Identity Verification** — Sumsub KYC (currently mocked for dev)
3. **Data Contribution** — Instagram OAuth import OR manual drag-and-drop upload (min 25 photos)
4. **Consent & Legal** — Explicit agreement for AI training + likeness rights

State persists to localStorage so users can resume. On completion, contributor + upload records are saved to Supabase and user is redirected to `/dashboard`.

### Supabase Storage Buckets
Two private buckets needed (create manually in Supabase dashboard):
- `sfw-uploads` — Lifestyle track photos
- `nsfw-uploads` — Premium track photos

Files stored under `{bucket}/{user_id}/` paths.

## Environment Variables

Required in `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (server-only)
SUMSUB_APP_TOKEN=                # Sumsub API token
SUMSUB_SECRET_KEY=               # Sumsub API secret
SUMSUB_WEBHOOK_SECRET=           # Sumsub webhook signing secret
INSTAGRAM_CLIENT_ID=             # Meta/Instagram app client ID
INSTAGRAM_CLIENT_SECRET=         # Meta/Instagram app client secret
INSTAGRAM_REDIRECT_URI=          # Must match Meta app config
```

## Database

Schema is in `supabase/schema.sql`. Two tables with RLS:
- `contributors` — User profile, track type, KYC status, consent, photo count
- `uploads` — Individual photo records (source, file path, bucket)

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

### Storage Buckets

Two private buckets exist:
- `sfw-uploads` — Lifestyle track photos
- `nsfw-uploads` — Premium track photos

## Known MVP Limitations

- **Identity verification is mocked** — `identity-verification.tsx` auto-approves after 2s timeout. Must integrate real Sumsub Web SDK for production.
- **Payments not implemented** — MVP focuses on signup + data collection only.
- **Instagram API requires Meta app review** — For production, the Meta app needs Basic Display product review. Dev uses test users.
- **Instagram tokens stored unencrypted** — Should add encryption for production.
