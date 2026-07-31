// Browser helpers for QuickBooks connect flow. All work happens in edge
// functions — this module only invokes them and reads safe metadata.
import { supabase } from "@/integrations/supabase/client";

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
