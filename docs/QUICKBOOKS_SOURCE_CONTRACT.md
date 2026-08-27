# ExitBridge — QuickBooks Source Contract v1

Authoritative contract for how ExitBridge acquires, classifies, stores, and
exposes QuickBooks Online data. Never place secrets, tokens, or real company
financials in this file.

Companion docs: [`EXITBRIDGE_QUICKBOOKS_ACQUISITION_DATA_SPEC.md`](./EXITBRIDGE_QUICKBOOKS_ACQUISITION_DATA_SPEC.md),
[`EXITBRIDGE_BUILD_CONTEXT.md`](./EXITBRIDGE_BUILD_CONTEXT.md).

---

## 1. Principles

1. **Read-only.** Only `GET` requests are ever issued to the Intuit Data API.
2. **Never manufacture data.** A missing source is recorded as a coverage gap.
   ExitBridge never estimates, interpolates, or substitutes a value QuickBooks
   did not return.
3. **Raw is immutable.** Every sync appends a new snapshot. Prior valid
   snapshots are never overwritten or deleted by a later failing sync.
4. **Structure is not evidence.** Section headers and summary shells are
   counted separately (`structural_node_count`) from rows that carry financial
   values (`financial_row_count`).
5. **Failure is typed.** An Intuit fault is a source failure, not a parse
   failure. Company metadata is not a financial report. Empty is not broken.

## 2. Source registry

`src/lib/qb-source-registry.ts` is the single source of truth. Every source
declares: `key`, `title`, `category`, `kind`, `tier`, `phase`, `privacy`,
`parser`, `periodStrategy`, and `diligenceUse`.

### Coverage categories (v1)

| Category | Purpose |
| --- | --- |
| `company_metadata` | Verified identity of the connected company |
| `historical_financials` | P&L, Balance Sheet, Cash Flow across fiscal years |
| `working_capital` | AR/AP aging, summary and detail |
| `accounting_structure` | Trial Balance, Chart of Accounts, Account List |

### Source kinds

`company_metadata` · `financial_report` · `accounting_entity` ·
`transaction_entity`

Kind determines the parser: report sources use the recursive report parser;
entity sources use the entity-query parser; company metadata is not parsed as
a report and an empty row count is never a failure.

## 3. Privacy classification

| Tier | Meaning | Buyer access |
| --- | --- | --- |
| `seller_private` | Raw and normalized source data | Never |
| `derived_confidential` | Derived metrics (SDE, adjusted EBITDA, ratios) | Never directly |
| `restricted_diligence` | Released only after signed NDA + seller release | Conditional |
| `buyer_shareable` | Seller-approved anonymous teaser content | Yes |

Every snapshot row stores its `privacy_tier`. No buyer-facing query path
touches any `quickbooks_*` table; RLS grants sellers read access to their own
business only.

## 4. Availability model

Availability is the truthful coverage state of a source, distinct from the
internal lifecycle status.

| Availability | Meaning |
| --- | --- |
| `ready` | Retrieved, parsed, and validated |
| `empty_source` | QuickBooks answered with no activity for the period |
| `unsupported` | This company/edition does not expose the source (HTTP 400/404) |
| `permission_limited` | Scope or permission block (HTTP 401/403) |
| `not_applicable` | Not meaningful for this company |
| `source_fault` | Intuit fault or transport failure — retry-eligible |
| `persistence_failed` | Retrieved but could not be stored |

Only `source_fault` and `persistence_failed` count as failures in a sync run.

## 5. Lifecycle

```text
REQUESTED → RETRIEVED → PARSED → VALIDATED → RECONCILED → READY
                     ↘ SOURCE_FAULT / EMPTY_SOURCE / PARSE_FAILED
                     ↘ VALIDATION_FAILED / PERSISTENCE_FAILED
```

Each stage records its own outcome (`sourceOutcome`, `parseOutcome`,
`validationOutcome`, `persistenceOutcome`) in the run manifest, so a stage
never inherits the blame for another stage's failure.

## 6. Reports API migration (2026-08-31)

Intuit migrates the Reports APIs to a modernized reporting service on
**August 31, 2026**. ExitBridge is prepared:

- The parser accepts both the classic `{ Rows: { Row: [...] } }` wrapper and
  bare `Rows: [...]` / `Columns: [...]` arrays, tolerates header-less
  containers, and ignores unknown fields rather than rejecting the payload.
- Setting `QUICKBOOKS_REPORTS_TESTING_MIGRATION=true` adds Intuit's temporary
  `testing_migration=true` parameter to every `/reports/*` request so the new
  service can be exercised before cutover.
- Each snapshot records `reports_api_generation` (`classic` | `modernized`)
  and `parser_version`, so lineage survives the migration.

## 7. Evidence lineage

Every snapshot persists: `source_key`, `source_label`, `request_path`,
`source_kind`, `availability`, `privacy_tier`, `period_start`, `period_end`,
`accounting_method`, `report_basis`, `source_generated_at`, `checksum`,
`parser_version`, `reports_api_generation`, `row_count`,
`structural_node_count`, `financial_row_count`, `entity_count`,
`transaction_count`, plus the immutable `raw_payload`.

## 8. Adding a source

1. Add the definition to `QB_SOURCE_REGISTRY` with the correct category, kind,
   privacy tier, parser, and period strategy.
2. Set `phase: "registered"` first; promote to `"active"` only when the
   request builder and parser path are both proven.
3. Confirm the request is `GET` only.
4. Confirm no buyer-facing query path is introduced.
5. Update this contract and the Change Log in `EXITBRIDGE_BUILD_CONTEXT.md`.
