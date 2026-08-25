# Extraction Hardening: Deterministic QuickBooks Truth Layer

Confirmed root causes (verified against the live database, sync run `26cc10ef…`):

1. **Parser key-casing bug** — QBO nests rows as `Header` / `Rows` / `Summary` (capitalized); `qb-report.ts` checks lowercase `header`. All 10 snapshots stored with `row_count = 0`; viewer and CSV render blank. Raw payloads are complete and reconcile (Assets = L+E = $23,436.29).
2. **Date display bug** — stored periods are correct `YYYY-MM-DD`, but viewers format via `new Date("2025-12-31")` (UTC midnight → previous day in US timezones). Pure rendering defect.
3. **Silent insert failures** — 6 requests (cash_flow ×2, trial_balance, aged_receivables, aged_payables, account_list) fetched OK but the snapshot insert failed; the engine discards the PostgREST error detail, so the exact cause is not yet known.
4. **No request manifest** — sync run stores only aggregate counts, hence "10 synced · 6 failed" with no per-request visibility.

No AI anywhere in this layer — all deterministic code.

## 1. Rebuild the report parser (`src/lib/qb-report.ts`)

- Handle QBO's real shape: rows keyed `Header`/`Rows`/`Summary`/`ColData`, `type: "Section"|"Data"`, `group` — keep lowercase variants as fallback.
- Parse recursively into a flat row model per the agreed schema: `sequence, depth, row_type (section|data|summary), section_path ("ASSETS > Current Assets > Bank Accounts"), group, account_id, label, column_key, value_text, value_numeric`.
- One parser powers viewer, CSV, normalization, reconciliation.
- Store the parsed rows into `normalized_payload` at sync time (parse-once, read-many) instead of header-meta-only.

## 2. Regression fixture + unit tests

- Extract the real Balance Sheet JSON from the stored snapshot into a test fixture (and one P&L).
- Assertions fail the build unless the parser proves: Checking 1,201.00 · Savings 800.00 · A/R 5,281.52 · Total Current Assets 9,941.29 · Total Assets 23,436.29 · A/P 1,602.67 · Total Liabilities 31,131.33 · Total Equity −7,695.04 · L+E 23,436.29.
- **Parser-completeness test (required):** for every QBO report fixture, every Data/Summary node with meaningful ColData in the source tree must either appear in the parsed representation or be explicitly classified as intentionally ignored. The parser must be general (also preserving Inventory Asset, Undeposited Funds, Truck → Original Cost, Mastercard, tax payables, Loan/Notes Payable, Opening Balance Equity, Retained Earnings, and all section summaries) — not hard-coded to the regression values.

## 3. Date-only handling everywhere

- Add shared date-only helpers (parse/format `YYYY-MM-DD` with no timezone math).
- Fix `fmtDate`/`fmtDateTime` in the report viewer and vault index cards (Dec 30 → Dec 31).
- Fiscal windows stay explicit strings (already correct in `qb-report-plan.ts`).

## 4. Sync engine observability — diagnose first, sanitize never-silently (`qb-sync.server.ts` + migration)

- Migration: add `results jsonb NOT NULL DEFAULT '[]'` to `quickbooks_sync_runs` — per-request manifest: report_type, label, requested path (no tokens), period, http_status, intuit fault code, internal safe code, snapshot_id, row_count.
- **Diagnose before fixing:** capture the exact sanitized PostgREST error code/message/class for every failed insert into the manifest and safe logs. Only after the cause is established (payload size, invalid characters, schema constraint, duplicate key, serialization) introduce any remedy.
- **Never silently mutate source financial data.** If invalid characters are confirmed as the cause: preserve the exact source response where feasible, document the transformation, compute the source checksum against the unmodified response where feasible, and store a sanitized JSON representation for parsing.

## 5. Snapshot/request lifecycle state machine

Replace bare `synced` with states written at sync time:

```text
REQUESTED → RETRIEVED → PARSED → VALIDATED → RECONCILED → READY
```

Terminal alternatives: `API_FAILED`, `PERSISTENCE_FAILED` (fetch succeeded, DB insert failed — exactly what hit the six reports), `EMPTY_SOURCE` (valid QuickBooks empty report, distinct from failure), `PARSE_FAILED`, `VALIDATION_FAILED`, `RECONCILIATION_WARNING`.

A 200 OK with zero parsed rows is no longer "synced".

## 6. Deterministic, report-structure-aware validation engine (`src/lib/qb-validate.ts`)

- Balance Sheet: Total Assets = Total Liabilities + Equity (±$0.01).
- Trial Balance: total debits = total credits.
- **P&L validated against actual QBO hierarchy, not a universal formula:** traverse sections and use explicit QBO summary/group rows — where present: Income − COGS = Gross Profit; Gross Profit − Operating Expenses = Operating Income; incorporate Other Income / Other Expense per the report's structure to reconcile to Net Income. A report is NOT invalid merely because the simplistic Income − COGS − Expenses = Net Income fails when below-the-line items exist.
- **Cross-report comparability gates:** AR Aging ↔ Balance Sheet A/R (and AP equivalents) run only when as-of dates match, accounting basis is compatible, and scope/filter configuration is comparable — otherwise the check returns `not_comparable`, never a false failure.
- Result stored per snapshot (`validation` jsonb: checks, expected, actual, pass/fail/not_comparable) and surfaced in the provenance header as **Source integrity: Verified / Needs review** — never silently "success".

## 7. Vault + viewer updates

- Viewer/CSV render the parsed rows (indented section hierarchy, account ids available).
- Vault cards show real parsed row counts and validation state; CompanyInfo card labelled so the count math is explainable.
- Sync results panel lists the per-request manifest including failures with safe error codes (e.g. `AR Aging 8/25/26 — PERSISTENCE_FAILED / code X`).

## 8. History-aware request planning — empirical, not CompanyStartDate-gated

- **Do NOT use `CompanyStartDate` as a hard cutoff** — this sandbox returns valid P&Ls predating it; the field is unreliable as a history boundary. Retain it as informational metadata only.
- Discover usable history empirically: attempt the bounded set of historical periods; classify a valid empty QuickBooks report as `EMPTY_SOURCE` (separate from API failure); record the earliest period containing meaningful financial data; use that discovered history to optimize future syncs.

## 9. Source immutability + parser versioning

- Raw source snapshots remain **immutable**: never alter `raw_payload`, original fetch metadata, or the source checksum.
- Derived representations may be regenerated deterministically from `raw_payload`, and must record `parser_version`, `parsed_at`, parsing status, and validation rules version — so any analysis can later state "generated from snapshot X using parser vN and validation rules vM".
- Re-parsing existing snapshots recompute `normalized_payload`/status only; raw data untouched.

## Out of scope (deliberately)

No invoices/customers/vendors/GL ingestion, no CDC, no AI analysis — horizontal expansion only after this deterministic truth layer passes.

## Technical notes

- Files: `src/lib/qb-report.ts` (rewrite core), new `src/lib/qb-validate.ts`, `src/lib/qb-sync.server.ts` (manifest + parse-at-sync + sanitized error capture), `src/routes/seller.financial-vault.*.tsx`, `src/lib/quickbooks.ts`, one migration (`quickbooks_sync_runs.results`), tests under `supabase/functions/tests/` and `tests/e2e/seller/`.
- No tokens, auth codes, or secrets in any manifest, log, or error path — masked realm + safe codes only.
