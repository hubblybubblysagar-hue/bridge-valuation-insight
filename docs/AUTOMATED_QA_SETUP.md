# ExitBridge Automated QA Setup

This project has four independent test layers. None of them touch a real
seller's data, and none of them write to Intuit.

| Layer | Location | Runner | What it proves |
| --- | --- | --- | --- |
| Database | `supabase/tests/database/*.sql` | pgTAP via `supabase test db` | Bridge-function permissions, one-time OAuth state consumption, RLS exposure |
| Edge Functions | `supabase/functions/tests/*.ts` | `deno test` | OAuth URL construction, token expiry math, refresh rotation, GET-only rule, CORS allow-list, safe error codes |
| Browser | `tests/e2e/**` | Playwright | Real vs. sample data separation, demo-route isolation, buyer/seller access boundaries |
| Scheduled smoke | `.github/workflows/quickbooks-smoke.yml` | GitHub Actions (daily) | The sandbox connection is still alive and refreshable |

## Running locally

```bash
bun run test:functions        # Deno unit tests (no network)
bun run test:e2e              # Playwright, boots the dev server automatically
supabase test db              # pgTAP, requires a local Supabase stack
bunx tsgo --noEmit            # typecheck
```

Playwright options:

- `QA_BASE_URL` — test an already-running app instead of booting `bun run dev`.
- `PW_CHANNEL=chromium` — use the full Chromium build when the headless-shell
  system libraries are unavailable.
- `bunx playwright test --project=public` — the only project that needs no
  credentials.

## QA accounts

The `seller` and `buyer` Playwright projects **skip themselves** unless these
are set. They must point at dedicated synthetic accounts, never a real user:

| Variable | Purpose |
| --- | --- |
| `QA_SELLER_EMAIL` / `QA_SELLER_PASSWORD` | Synthetic seller with an Intuit *sandbox* company |
| `QA_BUYER_EMAIL` / `QA_BUYER_PASSWORD` | Synthetic buyer used for access-boundary checks |

Add them as GitHub repository secrets to enable the authenticated jobs in CI.

## Smoke-test secrets

`quickbooks-smoke.yml` needs `SUPABASE_URL` and `QA_STATUS_TOKEN` (a Supabase
access token for the QA seller). It calls only `qa-quickbooks-status`, which
returns aggregate booleans and counts. The workflow additionally fails if the
response body ever contains `access_token`, `refresh_token`, or `realm_id`.

## Safety rules for new tests

1. Never hard-code Intuit credentials, realm ids, tokens, or a real seller's
   email in a test file.
2. Unit tests stub `globalThis.fetch`; they must not reach `intuit.com`.
3. Browser tests must assert on `data-testid` hooks (`qb-connect-button`,
   `qb-sample-button`, `qb-connected-state`, `qb-disconnected-state`,
   `qb-callback-error`) rather than on copy that changes with design work.
4. Any new `/demo/*` route must stay covered by the "demo routes never invoke a
   quickbooks-* Edge Function" test.

## Interpreting a red build

| Failing job | Most likely cause |
| --- | --- |
| `edge-function-tests` | A change to `_shared/quickbooks.ts` altered an error code, the scope, or introduced a non-GET Data API call |
| `database-tests` | A migration widened access to a `service_qb_*` bridge or a `quickbooks_*` table |
| `browser-tests` (public) | A demo route started calling a real Edge Function, or a `data-testid` was renamed |
| `browser-tests` (seller) | The sample-data path leaked into the real-connection UI, or Connect wrote financials |
| `quickbooks-smoke` | The sandbox refresh token expired (Intuit rotates every 100 days) — reconnect the QA seller |
