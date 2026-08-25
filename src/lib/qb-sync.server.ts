// Server-only QuickBooks Online client and financial sync engine.
// Never import this file from browser code.
//
// Architecture (deterministic truth layer — AI comes after, never before):
//   Acquire → Preserve → Parse → Validate → Normalize → Persist
// Every QuickBooks response is stored byte-immutable (raw_payload + checksum)
// and never rewritten. Normalization lives in normalized_payload only.
//
// Token storage model (project constraint: no new edge functions):
//   1. `supabase.rpc('service_qb_*')` with the authenticated session —
//      service-role bridge functions are locked to service_role only, so this
//      legitimately returns 401 under RLS.
//   2. Fallback: `supabaseAdmin` (service-role) — server-only, identical to
//      the runtime every Supabase Edge Function uses.

import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  buildReportRequests,
  companyInfoRequest,
  type SnapshotLifecycle,
  type SyncReportRequest,
  type SyncResultItem,
  type SyncRunResult,
} from "./qb-report-plan";
import {
  PARSER_VERSION,
  parseReport,
  reportHeaderMeta,
  reportRowCount,
} from "./qb-report";
import { validateReport, type ValidationResult } from "./qb-validate";

// Intuit's public discovery document for its OAuth endpoints.
const INTUIT_DISCOVERY_URL =
  "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration";

const QBO_HOSTS: Record<string, string> = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

function qboBaseUrl(environment: string): string {
  return QBO_HOSTS[environment === "production" ? "production" : "sandbox"];
}

export class SyncError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number | null = null,
    readonly intuitCode: string | null = null,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

interface StoredTokenBundle {
  realmId: string;
  environment: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

// ---------- Vault access (service-role bridge, then admin fallback) ----------

async function adminClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function vaultRead(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  secretId: string,
): Promise<StoredTokenBundle | null> {
  const { data, error } = await supabase.rpc("service_qb_get_token_secret", {
    _secret_id: secretId,
  });
  if (!error && data) return data as StoredTokenBundle;
  const admin = await adminClient();
  if (!admin) return null;
  const res = await admin.rpc("service_qb_get_token_secret", { _secret_id: secretId });
  if (res.error || !res.data) return null;
  return res.data as StoredTokenBundle;
}

async function vaultWrite(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  secretId: string,
  bundle: StoredTokenBundle,
): Promise<void> {
  const { error } = await supabase.rpc("service_qb_update_token_secret", {
    _secret_id: secretId,
    _bundle: bundle,
  });
  if (!error) return;
  const admin = await adminClient();
  if (!admin) throw new SyncError("vault_unavailable", "Cannot reach the token vault");
  const res = await admin.rpc("service_qb_update_token_secret", {
    _secret_id: secretId,
    _bundle: bundle,
  });
  if (res.error) throw new SyncError("vault_unavailable", res.error.message);
}

// ---------- Token refresh ----------

async function intuitTokenEndpoint(environment: string): Promise<string> {
  if (environment === "production") {
    const res = await fetch(INTUIT_DISCOVERY_URL);
    if (res.ok) {
      const doc = (await res.json()) as { token_endpoint?: string };
      if (doc.token_endpoint) return doc.token_endpoint;
    }
  }
  return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
}

async function refreshTokens(bundle: StoredTokenBundle): Promise<StoredTokenBundle> {
  const clientId = process.env["INTUIT_CLIENT_ID"];
  const clientSecret = process.env["INTUIT_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new SyncError("intuit_not_configured", "Intuit app credentials are missing");
  }
  const endpoint = await intuitTokenEndpoint(bundle.environment);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: bundle.refreshToken,
    }),
  });
  if (!res.ok) {
    throw new SyncError("token_refresh_failed", "QuickBooks session could not be refreshed", res.status);
  }
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };
  return {
    ...bundle,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(
      Date.now() + tokens.x_refresh_token_expires_in * 1000,
    ).toISOString(),
  };
}

// ---------- QuickBooks API ----------

interface QbApiResult {
  payload: unknown;
  httpStatus: number;
}

/**
 * GET a QuickBooks path. `requestPath` is the planner-built path including
 * any query string (e.g. `/reports/ProfitAndLoss?start_date=...`).
 */
async function quickbooksGet(
  bundle: StoredTokenBundle,
  requestPath: string,
  accessToken: string,
): Promise<QbApiResult> {
  const base = `${qboBaseUrl(bundle.environment)}/v3/company/${bundle.realmId}`;
  const url = new URL(`${base}${requestPath.startsWith("/") ? requestPath : `/${requestPath}`}`);
  url.searchParams.set("minorversion", process.env["QUICKBOOKS_MINOR_VERSION"] ?? "75");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      let intuitCode: string | null = null;
      try {
        const fault = (await res.json()) as {
          Fault?: { Error?: Array<{ code?: string }> };
        };
        intuitCode = fault.Fault?.Error?.[0]?.code ?? null;
      } catch {
        /* non-JSON fault body */
      }
      throw new SyncError(
        "quickbooks_request_failed",
        `QuickBooks API returned ${res.status}`,
        res.status,
        intuitCode,
      );
    }
    return { payload: await res.json(), httpStatus: res.status };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Helpers ----------

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sanitized persistence error detail: PostgREST/PG code + message class. Never raw payload data. */
function persistErrorDetail(err: { code?: string; message?: string }): string {
  const code = err.code ?? "unknown";
  const message = (err.message ?? "unknown error").slice(0, 200);
  return `${code}: ${message}`;
}

function deriveLifecycle(
  parsed: ReturnType<typeof parseReport>,
  validation: ValidationResult | null,
): SnapshotLifecycle {
  if (!parsed) return "parse_failed";
  const dataRows = parsed.rows.filter((r) => r.rowType === "data").length;
  if (parsed.noReportData || dataRows === 0) return "empty_source";
  if (!validation || validation.checks.length === 0) return "parsed"; // no validator for this report type
  if (validation.overall === "fail") return "validation_failed";
  if (validation.overall === "pass") return "ready";
  return "validated"; // checks ran but were not comparable
}

// ---------- Public API ----------

export interface QbConnectionRow {
  id: string;
  seller_id: string;
  business_id: string | null;
  realm_id: string;
  environment: string;
  company_name: string | null;
  status: string;
  token_secret_id: string | null;
}

export async function listConnectionsForSeller(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  },
  userId: string,
): Promise<QbConnectionRow[]> {
  const { data, error } = await supabase
    .from("quickbooks_connections")
    .select("id, seller_id, business_id, realm_id, environment, company_name, status, token_secret_id")
    .eq("seller_id", userId);
  if (error) throw new SyncError("connection_lookup_failed", error.message);
  return (data as QbConnectionRow[]) ?? [];
}

export async function fetchCompanyInfoForConnection(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  connection: QbConnectionRow,
): Promise<{ companyName: string | null; legalName: string | null; country: string | null }> {
  if (!connection.token_secret_id) throw new SyncError("no_token", "Connection has no stored token");
  const bundle = await vaultRead(supabase, connection.token_secret_id);
  if (!bundle) throw new SyncError("vault_unavailable", "Stored QuickBooks token is not accessible");

  let token = bundle.accessToken;
  if (new Date(bundle.accessTokenExpiresAt).getTime() - Date.now() < 120_000) {
    const refreshed = await refreshTokens(bundle);
    await vaultWrite(supabase, connection.token_secret_id, refreshed);
    token = refreshed.accessToken;
    bundle.realmId = refreshed.realmId;
  }

  const req = companyInfoRequest(bundle.realmId);
  const { payload } = await quickbooksGet(bundle, req.path, token);
  const info = (payload as { CompanyInfo?: Record<string, string> }).CompanyInfo ?? {};
  return {
    companyName: info.CompanyName ?? null,
    legalName: info.LegalName ?? null,
    country: info.Country ?? null,
  };
}

/**
 * Run the full financial sync for one connection:
 * plan → fetch → parse → validate → normalize → persist snapshots + manifest.
 */
export async function syncConnectionFinancials(
  supabase: {
    from: (table: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  },
  connection: QbConnectionRow,
): Promise<SyncRunResult> {
  const correlationId = randomUUID();
  if (!connection.business_id) throw new SyncError("no_business", "Connection is not linked to a business");
  if (!connection.token_secret_id) throw new SyncError("no_token", "Connection has no stored token");

  // 1. Resolve a valid access token (refresh when near expiry).
  let bundle = await vaultRead(supabase, connection.token_secret_id);
  if (!bundle) throw new SyncError("vault_unavailable", "Stored QuickBooks token is not accessible");
  if (new Date(bundle.accessTokenExpiresAt).getTime() - Date.now() < 120_000) {
    bundle = await refreshTokens(bundle);
    await vaultWrite(supabase, connection.token_secret_id, bundle);
  }

  // 2. CompanyInfo — fiscal-year input. CompanyStartDate is informational
  //    metadata only; it is NOT a hard cutoff for available history.
  const manifest: SyncResultItem[] = [];
  let companyName: string | null = connection.company_name;
  let fiscalYearStartMonth = 1;
  const ciReq = companyInfoRequest(bundle.realmId);
  try {
    const ci = await quickbooksGet(bundle, ciReq.path, bundle.accessToken);
    const companyInfo = ((ci.payload as { CompanyInfo?: Record<string, unknown> }).CompanyInfo ??
      {}) as Record<string, unknown>;
    companyName = (companyInfo["CompanyName"] as string) ?? companyName;
    fiscalYearStartMonth = Number(companyInfo["FiscalYearStartMonth"] ?? 1) || 1;
    manifest.push({
      reportType: ciReq.reportType,
      label: ciReq.label,
      path: ciReq.path,
      periodStart: null,
      periodEnd: null,
      status: "retrieved",
      httpStatus: ci.httpStatus,
    });
  } catch (err) {
    const se = err instanceof SyncError ? err : null;
    manifest.push({
      reportType: ciReq.reportType,
      label: ciReq.label,
      path: ciReq.path,
      periodStart: null,
      periodEnd: null,
      status: "api_failed",
      httpStatus: se?.httpStatus ?? null,
      intuitErrorCode: se?.intuitCode ?? null,
      errorCode: se?.code ?? "unknown_error",
    });
  }

  // 3. History-aware planning: skip periods whose prior snapshot was
  //    persistently empty (QuickBooks has no data there). Meaningful-history
  //    discovery comes from real snapshots, not from CompanyStartDate.
  const prior = await supabase
    .from("quickbooks_report_snapshots")
    .select("report_type, period_start, period_end, status")
    .eq("business_id", connection.business_id)
    .in("status", ["empty_source"]);
  const emptyPeriods = (prior.data ?? []) as Array<{
    report_type: string;
    period_start: string | null;
    period_end: string | null;
  }>;

  const requests: SyncReportRequest[] = buildReportRequests(new Date(), fiscalYearStartMonth)
    .filter(
      (r) =>
        !emptyPeriods.some(
          (e) =>
            e.report_type === r.reportType &&
            e.period_start === r.periodStart &&
            e.period_end === r.periodEnd,
        ),
    );

  // 4. Create the sync run row.
  const admin = await adminClient();
  const writer = admin ?? supabase;
  const runIns = await writer
    .from("quickbooks_sync_runs")
    .insert({
      seller_id: connection.seller_id,
      business_id: connection.business_id,
      connection_id: connection.id,
      status: "running",
      requested_report_types: requests.map((r) => r.reportType),
    })
    .select("id")
    .single();
  const syncRunId = (runIns.data as { id: string } | null)?.id ?? null;
  if (!syncRunId) {
    throw new SyncError(
      "sync_run_insert_failed",
      runIns.error?.message ?? "Could not create the sync run record",
    );
  }

  // 5. Execute each request: Acquire → Parse → Validate → Preserve/Persist.
  let success = 0;
  let failed = 0;
  const errorCodes: string[] = [];
  let discoveredHistoryEarliest: string | null = null;

  for (const req of requests) {
    const entry: SyncResultItem = {
      reportType: req.reportType,
      label: req.label,
      path: req.path,
      periodStart: req.periodStart,
      periodEnd: req.periodEnd,
      status: "requested",
    };
    manifest.push(entry);

    // Acquire
    let apiResult: QbApiResult;
    try {
      apiResult = await quickbooksGet(bundle, req.path, bundle.accessToken);
      entry.httpStatus = apiResult.httpStatus;
    } catch (err) {
      const se = err instanceof SyncError ? err : null;
      entry.status = "api_failed";
      entry.httpStatus = se?.httpStatus ?? null;
      entry.intuitErrorCode = se?.intuitCode ?? null;
      entry.errorCode = se?.code ?? "network_error";
      failed += 1;
      errorCodes.push(entry.errorCode);
      continue;
    }

    // Parse + Validate
    const parsed = parseReport(apiResult.payload);
    entry.rowCount = reportRowCount(apiResult.payload);
    const validation = parsed ? validateReport(req.reportType, parsed) : null;
    entry.status = deriveLifecycle(parsed, validation);

    // Preserve (byte-immutable) + Persist
    try {
      const rawJson = JSON.stringify(apiResult.payload ?? {});
      const checksum = await sha256Hex(rawJson);
      entry.checksum = checksum;
      const meta = reportHeaderMeta(apiResult.payload);
      const snapshot = {
        connection_id: connection.id,
        business_id: connection.business_id,
        sync_run_id: syncRunId,
        report_type: req.reportType,
        period_start: req.periodStart,
        period_end: req.periodEnd,
        accounting_method: req.accountingMethod,
        raw_payload: apiResult.payload ?? {},
        normalized_payload: {
          parser_version: PARSER_VERSION,
          parsed_at: new Date().toISOString(),
          meta,
          columns: parsed?.columns ?? [],
          rows: parsed?.rows ?? [],
          validation,
        },
        report_basis: meta.report_basis ?? req.accountingMethod,
        source_generated_at: meta.source_time,
        row_count: entry.rowCount,
        checksum,
        status: entry.status,
      };
      const ins = await writer
        .from("quickbooks_report_snapshots")
        .insert(snapshot)
        .select("id")
        .single();
      if (ins.error) {
        entry.status = "persistence_failed";
        entry.errorCode = "snapshot_insert_failed";
        entry.errorDetail = persistErrorDetail(ins.error);
        failed += 1;
        errorCodes.push(`${entry.errorCode}:${ins.error.code ?? "unknown"}`);
        continue;
      }
      entry.snapshotId = (ins.data as { id: string } | null)?.id ?? null;
      success += 1;
      // History discovery: track the earliest period that actually yielded data.
      if (entry.status !== "empty_source" && entry.status !== "parse_failed") {
        const end = entry.periodEnd;
        if (end && (!discoveredHistoryEarliest || end < discoveredHistoryEarliest)) {
          discoveredHistoryEarliest = end;
        }
      }
    } catch (err) {
      entry.status = "persistence_failed";
      entry.errorCode = "snapshot_insert_failed";
      entry.errorDetail = err instanceof Error ? err.message.slice(0, 200) : "unknown";
      failed += 1;
      errorCodes.push(entry.errorCode);
    }
  }

  // 6. Finalize the run with its full per-request manifest.
  const runStatus = failed === 0 ? "completed" : success > 0 ? "partial" : "failed";
  await writer
    .from("quickbooks_sync_runs")
    .update({
      status: runStatus,
      successful_count: success,
      failed_count: failed,
      error_codes: errorCodes,
      results: manifest,
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", syncRunId);

  // 7. Update connection bookkeeping.
  await writer
    .from("quickbooks_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_error: failed > 0 ? errorCodes.join(",") : null,
      company_name: companyName,
    })
    .eq("id", connection.id);

  return {
    syncRunId,
    status: runStatus,
    successfulCount: success,
    failedCount: failed,
    results: manifest,
    discoveredHistoryEarliest,
    lastSyncedAt: new Date().toISOString(),
    correlationId,
  };
}

/**
 * Re-run the current parser over existing snapshots in place. Updates
 * normalized_payload, row_count, and lifecycle status ONLY — raw_payload,
 * checksum, and fetched_at are immutable and never touched.
 */
export async function reparseStoredSnapshots(
  supabase: {
    from: (table: string) => any;
  },
  userId: string,
): Promise<{ reparsed: number; unchanged: number; failed: number }> {
  const admin = await adminClient();
  const writer = admin ?? supabase;

  const businesses = await supabase
    .from("businesses")
    .select("id")
    .eq("seller_id", userId);
  const businessIds = ((businesses.data ?? []) as Array<{ id: string }>).map((b) => b.id);
  if (businessIds.length === 0) return { reparsed: 0, unchanged: 0, failed: 0 };

  const snaps = await supabase
    .from("quickbooks_report_snapshots")
    .select("id, report_type, raw_payload, normalized_payload")
    .in("business_id", businessIds);

  let reparsed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const snap of (snaps.data ?? []) as Array<{
    id: string;
    report_type: string;
    raw_payload: unknown;
    normalized_payload: { parser_version?: string } | null;
  }>) {
    if (snap.normalized_payload?.parser_version === PARSER_VERSION) {
      unchanged += 1;
      continue;
    }
    try {
      const parsed = parseReport(snap.raw_payload);
      const validation = parsed ? validateReport(snap.report_type, parsed) : null;
      const status = deriveLifecycle(parsed, validation);
      const meta = reportHeaderMeta(snap.raw_payload);
      const upd = await writer
        .from("quickbooks_report_snapshots")
        .update({
          normalized_payload: {
            parser_version: PARSER_VERSION,
            parsed_at: new Date().toISOString(),
            meta,
            columns: parsed?.columns ?? [],
            rows: parsed?.rows ?? [],
            validation,
          },
          row_count: reportRowCount(snap.raw_payload),
          report_basis: meta.report_basis,
          status,
        } as never)
        .eq("id", snap.id);
      if (upd.error) failed += 1;
      else reparsed += 1;
    } catch {
      failed += 1;
    }
  }
  return { reparsed, unchanged, failed };
}
