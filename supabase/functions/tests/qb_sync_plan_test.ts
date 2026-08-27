// Deno unit tests for the Phase D financial truth layer: the pure sync
// request planner and the report parser/normalizer. These modules are
// dependency-free and shared verbatim between the server sync engine,
// the frontend vault, and this test suite. No network access.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildReportRequests,
  companyInfoRequest,
  completedFiscalYear,
  fiscalYearStartMonthFromCompanyInfo,
  isoDate,
  priorFiscalYear,
  SYNC_REPORT_TYPES,
} from "../../../src/lib/qb-report-plan.ts";
import {
  isReportPayload,
  normalizePnL,
  parseMoney,
  parseMoneyNullable,
  parseReport,
  reportRowCount,
  reportToCsv,
} from "../../../src/lib/qb-report.ts";

// ============ Fiscal year math ============

Deno.test("completedFiscalYear: calendar-year company in mid-year returns prior year", () => {
  const fy = completedFiscalYear(new Date(Date.UTC(2026, 5, 15)), 1);
  assertEquals(fy.start, "2025-01-01");
  assertEquals(fy.end, "2025-12-31");
  assertEquals(fy.label, "FY2025");
});

Deno.test("completedFiscalYear: before this year's start rolls back two starts", () => {
  // June-start fiscal year, observed in March 2026: FY Jul 2024–Jun 2025 completed.
  const fy = completedFiscalYear(new Date(Date.UTC(2026, 2, 15)), 7);
  assertEquals(fy.start, "2024-07-01");
  assertEquals(fy.end, "2025-06-30");
  assertEquals(fy.label, "FY2025");
});

Deno.test("priorFiscalYear: shifts the completed window back by whole years", () => {
  const today = new Date(Date.UTC(2026, 5, 15));
  const fy2 = priorFiscalYear(today, 1, 1);
  const fy3 = priorFiscalYear(today, 1, 2);
  assertEquals(fy2, { start: "2024-01-01", end: "2024-12-31", label: "FY2024" });
  assertEquals(fy3, { start: "2023-01-01", end: "2023-12-31", label: "FY2023" });
});

Deno.test("fiscalYearStartMonthFromCompanyInfo: parses stored snapshot, defaults to January", () => {
  assertEquals(
    fiscalYearStartMonthFromCompanyInfo({ CompanyInfo: { FiscalYearStartMonth: "July" } }),
    1, // non-numeric month names fall back to 1
  );
  assertEquals(
    fiscalYearStartMonthFromCompanyInfo({ CompanyInfo: { FiscalYearStartMonth: "7" } }),
    7,
  );
  assertEquals(fiscalYearStartMonthFromCompanyInfo(null), 1);
  assertEquals(fiscalYearStartMonthFromCompanyInfo({}), 1);
});

// ============ Report request planning ============

Deno.test("buildReportRequests: read-only requests covering the standard set", () => {
  const reqs = buildReportRequests(new Date(Date.UTC(2026, 5, 15)), 1);
  assertEquals(reqs.length, 18);
  // Every financial report type except company_info is covered by the
  // planner; company_info is built separately (needs the realm ID).
  for (const t of SYNC_REPORT_TYPES) {
    if (t === "company_info") continue;
    assert(
      reqs.some((r) => r.reportType === t),
      `expected a request for ${t}`,
    );
  }
  // Every request path is a GET-shaped reports/query URL — never a write verb.
  for (const r of reqs) {
    assert(
      r.path.startsWith("/reports/") || r.path.startsWith("/query?"),
      `unexpected path ${r.path}`,
    );
    assert(!/create|update|delete|post/i.test(r.path), `write-looking path ${r.path}`);
  }
  // company_info request: read-only companyinfo endpoint with escaped realm.
  const ci = companyInfoRequest("4620816365421018930");
  assertEquals(ci.reportType, "company_info");
  assertStringIncludes(ci.path, "/companyinfo/4620816365421018930");
  assert(!/create|update|delete|post/i.test(ci.path));
  // P&L set: 3 completed FY + YTD + prior YTD + monthly = 6.
  const pls = reqs.filter((r) => r.reportType === "profit_and_loss");
  assertEquals(pls.length, 6);
  // Cash flow: completed FY + YTD.
  assertEquals(reqs.filter((r) => r.reportType === "cash_flow").length, 2);
  assert(pls.some((r) => r.path.includes("columns=Month")), "expected a monthly P&L");
  // All P&L requests declare the accounting basis explicitly.
  for (const r of pls) {
    assertStringIncludes(r.path, "accounting_method=Accrual");
  }
  // Balance sheets are point-in-time (no start date).
  const bs = reqs.filter((r) => r.reportType === "balance_sheet");
  assertEquals(bs.length, 3);
  for (const r of bs) {
    assertEquals(r.periodStart, null);
    assertStringIncludes(r.path, "as_of_date=");
  }
});

// ============ Money parsing ============

Deno.test("parseMoney: currency, commas, and parenthesized negatives", () => {
  assertEquals(parseMoney("$1,234,567.89"), 1234567.89);
  assertEquals(parseMoney("(45,000.00)"), -45000);
  assertEquals(parseMoney("-1,200.50"), -1200.5);
  assertEquals(parseMoney(""), 0);
  assertEquals(parseMoneyNullable(""), null);
  assertEquals(parseMoneyNullable("—"), null);
  assertEquals(parseMoneyNullable("abc"), null);
});

// ============ Report parsing + normalization ============

const PL_PAYLOAD = {
  Header: {
    ReportName: "ProfitAndLoss",
    Currency: "USD",
    ReportBasis: "Accrual",
    StartPeriod: "2025-01-01",
    EndPeriod: "2025-12-31",
    Time: "2026-08-20T10:00:00-07:00",
  },
  Columns: {
    Column: [
      { ColTitle: "", ColType: "Account" },
      { ColTitle: "Total", ColType: "Money" },
    ],
  },
  Rows: {
    Row: [
      {
        header: { ColData: [{ value: "Income" }] },
        Rows: {
          Row: [
            { ColData: [{ value: "Services" }, { value: "2,500,000.00" }], type: "Data" },
            { ColData: [{ value: "Sales" }, { value: "350,000.00" }], type: "Data" },
          ],
        },
        Summary: { ColData: [{ value: "Total Income" }, { value: "2,850,000.00" }] },
        type: "Section",
      },
      { ColData: [{ value: "Gross Profit" }, { value: "1,425,000.00" }], type: "Data" },
      {
        header: { ColData: [{ value: "Expenses" }] },
        Rows: {
          Row: [
            { ColData: [{ value: "Payroll" }, { value: "800,000.00" }], type: "Data" },
            { ColData: [{ value: "Rent" }, { value: "(200,000.00)" }], type: "Data" },
          ],
        },
        Summary: { ColData: [{ value: "Total Expenses" }, { value: "1,000,000.00" }] },
        type: "Section",
      },
      { ColData: [{ value: "Net Operating Income" }, { value: "425,000.00" }], type: "Data" },
      { ColData: [{ value: "Net Income" }, { value: "425,000.00" }], type: "Data" },
    ],
  },
};

Deno.test("parseReport: builds a fully-attributed flat row model (v2)", () => {
  const parsed = parseReport(PL_PAYLOAD);
  assert(parsed !== null);
  assertEquals(parsed.currency, "USD");
  assertEquals(parsed.reportBasis, "Accrual");
  assertEquals(parsed.columns.map((c) => c.title), ["Total"]);

  const income = parsed.rows[0];
  assertEquals(income.rowType, "section");
  assertEquals(income.depth, 0);

  const totalIncome = parsed.rows.find((r) => r.label === "Total Income")!;
  assertEquals(totalIncome.rowType, "summary");
  assertEquals(totalIncome.depth, 1);
  assertEquals(totalIncome.sectionPath, "Income");

  assert(parsed.rows.some((r) => r.label === "Gross Profit"));
  assertEquals(
    reportRowCount(PL_PAYLOAD),
    parsed.rows.filter((r) => r.rowType !== "section").length,
  );
});

Deno.test("normalizePnL: traces the four core figures to labelled rows", () => {
  const parsed = parseReport(PL_PAYLOAD)!;
  const norm = normalizePnL(parsed);
  assertEquals(norm.revenue, 2_850_000);
  assertEquals(norm.grossProfit, 1_425_000);
  assertEquals(norm.operatingExpenses, 1_000_000);
  assertEquals(norm.netIncome, 425_000);
  assertEquals(norm.matched.revenue, "Total Income");
  assertEquals(norm.matched.operatingExpenses, "Total Expenses");
  assertEquals(norm.matched.netIncome, "Net Income");
});

Deno.test("normalizePnL: returns null fields when labels cannot be traced", () => {
  const parsed = parseReport({
    Header: { ReportName: "ProfitAndLoss", Currency: "USD" },
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Total" }] },
    Rows: { Row: [{ ColData: [{ value: "Mystery line" }, { value: "10.00" }], type: "Data" }] },
  })!;
  const norm = normalizePnL(parsed);
  assertEquals(norm.revenue, null);
  assertEquals(norm.grossProfit, null);
  assertEquals(norm.operatingExpenses, null);
  assertEquals(norm.netIncome, null);
  assertEquals(Object.keys(norm.matched).length, 0);
});

Deno.test("isReportPayload: rejects non-report shapes like CompanyInfo", () => {
  assert(!isReportPayload({ CompanyInfo: { CompanyName: "Sandbox Co" } }));
  assert(!isReportPayload(null));
  assert(isReportPayload(PL_PAYLOAD));
});

Deno.test("reportToCsv: header row, indented labels, quoted cells", () => {
  const parsed = parseReport(PL_PAYLOAD)!;
  const csv = reportToCsv(parsed);
  const lines = csv.split("\n");
  assertStringIncludes(lines[0], '"ProfitAndLoss"');
  const services = lines.find((l) => l.includes("Services"))!;
  assertStringIncludes(services, '"  Services"'); // depth-1 indent
  assertStringIncludes(services, '"2,500,000.00"'); // commas safely quoted
});
