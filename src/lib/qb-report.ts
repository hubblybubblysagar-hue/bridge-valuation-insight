// QuickBooks report-style JSON parser — pure functions, no dependencies.
// Safe to import from browser code, server functions, and Deno tests.
//
// Turns the nested QBO report hierarchy (Header / Columns / Rows with
// sections, sub-rows, and summaries) into a flat, renderable tree, and
// extracts normalized financial figures (revenue, gross profit, opex,
// net income) from Profit & Loss reports with explicit label matching.

// ============ Raw QBO shapes (loose) ============

interface RawColDataEntry {
  value?: string;
  id?: string;
  name?: string;
  href?: string;
}

interface RawRow {
  header?: { ColData?: RawColDataEntry[] };
  ColData?: RawColDataEntry[];
  Rows?: { Row?: RawRow[] };
  Summary?: { ColData?: RawColDataEntry[] };
  type?: string;
  group?: string;
}

interface RawReportPayload {
  Header?: {
    ReportName?: string;
    Currency?: string;
    ReportBasis?: string;
    StartPeriod?: string;
    EndPeriod?: string;
    Time?: string;
  };
  Columns?: { Column?: Array<{ ColTitle?: string; ColType?: string }> };
  Rows?: { Row?: RawRow[] };
}

// ============ Parsed model ============

export type ReportRowKind = "section" | "data" | "summary";

export interface ReportRowNode {
  label: string;
  values: string[];
  depth: number;
  kind: ReportRowKind;
  children: ReportRowNode[];
}

export interface ParsedReport {
  reportName: string;
  currency: string;
  reportBasis: string | null;
  startPeriod: string | null;
  endPeriod: string | null;
  sourceTime: string | null;
  /** Data column titles (excludes the leading label column). */
  columns: string[];
  rows: ReportRowNode[];
  flat: ReportRowNode[];
}

function colValues(colData: RawColDataEntry[] | undefined): { label: string; values: string[] } {
  const entries = colData ?? [];
  const label = (entries[0]?.value ?? "").toString();
  const values = entries.slice(1).map((e) => (e.value ?? "").toString());
  return { label, values };
}

function parseRow(raw: RawRow, depth: number): ReportRowNode | null {
  if (raw.header) {
    const { label, values } = colValues(raw.header.ColData);
    const children = (raw.Rows?.Row ?? [])
      .map((r) => parseRow(r, depth + 1))
      .filter((r): r is ReportRowNode => r !== null);
    if (raw.Summary) {
      const s = colValues(raw.Summary.ColData);
      children.push({
        label: s.label || `Total ${label}`,
        values: s.values,
        depth: depth + 1,
        kind: "summary",
        children: [],
      });
    }
    return { label, values, depth, kind: "section", children };
  }
  if (raw.ColData) {
    const { label, values } = colValues(raw.ColData);
    const kind: ReportRowKind = raw.type === "Data" || !raw.type ? "data" : "data";
    return { label, values, depth, kind, children: [] };
  }
  return null;
}

function flattenInto(node: ReportRowNode, out: ReportRowNode[]): void {
  out.push(node);
  for (const child of node.children) flattenInto(child, out);
}

export function isReportPayload(payload: unknown): payload is RawReportPayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    ("Rows" in payload || "Columns" in payload) &&
    "Header" in payload
  );
}

export function parseReport(payload: unknown): ParsedReport | null {
  if (!isReportPayload(payload)) return null;
  const raw = payload as RawReportPayload;
  const columnsRaw = raw.Columns?.Column ?? [];
  const titles = columnsRaw.map((c) => c.ColTitle ?? "");
  // Drop the leading label column when it has no title.
  const columns = titles.length > 0 && titles[0].trim() === "" ? titles.slice(1) : titles;
  const rows = (raw.Rows?.Row ?? [])
    .map((r) => parseRow(r, 0))
    .filter((r): r is ReportRowNode => r !== null);
  const flat: ReportRowNode[] = [];
  for (const r of rows) flattenInto(r, flat);
  return {
    reportName: raw.Header?.ReportName ?? "Report",
    currency: raw.Header?.Currency ?? "USD",
    reportBasis: raw.Header?.ReportBasis ?? null,
    startPeriod: raw.Header?.StartPeriod ?? null,
    endPeriod: raw.Header?.EndPeriod ?? null,
    sourceTime: raw.Header?.Time ?? null,
    columns,
    rows,
    flat,
  };
}

/** Number of value-bearing rows in a report payload (data + summary rows). */
export function reportRowCount(payload: unknown): number {
  const parsed = parseReport(payload);
  if (!parsed) return 0;
  return parsed.flat.filter((r) => r.kind !== "section" || r.values.some((v) => v !== "")).length;
}

/** Provenance metadata extracted from a report payload header. */
export function reportHeaderMeta(payload: unknown): {
  report_name: string | null;
  currency: string | null;
  report_basis: string | null;
  start_period: string | null;
  end_period: string | null;
  source_time: string | null;
} {
  if (!isReportPayload(payload)) {
    return {
      report_name: null,
      currency: null,
      report_basis: null,
      start_period: null,
      end_period: null,
      source_time: null,
    };
  }
  const h = (payload as RawReportPayload).Header ?? {};
  return {
    report_name: h.ReportName ?? null,
    currency: h.Currency ?? null,
    report_basis: h.ReportBasis ?? null,
    start_period: h.StartPeriod ?? null,
    end_period: h.EndPeriod ?? null,
    source_time: h.Time ?? null,
  };
}

// ============ Money parsing ============

/** Parse a QBO display value: "$1,234.00", "(1,234.00)" for negatives, "" for empty. */
export function parseMoneyNullable(value: string | null | undefined): number | null {
  if (value == null) return null;
  let s = value.trim();
  if (s === "" || s === "-" || s === "—") return null;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseMoney(value: string | null | undefined): number {
  return parseMoneyNullable(value) ?? 0;
}

// ============ Profit & Loss normalization ============

export interface NormalizedPnL {
  revenue: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  netIncome: number | null;
  currency: string;
  matched: {
    revenue?: string;
    grossProfit?: string;
    operatingExpenses?: string;
    netIncome?: string;
  };
}

function normLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Total value of a row: the last non-empty value column (TOTAL column for single-period reports). */
function rowTotal(row: ReportRowNode): number | null {
  for (let i = row.values.length - 1; i >= 0; i -= 1) {
    const n = parseMoneyNullable(row.values[i]);
    if (n !== null) return n;
  }
  return null;
}

/**
 * Derive the four core figures from a parsed P&L using label matching.
 * Returns null fields when a figure cannot be traced to a labelled row —
 * callers must surface "not available" rather than guessing.
 */
export function normalizePnL(parsed: ParsedReport): NormalizedPnL {
  const flat = parsed.flat;
  const matched: NormalizedPnL["matched"] = {};

  // Revenue: the summary row of the top Income/Revenue section.
  const revenueRow = flat.find(
    (r) => r.kind === "summary" && /^total (income|revenue)/.test(normLabel(r.label)),
  );
  // Gross profit: the "Gross Profit" row QBO inserts between income and expenses.
  const grossRow = flat.find((r) => normLabel(r.label).includes("gross profit"));
  // Operating expenses: the summary row of the Expenses section.
  const expenseRow = flat.find(
    (r) => r.kind === "summary" && /^total (expenses|operating expenses|cost of goods)/.test(normLabel(r.label)),
  );
  // Net income: exact "Net Income" preferred; fall back to "Net Operating Income".
  const netRow =
    flat.find((r) => normLabel(r.label) === "net income") ??
    flat.find((r) => normLabel(r.label) === "net operating income");

  if (revenueRow) matched.revenue = revenueRow.label;
  if (grossRow) matched.grossProfit = grossRow.label;
  if (expenseRow) matched.operatingExpenses = expenseRow.label;
  if (netRow) matched.netIncome = netRow.label;

  return {
    revenue: revenueRow ? rowTotal(revenueRow) : null,
    grossProfit: grossRow ? rowTotal(grossRow) : null,
    operatingExpenses: expenseRow ? rowTotal(expenseRow) : null,
    netIncome: netRow ? rowTotal(netRow) : null,
    currency: parsed.currency,
    matched,
  };
}

// ============ CSV export ============

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function reportToCsv(parsed: ParsedReport): string {
  const lines: string[] = [];
  lines.push([csvCell(parsed.reportName), ...parsed.columns.map(csvCell)].join(","));
  for (const row of parsed.flat) {
    const indent = "  ".repeat(row.depth);
    lines.push([csvCell(indent + row.label), ...row.values.map(csvCell)].join(","));
  }
  return lines.join("\n");
}
