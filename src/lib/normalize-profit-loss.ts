// Profit & Loss normalization for the Financial Review workflow.
//
// Values are traced to labelled QuickBooks summary rows ("Total Income",
// "Net Income"). Rows without a traceable label are never used as a source,
// and missing figures come back as null — the UI shows "Not available"
// rather than a guess. Add-backs are always seller-provided, never derived
// from QuickBooks.

import {
  normalizePnL,
  parseReport,
  type NormalizedPnL,
} from "./qb-report";

export interface NormalizedFinancials {
  revenue: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  netIncome: number | null;
  currency: string;
  /** Which QuickBooks rows each value came from (for provenance display). */
  matched: NormalizedPnL["matched"];
}

/**
 * Derive normalized financials from a Profit & Loss report payload using
 * parser v2. Returns null when the payload is not a QBO report at all.
 */
export function normalizeFinancialsFromPayload(payload: unknown): NormalizedFinancials | null {
  const parsed = parseReport(payload);
  if (!parsed) return null;
  return normalizePnL(parsed);
}
