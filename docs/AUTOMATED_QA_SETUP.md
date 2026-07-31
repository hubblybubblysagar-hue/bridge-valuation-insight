# ExitBridge Automated QA Setup

This project has four independent test layers. None of them touch a real
seller's data, and none of them write to Intuit.

| Layer | Location | Runner | What it proves |
| --- | --- | --- | --- |
| Database | `supabase/tests/database/*.sql` | pgTAP via `supabase test db` | Bridge-function permissions, one-time OAuth state consumption, RLS exposure |
| Edge Functions | `supabase/functions/tests/*.ts` | `deno test` | OAuth URL construction, token expiry math, refresh rotation, GET-only rule, CORS allow-list, safe error codes |
| Browser | `tests/e2e/**` | Playwright | Real vs. sample data separation, demo-route isolation, buyer/seller access boundaries |
| Scheduled smoke | `.github/workflows/quickbooks-smoke.yml` | GitHub Actions (daily) | The sandbox connection is still alive and refreshable |

## Workflows

| Workflow | File | Triggers |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | push to `main`, pull_request, `workflow_dispatch` |
| QuickBooks sandbox smoke | `.github/workflows/quickbooks-smoke.yml` | daily cron `0 11 * * *`, `workflow_dispatch` |
| QA report (GitHub Pages) | `.github/workflows/qa-pages.yml` | push to `main`, `workflow_dispatch` |

All three include `workflow_dispatch`, so each appears in the Actions tab with
a **Run workflow** button once the files are on `main`.

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

## GitHub secrets by workflow

| Secret | `ci.yml` | `quickbooks-smoke.yml` | `qa-pages.yml` |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | — | yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | — | yes |
| `VITE_SUPABASE_PROJECT_ID` | yes | — | yes |
| `QA_BASE_URL` | yes | — | optional |
| `QA_SELLER_EMAIL` | yes | yes | optional |
| `QA_SELLER_PASSWORD` | yes | yes | optional |
| `QA_BUYER_EMAIL` | yes | — | optional |
| `QA_BUYER_PASSWORD` | yes | — | optional |
| `SUPABASE_URL` | — | yes | — |
| `SUPABASE_ANON_KEY` | — | yes | — |

`QA_STATUS_TOKEN` **was removed** — a stored Supabase user access token expires
within the hour and is never a valid permanent secret for a scheduled job.

Intuit's client id and client secret live **only** in Supabase Edge Function
secrets (`INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`). They must never be added
to GitHub.

## QA accounts

The `seller` and `buyer` Playwright projects **skip themselves** unless these
are set. They must point at dedicated synthetic accounts, never a real user:

| Variable | Purpose |
| --- | --- |
| `QA_SELLER_EMAIL` / `QA_SELLER_PASSWORD` | Synthetic seller with an Intuit *sandbox* company |
| `QA_BUYER_EMAIL` / `QA_BUYER_PASSWORD` | Synthetic buyer used for access-boundary checks |

## Smoke-test login process

`quickbooks-smoke.yml` mints a short-lived session at runtime:

1. `POST $SUPABASE_URL/auth/v1/token?grant_type=password` with
   `apikey: $SUPABASE_ANON_KEY`, `Content-Type: application/json`, and the QA
   seller email/password in the JSON body.
2. `jq -r '.access_token'` extracts the temporary token. It is never echoed,
   printed, uploaded, or written to disk.
3. `POST $SUPABASE_URL/functions/v1/qa-quickbooks-status` with
   `Authorization: Bearer <token>`, `apikey`, and `Content-Type`.
4. The shell variable is `unset` immediately after the request.

Assertions run against the real flat response schema:
`.connectionExists == true`, `.connectionStatus == "connected"`,
`.tokenSecretPresent == true`, `.companyInfoRetrieved == true`,
`.companyInfoSnapshotCount >= 1`. A missing connection fails with
`manual_oauth_authorization_required`. Only a sanitized summary
(`connectionStatus`, `tokenSecretPresent`, `companyInfoRetrieved`,
`companyInfoSnapshotCount`, `safeLastErrorCode`, `migrationVersion`) is
printed, and the job fails if the payload ever contains `access_token`,
`refresh_token`, `realm_id`, `token_secret_id`, `company_name`, `seller_id`,
`user_id`, or `business_id`.

## GitHub Pages QA report

Setup steps (one time):

1. Merge `qa-pages.yml` to `main`.
2. Repository **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. Approve the `github-pages` environment if the repo requires it.
4. Run **QA report (GitHub Pages)** from the Actions tab; the deploy job
   prints the published URL.

Safety model — the published site (`index.html` + `qa-summary.json`) contains
only: commit SHA, workflow timestamp, typecheck / lint / build / Edge Function
/ database / public browser / authenticated browser / QuickBooks smoke status
(`pass`, `fail`, `skipped`, or `not-run`), total test count, failed test count,
and a safe error code. Suites whose secrets are unset are reported as
`skipped`, never `pass`.

It never contains emails, user/business/connection ids, company names, realm
ids, financial values, access or refresh tokens, client secrets, Supabase keys,
authenticated screenshots, or raw logs. Playwright HTML reports, JUnit and JSON
output, failure screenshots, and traces remain **private Actions artifacts**.

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
| `quickbooks-smoke` | The sandbox refresh token expired (Intuit rotates every 100 days) — reconnect the QA seller, or the QA seller sign-in failed |
