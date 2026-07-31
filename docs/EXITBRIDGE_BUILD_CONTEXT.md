# ExitBridge — Build Context

Living source of truth for future coding agents working on ExitBridge.
Read this file **before** making changes, and update it **after** every
material change. Never place secrets, API keys, or real customer data
in this file.

---

## 1. Product Vision

ExitBridge is an AI-powered, **seller-first** platform for small business
owners exploring a sale. The MVP loop:

Connect QuickBooks (or use mock QuickBooks data) → generate preliminary
valuation → create anonymous teaser → privately test buyer interest →
buyer can request NDA access.

It is **not** a generic marketplace. The seller experience is the
primary product; buyer surfaces exist to validate demand and gate
disclosure.

## 2. Current MVP Scope

**Built:**

- Public landing page
- Seller signup/login (Supabase Auth)
- Mock QuickBooks "connection" step
- Business basics form (persisted)
- Financial review (persisted)
- Risk questions (persisted)
- Preliminary valuation generation + persistence
- Anonymous teaser generation + persistence
- Seller-side buyer-interest approval flow
- Buyer signup + acquisition-criteria profile
- Buyer feed of approved anonymous teasers
- NDA request submission (persisted)
- Demo (`/demo/*`) and QA (`/qa`, `/qa-static`, `/qa-backend`) routes
- `/debug/state` mock-only diagnostic view
- Supabase-backed persistence with per-user RLS

**Intentionally not built yet:**

- Real QuickBooks OAuth (Intuit)
- Real AI financial extraction from statements
- Stripe payment (Snapshot checkout)
- Full CIM generation
- Real buyer matching algorithm
- Real email notifications
- DocuSign / HelloSign
- Server-side PDF generation (teaser export is client-side)
- Admin/founder review dashboard

## 3. Tech Stack

- Frontend: React 19, TanStack Start (Vite 7), TypeScript strict
- Routing: TanStack Router (file-based, `src/routes/`)
- Styling: Tailwind CSS v4 via `src/styles.css`, shadcn/ui components
- Backend: Supabase (Postgres + Auth + Storage)
- Client: `@/integrations/supabase/client` (publishable key + session)
- Auth: Supabase email/password; `profiles` row created on signup
- Deployment target: Cloudflare Worker edge runtime
- Notable libs: `@tanstack/react-query`, `sonner`, `zod`

## 4. Supabase Schema

All tables live in `public`. RLS is **enabled** on every table.

| Table | Purpose | Access |
| --- | --- | --- |
| `profiles` | 1:1 with `auth.users`; stores email, role (seller/buyer), full_name | Owner-only read/insert/update |
| `businesses` | Seller-owned business record (name, industry, region, status) | Seller-only via `seller_id = auth.uid()` |
| `seller_financials` | Revenue/SDE inputs and QB source metadata | Business owner only |
| `risk_answers` | Structured risk questionnaire responses (unique per business) | Business owner only |
| `valuations` | Computed valuation range + drivers/concerns (unique per business) | Business owner only |
| `teasers` | Anonymous teaser snapshot + `approved_for_outreach` flag (unique per business) | Owner full access; any authenticated user may SELECT rows where `approved_for_outreach = true` |
| `buyer_profiles` | Buyer acquisition criteria (unique per buyer) | Buyer-only |
| `buyer_interest_tests` | Seller's private buyer-interest test record (unique per business) | Seller-only |
| `nda_requests` | Buyer request against a teaser (unique per buyer+teaser) | Buyer reads/inserts own; business owner reads/updates for own business |
| `file_uploads` | Metadata for financial + teaser uploads | Business owner only |

Storage buckets (private):

- `financial-uploads` — seller-uploaded P&L / balance sheet files
- `teaser-pdfs` — generated teaser artifacts

## 5. RLS / Security Model

Plain-English rules (mirrored by policies in
`supabase/migrations/*`):

- A user can read/update only their own `profiles` row.
- Sellers can manage only their own `businesses` and all child rows
  (`seller_financials`, `risk_answers`, `valuations`, `teasers`,
  `file_uploads`, `buyer_interest_tests`) via the
  `owns_business(business_id)` security-definer helper.
- Buyers **cannot** read seller financials, risk answers, valuations,
  or file uploads.
- Any authenticated user may read teasers where
  `approved_for_outreach = true`. Unapproved teasers are only visible
  to the owning seller.
- Buyers may insert NDA requests scoped to their own `auth.uid()`;
  they can read their own submissions. Sellers can read + update
  NDA requests only for businesses they own.
- Demo/QA routes never write to Supabase; `/debug/state` renders only
  the local mock store.

Known limitations to revisit:

- No admin role yet — founder review will need a `has_role` helper +
  `user_roles` table (see `user-roles` knowledge) before shipping.
- Approved teasers currently visible to `authenticated`; if buyers
  should be gated behind an `approved` buyer profile, add a policy
  join through `buyer_profiles`.

## 6. Route Map

Public:
- `/`, `/signup`, `/login`, `/buyer-signup`, `/sample-teaser`

Seller (requires signed-in seller session):
- `/seller`, `/seller/connect`, `/seller/business`,
  `/seller/financial-review`, `/seller/risk`, `/seller/valuation`,
  `/seller/teaser`, `/seller/buyer-interest`, `/seller/account`

Buyer (requires signed-in buyer session):
- `/buyer`, `/buyer/ndas`, `/buyer/account`

QA / Demo (mock-only unless noted):
- `/qa`, `/qa-static`, `/debug/state` — mock
- `/qa-backend` — **real Supabase**; requires signed-in user
- `/demo/seller/*`, `/demo/buyer/*` — mock

## 7. Important Files

- `src/lib/store.ts` — in-memory + localStorage app state, auth helpers,
  demo seed data
- `src/lib/persist.ts` — write-through helpers for every Supabase table
- `src/lib/valuation.ts` — SDE + valuation math, industry multiples
- `src/lib/teaser-snapshot.ts` — teaser copy generator
- `src/integrations/supabase/client.ts` — browser Supabase client
- `src/integrations/supabase/types.ts` — generated schema types (do not edit)
- `src/routes/__root.tsx` — root layout + session hydration
- `src/routes/seller.*.tsx` — seller flow pages
- `src/routes/buyer.*.tsx`, `src/routes/buyer-signup.tsx` — buyer flow
- `src/routes/qa-backend.tsx` — protected QA console (real DB)
- `src/routes/debug.state.tsx` — mock-only diagnostic view
- `src/components/SellerLayout.tsx`, `BuyerLayout.tsx` — shells
- `supabase/migrations/*.sql` — schema, RLS, unique constraints

## 8. Current Data Flow

Real seller flow:

1. Seller signs up via Supabase Auth (`signUp` in `store.ts`).
2. A `profiles` row is created for `auth.uid()`.
3. `hydrateSellerWorkspace` runs on session hydration and load the
   most recent business + child records.
4. `/seller/connect` calls `persistFinancials(..., "quickbooks_mock")`.
5. `/seller/business` calls `persistBusiness`.
6. `/seller/financial-review` calls `persistFinancials`.
7. `/seller/risk` calls `persistRisk` (upsert on `business_id`).
8. `/seller/valuation` computes valuation and calls `persistValuation`
   (upsert on `business_id`).
9. `/seller/teaser` calls `persistTeaser` (upsert on `business_id`).
10. `/seller/buyer-interest` calls `approveBuyerInterestTest`, which
    flips `teasers.approved_for_outreach` and upserts a
    `buyer_interest_tests` row.
11. Teaser becomes visible to authenticated buyers.
12. Buyer submits `nda_requests` row via `submitNdaRequest` (upsert on
    `(buyer_id, teaser_id)`).
13. Seller sees the request on `/seller/buyer-interest`.

Demo/QA flow: `seedDemoStage()` writes only to the in-memory store; no
Supabase calls. Must stay this way.

## 9. Known Issues / Risks

- Real QuickBooks OAuth is not implemented; `/seller/connect` uses mock data.
- Teaser PDF export is client-side only.
- Supabase email confirmation may block instant sign-in in dev. The
  login screen surfaces the returned error verbatim; a friendlier
  post-signup "check your email" state is still TODO.
- Buyer matching is placeholder copy.
- No AI extraction; financial numbers come from mock data or manual entry.
- No Stripe; monetization is UX-only for now.
- RLS should be re-audited before any real financial data is ingested.
- Avoid storing real customer financials until at least one adversarial
  security review has been done.

## 10. Decision Log

| Date | Decision | Reason | Affected |
| --- | --- | --- | --- |
| 2026-07-13 | Seller-first strategy | Owner-friendly onboarding is the wedge; buyer marketplace comes later | Product scope |
| 2026-07-13 | QuickBooks-first ingestion | Highest signal for SMB SDE; unblocks preliminary valuation | `/seller/connect`, `seller_financials` |
| 2026-07-13 | Supabase as backend | Postgres + Auth + Storage + RLS in one place | Entire backend |
| 2026-07-14 | Demo/QA routes stay mock-only | Keeps public review paths safe and offline | `/demo/*`, `/qa*`, `/debug/state` |
| 2026-07-14 | Initial schema + RLS | 10-table product schema, per-user RLS via `owns_business` | `supabase/migrations/*` |
| 2026-07-14 | Backend QA + hardening pass | Add uniqueness, upserts, and `/qa-backend` before adding OAuth/Stripe | `src/lib/persist.ts`, `src/routes/qa-backend.tsx` |

## 11. Change Log

- **2026-08-01 — Phase C: QuickBooks repair + automated QA infrastructure**
  - **Root cause fixed:** the edge functions called Vault/state helpers that
    exist only in the `private` schema, but PostgREST resolves RPCs in
    `public`, so every Vault call failed and the callback always redirected
    with `quickbooks=error`. Migration
    `supabase/migrations/20260731_qb_service_bridges.sql` adds five
    `public.service_qb_*` SECURITY DEFINER bridges (create/update/get/delete
    token secret, consume oauth state), executable by `service_role` only.
  - `_shared/quickbooks.ts`: CORS allow-list (no wildcard), stable machine
    error codes (`QB_ERROR.*`), correlation ids in every log line, and the
    GET-only Data API rule enforced by having no write helper at all.
  - New edge function `qa-quickbooks-status` returns aggregate booleans and
    counts only — never realm ids or tokens.
  - `src/routes/seller.connect.tsx` rewritten: `loadConnectionSummary()` is
    the single source of truth, sample data is explicitly labelled and never
    creates a connection, and callback success is only shown after the
    CompanyInfo snapshot is verified. Test hooks: `qb-connect-button`,
    `qb-sample-button`, `qb-connected-state`, `qb-disconnected-state`,
    `qb-callback-error`.
  - **Automated testing** (see `docs/AUTOMATED_QA_SETUP.md`):
    - pgTAP — `supabase/tests/database/quickbooks_bridges_test.sql`,
      `quickbooks_rls_test.sql`.
    - Deno — `supabase/functions/tests/quickbooks_shared_test.ts` (17 tests,
      `fetch` stubbed; no network).
    - Playwright — `tests/e2e/{public,seller,buyer}`; `public` needs no
      credentials, `seller`/`buyer` self-skip without QA account secrets.
    - CI — `.github/workflows/ci.yml` (typecheck, lint, build, Deno, pgTAP,
      Playwright) and `.github/workflows/quickbooks-smoke.yml` (daily
      read-only sandbox connectivity check).
  - New env/secrets for CI only: `QA_BASE_URL`, `QA_SELLER_EMAIL`,
    `QA_SELLER_PASSWORD`, `QA_BUYER_EMAIL`, `QA_BUYER_PASSWORD`.

- **2026-07-31 — Phase C.1: CI automation repair**
  - **`QA_STATUS_TOKEN` removed everywhere.** A stored Supabase *user* access
    token expires within an hour and is not a valid permanent secret for a
    scheduled workflow. `quickbooks-smoke.yml` now signs in at runtime:
    `POST $SUPABASE_URL/auth/v1/token?grant_type=password` with the `apikey`
    header and the QA seller credentials, reads `access_token` with `jq`,
    calls `qa-quickbooks-status` with `Authorization: Bearer <token>` +
    `apikey`, then unsets the variable. The token is never echoed, uploaded,
    or persisted.
  - Smoke assertions now match the real flat response schema
    (`connectionExists`, `connectionStatus`, `tokenSecretPresent`,
    `companyInfoRetrieved`, `companyInfoSnapshotCount`). The old
    `.ok` / `.connection.*` / `.snapshots.*` checks were invalid and removed.
    Missing connection fails with `manual_oauth_authorization_required`.
    Only a sanitized six-field summary is printed; the run fails if the
    response contains `access_token`, `refresh_token`, `realm_id`,
    `token_secret_id`, `company_name`, `seller_id`, `user_id`, or
    `business_id`.
  - Exact GitHub secrets — `ci.yml`: `VITE_SUPABASE_URL`,
    `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`,
    `QA_BASE_URL`, `QA_SELLER_EMAIL`, `QA_SELLER_PASSWORD`,
    `QA_BUYER_EMAIL`, `QA_BUYER_PASSWORD`. `quickbooks-smoke.yml`:
    `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `QA_SELLER_EMAIL`,
    `QA_SELLER_PASSWORD`. Intuit client id/secret stay only in Supabase Edge
    Function secrets and are never added to GitHub.
  - New `.github/workflows/qa-pages.yml` publishes a **sanitized** public QA
    report (`index.html` + `qa-summary.json`) via `actions/configure-pages`,
    `actions/upload-pages-artifact`, `actions/deploy-pages` with
    `contents: read`, `pages: write`, `id-token: write` and the
    `github-pages` environment. It contains pass/fail/skipped statuses,
    commit SHA, timestamp, test counts, and a safe error code only —
    no emails, ids, company names, financial values, keys, screenshots, or
    raw logs. Unconfigured authenticated suites report `skipped`, never
    `pass`. Playwright HTML/JUnit/JSON reports, screenshots, and traces stay
    private Actions artifacts.
  - All three workflows (`ci.yml`, `quickbooks-smoke.yml`, `qa-pages.yml`)
    include `workflow_dispatch` so they appear and can be run manually from
    the Actions tab.




- **2026-07-21 — Phase B: real QuickBooks OAuth (sandbox)**
  - Deployed 4 edge functions: `quickbooks-auth-start` (JWT on),
    `quickbooks-auth-callback` (JWT off — Intuit redirect target),
    `quickbooks-company-info` (JWT on), `quickbooks-disconnect` (JWT on).
  - Tokens are stored encrypted in Supabase Vault via `private.*`
    SECURITY DEFINER helpers; `quickbooks_connections` holds only the
    Vault secret id + safe metadata (realm_id, company_name, status,
    expires_at, last_error). OAuth `state` is stored as a hash in
    `quickbooks_oauth_states` and consumed atomically.
  - Frontend: `src/lib/quickbooks.ts` invokes the edge functions;
    `src/routes/seller.connect.tsx` handles real OAuth (start / verify /
    disconnect) and shows masked realm + company name once connected.
  - `/qa-backend` now has a "QuickBooks connection QA" panel for
    sellers: connection status, masked realm, snapshot count, and
    buttons to start OAuth, verify CompanyInfo (triggers refresh if
    needed), and disconnect. Tokens are never rendered.
  - Env: `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`,
    `INTUIT_REDIRECT_URI`, `INTUIT_ENVIRONMENT=sandbox`,
    `EXITBRIDGE_APP_URL`, `QUICKBOOKS_MINOR_VERSION=75` set in Supabase.
  - Demo/QA isolation preserved: `/demo/*` and the `exitbridge.demo`
    accounts never call Intuit.
  - Follow-ups: P&L / Balance Sheet ingestion + normalization into
    `seller_financials`; scheduled refresh job; admin/founder review.
- **2026-07-18 — Phase A hardening + QuickBooks schema scaffolding**

  - Added DB trigger `public.handle_new_auth_user()` on `auth.users` that
    creates the `profiles` row from signup metadata. Removed the client-side
    profile insert in `signUp()` (was RLS-blocked when email confirmation
    delayed the session). Backfilled missing profiles for existing users.
  - Teaser transition sentence now uses natural, reason-conditional
    language (`src/lib/teaser-snapshot.ts`).
  - Buyer feed (`src/routes/buyer.index.tsx`) no longer falls back to mock
    deals for real buyers; renders an empty state instead. Demo user still
    sees `FALLBACK_DEALS`.
  - New QuickBooks tables (metadata only — no OAuth tokens stored yet):
    `quickbooks_connections` (seller-readable), `quickbooks_oauth_states`
    (server-only, no anon/authenticated grants), and
    `quickbooks_report_snapshots` (owner-readable via `owns_business`).
  - Follow-ups (Phase B, pending Intuit sandbox credentials): edge functions
    `quickbooks-auth-start`, `quickbooks-auth-callback`,
    `quickbooks-sync-reports`; token storage via Supabase Vault; wire
    `/seller/connect` to real Intuit sandbox OAuth.

- **2026-07-14 — Backend QA + hardening pass**
  - Added unique constraints: `buyer_profiles.buyer_id`,
    `risk_answers.business_id`, `valuations.business_id`,
    `teasers.business_id`, `buyer_interest_tests.business_id`,
    and `(buyer_id, teaser_id)` on `nda_requests`.
  - Converted `persistRisk`, `persistValuation`, `persistTeaser`,
    `persistBuyerProfile`, `approveBuyerInterestTest`, and
    `submitNdaRequest` to Supabase `upsert(..., { onConflict })`.
  - Added protected `/qa-backend` page that exercises the real
    persistence helpers as the current authenticated user and
    surfaces auth id, profile row, and RLS-visible counts.
  - Added this document.
  - Files: `src/lib/persist.ts`, `src/routes/qa-backend.tsx`,
    `docs/EXITBRIDGE_BUILD_CONTEXT.md`.
  - Migration: uniqueness constraints migration (2026-07-14).
  - Follow-ups: friendlier post-signup email-confirmation UX;
    admin role/table; consider gating approved-teaser reads on an
    approved buyer profile.

## 12. Next Build Priorities

1. Backend QA + RLS hardening (this pass) ✅
2. End-to-end Supabase persistence testing via `/qa-backend`
3. Real QuickBooks OAuth (Intuit)
4. QuickBooks P&L / Balance Sheet ingestion + normalization
5. Stripe $499 Snapshot checkout
6. Email notifications (signup, NDA request, approval)
7. Server-side teaser PDF export
8. AI-assisted valuation explanation and teaser copy
9. Admin/founder review dashboard (role table + policies)
10. Real buyer matching logic

## 13. Instructions for Future Agents

**Before making changes:**

- Read this file first.
- Re-read `src/integrations/supabase/types.ts` and current migrations
  before touching persistence.
- Preserve the seller-first product strategy.
- Preserve the QuickBooks-first onboarding flow.
- Keep `/demo/*`, `/qa`, `/qa-static`, `/debug/state`, and
  `/sample-teaser` mock-only. `/qa-backend` is the only QA surface
  allowed to hit real Supabase.
- Never expose seller financials, risk answers, valuations, or file
  uploads to buyers.
- Never fabricate precision (e.g. "$1,873,214 exact valuation").
- Do not add major new features unless explicitly asked.

**After making changes:**

- Update this document (Change Log, Known Issues, Next Priorities).
- Note any new migrations or env vars.
- Note any security implications and re-run RLS review if policies changed.
- Confirm build/typecheck passed.

**Never include** in this file: `SUPABASE_SERVICE_ROLE_KEY`, Intuit
client secrets, Stripe secrets, OpenAI/Lovable API keys, or any real
customer financials.
