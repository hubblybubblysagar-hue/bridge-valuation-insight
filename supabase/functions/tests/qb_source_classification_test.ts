// Source classification: faults, empty sources, metadata, narrowed retries.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  financialRowCount,
  parseReport,
  sourceFault,
} from "../../../src/lib/qb-report.ts";
import {
  narrowerPeriodRequest,
  sourceKindFor,
  type SyncReportRequest,
} from "../../../src/lib/qb-report-plan.ts";

const FAULT = {
  Fault: {
    type: "SystemFault",
    Error: [{ code: "10000", Message: "An application error has occurred", Detail: "NullPointerException" }],
  },
  time: "2026-08-26T10:00:00.000Z",
};

Deno.test("an Intuit fault is detected and never treated as a report", () => {
  const f = sourceFault(FAULT);
  assertEquals(f?.type, "SystemFault");
  assertEquals(f?.code, "10000");
  assertEquals(parseReport(FAULT), null);
});

Deno.test("a real report carries no fault", () => {
  assertEquals(sourceFault({ Header: {}, Rows: {} }), null);
});

Deno.test("financialRowCount ignores structural shells", () => {
  const payload = {
    Header: { ReportName: "ProfitAndLoss" },
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Total" }] },
    Rows: {
      Row: [
        {
          type: "Section",
          Header: { ColData: [{ value: "Income" }, { value: "" }] },
          Rows: { Row: [{ type: "Data", ColData: [{ value: "Sales" }, { value: "100.00" }] }] },
          Summary: { ColData: [{ value: "Total Income" }, { value: "100.00" }] },
        },
      ],
    },
  };
  const parsed = parseReport(payload);
  assertEquals(financialRowCount(parsed), 2); // data row + summary; section shell excluded
});

Deno.test("company info is metadata, reports are financial", () => {
  assertEquals(sourceKindFor("company_info"), "company_metadata");
  assertEquals(sourceKindFor("account_list"), "accounting_entity");
  assertEquals(sourceKindFor("profit_and_loss"), "financial_report");
});

Deno.test("narrowed retry halves the window from the end and relabels", () => {
  const req: SyncReportRequest = {
    reportType: "profit_and_loss",
    label: "Profit & Loss — FY2025",
    path: "/reports/ProfitAndLoss?accounting_method=Accrual&start_date=2025-01-01&end_date=2025-12-31",
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    accountingMethod: "Accrual",
  };
  const narrowed = narrowerPeriodRequest(req);
  assertEquals(narrowed?.periodEnd, "2025-12-31");
  assertEquals(narrowed?.periodStart, "2025-07-02");
  assertEquals(narrowed?.path.includes("start_date=2025-07-02"), true);
});

Deno.test("as-of reports and short windows are not narrowed", () => {
  assertEquals(
    narrowerPeriodRequest({
      reportType: "balance_sheet",
      label: "Balance Sheet",
      path: "/reports/BalanceSheet?as_of_date=2026-08-26",
      periodStart: null,
      periodEnd: "2026-08-26",
      accountingMethod: "Accrual",
    }),
    null,
  );
});
