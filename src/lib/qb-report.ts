// QuickBooks report parser v2 — pure functions, no dependencies.
// Safe to import from browser code, server functions, and Deno tests.
//
// QuickBooks nests report rows as capital-keyed structures:
//   Row { type: "Section", Header: {ColData}, Rows: {Row: [...]}, Summary: {ColData}, group }
//   Row { type: "Data", ColData: [...] }
// Parser v1 looked for lowercase `header` and silently dropped every section —
// this version traverses the real QBO shape recursively and emits one flat,
// fully-attributed row per source node (header, data, or summary).

export const PARSER_VERSION = "2.0.0";

// ============ Raw QBO shapes (loose; both casings tolerated) ============

interface RawColDataEntry {
  value?: string;
  id?: string;
  name?: string;
  href?: string;
}

interface RawRow {
  Header?: { ColData?: RawColDataEntry[] };
  header?: { ColData?: RawColDataEntry[] };
  ColData?: RawColDataEntry[];
  Rows?: { Row?: RawRow[] };
  Summary?: { ColData?: RawColDataEntry[] };
  summary?: { ColData?: RawColDataEntry[] };
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
    Option?: Array<{ Name?: string; Value?: string }>;
  };
  Columns?: {
    Column?: Array<{
      ColTitle?: string;
      ColType?: string;
      MetaData?: Array<{ Name?: string; Value?: string }>;
    }>;
  };
  Rows?: { Row?: RawRow[] };
}

// ============ Parsed model ============

export type ReportRowType = "section" | "data" | "summary";

export interface ParsedRowValue {
  columnKey: string;
  valueText: string;
  valueNumeric: number | null;
}

export interface ParsedRow {
  /** 0-based document order. */
  sequence: number;
  depth: number;
  rowType: ReportRowType;
  /** "ASSETS > Current Assets > Bank Accounts" — ancestor section labels. */
  sectionPath: string;
  group: string | null;
  /** QuickBooks account/entity id when the source row carries one. */
  accountId: string | null;
  label: string;
  values: ParsedRowValue[];
}

export interface ParsedColumn {
  title: string;
  colKey: string;
  colType: string;
}

export interface ParsedReport {
  reportName: string;
  currency: string;
  reportBasis: string | null;
  startPeriod: string | null;
  endPeriod: string | null;
  sourceTime: string | null;
  noReportData: boolean;
  columns: ParsedColumn[];
  rows: ParsedRow[];
}

// ============ Money parsing ============

/** Parse a QBO display value: "1,234.00", "(1,234.00)" for negatives, "" for empty. */
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

// ============ Parsing ============

function firstEntry(colData: RawColDataEntry[] | undefined): { label: string; id: string | null } {
  const e = colData?.[0];
  return { label: (e?.value ?? "").toString(), id: e?.id != null ? String(e.id) : null };
}

function valueEntries(
  colData: RawColDataEntry[] | undefined,
  columns: ParsedColumn[],
): ParsedRowValue[] {
  const entries = (colData ?? []).slice(1);
  return entries.map((e, i) => {
    const text = (e.value ?? "").toString();
    return {
      columnKey: columns[i]?.colKey ?? `col_${i}`,
      valueText: text,
      valueNumeric: parseMoneyNullable(text),
    };
  });
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
  const allColumns: ParsedColumn[] = columnsRaw.map((c, i) => ({
    title: c.ColTitle ?? "",
    colKey:
      c.MetaData?.find((m) => m.Name === "ColKey")?.Value ??
      (i === 0 ? "account" : `col_${i}`),
    colType: c.ColType ?? "",
  }));
  // Drop the leading label column when it has no title; values align to the rest.
  const columns =
    allColumns.length > 0 && allColumns[0].title.trim() === "" ? allColumns.slice(1) : allColumns;

  const header = raw.Header ?? {};
  const noReportData =
    header.Option?.some((o) => o.Name === "NoReportData" && o.Value === "true") ?? false;

  const rows: ParsedRow[] = [];
  let sequence = 0;

  const walk = (rawRows: RawRow[] | undefined, depth: number, ancestors: string[]): void => {
    for (const r of rawRows ?? []) {
      const headerBlock = r.Header ?? r.header;
      const summaryBlock = r.Summary ?? r.summary;
      const path = ancestors.join(" > ");

      if (headerBlock) {
        const { label, id } = firstEntry(headerBlock.ColData);
        const myPath = path ? `${path} > ${label}` : label;
        rows.push({
          sequence: sequence++,
          depth,
          rowType: "section",
          sectionPath: path,
          group: r.group ?? null,
          accountId: id,
          label,
          values: valueEntries(headerBlock.ColData, columns),
        });
        walk(r.Rows?.Row, depth + 1, [...ancestors, label]);
        if (summaryBlock) {
          const s = firstEntry(summaryBlock.ColData);
          rows.push({
            sequence: sequence++,
            depth: depth + 1,
            rowType: "summary",
            sectionPath: myPath,
            group: r.group ?? null,
            accountId: null,
            label: s.label || `Total ${label}`,
            values: valueEntries(summaryBlock.ColData, columns),
          });
        }
        continue;
      }

      if (summaryBlock && !r.ColData) {
        // Standalone summary section (Gross Profit, Net Operating Income, Net Income).
        const s = firstEntry(summaryBlock.ColData);
        rows.push({
          sequence: sequence++,
          depth,
          rowType: "summary",
          sectionPath: path,
          group: r.group ?? null,
          accountId: null,
          label: s.label,
          values: valueEntries(summaryBlock.ColData, columns),
        });
        continue;
      }

      if (r.ColData) {
        const { label, id } = firstEntry(r.ColData);
        rows.push({
          sequence: sequence++,
          depth,
          rowType: "data",
          sectionPath: path,
          group: r.group ?? null,
          accountId: id,
          label,
          values: valueEntries(r.ColData, columns),
        });
      }
    }
  };

  walk(raw.Rows?.Row, 0, []);

  return {
    reportName: header.ReportName ?? "Report",
    currency: header.Currency ?? "USD",
    reportBasis: header.ReportBasis ?? null,
    startPeriod: header.StartPeriod ?? null,
    endPeriod: header.EndPeriod ?? null,
    sourceTime: header.Time ?? null,
    noReportData,
    columns,
    rows,
  };
}

/**
 * Count source nodes that carry meaningful ColData (section headers, data
 * rows, and summaries). The parser must emit exactly one row per such node —
 * used by the completeness regression test to prove nothing is dropped.
 */
export function countSourceNodes(payload: unknown): number {
  if (!isReportPayload(payload)) return 0;
  let count = 0;
  const walk = (rawRows: RawRow[] | undefined): void => {
    for (const r of rawRows ?? []) {
      const headerBlock = r.Header ?? r.header;
      const summaryBlock = r.Summary ?? r.summary;
      if (headerBlock?.ColData && headerBlock.ColData.length > 0) count += 1;
      else if (!headerBlock && r.ColData && r.ColData.length > 0) count += 1;
      if (summaryBlock?.ColData && summaryBlock.ColData.length > 0) count += 1;
      walk(r.Rows?.Row);
    }
  };
  walk((payload as RawReportPayload).Rows?.Row);
  return count;
}

/** Number of value-bearing rows (data + summary rows with any non-empty value). */
export function reportRowCount(payload: unknown): number {
  const parsed = parseReport(payload);
  if (!parsed) return 0;
  return parsed.rows.filter(
    (r) => r.rowType !== "section" || r.values.some((v) => v.valueText !== ""),
  ).length;
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

// ============ Row lookups (shared by normalization + validation) ============

function normLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Total value of a row: the last non-empty numeric column. */
export function rowTotal(row: ParsedRow): number | null {
  for (let i = row.values.length - 1; i >= 0; i -= 1) {
    if (row.values[i].valueNumeric !== null) return row.values[i].valueNumeric;
  }
  return null;
}

/** Find a summary row by exact normalized label (e.g. "net income"). */
export function findSummaryRow(parsed: ParsedReport, label: string): ParsedRow | null {
  const target = normLabel(label);
  return parsed.rows.find((r) => r.rowType === "summary" && normLabel(r.label) === target) ?? null;
}

/** Find a summary row whose label starts with a prefix (e.g. "total income"). */
export function findSummaryRowByPrefix(parsed: ParsedReport, prefix: string): ParsedRow | null {
  const target = normLabel(prefix);
  return (
    parsed.rows.find((r) => r.rowType === "summary" && normLabel(r.label).startsWith(target)) ??
    null
  );
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

/**
 * Derive the four core figures from a parsed P&L using explicit QBO summary
 * rows. Returns null fields when a figure cannot be traced to a labelled
 * row — callers must surface "not available" rather than guessing.
 */
export function normalizePnL(parsed: ParsedReport): NormalizedPnL {
  const matched: NormalizedPnL["matched"] = {};

  const revenueRow =
    findSummaryRowByPrefix(parsed, "total income") ?? findSummaryRowByPrefix(parsed, "total revenue");
  const grossRow =
    findSummaryRow(parsed, "gross profit") ??
    parsed.rows.find((r) => normLabel(r.label).includes("gross profit")) ??
    null;
  const expenseRow =
    findSummaryRow(parsed, "total expenses") ??
    findSummaryRowByPrefix(parsed, "total operating expenses");
  const netRow =
    findSummaryRow(parsed, "net income") ??
    findSummaryRow(parsed, "net operating income") ??
    parsed.rows.find((r) =>
      ["net income", "net operating income"].includes(normLabel(r.label)),
    ) ??
    null;

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
  lines.push(
    [csvCell(parsed.reportName), ...parsed.columns.map((c) => csvCell(c.title))].join(","),
  );
  for (const row of parsed.rows) {
    const indent = "  ".repeat(row.depth);
    lines.push(
      [
        csvCell(indent + row.label),
        ...row.values.map((v) => csvCell(v.valueText)),
      ].join(","),
    );
  }
  return lines.join("\n");
}
