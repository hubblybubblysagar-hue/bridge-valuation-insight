// Browser helpers for QuickBooks connect flow. OAuth/verify/disconnect invoke
// the existing edge functions; the Phase D financial sync runs through a
// TanStack server function. This module only reads safe, RLS-scoped metadata.
import { supabase } from "@/integrations/supabase/client";
import { syncQuickBooksFinancials } from "./qb-sync.functions";
import { normalizePnL, parseReport } from "./qb-report";
import type { SyncResultItem, SyncRunResult } from "./qb-report-plan";

export interface QbConnectionSummary {
  id: string;
  realmIdMasked: string;
  companyName: string | null;
  environment: string;
  status: string;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  tokenSecretPresent: boolean;
  lastError: string | null;
}

export async function loadConnectionSummary(): Promise<QbConnectionSummary | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("quickbooks_connections")
    .select(
      "id, realm_id, company_name, environment, status, connected_at, last_synced_at, access_token_expires_at, refresh_token_expires_at, token_secret_id, last_error",
    )
    .eq("seller_id", userId)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    realmIdMasked: data.realm_id ? `****${String(data.realm_id).slice(-4)}` : "",
    companyName: data.company_name,
    environment: data.environment,
    status: data.status,
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
    accessTokenExpiresAt: data.access_token_expires_at,
    refreshTokenExpiresAt: data.refresh_token_expires_at,
    tokenSecretPresent: Boolean(data.token_secret_id),
    lastError: data.last_error,
  };
}

export async function companyInfoSnapshotCount(connectionId: string): Promise<number> {
  const { count } = await supabase
    .from("quickbooks_report_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .eq("report_type", "company_info");
  return count ?? 0;
}

export interface QaQuickBooksStatus {
  appEnvironment: string;
  buildCommit: string;
  connectionExists: boolean;
  connectionStatus: string | null;
  tokenSecretPresent: boolean;
  companyInfoRetrieved: boolean;
  companyInfoSnapshotCount: number;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  safeLastErrorCode: string | null;
  latestCorrelationId: string | null;
  migrationVersion: string;
}

export async function loadQaQuickBooksStatus(): Promise<QaQuickBooksStatus> {
  return invokeFn<QaQuickBooksStatus>("qa-quickbooks-status");
}

export async function countCompanyInfoSnapshots(): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return 0;
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!biz) return 0;
  const { count } = await supabase
    .from("quickbooks_report_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("business_id", biz.id)
    .eq("report_type", "company_info");
  return count ?? 0;
}

async function invokeFn<T>(name: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: {} });
  if (error) throw new Error(error.message);
  return data as T;
}

export async function startQuickBooksOAuth(): Promise<{ authorizationUrl: string; expiresAt: string }> {
  return invokeFn("quickbooks-auth-start");
}

export async function verifyCompanyInfo(): Promise<QbConnectionSummary> {
  const raw = await invokeFn<{
    connectionId: string;
    realmIdMasked: string;
    companyName: string | null;
    environment: string;
    status: string;
    connectedAt: string | null;
    lastSyncedAt: string | null;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
  }>("quickbooks-company-info");
  return {
    id: raw.connectionId,
    realmIdMasked: raw.realmIdMasked,
    companyName: raw.companyName,
    environment: raw.environment,
    status: raw.status,
    connectedAt: raw.connectedAt,
    lastSyncedAt: raw.lastSyncedAt,
    accessTokenExpiresAt: raw.accessTokenExpiresAt,
    refreshTokenExpiresAt: raw.refreshTokenExpiresAt,
    tokenSecretPresent: true,
    lastError: null,
  };
}

export async function disconnectQuickBooks(): Promise<void> {
  await invokeFn("quickbooks-disconnect");
}

// ============ Financial Vault (Phase D) ============

/** Trigger the read-only financial sync (P&L, Balance Sheet, Cash Flow, etc.). */
export async function syncFinancials(): Promise<SyncRunResult> {
  return syncQuickBooksFinancials({ data: {} });
}

export interface VaultSnapshotMeta {
  id: string;
  reportType: string;
  periodStart: string | null;
  periodEnd: string | null;
  accountingMethod: string | null;
  reportBasis: string | null;
  rowCount: number | null;
  checksum: string | null;
  status: string;
  fetchedAt: string | null;
  sourceGeneratedAt: string | null;
  syncRunId: string | null;
}

export interface VaultSyncRunMeta {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  successfulCount: number;
  failedCount: number;
  errorCodes: string[];
  /** Per-request manifest (sanitized: no tokens, realm masked). */
  results: SyncResultItem[];
}

export interface VaultData {
  businessId: string | null;
  connection: QbConnectionSummary | null;
  snapshots: VaultSnapshotMeta[];
  runs: VaultSyncRunMeta[];
}

/** Strip anything sensitive from a stored manifest before it reaches the UI. */
function sanitizeManifest(raw: unknown): SyncResultItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = { ...(item as SyncResultItem) };
    if (r.path) {
      // The CompanyInfo path embeds the realm id — mask all but the last 4.
      r.path = r.path.replace(/\/companyinfo\/(\w+)/i, (_m, id: string) => `/companyinfo/****${id.slice(-4)}`);
    }
    return r;
  });
}

async function currentSellerBusinessId(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return null;
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return biz?.id ?? null;
}

export async function loadVaultData(): Promise<VaultData> {
  const [connection, businessId] = await Promise.all([
    loadConnectionSummary(),
    currentSellerBusinessId(),
  ]);
  if (!businessId) return { businessId: null, connection, snapshots: [], runs: [] };
  const [snapRes, runRes] = await Promise.all([
    supabase
      .from("quickbooks_report_snapshots")
      .select(
        "id, report_type, period_start, period_end, accounting_method, report_basis, row_count, checksum, status, fetched_at, source_generated_at, sync_run_id",
      )
      .eq("business_id", businessId)
      .order("fetched_at", { ascending: false })
      .limit(400),
    supabase
      .from("quickbooks_sync_runs")
      .select(
        "id, status, started_at, completed_at, successful_count, failed_count, error_codes, results",
      )
      .eq("business_id", businessId)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);
  return {
    businessId,
    connection,
    snapshots: (snapRes.data ?? []).map((r) => ({
      id: r.id,
      reportType: r.report_type,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      accountingMethod: r.accounting_method,
      reportBasis: r.report_basis,
      rowCount: r.row_count,
      checksum: r.checksum,
      status: r.status ?? "synced",
      fetchedAt: r.fetched_at,
      sourceGeneratedAt: r.source_generated_at,
      syncRunId: r.sync_run_id,
    })),
    runs: (runRes.data ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      successfulCount: r.successful_count,
      failedCount: r.failed_count,
      errorCodes: r.error_codes ?? [],
      results: sanitizeManifest(r.results),
    })),
  };
}

export interface SnapshotDetail extends VaultSnapshotMeta {
  rawPayload: unknown;
}

export async function loadSnapshotById(id: string): Promise<SnapshotDetail | null> {
  const { data, error } = await supabase
    .from("quickbooks_report_snapshots")
    .select(
      "id, report_type, period_start, period_end, accounting_method, report_basis, row_count, checksum, status, fetched_at, source_generated_at, sync_run_id, raw_payload",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    reportType: data.report_type,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    accountingMethod: data.accounting_method,
    reportBasis: data.report_basis,
    rowCount: data.row_count,
    checksum: data.checksum,
    status: data.status ?? "synced",
    fetchedAt: data.fetched_at,
    sourceGeneratedAt: data.source_generated_at,
    syncRunId: data.sync_run_id,
    rawPayload: data.raw_payload,
  };
}

// ============ Real P&L normalization for Financial Review ============

export interface RealPnLSummary {
  snapshotId: string;
  periodStart: string | null;
  periodEnd: string | null;
  basis: string | null;
  currency: string;
  fetchedAt: string | null;
  checksum: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  netIncome: number | null;
  matched: {
    revenue?: string;
    grossProfit?: string;
    operatingExpenses?: string;
    netIncome?: string;
  };
}

const YEAR_MS = 300 * 24 * 60 * 60 * 1000;

/**
 * Latest synced Profit & Loss, normalized. Prefers a ~12-month completed
 * fiscal year over YTD slices. Returns null when no P&L snapshot exists —
 * callers must fall back to clearly-labelled sample/manual modes.
 */
export async function loadLatestAnnualPnL(): Promise<RealPnLSummary | null> {
  const businessId = await currentSellerBusinessId();
  if (!businessId) return null;
  const { data } = await supabase
    .from("quickbooks_report_snapshots")
    .select("id, period_start, period_end, report_basis, accounting_method, fetched_at, checksum, raw_payload")
    .eq("business_id", businessId)
    .eq("report_type", "profit_and_loss")
    .order("period_end", { ascending: false })
    .limit(12);
  const rows = data ?? [];
  const annual = rows.find(
    (r) =>
      r.period_start &&
      r.period_end &&
      Date.parse(r.period_end) - Date.parse(r.period_start) >= YEAR_MS,
  );
  const pick = annual ?? rows[0];
  if (!pick) return null;
  const parsed = parseReport(pick.raw_payload);
  if (!parsed) return null;
  const norm = normalizePnL(parsed);
  return {
    snapshotId: pick.id,
    periodStart: pick.period_start,
    periodEnd: pick.period_end,
    basis: pick.report_basis ?? pick.accounting_method,
    currency: norm.currency,
    fetchedAt: pick.fetched_at,
    checksum: pick.checksum,
    revenue: norm.revenue,
    grossProfit: norm.grossProfit,
    operatingExpenses: norm.operatingExpenses,
    netIncome: norm.netIncome,
    matched: norm.matched,
  };
}
