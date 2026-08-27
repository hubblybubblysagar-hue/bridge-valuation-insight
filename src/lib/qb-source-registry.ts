// ExitBridge QuickBooks Source Registry — the single, typed definition of
// every QuickBooks source ExitBridge is allowed to acquire.
//
// Pure data + pure functions. Safe to import from browser code, server
// functions, and Deno tests. Route components must read source behaviour from
// here rather than hard-coding report names, periods, or privacy rules.
//
// Upstream specifications (do not copy Intuit docs into this repo — link them):
//   - QuickBooks Online Accounting API (Postman collection)
//     https://www.postman.com/intuit-developer/intuit-developer-quickbooks-online-accounting-api/documentation/4884662-e6c576f1-f6d3-440f-b090-da9ff1ac519d
//   - Upcoming changes to Reports APIs (modernized reporting service,
//     effective 2026-08-31)
//     https://medium.com/intuitdev/upcoming-changes-to-reports-apis-5083ec9aadce
//
// Contract doc: docs/QUICKBOOKS_SOURCE_CONTRACT.md

/** What a source physically is. Drives parser selection and counting. */
export type SourceKind =
  | "company_metadata"
  | "financial_report"
  | "accounting_entity"
  | "transaction_entity";

/**
 * Disclosure tier. Nothing is buyer-visible because a buyer signed up or
 * requested an NDA — only explicitly seller-approved `buyer_shareable`
 * outputs ever leave the seller's private workspace.
 */
export type PrivacyTier =
  | "seller_private"
  | "restricted_diligence"
  | "derived_confidential"
  | "buyer_shareable";

/**
 * Truthful outcome for a planned source. "Not present" is information, not
 * failure: only `source_fault`, `persistence_failed` and `permission_limited`
 * are technical problems.
 */
export type SourceAvailability =
  | "ready"
  | "empty_source"
  | "source_fault"
  | "unsupported"
  | "not_applicable"
  | "permission_limited"
  | "persistence_failed";

/** Seller-facing grouping in the Financial Vault coverage panel. */
export type CoverageCategory =
  | "company"
  | "historical_financials"
  | "working_capital"
  | "accounting_records"
  | "transaction_evidence"
  | "commercial_detail";

export const COVERAGE_CATEGORY_LABELS: Record<CoverageCategory, string> = {
  company: "Company",
  historical_financials: "Historical financials",
  working_capital: "Working capital",
  accounting_records: "Accounting records",
  transaction_evidence: "Transaction evidence",
  commercial_detail: "Commercial detail",
};

export const COVERAGE_CATEGORY_ORDER: CoverageCategory[] = [
  "company",
  "historical_financials",
  "working_capital",
  "accounting_records",
  "transaction_evidence",
  "commercial_detail",
];

/** How important the source is to a credible transaction-preparation package. */
export type SourceTier = "mandatory" | "recommended" | "conditional";

/**
 * `active` sources are acquired by the current sync. `registered` sources are
 * fully specified but deliberately deferred — they exist so future ingestion
 * phases plug into this registry instead of creating a second architecture.
 */
export type SourcePhase = "active" | "registered";

export type PeriodStrategy = "range" | "as_of" | "none";

export type ParserKind = "report" | "entity" | "company_info";

export interface QbSourceDefinition {
  /** ExitBridge internal source key — also the persisted `report_type`. */
  key: string;
  title: string;
  kind: SourceKind;
  privacy: PrivacyTier;
  category: CoverageCategory;
  tier: SourceTier;
  phase: SourcePhase;
  /** Documented Intuit report name, entity name, or `companyinfo`. */
  endpoint: string;
  /** Read-only by construction: every ExitBridge QuickBooks call is a GET. */
  method: "GET";
  periodStrategy: PeriodStrategy;
  accountingBasis: "Accrual" | "Cash" | null;
  parser: ParserKind;
  /** Validation rule keys applied after parsing (see qb-validate.ts). */
  validation: string[];
  /** Whether Intuit lists the report as supported after 2026-08-31. */
  supportedAfterReportsMigration: boolean;
  /** What diligence question this source answers. */
  diligenceUse: string;
  /** Truthful behaviour when QuickBooks has nothing for this source. */
  whenEmpty: SourceAvailability;
}

const S = (d: QbSourceDefinition): QbSourceDefinition => d;

export const QB_SOURCE_REGISTRY: QbSourceDefinition[] = [
  // ---------------- Company ----------------
  S({
    key: "company_info",
    title: "Company information",
    kind: "company_metadata",
    privacy: "seller_private",
    category: "company",
    tier: "mandatory",
    phase: "active",
    endpoint: "companyinfo",
    method: "GET",
    periodStrategy: "none",
    accountingBasis: null,
    parser: "company_info",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Verified legal entity, fiscal year start, and company profile.",
    whenEmpty: "source_fault",
  }),

  // ---------------- Historical financials ----------------
  S({
    key: "profit_and_loss",
    title: "Profit & Loss",
    kind: "financial_report",
    privacy: "seller_private",
    category: "historical_financials",
    tier: "mandatory",
    phase: "active",
    endpoint: "ProfitAndLoss",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: ["pnl_income_less_expense_equals_net"],
    supportedAfterReportsMigration: true,
    diligenceUse: "Historical performance, revenue trend, cost structure, SDE/EBITDA base.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "balance_sheet",
    title: "Balance Sheet",
    kind: "financial_report",
    privacy: "seller_private",
    category: "historical_financials",
    tier: "mandatory",
    phase: "active",
    endpoint: "BalanceSheet",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: "Accrual",
    parser: "report",
    validation: ["bs_assets_equal_liabilities_plus_equity"],
    supportedAfterReportsMigration: true,
    diligenceUse: "Asset base, debt, equity, and net working capital position.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "cash_flow",
    title: "Statement of Cash Flows",
    kind: "financial_report",
    privacy: "seller_private",
    category: "historical_financials",
    tier: "mandatory",
    phase: "active",
    endpoint: "CashFlow",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Cash conversion quality and the earnings-to-cash bridge.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "profit_and_loss_detail",
    title: "Profit & Loss Detail",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "transaction_evidence",
    tier: "recommended",
    phase: "registered",
    endpoint: "ProfitAndLossDetail",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Transaction-level support for revenue and expense lines; add-back evidence.",
    whenEmpty: "empty_source",
  }),

  // ---------------- Working capital ----------------
  S({
    key: "aged_receivables",
    title: "Aged Receivables summary",
    kind: "financial_report",
    privacy: "seller_private",
    category: "working_capital",
    tier: "mandatory",
    phase: "active",
    endpoint: "AgedReceivables",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Collections behaviour and overdue exposure.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "aged_receivable_detail",
    title: "Aged Receivable Detail",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "working_capital",
    tier: "recommended",
    phase: "active",
    endpoint: "AgedReceivableDetail",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Invoice-level AR exposure and customer-level collection risk.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "aged_payables",
    title: "Aged Payables summary",
    kind: "financial_report",
    privacy: "seller_private",
    category: "working_capital",
    tier: "mandatory",
    phase: "active",
    endpoint: "AgedPayables",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Payment obligations and supplier payment behaviour.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "aged_payable_detail",
    title: "Aged Payable Detail",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "working_capital",
    tier: "recommended",
    phase: "active",
    endpoint: "AgedPayableDetail",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Bill-level AP exposure and vendor dependency.",
    whenEmpty: "empty_source",
  }),

  // ---------------- Accounting records ----------------
  S({
    key: "trial_balance",
    title: "Trial Balance",
    kind: "financial_report",
    privacy: "seller_private",
    category: "accounting_records",
    tier: "mandatory",
    phase: "active",
    endpoint: "TrialBalance",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: ["tb_debits_equal_credits"],
    supportedAfterReportsMigration: true,
    diligenceUse: "Proof the ledger balances; account-level close position.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "account_list",
    title: "Chart of Accounts",
    kind: "accounting_entity",
    privacy: "seller_private",
    category: "accounting_records",
    tier: "mandatory",
    phase: "active",
    endpoint: "Account",
    method: "GET",
    periodStrategy: "none",
    accountingBasis: null,
    parser: "entity",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Stable account taxonomy for normalization and mapping.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "account_list_detail",
    title: "Account List report",
    kind: "financial_report",
    privacy: "seller_private",
    category: "accounting_records",
    tier: "recommended",
    phase: "active",
    endpoint: "AccountList",
    method: "GET",
    periodStrategy: "none",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Reported account hierarchy and balances as QuickBooks presents them.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "general_ledger",
    title: "General Ledger",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "transaction_evidence",
    tier: "recommended",
    phase: "registered",
    endpoint: "GeneralLedger",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Full transaction-level support for every reported balance.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "transaction_list_with_splits",
    title: "Transaction List with Splits",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "transaction_evidence",
    tier: "conditional",
    phase: "registered",
    endpoint: "TransactionListWithSplits",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Split-level detail for unusual or discretionary transactions.",
    whenEmpty: "empty_source",
  }),

  // ---------------- Commercial detail (registered, deferred) ----------------
  S({
    key: "sales_by_customer",
    title: "Sales by Customer",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "recommended",
    phase: "registered",
    endpoint: "CustomerSales",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Customer concentration and revenue-quality analysis.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "customer_income",
    title: "Customer Income",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "CustomerIncome",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Margin contribution by customer.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "customer_balance_detail",
    title: "Customer Balance Detail",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "CustomerBalanceDetail",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Open balances per customer for AR diligence.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "sales_by_product",
    title: "Sales by Product/Service",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "ItemSales",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Revenue mix by product or service line.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "vendor_balance_detail",
    title: "Vendor Balance Detail",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "VendorBalanceDetail",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Open balances per vendor for AP diligence.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "vendor_expenses",
    title: "Vendor Expenses",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "VendorExpenses",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: "Accrual",
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Vendor concentration and supplier dependency.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "inventory_valuation_summary",
    title: "Inventory Valuation Summary",
    kind: "financial_report",
    privacy: "seller_private",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "InventoryValuationSummary",
    method: "GET",
    periodStrategy: "as_of",
    accountingBasis: null,
    parser: "report",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Inventory valuation when the business carries inventory.",
    whenEmpty: "not_applicable",
  }),
  S({
    key: "customer_entity",
    title: "Customer records",
    kind: "accounting_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "recommended",
    phase: "registered",
    endpoint: "Customer",
    method: "GET",
    periodStrategy: "none",
    accountingBasis: null,
    parser: "entity",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Customer roster for pseudonymized concentration and retention analysis.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "vendor_entity",
    title: "Vendor records",
    kind: "accounting_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "Vendor",
    method: "GET",
    periodStrategy: "none",
    accountingBasis: null,
    parser: "entity",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Vendor roster for pseudonymized dependency analysis.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "invoice_entity",
    title: "Invoice records",
    kind: "transaction_entity",
    privacy: "restricted_diligence",
    category: "transaction_evidence",
    tier: "recommended",
    phase: "registered",
    endpoint: "Invoice",
    method: "GET",
    periodStrategy: "range",
    accountingBasis: null,
    parser: "entity",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Recurring vs one-time revenue, monthly trends, collection cycles.",
    whenEmpty: "empty_source",
  }),
  S({
    key: "item_entity",
    title: "Item records",
    kind: "accounting_entity",
    privacy: "restricted_diligence",
    category: "commercial_detail",
    tier: "conditional",
    phase: "registered",
    endpoint: "Item",
    method: "GET",
    periodStrategy: "none",
    accountingBasis: null,
    parser: "entity",
    validation: [],
    supportedAfterReportsMigration: true,
    diligenceUse: "Product/service taxonomy behind revenue mix.",
    whenEmpty: "empty_source",
  }),
];

const BY_KEY = new Map(QB_SOURCE_REGISTRY.map((s) => [s.key, s]));

export function getSourceDefinition(key: string): QbSourceDefinition | null {
  return BY_KEY.get(key) ?? null;
}

export function activeSources(): QbSourceDefinition[] {
  return QB_SOURCE_REGISTRY.filter((s) => s.phase === "active");
}

export function registeredSources(): QbSourceDefinition[] {
  return QB_SOURCE_REGISTRY.filter((s) => s.phase === "registered");
}

/** Kind for a source key. Unknown keys default to a financial report. */
export function sourceKindFor(key: string): SourceKind {
  return getSourceDefinition(key)?.kind ?? "financial_report";
}

export function privacyTierFor(key: string): PrivacyTier {
  return getSourceDefinition(key)?.privacy ?? "seller_private";
}

export function coverageCategoryFor(key: string): CoverageCategory {
  return getSourceDefinition(key)?.category ?? "historical_financials";
}

export function sourceTitleFor(key: string): string {
  return getSourceDefinition(key)?.title ?? key.replace(/_/g, " ");
}

/** Parser to run for a source key. */
export function parserFor(key: string): ParserKind {
  return getSourceDefinition(key)?.parser ?? "report";
}

/** Seller-facing coverage labels — never developer diagnostics. */
export const AVAILABILITY_LABELS: Record<SourceAvailability, string> = {
  ready: "Ready",
  empty_source: "No activity",
  source_fault: "Needs attention",
  unsupported: "Not supported",
  not_applicable: "Not applicable",
  permission_limited: "Permission limited",
  persistence_failed: "Needs attention",
};

/** Map an internal snapshot lifecycle status to a coverage availability. */
export function availabilityFromLifecycle(status: string): SourceAvailability {
  switch (status) {
    case "ready":
    case "reconciled":
    case "validated":
    case "parsed":
    case "retrieved":
    case "synced":
      return "ready";
    case "empty_source":
      return "empty_source";
    case "source_fault":
    case "api_failed":
    case "parse_failed":
    case "validation_failed":
      return "source_fault";
    case "persistence_failed":
      return "persistence_failed";
    default:
      return "source_fault";
  }
}
