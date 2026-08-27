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
  narrowerPeriodRequest,
  sourceKindFor,
  type SnapshotLifecycle,
  type SyncReportRequest,
  type SyncResultItem,
  type SyncRunResult,
} from "./qb-report-plan";
import {
  PARSER_VERSION,
  financialRowCount,
  parseEntityQuery,
  parseReport,
  reportHeaderMeta,
  reportRowCount,
  sourceFault,
  structuralNodeCount,
} from "./qb-report";
import {
  availabilityFromLifecycle,
  parserFor,
  privacyTierFor,
  sourceTitleFor,
  type SourceAvailability,
} from "./qb-source-registry";
import { validateReport, type ValidationResult } from "./qb-validate";

/**
 * Intuit migrates the Reports APIs to its modernized reporting service on
 * 2026-08-31. Setting QUICKBOOKS_REPORTS_TESTING_MIGRATION=true adds Intuit's
 * documented temporary `testing_migration` parameter to every /reports/*
 * request so ExitBridge can exercise the new responses before the cutover.
 */
function reportsApiGeneration(): "classic" | "modernized" {
  return (process.env["QUICKBOOKS_REPORTS_TESTING_MIGRATION"] ?? "").toLowerCase() === "true"
    ? "modernized"
    : "classic";
}



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

/**
 * Token bundles are written to the vault by the OAuth edge functions in
 * snake_case (`access_token`, `refresh_token`, `access_token_expires_at`) and
 * carry no realm/environment — those live on the connection row. Reading them
 * as camelCase yielded `undefined` tokens and `/companyinfo/undefined` paths
 * (the Aug 26 mass-401). Both casings are accepted; snake_case is written.
 */
interface StoredTokenBundle {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  [key: string]: unknown;
}

/** Everything an API call needs: realm + environment come from the connection. */
interface QbContext {
  realmId: string;
  environment: string;
  accessToken: string;
}

function pick(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v !== "") return v;
  }
  return "";
}

function normalizeBundle(raw: unknown): StoredTokenBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const access = pick(r, "access_token", "accessToken");
  const refresh = pick(r, "refresh_token", "refreshToken");
  if (!access || !refresh) return null;
  return {
    ...r,
    access_token: access,
    refresh_token: refresh,
    access_token_expires_at: pick(r, "access_token_expires_at", "accessTokenExpiresAt"),
    refresh_token_expires_at: pick(r, "refresh_token_expires_at", "refreshTokenExpiresAt"),
  };
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
  if (!error && data) return normalizeBundle(data);
  const admin = await adminClient();
  if (!admin) return null;
  const res = await admin.rpc("service_qb_get_token_secret", { _secret_id: secretId });
  if (res.error || !res.data) return null;
  return normalizeBundle(res.data);

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

async function refreshTokens(
  bundle: StoredTokenBundle,
  environment: string,
): Promise<StoredTokenBundle> {
  const clientId = process.env["INTUIT_CLIENT_ID"];
  const clientSecret = process.env["INTUIT_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new SyncError("intuit_not_configured", "Intuit app credentials are missing");
  }
  const endpoint = await intuitTokenEndpoint(environment);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: bundle.refresh_token,
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
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: "bearer",
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(
      Date.now() + tokens.x_refresh_token_expires_in * 1000,
    ).toISOString(),
  };
}

// ---------- QuickBooks API ----------

interface QbApiResult {
  payload: unknown;
  httpStatus: number;
  attempts: number;
}

/** Transient conditions worth a bounded retry. Auth/permission errors are not. */
function isTransientStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

const RETRY_BACKOFF_MS = [400, 1200];

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * GET a QuickBooks path with bounded retries. `requestPath` is the
 * planner-built path including any query string. Retries apply to network
 * errors, 429/5xx, and Intuit SystemFaults returned with a 200 body — those
 * are intermittent sandbox failures, not data problems.
 */
async function quickbooksGet(
  ctx: QbContext,
  requestPath: string,
  maxAttempts = 3,
): Promise<QbApiResult> {
  if (!ctx.realmId) {
    throw new SyncError("missing_realm", "Connection is missing its QuickBooks realm id");
  }
  if (!ctx.accessToken) {
    throw new SyncError("missing_access_token", "Stored QuickBooks token is unreadable");
  }
  const base = `${qboBaseUrl(ctx.environment)}/v3/company/${ctx.realmId}`;
  const url = new URL(`${base}${requestPath.startsWith("/") ? requestPath : `/${requestPath}`}`);
  url.searchParams.set("minorversion", process.env["QUICKBOOKS_MINOR_VERSION"] ?? "75");
  if (reportsApiGeneration() === "modernized" && requestPath.includes("/reports/")) {
    url.searchParams.set("testing_migration", "true");
  }


  let lastError: SyncError = new SyncError("network_error", "QuickBooks request failed");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${ctx.accessToken}`, Accept: "application/json" },
        signal: controller.signal,
      });
      const text = await res.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const fault = sourceFault(payload);
        lastError = new SyncError(
          "quickbooks_request_failed",
          `QuickBooks API returned ${res.status}`,
          res.status,
          fault?.code ?? null,
        );
        if (isTransientStatus(res.status) && attempt < maxAttempts) {
          await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 1200);
          continue;
        }
        throw lastError;
      }

      // A 200 can still carry a Fault (sandbox SystemFault/NullPointerException).
      const fault = sourceFault(payload);
      if (fault) {
        lastError = new SyncError(
          "quickbooks_source_fault",
          fault.detail ?? "QuickBooks returned a fault for this report",
          res.status,
          fault.code,
        );
        if (attempt < maxAttempts) {
          await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 1200);
          continue;
        }
        throw lastError;
      }

      return { payload, httpStatus: res.status, attempts: attempt };
    } catch (err) {
      if (err instanceof SyncError) {
        lastError = err;
        if (attempt >= maxAttempts) throw err;
        if (err.code === "quickbooks_source_fault" || isTransientStatus(err.httpStatus ?? 0)) {
          continue;
        }
        throw err;
      }
      lastError = new SyncError("network_error", "QuickBooks request failed");
      if (attempt >= maxAttempts) throw lastError;
      await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 1200);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
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
  payload?: unknown,
): SnapshotLifecycle {
  // A source fault is an API failure, never a parse failure.
  if (payload !== undefined && sourceFault(payload)) return "source_fault";
  if (!parsed) return "parse_failed";
  if (parsed.noReportData || financialRowCount(parsed) === 0) return "empty_source";
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
  let bundle = await vaultRead(supabase, connection.token_secret_id);
  if (!bundle) throw new SyncError("vault_unavailable", "Stored QuickBooks token is not accessible");

  if (Date.parse(bundle.access_token_expires_at) - Date.now() < 120_000) {
    bundle = await refreshTokens(bundle, connection.environment);
    await vaultWrite(supabase, connection.token_secret_id, bundle);
  }

  const ctx: QbContext = {
    realmId: connection.realm_id,
    environment: connection.environment,
    accessToken: bundle.access_token,
  };
  const req = companyInfoRequest(connection.realm_id);
  const { payload } = await quickbooksGet(ctx, req.path);
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

  // 1. Resolve a valid access token (refresh when near expiry). The bundle is
  //    snake_case and carries no realm — realm/environment come from the row.
  let bundle = await vaultRead(supabase, connection.token_secret_id);
  if (!bundle) throw new SyncError("vault_unavailable", "Stored QuickBooks token is not accessible");
  if (Date.parse(bundle.access_token_expires_at) - Date.now() < 120_000) {
    bundle = await refreshTokens(bundle, connection.environment);
    await vaultWrite(supabase, connection.token_secret_id, bundle);
  }
  const ctx: QbContext = {
    realmId: connection.realm_id,
    environment: connection.environment,
    accessToken: bundle.access_token,
  };

  const manifest: SyncResultItem[] = [];
  let companyName: string | null = connection.company_name;
  let fiscalYearStartMonth = 1;

  // The writer used for all snapshot/run persistence.
  const admin = await adminClient();
  const writer = admin ?? supabase;

  let success = 0;
  let failed = 0;
  // Sources this QuickBooks company does not expose: recorded truthfully as
  // coverage gaps, never as failures.
  let unsupported = 0;

  const errorCodes: string[] = [];
  let discoveredHistoryEarliest: string | null = null;
  let syncRunId: string | null = null;

  /** Preserve raw source + derived representation. Never mutates raw data. */
  const persistSnapshot = async (
    req: SyncReportRequest,
    payload: unknown,
    entry: SyncResultItem,
    parsed: ReturnType<typeof parseReport>,
    validation: ValidationResult | null,
  ): Promise<boolean> => {
    try {
      const rawJson = JSON.stringify(payload ?? {});
      const checksum = await sha256Hex(rawJson);
      entry.checksum = checksum;
      const meta = reportHeaderMeta(payload);
      const entities = parserFor(req.reportType) === "entity" ? parseEntityQuery(payload) : null;
      const availability: SourceAvailability =
        entry.availability ?? availabilityFromLifecycle(entry.status);
      const ins = await writer
        .from("quickbooks_report_snapshots")
        .insert({
          connection_id: connection.id,
          business_id: connection.business_id,
          sync_run_id: syncRunId,
          report_type: req.reportType,
          source_key: req.reportType,
          source_label: req.label ?? sourceTitleFor(req.reportType),
          request_path: req.path,
          source_kind: entry.kind,
          availability,
          privacy_tier: privacyTierFor(req.reportType),
          period_start: req.periodStart,
          period_end: req.periodEnd,
          accounting_method: req.accountingMethod,
          raw_payload: payload ?? {},
          normalized_payload: {
            parser_version: PARSER_VERSION,
            parsed_at: new Date().toISOString(),
            kind: entry.kind,
            reports_api_generation: reportsApiGeneration(),
            meta,
            columns: parsed?.columns ?? [],
            rows: parsed?.rows ?? [],
            entity_name: entities?.entityName ?? null,
            entities: entities?.entities ?? [],
            structural_node_count: entry.structuralNodeCount ?? 0,
            financial_row_count: entry.financialRowCount ?? 0,
            entity_count: entry.entityCount ?? 0,
            validation,
          },
          report_basis: meta.report_basis ?? req.accountingMethod,
          source_generated_at: meta.source_time,
          row_count: entry.rowCount ?? 0,
          structural_node_count: entry.structuralNodeCount ?? 0,
          financial_row_count: entry.financialRowCount ?? 0,
          entity_count: entry.entityCount ?? 0,
          transaction_count: entry.transactionCount ?? null,
          parser_version: PARSER_VERSION,
          reports_api_generation: reportsApiGeneration(),
          checksum,
          status: entry.status,
        })
        .select("id")
        .single();
      if (ins.error) {
        entry.status = "persistence_failed";
        entry.availability = "persistence_failed";
        entry.persistenceOutcome = "failed";
        entry.errorCode = "snapshot_insert_failed";
        entry.errorDetail = persistErrorDetail(ins.error);
        return false;
      }

      entry.snapshotId = (ins.data as { id: string } | null)?.id ?? null;
      entry.persistenceOutcome = "ok";
      return true;
    } catch (err) {
      entry.status = "persistence_failed";
      entry.availability = "persistence_failed";
      entry.persistenceOutcome = "failed";
      entry.errorCode = "snapshot_insert_failed";
      entry.errorDetail = err instanceof Error ? err.message.slice(0, 200) : "unknown";
      return false;
    }
  };


  // 2. CompanyInfo — verified company metadata AND the fiscal-year input.
  //    It is metadata, never a financial report: it is not parsed as one and
  //    an empty row count is not a failure. CompanyStartDate stays
  //    informational — it is not a hard history cutoff.
  const ciReq = companyInfoRequest(connection.realm_id);
  const ciEntry: SyncResultItem = {
    reportType: ciReq.reportType,
    label: ciReq.label,
    path: ciReq.path,
    periodStart: null,
    periodEnd: null,
    status: "requested",
    kind: "company_metadata",
    parseOutcome: "not_applicable",
    validationOutcome: "not_applicable",
  };
  manifest.push(ciEntry);
  let ciPayload: unknown = null;
  try {
    const ci = await quickbooksGet(ctx, ciReq.path);
    ciPayload = ci.payload;
    ciEntry.httpStatus = ci.httpStatus;
    ciEntry.attempts = ci.attempts;
    ciEntry.sourceOutcome = "ok";
    ciEntry.status = "retrieved";
    const companyInfo = ((ci.payload as { CompanyInfo?: Record<string, unknown> })?.CompanyInfo ??
      {}) as Record<string, unknown>;
    companyName = (companyInfo["CompanyName"] as string) ?? companyName;
    fiscalYearStartMonth = Number(companyInfo["FiscalYearStartMonth"] ?? 1) || 1;
    ciEntry.rowCount = Object.keys(companyInfo).length;
    ciEntry.financialRowCount = null;
    ciEntry.availability = "ready";

  } catch (err) {
    const se = err instanceof SyncError ? err : null;
    ciEntry.status = se?.code === "quickbooks_source_fault" ? "source_fault" : "api_failed";
    ciEntry.sourceOutcome = "failed";
    ciEntry.availability = "source_fault";

    ciEntry.httpStatus = se?.httpStatus ?? null;
    ciEntry.intuitErrorCode = se?.intuitCode ?? null;
    ciEntry.errorCode = se?.code ?? "unknown_error";
    failed += 1;
    errorCodes.push(ciEntry.errorCode);
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
  const runIns = await writer
    .from("quickbooks_sync_runs")
    .insert({
      seller_id: connection.seller_id,
      business_id: connection.business_id,
      connection_id: connection.id,
      status: "running",
      requested_report_types: [ciReq.reportType, ...requests.map((r) => r.reportType)],
    })
    .select("id")
    .single();
  syncRunId = (runIns.data as { id: string } | null)?.id ?? null;
  if (!syncRunId) {
    throw new SyncError(
      "sync_run_insert_failed",
      runIns.error?.message ?? "Could not create the sync run record",
    );
  }

  // Persist the company metadata snapshot now that the run exists.
  if (ciEntry.status === "retrieved") {
    if (await persistSnapshot(ciReq, ciPayload, ciEntry, null, null)) success += 1;
    else {
      failed += 1;
      errorCodes.push(ciEntry.errorCode ?? "snapshot_insert_failed");
    }
  }

  // 5. Execute each request: Acquire → Parse → Validate → Preserve/Persist.
  const runRequest = async (
    req: SyncReportRequest,
    fallbackOf: SyncReportRequest | null,
  ): Promise<SyncResultItem> => {
    const entry: SyncResultItem = {
      reportType: req.reportType,
      label: req.label,
      path: req.path,
      periodStart: req.periodStart,
      periodEnd: req.periodEnd,
      status: "requested",
      kind: sourceKindFor(req.reportType),
      fallbackOfPeriod: fallbackOf
        ? { start: fallbackOf.periodStart, end: fallbackOf.periodEnd }
        : null,
    };
    manifest.push(entry);

    // Acquire (with bounded retries for transient Intuit faults).
    let apiResult: QbApiResult;
    try {
      apiResult = await quickbooksGet(ctx, req.path);
      entry.httpStatus = apiResult.httpStatus;
      entry.attempts = apiResult.attempts;
      entry.sourceOutcome = "ok";
    } catch (err) {
      const se = err instanceof SyncError ? err : null;
      const isFault = se?.code === "quickbooks_source_fault";
      const http = se?.httpStatus ?? null;
      entry.status = isFault ? "source_fault" : "api_failed";
      // "Not present" is information. A report this QuickBooks edition does not
      // expose is `unsupported`; a scope/permission block is `permission_limited`.
      entry.availability =
        http === 400 || http === 404
          ? "unsupported"
          : http === 401 || http === 403
            ? "permission_limited"
            : "source_fault";
      entry.sourceOutcome = "failed";
      entry.parseOutcome = "skipped";
      entry.validationOutcome = "skipped";
      entry.persistenceOutcome = "skipped";
      entry.httpStatus = http;
      entry.intuitErrorCode = se?.intuitCode ?? null;
      entry.intuitFaultType = isFault ? "SystemFault" : null;
      entry.errorCode = se?.code ?? "network_error";
      entry.errorDetail = se?.message.slice(0, 200) ?? null;
      // Unsupported/not-applicable sources are recorded, not counted as failures.
      if (entry.availability === "unsupported") unsupported += 1;
      else {
        failed += 1;
        errorCodes.push(entry.errorCode);
      }
      return entry;
    }

    entry.reportsApiGeneration = reportsApiGeneration();

    // Parse + Validate. Entity queries are NOT reports and are never run
    // through the report parser.
    let parsed: ReturnType<typeof parseReport> = null;
    let validation: ValidationResult | null = null;

    if (parserFor(req.reportType) === "entity") {
      const entities = parseEntityQuery(apiResult.payload);
      entry.entityCount = entities?.count ?? 0;
      entry.rowCount = entities?.count ?? 0;
      entry.financialRowCount = null;
      entry.structuralNodeCount = 0;
      entry.parseOutcome = entities ? (entities.count > 0 ? "ok" : "empty") : "failed";
      entry.validationOutcome = "not_applicable";
      entry.status = !entities ? "parse_failed" : entities.count === 0 ? "empty_source" : "ready";
      entry.availability = availabilityFromLifecycle(entry.status);
    } else {
      parsed = parseReport(apiResult.payload);
      entry.rowCount = reportRowCount(apiResult.payload);
      entry.financialRowCount = financialRowCount(parsed);
      entry.structuralNodeCount = structuralNodeCount(parsed);
      validation = parsed ? validateReport(req.reportType, parsed) : null;
      entry.status = deriveLifecycle(parsed, validation, apiResult.payload);
      entry.parseOutcome =
        entry.status === "parse_failed" ? "failed" : entry.status === "empty_source" ? "empty" : "ok";
      entry.validationOutcome = !validation || validation.checks.length === 0
        ? "not_applicable"
        : validation.overall === "fail"
          ? "failed"
          : "ok";
      entry.availability = availabilityFromLifecycle(entry.status);
    }


    // Preserve (byte-immutable) + Persist. Prior valid snapshots are never
    // touched — every sync appends a new immutable version.
    const persisted = await persistSnapshot(req, apiResult.payload, entry, parsed, validation);
    if (!persisted) {
      failed += 1;
      errorCodes.push(entry.errorCode ?? "snapshot_insert_failed");
      return entry;
    }
    if (entry.status === "parse_failed") {
      failed += 1;
      errorCodes.push("parse_failed");
      return entry;
    }
    // empty_source is a valid QuickBooks answer, not a failure.
    success += 1;
    if (entry.status !== "empty_source" && entry.periodEnd) {
      if (!discoveredHistoryEarliest || entry.periodEnd < discoveredHistoryEarliest) {
        discoveredHistoryEarliest = entry.periodEnd;
      }
    }
    return entry;
  };

  for (const req of requests) {
    const entry = await runRequest(req, null);
    // Deterministic narrower-period fallback: a faulted long window is retried
    // once over a shorter, explicitly-labelled window. Results are never merged.
    if (entry.status === "source_fault") {
      const narrowed = narrowerPeriodRequest(req);
      if (narrowed) await runRequest(narrowed, req);
    }
  }


  // 6. Finalize the run with its full per-request manifest.
  const runStatus = failed === 0 ? "completed" : success > 0 ? "partial" : "failed";
  void unsupported;

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
      const kind = sourceKindFor(snap.report_type);
      const parsed = parseReport(snap.raw_payload);
      const validation = parsed ? validateReport(snap.report_type, parsed) : null;
      // Metadata snapshots are never "parse failed" — they are not reports.
      const status: SnapshotLifecycle =
        kind === "company_metadata"
          ? sourceFault(snap.raw_payload)
            ? "source_fault"
            : "retrieved"
          : deriveLifecycle(parsed, validation, snap.raw_payload);
      const meta = reportHeaderMeta(snap.raw_payload);
      const upd = await writer
        .from("quickbooks_report_snapshots")
        .update({
          normalized_payload: {
            parser_version: PARSER_VERSION,
            parsed_at: new Date().toISOString(),
            kind,
            meta,
            columns: parsed?.columns ?? [],
            rows: parsed?.rows ?? [],
            financial_row_count: financialRowCount(parsed),
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
