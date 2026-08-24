// Shared server-only QuickBooks helpers. Used by every quickbooks-* edge function.
// SECURITY:
//   - Never log tokens, authorization codes, client secret, or the Basic auth header.
//   - The exported quickbooksGet() helper rejects any HTTP method other than GET.
//   - Callers must not add write helpers.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
  appUrl: string;
  minorVersion: string;
  enableBackendQa: boolean;
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_token_expires_at: string; // ISO
  refresh_token_expires_at: string; // ISO
  issued_at: string; // ISO
}

// ---- CORS ----------------------------------------------------------------
// No wildcard. Only EXITBRIDGE_APP_URL (plus localhost dev origins when
// APP_ENV=development) may invoke the browser-facing functions.
const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
];

export function allowedOrigins(): string[] {
  const list: string[] = [];
  const app = Deno.env.get("EXITBRIDGE_APP_URL");
  if (app) list.push(app.replace(/\/$/, ""));
  const extra = Deno.env.get("EXITBRIDGE_EXTRA_ORIGINS");
  if (extra) list.push(...extra.split(",").map((o) => o.trim()).filter(Boolean));
  if ((Deno.env.get("APP_ENV") ?? "production") === "development") list.push(...DEV_ORIGINS);
  return list;
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // non-browser caller (CLI, workflow, server-to-server)
  return allowedOrigins().includes(origin.replace(/\/$/, ""));
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
  const allowed = allowedOrigins();
  const chosen = origin && allowed.includes(origin.replace(/\/$/, ""))
    ? origin.replace(/\/$/, "")
    : allowed[0];
  if (chosen) base["Access-Control-Allow-Origin"] = chosen;
  return base;
}

// ---- Stable, safe machine-readable error codes ---------------------------
export const QB_ERROR = {
  oauthStartUnauthorized: "oauth_start_unauthorized",
  oauthStartSellerRequired: "oauth_start_seller_required",
  oauthStateCreateFailed: "oauth_state_create_failed",
  oauthStateInvalid: "oauth_state_invalid",
  oauthStateExpiredOrReused: "oauth_state_expired_or_reused",
  tokenExchangeFailed: "token_exchange_failed",
  tokenVaultCreateFailed: "token_vault_create_failed",
  tokenVaultReadFailed: "token_vault_read_failed",
  tokenVaultUpdateFailed: "token_vault_update_failed",
  connectionUpsertFailed: "connection_upsert_failed",
  companyInfoFetchFailed: "company_info_fetch_failed",
  companyInfoSnapshotFailed: "company_info_snapshot_failed",
  tokenRefreshFailed: "token_refresh_failed",
  disconnectRevokeFailed: "disconnect_revoke_failed",
  disconnectVaultDeleteFailed: "disconnect_vault_delete_failed",
  originNotAllowed: "origin_not_allowed",
  qaDisabled: "qa_disabled",
  forbiddenRole: "forbidden_role",
  noConnection: "no_connection",
  noBusiness: "no_business",
  connectionNotActive: "connection_not_active",
  syncRunCreateFailed: "sync_run_create_failed",
  syncRunUpdateFailed: "sync_run_update_failed",
  reportFetchFailed: "report_fetch_failed",
  snapshotInsertFailed: "snapshot_insert_failed",
} as const;

export type QbErrorCode = typeof QB_ERROR[keyof typeof QB_ERROR];

export class QbError extends Error {
  code: QbErrorCode;
  constructor(code: QbErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/** Normalize any thrown value into a safe, machine-readable code. */
export function toErrorCode(e: unknown, fallback: QbErrorCode): QbErrorCode {
  return e instanceof QbError ? e.code : fallback;
}

/** The only value ever written to quickbooks_connections.last_error. */
export function safeLastError(code: QbErrorCode, cid: string): string {
  return `${code}:${cid}`;
}

export function jsonError(
  code: QbErrorCode,
  cid: string,
  status: number,
  origin?: string | null,
): Response {
  return new Response(JSON.stringify({ error: code, correlationId: cid }), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

export function loadConfig(): QuickBooksConfig {
  const required = {
    INTUIT_CLIENT_ID: Deno.env.get("INTUIT_CLIENT_ID"),
    INTUIT_CLIENT_SECRET: Deno.env.get("INTUIT_CLIENT_SECRET"),
    INTUIT_REDIRECT_URI: Deno.env.get("INTUIT_REDIRECT_URI"),
    INTUIT_ENVIRONMENT: Deno.env.get("INTUIT_ENVIRONMENT"),
    EXITBRIDGE_APP_URL: Deno.env.get("EXITBRIDGE_APP_URL"),
    QUICKBOOKS_MINOR_VERSION: Deno.env.get("QUICKBOOKS_MINOR_VERSION"),
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
  }
  const env = required.INTUIT_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    clientId: required.INTUIT_CLIENT_ID!,
    clientSecret: required.INTUIT_CLIENT_SECRET!,
    redirectUri: required.INTUIT_REDIRECT_URI!,
    environment: env,
    appUrl: required.EXITBRIDGE_APP_URL!,
    minorVersion: required.QUICKBOOKS_MINOR_VERSION!,
    enableBackendQa: (Deno.env.get("ENABLE_BACKEND_QA") ?? "false") === "true",
  };
}

export function apiBaseUrl(env: "sandbox" | "production"): string {
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

const OAUTH_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const OAUTH_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";

export function buildAuthorizationUrl(cfg: QuickBooksConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export function correlationId(): string {
  return crypto.randomUUID();
}

export function generateOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // URL-safe base64
  let b64 = btoa(String.fromCharCode(...bytes));
  b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function maskRealm(realm: string | null | undefined): string {
  if (!realm) return "";
  if (realm.length <= 4) return "****";
  return `****${realm.slice(-4)}`;
}

export function safeJsonParse<T = unknown>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { return null; }
}

export function safeError(input: unknown): string {
  if (input instanceof Error) return input.message.slice(0, 200);
  if (typeof input === "string") return input.slice(0, 200);
  return "unknown error";
}

// Basic auth header for Intuit token endpoints; never log this value.
function basicAuth(cfg: QuickBooksConfig): string {
  return "Basic " + btoa(`${cfg.clientId}:${cfg.clientSecret}`);
}

function computeExpiries(resp: {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}): TokenBundle {
  const now = Date.now();
  return {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
    token_type: resp.token_type ?? "bearer",
    access_token_expires_at: new Date(now + resp.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(
      now + resp.x_refresh_token_expires_in * 1000,
    ).toISOString(),
    issued_at: new Date(now).toISOString(),
  };
}

export async function exchangeAuthorizationCode(
  cfg: QuickBooksConfig,
  code: string,
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(cfg),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new QbError(QB_ERROR.tokenExchangeFailed, `status ${res.status}`);
  }
  const json = await res.json();
  return computeExpiries(json);
}

export async function refreshTokenBundle(
  cfg: QuickBooksConfig,
  refreshToken: string,
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(cfg),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new QbError(QB_ERROR.tokenRefreshFailed, `status ${res.status}`);
  }
  const json = await res.json();
  return computeExpiries(json);
}

export async function revokeToken(
  cfg: QuickBooksConfig,
  token: string,
): Promise<boolean> {
  const res = await fetch(OAUTH_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(cfg),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  return res.ok;
}

// GET-only QuickBooks Data API helper. Rejects any other method by construction.
export async function quickbooksGet(
  cfg: QuickBooksConfig,
  accessToken: string,
  realmId: string,
  path: string,
  errorCode: QbErrorCode = QB_ERROR.companyInfoFetchFailed,
): Promise<unknown> {
  if (!path.startsWith("/")) path = "/" + path;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${apiBaseUrl(cfg.environment)}/v3/company/${realmId}${path}${sep}minorversion=${cfg.minorVersion}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new QbError(errorCode, `status ${res.status}`);
  }
  return res.json();
}

// ============ Supabase admin helpers ============

export function serviceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function authedUserFromRequest(
  req: Request,
): Promise<{ id: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export function logSafe(event: Record<string, unknown>): void {
  // Whitelisted keys only. Never log tokens/codes/secrets.
  const allow = new Set([
    "correlation_id",
    "action",
    "seller_id",
    "connection_id",
    "sync_run_id",
    "report_type",
    "successful_count",
    "failed_count",
    "realm_masked",
    "status",
    "intuit_status",
    "error",
    "error_code",
    "timestamp",
  ]);
  const clean: Record<string, unknown> = { ts: new Date().toISOString() };
  for (const [k, v] of Object.entries(event)) {
    if (allow.has(k)) clean[k] = v;
  }
  console.log(JSON.stringify(clean));
}

export async function consumeOAuthState(
  admin: SupabaseClient,
  stateHash: string,
): Promise<{ seller_id: string; business_id: string | null } | null> {
  const { data, error } = await admin.rpc("service_qb_consume_oauth_state" as never, {
    _state_hash: stateHash,
  } as never);
  if (error) throw new QbError(QB_ERROR.oauthStateInvalid, safeError(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !(row as { seller_id?: string }).seller_id) return null;
  return row as { seller_id: string; business_id: string | null };
}

export function buildInfo(): { appEnvironment: string; buildCommit: string } {
  return {
    appEnvironment: Deno.env.get("APP_ENV") ?? "production",
    buildCommit: Deno.env.get("BUILD_COMMIT") ?? "unknown",
  };
}

export interface StoredConnection {
  id: string;
  seller_id: string;
  business_id: string | null;
  realm_id: string;
  environment: string;
  company_name: string | null;
  token_secret_id: string | null;
  status: string;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

// Retrieve the token bundle via the private SECURITY DEFINER helper.
export async function getTokenBundle(
  admin: SupabaseClient,
  secretId: string,
): Promise<TokenBundle | null> {
  const { data, error } = await admin.rpc("service_qb_get_token_secret" as never, {
    _secret_id: secretId,
  } as never);
  if (error) throw new QbError(QB_ERROR.tokenVaultReadFailed, safeError(error));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : (data as TokenBundle);
}

export async function createTokenSecret(
  admin: SupabaseClient,
  bundle: TokenBundle,
  name: string,
): Promise<string> {
  const { data, error } = await admin.rpc("service_qb_create_token_secret" as never, {
    _bundle: bundle as unknown as Record<string, unknown>,
    _name: name,
  } as never);
  if (error) throw new QbError(QB_ERROR.tokenVaultCreateFailed, safeError(error));
  return data as string;
}

export async function updateTokenSecret(
  admin: SupabaseClient,
  secretId: string,
  bundle: TokenBundle,
): Promise<void> {
  const { error } = await admin.rpc("service_qb_update_token_secret" as never, {
    _secret_id: secretId,
    _bundle: bundle as unknown as Record<string, unknown>,
  } as never);
  if (error) throw new QbError(QB_ERROR.tokenVaultUpdateFailed, safeError(error));
}

export async function deleteTokenSecret(
  admin: SupabaseClient,
  secretId: string,
): Promise<void> {
  await admin.rpc("service_qb_delete_token_secret" as never, {
    _secret_id: secretId,
  } as never);
}

// If access_token expires within 5 minutes, refresh and persist the new bundle.
export async function ensureFreshAccess(
  admin: SupabaseClient,
  cfg: QuickBooksConfig,
  conn: StoredConnection,
): Promise<{ bundle: TokenBundle; refreshed: boolean }> {
  if (!conn.token_secret_id) throw new QbError(QB_ERROR.tokenVaultReadFailed, "no token secret");
  const bundle = await getTokenBundle(admin, conn.token_secret_id);
  if (!bundle) throw new QbError(QB_ERROR.tokenVaultReadFailed, "token secret unavailable");
  const exp = Date.parse(bundle.access_token_expires_at);
  if (exp - Date.now() > 5 * 60 * 1000) {
    return { bundle, refreshed: false };
  }
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
  return { bundle: fresh, refreshed: true };
}
