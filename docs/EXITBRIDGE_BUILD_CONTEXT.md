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
