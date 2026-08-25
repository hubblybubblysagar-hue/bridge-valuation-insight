// Regression tests for the QuickBooks report parser v2 and validation
// engine, driven by REAL sandbox payloads captured verbatim from a live
// sync (tests/fixtures/qb-reports.ts). The v1 parser silently dropped every
// section because it looked for lowercase keys — these tests prove every
// meaningful source node is parsed and that financial identities hold.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  countSourceNodes,
  findSummaryRow,
  normalizePnL,
  parseReport,
  reportRowCount,
  reportToCsv,
  rowTotal,
} from "../../../src/lib/qb-report.ts";
import {
  comparable,
  validateBalanceSheet,
  validateProfitAndLoss,
  validateReport,
} from "../../../src/lib/qb-validate.ts";
import { QB_BALANCE_SHEET, QB_PROFIT_AND_LOSS } from "../../../tests/fixtures/qb-reports.ts";

Deno.test("parser v2: parses the real Balance Sheet into attributed rows", () => {
  const parsed = parseReport(QB_BALANCE_SHEET);
  assert(parsed, "payload must parse");
  assertEquals(parsed!.reportName, "BalanceSheet");
  assertEquals(parsed!.currency, "USD");
  assert(parsed!.rows.length > 10, "expected many rows");
  // Every row carries full attribution.
  for (const row of parsed!.rows) {
    assert(typeof row.sequence === "number");
    assert(typeof row.depth === "number");
    assert(["section", "data", "summary"].includes(row.rowType));
    assert(typeof row.sectionPath === "string");
    assert(typeof row.label === "string");
  }
});

Deno.test("parser v2 completeness: every meaningful QBO node appears in parsed rows", () => {
  for (const fixture of [QB_BALANCE_SHEET, QB_PROFIT_AND_LOSS]) {
    const parsed = parseReport(fixture);
    assert(parsed, "payload must parse");
    assertEquals(
      parsed!.rows.length,
      countSourceNodes(fixture),
      "one parsed row per meaningful source node (header, data, or summary)",
    );
  }
});

Deno.test("parser v2: row_count is non-zero for real payloads (v1 regression)", () => {
  assert(reportRowCount(QB_BALANCE_SHEET) > 0, "row_count must not be 0");
  assert(reportRowCount(QB_PROFIT_AND_LOSS) > 0, "row_count must not be 0");
});

Deno.test("validation: Balance Sheet reconciles (Total Assets = L + E)", () => {
  const parsed = parseReport(QB_BALANCE_SHEET)!;
  const checks = validateBalanceSheet(parsed);
  assertEquals(checks.length, 1);
  assertEquals(checks[0].status, "pass", checks[0].detail ?? "");
  assertEquals(checks[0].expected, 23436.29);
  assertEquals(checks[0].actual, 23436.29);
});

Deno.test("validation: P&L structure-aware identities reconcile", () => {
  const parsed = parseReport(QB_PROFIT_AND_LOSS)!;
  const checks = validateProfitAndLoss(parsed);
  const ids = checks.map((c) => c.id);
  assert(ids.includes("pl_gross_profit"), "gross profit identity present");
  assert(ids.includes("pl_net_income"), "net income identity present");
  for (const c of checks) {
    assertEquals(
      c.status,
      "pass",
      `${c.id} should reconcile: expected ${c.expected}, got ${c.actual} (${c.detail ?? ""})`,
    );
  }
});

Deno.test("normalizePnL: core figures traced to labelled QuickBooks rows", () => {
  const parsed = parseReport(QB_PROFIT_AND_LOSS)!;
  const n = normalizePnL(parsed);
  assert(n.revenue !== null, "revenue must come from Total Income");
  assert(n.netIncome !== null, "net income must come from Net Income");
  assertEquals(n.currency, "USD");
  assertStringIncludes(n.matched.revenue!.toLowerCase(), "total income");
  assertStringIncludes(n.matched.netIncome!.toLowerCase(), "net income");
});

Deno.test("parser v2: standalone summary rows (Gross Profit, Net Income) are captured", () => {
  const parsed = parseReport(QB_PROFIT_AND_LOSS)!;
  const gross = findSummaryRow(parsed, "gross profit");
  const net = findSummaryRow(parsed, "net income");
  assert(gross, "Gross Profit summary row present");
  assert(net, "Net Income summary row present");
  assert(rowTotal(gross!) !== null);
  assert(rowTotal(net!) !== null);
});

Deno.test("comparability gate: different dates or basis are not comparable", () => {
  const a = { reportType: "aged_receivables", periodEnd: "2025-12-31", reportBasis: "Accrual" };
  const b = { reportType: "balance_sheet", periodEnd: "2025-12-31", reportBasis: "Accrual" };
  const c = { reportType: "balance_sheet", periodEnd: "2026-08-25", reportBasis: "Accrual" };
  const d = { reportType: "balance_sheet", periodEnd: "2025-12-31", reportBasis: "Cash" };
  assert(comparable(a, b));
  assert(!comparable(a, c), "different as-of dates must not compare");
  assert(!comparable(a, d), "different basis must not compare");
});

Deno.test("validateReport dispatcher: balance sheet overall pass", () => {
  const parsed = parseReport(QB_BALANCE_SHEET)!;
  const result = validateReport("balance_sheet", parsed);
  assertEquals(result.overall, "pass");
});

Deno.test("CSV export: includes sections, data, and summary rows", () => {
  const parsed = parseReport(QB_BALANCE_SHEET)!;
  const csv = reportToCsv(parsed);
  const lines = csv.split("\n");
  assertEquals(lines.length, parsed.rows.length + 1);
  assertStringIncludes(csv, "Total Assets");
  assertStringIncludes(csv, "23,436.29");
});

Deno.test("parseReport: non-report payloads return null", () => {
  assertEquals(parseReport(null), null);
  assertEquals(parseReport({}), null);
  assertEquals(parseReport({ CompanyInfo: { CompanyName: "X" } }), null);
});
