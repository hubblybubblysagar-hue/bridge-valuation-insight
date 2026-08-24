// Server-only QuickBooks financial sync engine.
//
// Worker-runtime safe: uses fetch + Web Crypto only. All privileged work
// (Vault token access, sync-run bookkeeping, snapshot inserts) goes through
// the service-role admin client AFTER the caller has been authenticated and
// role-checked by the caller (qb-sync.functions.ts + requireSupabaseAuth).
//
// Token material, realm ids, auth codes, and client secrets are never
// returned, logged, or included in error messages — only safe error codes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  buildReportRequests,
  fiscalYearStartMonthFromCompanyInfo,
  SYNC_REPORT_TYPES,
  type SyncReportType,
  type SyncResultItem,
  type SyncRunResult,
} from "./qb-report-plan";
import { reportHeaderMeta, reportRowCount } from "./qb-report";

type Admin = SupabaseClient<Database>;

export const SYNC_ERROR = {
  unauthorized: "unauthorized",
  forbiddenRole: "forbidden_role",
  noConnection: "no_connection",
  noBusiness: "no_business",
  connectionNotActive: "connection_not_active",
  configNotConfigured: "config_not_configured",
  tokenVaultReadFailed: "token_vault_read_failed",
  tokenVaultUpdateFailed: "token_vault_update_failed",
  tokenRefreshFailed: "token_refresh_failed",
  syncRunCreateFailed: "sync_run_create_failed",
  reportFetchFailed: "report_fetch_failed",
  snapshotInsertFailed: "snapshot_insert_failed",
} as const;

export type SyncErrorCode = (typeof SYNC_ERROR)[keyof typeof SYNC_ERROR];

export class SyncError extends Error {
  readonly code: SyncErrorCode;
  constructor(code: SyncErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

function toErrorCode(e: unknown, fallback: SyncErrorCode): SyncErrorCode {
  return e instanceof SyncError ? e.code : fallback;
}

// Whitelisted structured logging — never tokens, codes, or secrets.
function logSafe(event: Record<string, unknown>): void {
  const allow = new Set([
    "correlation_id",
    "action",
    "seller_id",
    "connection_id",
    "sync_run_id",
    "report_type",
    "realm_masked",
    "status",
    "intuit_status",
    "successful_count",
    "failed_count",
    "error_code",
  ]);
  const clean: Record<string, unknown> = { ts: new Date().toISOString() };
  for (const [k, v] of Object.entries(event)) {
    if (allow.has(k)) clean[k] = v;
  }
  console.log(JSON.stringify(clean));
}

function maskRealm(realm: string | null | undefined): string {
  if (!realm) return "";
  return realm.length <= 4 ? "****" : `****${realm.slice(-4)}`;
}

interface SyncConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  minorVersion: string;
}

function loadSyncConfig(): SyncConfig {
  const clientId = process.env.INTUIT_CLIENT_ID;
  const clientSecret = process.env.INTUIT_CLIENT_SECRET;
  const minorVersion = process.env.QUICKBOOKS_MINOR_VERSION ?? "75";
  if (!clientId || !clientSecret) throw new SyncError(SYNC_ERROR.configNotConfigured);
  return {
    clientId,
    clientSecret,
    environment: process.env.INTUIT_ENVIRONMENT === "production" ? "production" : "sandbox",
    minorVersion,
  };
}

function apiBaseUrl(env: "sandbox" | "production"): string {
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

const OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  issued_at: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============ Vault + token lifecycle ============

type StoredConnection = Database["public"]["Tables"]["quickbooks_connections"]["Row"];

async function getTokenBundle(admin: Admin, secretId: string): Promise<TokenBundle | null> {
  const { data, error } = await admin.rpc("service_qb_get_token_secret" as never, {
    _secret_id: secretId,
  } as never);
  if (error) throw new SyncError(SYNC_ERROR.tokenVaultReadFailed);
  if (!data) return null;
  return typeof data === "string" ? (JSON.parse(data) as TokenBundle) : (data as TokenBundle);
}

async function updateTokenSecret(admin: Admin, secretId: string, bundle: TokenBundle): Promise<void> {
  const { error } = await admin.rpc("service_qb_update_token_secret" as never, {
    _secret_id: secretId,
    _bundle: bundle as unknown as Record<string, unknown>,
  } as never);
  if (error) throw new SyncError(SYNC_ERROR.tokenVaultUpdateFailed);
}

async function refreshTokenBundle(cfg: SyncConfig, refreshToken: string): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${cfg.clientId}:${cfg.clientSecret}`),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new SyncError(SYNC_ERROR.tokenRefreshFailed, `status ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };
  const now = Date.now();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    token_type: json.token_type ?? "bearer",
    access_token_expires_at: new Date(now + json.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + json.x_refresh_token_expires_in * 1000).toISOString(),
    issued_at: new Date(now).toISOString(),
  };
}

/** Refresh the access token when it expires within 5 minutes; persist the new bundle. */
async function ensureFreshAccess(
  admin: Admin,
  cfg: SyncConfig,
  conn: StoredConnection,
): Promise<TokenBundle> {
  if (!conn.token_secret_id) throw new SyncError(SYNC_ERROR.tokenVaultReadFailed);
  const bundle = await getTokenBundle(admin, conn.token_secret_id);
  if (!bundle) throw new SyncError(SYNC_ERROR.tokenVaultReadFailed);
  const exp = Date.parse(bundle.access_token_expires_at);
  if (exp - Date.now() > 5 * 60 * 1000) return bundle;
  const fresh = await refreshTokenBundle(cfg, bundle.refresh_token);
  await updateTokenSecret(admin, conn.token_secret_id, fresh);
  await admin
    .from("quickbooks_connections")
    .update({
      access_token_expires_at: fresh.access_token_expires_at,
      refresh_token_expires_at: fresh.refresh_token_expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);
  return fresh;
}

// ============ Read-only QuickBooks Data API ============

async function quickbooksGet(
  cfg: SyncConfig,
  accessToken: string,
  realmId: string,
  path: string,
): Promise<unknown> {
  if (!path.startsWith("/")) path = "/" + path;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${apiBaseUrl(cfg.environment)}/v3/company/${realmId}${path}${sep}minorversion=${cfg.minorVersion}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new SyncError(SYNC_ERROR.reportFetchFailed, `status ${res.status}`);
  return res.json();
}

// ============ Sync orchestration ============

/**
 * Run the read-only financial sync for an authenticated seller.
 * `userId` must come from a verified session (requireSupabaseAuth).
 */
export async function runFinancialSync(
  userId: string,
  userClient: SupabaseClient<Database>,
  reportTypes: string[] | null,
): Promise<SyncRunResult> {
  const cid = crypto.randomUUID();
  const cfg = loadSyncConfig();

  // Role check with the caller's own RLS-scoped client.
  const { data: profile } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.role !== "seller") {
    throw new SyncError(SYNC_ERROR.forbiddenRole);
  }

  const requested = (
    reportTypes && reportTypes.length > 0
      ? SYNC_REPORT_TYPES.filter((t) => reportTypes.includes(t))
      : [...SYNC_REPORT_TYPES]
  ) as SyncReportType[];
  if (requested.length === 0) throw new SyncError(SYNC_ERROR.reportFetchFailed);

  const admin = supabaseAdmin;
  const { data: conn } = await admin
    .from("quickbooks_connections")
    .select("*")
    .eq("seller_id", userId)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!conn) throw new SyncError(SYNC_ERROR.noConnection);
  if (conn.status !== "connected" || !conn.token_secret_id) {
    throw new SyncError(SYNC_ERROR.connectionNotActive);
  }
  if (!conn.business_id) throw new SyncError(SYNC_ERROR.noBusiness);

  // Auditable sync run.
  const { data: run, error: runErr } = await admin
    .from("quickbooks_sync_runs")
    .insert({
      seller_id: userId,
      business_id: conn.business_id,
      connection_id: conn.id,
      status: "running",
      requested_report_types: requested,
    })
    .select("id")
    .single();
  if (runErr || !run) throw new SyncError(SYNC_ERROR.syncRunCreateFailed);
  const syncRunId = run.id;

  try {
    // Fiscal-year basis from the stored company_info snapshot.
    const { data: ciSnap } = await admin
      .from("quickbooks_report_snapshots")
      .select("raw_payload")
      .eq("business_id", conn.business_id)
      .eq("report_type", "company_info")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fyStartMonth = fiscalYearStartMonthFromCompanyInfo(ciSnap?.raw_payload ?? null);

    const bundle = await ensureFreshAccess(admin, cfg, conn);
    const requests = buildReportRequests(new Date(), fyStartMonth).filter((r) =>
      requested.includes(r.reportType),
    );

    let successful = 0;
    let failed = 0;
    const errorCodes = new Set<string>();
    const results: SyncResultItem[] = [];

    for (const r of requests) {
      try {
        const payload = await quickbooksGet(cfg, bundle.access_token, conn.realm_id, r.path);
        const meta = reportHeaderMeta(payload);
        const checksum = await sha256Hex(JSON.stringify(payload));
        const { error: insErr } = await admin.from("quickbooks_report_snapshots").insert({
          connection_id: conn.id,
          business_id: conn.business_id,
          sync_run_id: syncRunId,
          report_type: r.reportType,
          period_start: r.periodStart,
          period_end: r.periodEnd,
          accounting_method: r.accountingMethod,
          report_basis: meta.report_basis ?? r.accountingMethod,
          raw_payload: payload as unknown as Json,
          normalized_payload: meta as unknown as Json,
          source_generated_at: meta.source_time,
          row_count: reportRowCount(payload),
          checksum,
          status: "synced",
          fetched_at: new Date().toISOString(),
        });
        if (insErr) {
          failed += 1;
          errorCodes.add(SYNC_ERROR.snapshotInsertFailed);
          results.push({
            reportType: r.reportType,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            status: "failed",
            errorCode: SYNC_ERROR.snapshotInsertFailed,
          });
          continue;
        }
        successful += 1;
        results.push({
          reportType: r.reportType,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          status: "synced",
          checksum,
        });
      } catch (e) {
        failed += 1;
        const code = toErrorCode(e, SYNC_ERROR.reportFetchFailed);
        errorCodes.add(code);
        results.push({
          reportType: r.reportType,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          status: "failed",
          errorCode: code,
        });
        logSafe({
          correlation_id: cid,
          action: "sync_report",
          sync_run_id: syncRunId,
          report_type: r.reportType,
          error_code: code,
        });
      }
    }

    const status = failed === 0 ? "completed" : successful > 0 ? "partial" : "failed";
    const completedAt = new Date().toISOString();
    await admin
      .from("quickbooks_sync_runs")
      .update({
        status,
        successful_count: successful,
        failed_count: failed,
        error_codes: Array.from(errorCodes),
        completed_at: completedAt,
      })
      .eq("id", syncRunId);

    await admin
      .from("quickbooks_connections")
      .update({
        last_synced_at: successful > 0 ? completedAt : conn.last_synced_at,
        last_error: failed === 0 ? null : `${Array.from(errorCodes)[0]}:${cid}`,
        updated_at: completedAt,
      })
      .eq("id", conn.id);

    logSafe({
      correlation_id: cid,
      action: "sync_financials",
      seller_id: userId,
      connection_id: conn.id,
      sync_run_id: syncRunId,
      realm_masked: maskRealm(conn.realm_id),
      status,
      successful_count: successful,
      failed_count: failed,
    });

    return {
      syncRunId,
      status,
      successfulCount: successful,
      failedCount: failed,
      results,
      lastSyncedAt: successful > 0 ? completedAt : conn.last_synced_at,
      correlationId: cid,
    };
  } catch (e) {
    const code = toErrorCode(e, SYNC_ERROR.reportFetchFailed);
    await admin
      .from("quickbooks_sync_runs")
      .update({ status: "failed", error_codes: [code], completed_at: new Date().toISOString() })
      .eq("id", syncRunId);
    await admin
      .from("quickbooks_connections")
      .update({ last_error: `${code}:${cid}` })
      .eq("id", conn.id);
    logSafe({ correlation_id: cid, action: "sync_financials", sync_run_id: syncRunId, error_code: code });
    throw e instanceof SyncError ? e : new SyncError(code);
  }
}
