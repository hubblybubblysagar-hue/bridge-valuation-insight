# ExitBridge — QuickBooks Acquisition Data Spec

Living technical + product specification for all QuickBooks ingestion in
ExitBridge. Update this document after every ingestion phase. Never include
secrets, tokens, authorization codes, or real company financials in this file.

Companion doc: [`EXITBRIDGE_BUILD_CONTEXT.md`](./EXITBRIDGE_BUILD_CONTEXT.md).

---

## 1. Purpose

QuickBooks is the **source-connected financial spine** for ExitBridge, but
it is *not* the full acquisition data room. Buyer-facing disclosure is
always driven by seller-approved, adjusted, normalized artifacts — never by
raw QuickBooks payloads.

Architecture (target, not all built yet):

1. **Raw source evidence** — untouched Intuit responses stored as
   `quickbooks_report_snapshots.raw_payload`, keyed to realm + period +
   accounting method + retrieval time.
2. **Canonical financial model** — normalized P&L / BS / CF / TB rows
   mapped to a stable ExitBridge chart of accounts.
3. **Evidence + adjustment lineage** — every derived metric traces back
   to a raw snapshot + parser version + normalization version + seller
   adjustments.
4. **Deterministic analytics** — SDE, adjusted EBITDA, working capital,
   customer concentration, revenue quality all computed from the
   canonical model, reproducibly.
5. **Controlled disclosure** — the anonymous teaser and later CIM only
   include what the seller explicitly approves.
6. **Document generation** — teasers, CIMs, and diligence packets are
   rendered from the canonical model + approved disclosures.

## 2. Current phase

**Current implementation phase: secure OAuth and CompanyInfo only.**

No P&L, Balance Sheet, Cash Flow, TB, AR/AP aging, customer, or
transaction data is retrieved yet.

## 3. Planned ingestion phases

**Phase 1 — This iteration**
- Intuit OAuth 2.0 (accounting scope)
- CompanyInfo retrieval
- Connection lifecycle: connect, verify, refresh, disconnect

**Phase 2 — Baseline financials**
- Preferences
- Account (chart of accounts)
- Reports: ProfitAndLoss, BalanceSheet, CashFlow, TrialBalance,
  AgedReceivables, AgedPayables

**Phase 3 — Composition and quality**
- Reports: CustomerSales / CustomerIncome, ItemSales, VendorExpenses,
  GeneralLedgerDetail

**Phase 4 — Entity-level detail**
- Customer, Invoice, SalesReceipt, Payment, CreditMemo, RefundReceipt
- Vendor, Bill, Purchase, BillPayment, VendorCredit
- JournalEntry, Class, Department, Item

## 4. Data classification

| Class | Examples | Buyer access |
| --- | --- | --- |
| Seller-private source data | Intuit tokens, raw CompanyInfo, raw reports, raw entity payloads | Never |
| Seller-private normalized data | Canonical P&L, BS, CF, TB, adjustments, SDE build | Never |
| Seller-approved anonymous disclosure | Teaser overview, industry, region, high-level ranges | Yes, after seller approval |
| Restricted diligence data | Adjusted financials, customer concentration, GL detail | Only after signed NDA and seller-controlled release |

CompanyInfo, tokens, `quickbooks_report_snapshots`, raw financials, customer
data, and vendor data are **never** buyer-readable — enforced by RLS and by
absence of any buyer-facing query path.

## 5. Read-only operational rule

The Intuit `com.intuit.quickbooks.accounting` OAuth scope is **not
inherently read-only** — it permits writes at the API level. ExitBridge
enforces read-only behavior in code:

- Only `GET` requests are issued against the Intuit Data API.
- No write helpers exist in `supabase/functions/_shared/quickbooks.ts`.
- No create / update / delete entity methods are implemented.
- The shared helper `quickbooksGet()` is the only outbound QuickBooks
  Data API path and only accepts GET by construction.
- Any addition of an HTTP method other than GET in the shared helper
  must be rejected in review.

## 6. Evidence lineage standard

Every derived metric must (in future phases) trace to:

- source type (report / entity)
- realm ID
- source endpoint or report name
- source period (start, end)
- accounting basis (accrual / cash)
- retrieved timestamp
- raw snapshot ID (`quickbooks_report_snapshots.id`)
- parser version
- normalization version
- seller adjustment reference (if any)
- evidence status (raw / normalized / seller-adjusted / rejected)
- disclosure status (private / teaser / diligence-released)

## 7. Security requirements

- Tokens never enter frontend code.
- Tokens never enter logs (safe log fields only: correlation id, seller id,
  connection id, masked realm id, action, HTTP status, safe Intuit error
  code, timestamp).
- Tokens never enter ordinary browser-readable tables.
- Tokens are stored in Supabase Vault, keyed by
  `quickbooks_connections.token_secret_id`.
- Buyers cannot access any `quickbooks_*` table (no policies grant them
  SELECT).
- Demo routes (`/demo/*`, `/qa`, `/qa-static`, `/debug/state`, and the two
  `*.demo` accounts) never invoke Intuit.
- Sandbox and production configurations remain separate
  (`INTUIT_ENVIRONMENT`).
- OAuth state is short-lived (10 minutes) and single-use — enforced by
  `private.consume_quickbooks_oauth_state`.
- The latest refresh token always replaces the prior token bundle in Vault.
- No secrets or real financial data ever appear in this or any other doc.

## 8. Instructions for future agents

Before adding a new ingestion phase:

1. Update Section 2 (Current phase) and Section 3 (Planned ingestion
   phases).
2. Confirm the classification of new data in Section 4.
3. Confirm the GET-only rule holds for every new call site.
4. Extend the evidence lineage standard if new dimensions apply.
5. Verify no new buyer-facing query path is introduced.
6. Update the companion `EXITBRIDGE_BUILD_CONTEXT.md` Change Log.
