# Extraction Hardening: Deterministic QuickBooks Truth Layer

Confirmed root causes (verified against the live database, sync run `26cc10ef…`):

1. **Parser key-casing bug** — QBO nests rows as `Header` / `Rows` / `Summary` (capitalized); `qb-report.ts` checks lowercase `header`. All 10 snapshots stored with `row_count = 0`; viewer and CSV render blank. Raw payloads are complete and reconcile (Assets = L+E = $23,436.29).
2. **Date display bug** — stored periods are correct `YYYY-MM-DD`, but viewers format via `new Date("2025-12-31")` (UTC midnight → previous day in US timezones). Pure rendering defect.
3. **Silent insert failures** — 6 requests (cash_flow ×2, trial_balance, aged_receivables, aged_payables, account_list) fetched OK but the snapshot insert failed; the engine discards the PostgREST error detail, so we can't yet see why (likely payload-size or invalid character).
4. **No request manifest** — sync run stores only aggregate counts, hence "10 synced · 6 failed" with no per-request visibility.

No AI anywhere in this layer — all deterministic code.

## 1. Rebuild the report parser (`src/lib/qb-report.ts`)

- Handle QBO's real shape: rows keyed `Header`/`Rows`/`Summary`/`ColData`, `type: "Section"|"Data"`, `group` — keep lowercase variants as fallback.
- Parse recursively into a flat row model per the agreed schema: `sequence, depth, row_type (section|data|summary), section_path ("ASSETS > Current Assets > Bank Accounts"), group, account_id, label, column_key, value_text, value_numeric`.
- One parser powers viewer, CSV, normalization, reconciliation.
- Store the parsed rows into `normalized_payload` at sync time (parse-once, read-many) instead of header-meta-only.

## 2. Regression fixture + unit tests

- Extract the real Balance Sheet JSON from the stored snapshot into a test fixture (and one P&L).
- Deno/vitest assertions fail the build unless the parser proves: Checking 1,201.00 · Savings 800.00 · A/R 5,281.52 · Total Current Assets 9,941.29 · Total Assets 23,436.29 · A/P 1,602.67 · Total Liabilities 31,131.33 · Total Equity −7,695.04 · L+E 23,436.29.

## 3. Date-only handling everywhere

- Add shared date-only helpers (parse/format `YYYY-MM-DD` with no timezone math).
- Fix `fmtDate`/`fmtDateTime` in the report viewer and vault index cards (Dec 30 → Dec 31).
- Fiscal windows stay explicit strings (already correct in `qb-report-plan.ts`).

## 4. Sync engine observability (`qb-sync.server.ts` + migration)

- Migration: add `results jsonb NOT NULL DEFAULT '[]'` to `quickbooks_sync_runs` — per-request manifest: report_type, label, requested path (no tokens), period, http_status, intuit fault code, internal safe code, snapshot_id, row_count.
- Capture sanitized PostgREST insert errors (code + message class, never payload/token) into the manifest so the 6 failures become diagnosable in the UI and logs.
- Guard against likely insert-failure causes: strip `\u0000`/invalid control chars from payloads before insert.

## 5. Snapshot state machine

Replace bare `synced` with lifecycle states written at sync time:
`retrieved → parsed → validated → ready`, plus `parse_failed` / `empty_source` / `api_failed`.
A 200 OK with zero parsed rows is no longer "synced".

## 6. Deterministic validation engine (`src/lib/qb-validate.ts`)

- Balance Sheet: Total Assets = Total Liabilities + Equity (±$0.01).
- Trial Balance: total debits = total credits.
- AR/AP aging totals vs Balance Sheet A/R, A/P (as-of dates match).
- P&L: Income − COGS − Expenses = Net Income.
- Result stored per snapshot (`validation` jsonb: checks, expected, actual, pass/fail) and surfaced in the provenance header as **Source integrity: Verified / Needs review** — never silently "success".

## 7. Vault + viewer updates

- Viewer/CSV render the parsed rows (indented section hierarchy, account ids available).
- Vault cards show real parsed row counts and validation state; CompanyInfo card labelled so the count math is explainable.
- Sync results panel lists the per-request manifest including failures with safe error codes.

## 8. History-aware request planning

- Read `CompanyStartDate` from the CompanyInfo snapshot; don't request fiscal years that start before it (still allow older data when the company genuinely has history — skip only when clearly meaningless).

## Out of scope (deliberately)

No invoices/customers/vendors/GL ingestion, no CDC, no AI analysis — horizontal expansion only after this milestone passes.

## Technical notes

- Files: `src/lib/qb-report.ts` (rewrite core), new `src/lib/qb-validate.ts`, `src/lib/qb-sync.server.ts` (manifest + parse-at-sync + sanitized errors), `src/routes/seller.financial-vault.*.tsx`, `src/lib/quickbooks.ts`, one migration (`quickbooks_sync_runs.results`), tests under `supabase/functions/tests/` and `tests/e2e/seller/`.
- No tokens, auth codes, or secrets in any manifest, log, or error path — masked realm + safe codes only.
- Existing snapshots can be re-parsed in place from `raw_payload` (parser is pure); no re-sync required to fix display.
