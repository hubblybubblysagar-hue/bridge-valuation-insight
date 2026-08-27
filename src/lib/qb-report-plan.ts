// QuickBooks financial sync planning — pure functions, no dependencies.
// Safe to import from browser code, server functions, and Deno tests.
//
// Defines the standard report set synced from QuickBooks, the fiscal-year
// period math used to build report request URLs, and the shared result
// types returned by the sync server function.

export const SYNC_REPORT_TYPES = [
  "company_info",
  "profit_and_loss",
  "balance_sheet",
  "cash_flow",
  "trial_balance",
  "aged_receivables",
  "aged_receivable_detail",
  "aged_payables",
  "aged_payable_detail",
  "account_list",
  "account_list_detail",
] as const;

export type SyncReportType = (typeof SYNC_REPORT_TYPES)[number];

export const SYNC_REPORT_TYPE_LABELS: Record<SyncReportType, string> = {
  company_info: "Company information",
  profit_and_loss: "Profit & Loss",
  balance_sheet: "Balance Sheet",
  cash_flow: "Statement of Cash Flows",
  trial_balance: "Trial Balance",
  aged_receivables: "Aged Receivables",
  aged_receivable_detail: "Aged Receivable Detail",
  aged_payables: "Aged Payables",
  aged_payable_detail: "Aged Payable Detail",
  account_list: "Chart of Accounts",
  account_list_detail: "Account List report",
};


export interface SyncReportRequest {
  reportType: SyncReportType;
  label: string;
  path: string;
  periodStart: string | null;
  periodEnd: string | null;
  accountingMethod: string | null;
}

// Lifecycle states for a single report request/snapshot.
// REQUESTED → RETRIEVED → PARSED → VALIDATED → RECONCILED → READY, with
// terminal failure/empty alternatives. A 200 OK with zero parsed rows is
// never "ready".
export type SnapshotLifecycle =
  | "requested"
  | "retrieved"
  | "parsed"
  | "validated"
  | "reconciled"
  | "ready"
  | "api_failed"
  | "source_fault"
  | "persistence_failed"
  | "empty_source"
  | "parse_failed"
  | "validation_failed"
  | "reconciliation_warning"
  | "synced"; // legacy value from pre-v2 syncs

// Source kind / privacy / availability are defined once, in the source
// registry. Re-exported here so existing importers keep working.
export {
  sourceKindFor,
  privacyTierFor,
  availabilityFromLifecycle,
} from "./qb-source-registry";
export type {
  SourceKind,
  PrivacyTier,
  SourceAvailability,
} from "./qb-source-registry";

import type { SourceAvailability, SourceKind } from "./qb-source-registry";

export type StageOutcome = "ok" | "failed" | "skipped" | "empty" | "not_applicable";

export interface SyncResultItem {
  reportType: string;
  label?: string;
  /** Request path (no host, no tokens) — persisted for auditability. */
  path?: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: SnapshotLifecycle;
  /** Truthful coverage state: "not present" is information, not failure. */
  availability?: SourceAvailability;
  /** company_metadata / financial_report / accounting_entity / transaction_entity. */
  kind?: SourceKind;
  /** Per-stage outcomes so a source failure is never reported as a parse failure. */
  sourceOutcome?: StageOutcome;
  parseOutcome?: StageOutcome;
  validationOutcome?: StageOutcome;
  persistenceOutcome?: StageOutcome;
  httpStatus?: number | null;
  intuitErrorCode?: string | null;
  intuitFaultType?: string | null;
  errorCode?: string;
  /** Sanitized persistence error detail (PostgREST code + message class). */
  errorDetail?: string | null;
  /** Number of source attempts made (retries for transient Intuit faults). */
  attempts?: number;
  /** Set when this request is a deterministic narrower-period fallback. */
  fallbackOfPeriod?: { start: string | null; end: string | null } | null;
  snapshotId?: string | null;
  /** All parsed rows including structural section/summary shells. */
  rowCount?: number | null;
  /** Rows that actually carry financial values. */
  financialRowCount?: number | null;
  /** Section/summary shells that organize but do not evidence. */
  structuralNodeCount?: number | null;
  /** Accounting entity records returned by a generic query. */
  entityCount?: number | null;
  /** Transaction-level records returned by a detail source. */
  transactionCount?: number | null;
  checksum?: string;
  /** "classic" or "modernized" — which Reports service produced the payload. */
  reportsApiGeneration?: string | null;
}


/**
 * Deterministic narrower-period retry for a period-bounded report whose source
 * request faulted. Halves the window from the END (never invents data, never
 * merges results) so a fault on a long window can still yield a real, clearly
 * labelled shorter-period snapshot.
 */
export function narrowerPeriodRequest(req: SyncReportRequest): SyncReportRequest | null {
  if (!req.periodStart || !req.periodEnd) return null;
  const startMs = Date.parse(req.periodStart);
  const endMs = Date.parse(req.periodEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const days = Math.round((endMs - startMs) / 86_400_000);
  if (days < 60) return null; // already short — nothing meaningful to narrow to
  const newStartMs = endMs - Math.floor(days / 2) * 86_400_000;
  const newStart = isoDate(new Date(newStartMs));
  return {
    ...req,
    label: `${req.label} (narrowed: ${newStart} – ${req.periodEnd})`,
    path: req.path.replace(
      /start_date=[^&]*/,
      `start_date=${encodeURIComponent(newStart)}`,
    ),
    periodStart: newStart,
  };
}


export type SyncRunStatus = "completed" | "partial" | "failed";

export interface SyncRunResult {
  syncRunId: string;
  status: SyncRunStatus;
  successfulCount: number;
  failedCount: number;
  results: SyncResultItem[];
  /** Earliest report period end that contained meaningful data in this run. */
  discoveredHistoryEarliest?: string | null;
  lastSyncedAt: string | null;
  correlationId: string;
}

// ============ Fiscal year math ============

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseDateUtc(s: string): Date {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function lastDayOfMonthUtc(year: number, month1: number): Date {
  // month1 is 1-based.
  return new Date(Date.UTC(year, month1, 0));
}

export interface FiscalYearWindow {
  start: string;
  end: string;
  label: string;
}

// Completed fiscal year ending most recently before today, given the
// company's fiscal year start month (1-12, QuickBooks FiscalYearStartMonth).
export function completedFiscalYear(today: Date, fyStartMonth: number): FiscalYearWindow {
  const m = Math.min(Math.max(fyStartMonth, 1), 12);
  const y = today.getUTCFullYear();
  const thisYearStart = new Date(Date.UTC(y, m - 1, 1));
  const start = today >= thisYearStart ? thisYearStart : new Date(Date.UTC(y - 1, m - 1, 1));
  const completedStart = new Date(Date.UTC(start.getUTCFullYear() - 1, m - 1, 1));
  const completedEnd = addDays(start, -1);
  return {
    start: isoDate(completedStart),
    end: isoDate(completedEnd),
    label: `FY${completedEnd.getUTCFullYear()}`,
  };
}

// Fiscal year window n years before the most recent completed fiscal year.
export function priorFiscalYear(today: Date, fyStartMonth: number, yearsBack: number): FiscalYearWindow {
  const base = completedFiscalYear(today, fyStartMonth);
  const s = parseDateUtc(base.start);
  const start = new Date(Date.UTC(s.getUTCFullYear() - yearsBack, s.getUTCMonth(), 1));
  // Shift the completed year's END back by whole years (shifting the start
  // would land on the day before the window, one year too far).
  const e = parseDateUtc(base.end);
  const shifted = new Date(Date.UTC(e.getUTCFullYear() - yearsBack, e.getUTCMonth(), e.getUTCDate()));
  // End is always a month-end; normalize for leap-year edge cases.
  const endNorm = lastDayOfMonthUtc(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1);
  return {
    start: isoDate(start),
    end: isoDate(endNorm),
    label: `FY${endNorm.getUTCFullYear()}`,
  };
}

// Extract the fiscal-year start month from a stored company_info snapshot.
export function fiscalYearStartMonthFromCompanyInfo(raw: unknown): number {
  const ci =
    raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).CompanyInfo as Record<string, unknown> | undefined)
      : undefined;
  const v = ci?.FiscalYearStartMonth;
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 1;
}

// ============ Report request planning ============

const ACCOUNTING_METHOD = "Accrual";

function reportPath(name: string, params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.append(k, v);
  }
  return `/reports/${name}?${q.toString()}`;
}

// CompanyInfo is not a /reports/* endpoint — it needs the realm ID, so it is
// built separately and synced first: its FiscalYearStartMonth determines the
// fiscal-year windows for every other report in the run.
export function companyInfoRequest(realmId: string): SyncReportRequest {
  return {
    reportType: "company_info",
    label: "Company information",
    path: `/companyinfo/${encodeURIComponent(realmId)}`,
    periodStart: null,
    periodEnd: null,
    accountingMethod: null,
  };
}

// The standard acquisition-diligence report set. Every request is a
// read-only GET against the QuickBooks reports/query endpoints.
export function buildReportRequests(today: Date, fyStartMonth: number): SyncReportRequest[] {
  const fy1 = completedFiscalYear(today, fyStartMonth);
  const fy2 = priorFiscalYear(today, fyStartMonth, 1);
  const fy3 = priorFiscalYear(today, fyStartMonth, 2);
  const ytdStart = isoDate(addDays(parseDateUtc(fy1.end), 1));
  const todayIso = isoDate(today);
  const priorYtdEndDate = parseDateUtc(todayIso);
  priorYtdEndDate.setUTCFullYear(priorYtdEndDate.getUTCFullYear() - 1);
  const priorYtdEnd = isoDate(priorYtdEndDate);

  const pl = (start: string, end: string, extra?: Record<string, string>) =>
    reportPath("ProfitAndLoss", {
      accounting_method: ACCOUNTING_METHOD,
      start_date: start,
      end_date: end,
      ...extra,
    });
  const bs = (asOf: string) =>
    reportPath("BalanceSheet", { accounting_method: ACCOUNTING_METHOD, as_of_date: asOf });

  return [
    {
      reportType: "profit_and_loss",
      label: `Profit & Loss — ${fy1.label}`,
      path: pl(fy1.start, fy1.end),
      periodStart: fy1.start,
      periodEnd: fy1.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "profit_and_loss",
      label: `Profit & Loss — ${fy2.label}`,
      path: pl(fy2.start, fy2.end),
      periodStart: fy2.start,
      periodEnd: fy2.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "profit_and_loss",
      label: `Profit & Loss — ${fy3.label}`,
      path: pl(fy3.start, fy3.end),
      periodStart: fy3.start,
      periodEnd: fy3.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "profit_and_loss",
      label: "Profit & Loss — Year to date",
      path: pl(ytdStart, todayIso),
      periodStart: ytdStart,
      periodEnd: todayIso,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "profit_and_loss",
      label: "Profit & Loss — Prior year to date",
      path: pl(fy2.start, priorYtdEnd),
      periodStart: fy2.start,
      periodEnd: priorYtdEnd,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "profit_and_loss",
      label: `Profit & Loss by month — ${fy1.label}`,
      path: pl(fy1.start, fy1.end, { columns: "Month" }),
      periodStart: fy1.start,
      periodEnd: fy1.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "balance_sheet",
      label: "Balance Sheet — Current",
      path: bs(todayIso),
      periodStart: null,
      periodEnd: todayIso,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "balance_sheet",
      label: `Balance Sheet — ${fy1.label} close`,
      path: bs(fy1.end),
      periodStart: null,
      periodEnd: fy1.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "balance_sheet",
      label: `Balance Sheet — ${fy2.label} close`,
      path: bs(fy2.end),
      periodStart: null,
      periodEnd: fy2.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "cash_flow",
      label: `Statement of Cash Flows — ${fy1.label}`,
      path: reportPath("CashFlow", { start_date: fy1.start, end_date: fy1.end }),
      periodStart: fy1.start,
      periodEnd: fy1.end,
      accountingMethod: null,
    },
    {
      reportType: "cash_flow",
      label: "Statement of Cash Flows — Year to date",
      path: reportPath("CashFlow", { start_date: ytdStart, end_date: todayIso }),
      periodStart: ytdStart,
      periodEnd: todayIso,
      accountingMethod: null,
    },
    {
      reportType: "trial_balance",
      label: `Trial Balance — ${fy1.label} close`,
      path: reportPath("TrialBalance", {
        accounting_method: ACCOUNTING_METHOD,
        start_date: fy1.start,
        end_date: fy1.end,
      }),
      periodStart: fy1.start,
      periodEnd: fy1.end,
      accountingMethod: ACCOUNTING_METHOD,
    },
    {
      reportType: "aged_receivables",
      label: "Aged Receivables — Current",
      path: reportPath("AgedReceivables", { as_of_date: todayIso }),
      periodStart: null,
      periodEnd: todayIso,
      accountingMethod: null,
    },
    {
      reportType: "aged_payables",
      label: "Aged Payables — Current",
      path: reportPath("AgedPayables", { as_of_date: todayIso }),
      periodStart: null,
      periodEnd: todayIso,
      accountingMethod: null,
    },
    {
      reportType: "aged_receivable_detail",
      label: "Aged Receivable Detail — Current",
      path: reportPath("AgedReceivableDetail", { as_of_date: todayIso }),
      periodStart: null,
      periodEnd: todayIso,
      accountingMethod: null,
    },
    {
      reportType: "aged_payable_detail",
      label: "Aged Payable Detail — Current",
      path: reportPath("AgedPayableDetail", { as_of_date: todayIso }),
      periodStart: null,
      periodEnd: todayIso,
      accountingMethod: null,
    },
    {
      reportType: "account_list",
      label: "Chart of Accounts",
      path: "/query?query=select * from Account maxresults 1000",
      periodStart: null,
      periodEnd: null,
      accountingMethod: null,
    },
    {
      reportType: "account_list_detail",
      label: "Account List report",
      path: reportPath("AccountList", {}),
      periodStart: null,
      periodEnd: null,
      accountingMethod: null,
    },
  ];

}
