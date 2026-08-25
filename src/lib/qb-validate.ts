// Deterministic financial validation engine — pure functions, no dependencies.
//
// Runs structure-aware checks over parsed QuickBooks reports. Every check
// returns pass / fail / not_comparable — never a false failure when two
// reports were requested with incompatible dates, basis, or scope.

import {
  findSummaryRow,
  findSummaryRowByPrefix,
  rowTotal,
  type ParsedReport,
  type ParsedRow,
} from "./qb-report";

export const VALIDATION_VERSION = "1.0.0";

export type ValidationStatus = "pass" | "fail" | "not_comparable";

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationStatus;
  expected: number | null;
  actual: number | null;
  difference: number | null;
  detail?: string;
}

export interface ValidationResult {
  version: string;
  validatedAt: string;
  checks: ValidationCheck[];
  /** pass = every comparable check passed; fail = at least one failed. */
  overall: "pass" | "fail" | "not_comparable";
}

const TOLERANCE = 0.01;

function check(
  id: string,
  label: string,
  expected: number | null,
  actual: number | null,
  detail?: string,
): ValidationCheck {
  if (expected === null || actual === null) {
    return { id, label, status: "not_comparable", expected, actual, difference: null, detail };
  }
  const difference = Math.round((actual - expected) * 100) / 100;
  return {
    id,
    label,
    status: Math.abs(difference) <= TOLERANCE ? "pass" : "fail",
    expected,
    actual,
    difference,
    detail,
  };
}

function total(parsed: ParsedReport, label: string): number | null {
  const row = findSummaryRow(parsed, label);
  return row ? rowTotal(row) : null;
}

function totalByPrefix(parsed: ParsedReport, prefix: string): number | null {
  const row = findSummaryRowByPrefix(parsed, prefix);
  return row ? rowTotal(row) : null;
}

// ============ Balance Sheet ============

export function validateBalanceSheet(parsed: ParsedReport): ValidationCheck[] {
  const assets = total(parsed, "total assets");
  const liabEquity = total(parsed, "total liabilities and equity");
  return [
    check(
      "bs_balance",
      "Total Assets = Total Liabilities + Equity",
      assets,
      liabEquity,
      assets === null || liabEquity === null
        ? "Required summary rows not present in this report"
        : undefined,
    ),
  ];
}

// ============ Profit & Loss (structure-aware) ============

export function validateProfitAndLoss(parsed: ParsedReport): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  const income = totalByPrefix(parsed, "total income") ?? totalByPrefix(parsed, "total revenue");
  const cogs = total(parsed, "total cost of goods sold");
  const grossProfit = total(parsed, "gross profit");
  const expenses = total(parsed, "total expenses");
  const netOperating = total(parsed, "net operating income");
  const netOther = total(parsed, "net other income");
  const netIncome = total(parsed, "net income");

  // Income − COGS = Gross Profit (only when QBO emitted all three rows).
  if (income !== null && grossProfit !== null) {
    const expected = cogs !== null ? income - cogs : income;
    checks.push(
      check(
        "pl_gross_profit",
        cogs !== null ? "Income − COGS = Gross Profit" : "Income = Gross Profit (no COGS section)",
        Math.round(expected * 100) / 100,
        grossProfit,
      ),
    );
  }

  // Gross Profit − Operating Expenses = Net Operating Income.
  if (grossProfit !== null && expenses !== null && netOperating !== null) {
    checks.push(
      check(
        "pl_operating_income",
        "Gross Profit − Operating Expenses = Net Operating Income",
        Math.round((grossProfit - expenses) * 100) / 100,
        netOperating,
      ),
    );
  }

  // Reconcile to Net Income, incorporating Other Income/Expense according to
  // the report's actual structure (Net Other Income summary row).
  if (netOperating !== null && netIncome !== null) {
    const hasOther = netOther !== null;
    const expected = hasOther ? netOperating + netOther : netOperating;
    checks.push(
      check(
        "pl_net_income",
        hasOther
          ? "Net Operating Income + Net Other Income = Net Income"
          : "Net Operating Income = Net Income (no below-the-line items)",
        Math.round(expected * 100) / 100,
        netIncome,
      ),
    );
  } else if (income !== null && netIncome !== null && netOperating === null) {
    // Simplified P&L without an operating-income subtotal: only valid when no
    // below-the-line sections exist; otherwise not comparable.
    if (netOther === null && grossProfit !== null && expenses !== null) {
      checks.push(
        check(
          "pl_net_income",
          "Gross Profit − Expenses = Net Income",
          Math.round((grossProfit - expenses) * 100) / 100,
          netIncome,
        ),
      );
    }
  }

  if (checks.length === 0) {
    checks.push(
      check("pl_structure", "P&L contains traceable summary rows", null, null,
        "No Income/Gross Profit/Net Income summary rows found"),
    );
  }
  return checks;
}

// ============ Trial Balance ============

export function validateTrialBalance(parsed: ParsedReport): ValidationCheck[] {
  // QBO TrialBalance carries Debit and Credit money columns; the grand-total
  // summary row is labelled "TOTAL".
  const totalRow =
    parsed.rows.find((r) => r.rowType === "summary" && r.label.trim().toUpperCase() === "TOTAL") ??
    null;
  if (!totalRow) {
    return [
      check("tb_balance", "Total Debits = Total Credits", null, null, "No TOTAL summary row found"),
    ];
  }
  const byKey = (key: string): number | null => {
    const v = totalRow.values.find((x) => x.columnKey.toLowerCase().includes(key));
    return v ? v.valueNumeric : null;
  };
  const debit = byKey("debit") ?? totalRow.values[0]?.valueNumeric ?? null;
  const credit = byKey("credit") ?? totalRow.values[1]?.valueNumeric ?? null;
  return [check("tb_balance", "Total Debits = Total Credits", debit, credit)];
}

// ============ Cross-report reconciliation (comparability-gated) ============

export interface SnapshotContext {
  reportType: string;
  periodEnd: string | null;
  reportBasis: string | null;
}

/** True only when two reports share as-of date AND accounting basis. */
export function comparable(a: SnapshotContext, b: SnapshotContext): boolean {
  if (!a.periodEnd || !b.periodEnd || a.periodEnd !== b.periodEnd) return false;
  const basisA = (a.reportBasis ?? "").toLowerCase();
  const basisB = (b.reportBasis ?? "").toLowerCase();
  return basisA === basisB;
}

/** Extract the A/R (or A/P) control-account balance from a Balance Sheet. */
function balanceSheetAccountTotal(parsed: ParsedReport, label: string): number | null {
  const target = label.toLowerCase();
  const row = parsed.rows.find(
    (r: ParsedRow) => r.rowType === "summary" && r.label.toLowerCase() === target,
  );
  return row ? rowTotal(row) : null;
}

/** Extract the grand total from an AR/AP aging report. */
function agingGrandTotal(parsed: ParsedReport): number | null {
  const row =
    parsed.rows.find((r) => r.rowType === "summary" && /^total$/i.test(r.label.trim())) ??
    parsed.rows.filter((r) => r.rowType === "summary").pop() ??
    null;
  return row ? rowTotal(row) : null;
}

export function reconcileAgingToBalanceSheet(
  aging: ParsedReport,
  agingCtx: SnapshotContext,
  balanceSheet: ParsedReport,
  bsCtx: SnapshotContext,
  kind: "receivables" | "payables",
): ValidationCheck {
  const id = kind === "receivables" ? "recon_ar" : "recon_ap";
  const label =
    kind === "receivables"
      ? "AR Aging total = Balance Sheet A/R"
      : "AP Aging total = Balance Sheet A/P";
  if (!comparable(agingCtx, bsCtx)) {
    return check(id, label, null, null,
      "Not comparable: as-of dates or accounting basis differ");
  }
  const bsAccount = balanceSheetAccountTotal(
    balanceSheet,
    kind === "receivables" ? "total accounts receivable" : "total accounts payable",
  );
  const agingTotal = agingGrandTotal(aging);
  return check(id, label, bsAccount, agingTotal,
    bsAccount === null || agingTotal === null
      ? "Required totals not traceable in one of the reports"
      : undefined);
}

// ============ Dispatcher ============

export function validateReport(reportType: string, parsed: ParsedReport): ValidationResult {
  let checks: ValidationCheck[];
  switch (reportType) {
    case "balance_sheet":
      checks = validateBalanceSheet(parsed);
      break;
    case "profit_and_loss":
      checks = validateProfitAndLoss(parsed);
      break;
    case "trial_balance":
      checks = validateTrialBalance(parsed);
      break;
    default:
      checks = [];
  }
  const overall: ValidationResult["overall"] =
    checks.length === 0 || checks.every((c) => c.status === "not_comparable")
      ? "not_comparable"
      : checks.some((c) => c.status === "fail")
        ? "fail"
        : "pass";
  return {
    version: VALIDATION_VERSION,
    validatedAt: new Date().toISOString(),
    checks,
    overall,
  };
}
