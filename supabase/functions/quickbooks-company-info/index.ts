// Verifies the seller's QuickBooks connection by refreshing (if needed) and
// fetching CompanyInfo. Returns only safe metadata — never tokens.
import {
  authedUserFromRequest,
  corsHeaders,
  correlationId,
  ensureFreshAccess,
  isOriginAllowed,
  jsonError,
  loadConfig,
  logSafe,
  maskRealm,
  QB_ERROR,
  quickbooksGet,
  safeError,
  safeLastError,
  serviceRoleClient,
  toErrorCode,
  type StoredConnection,
} from "../_shared/quickbooks.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cid = correlationId();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (!isOriginAllowed(origin)) return jsonError(QB_ERROR.originNotAllowed, cid, 403, origin);
  let connectionId: string | null = null;
  const admin = serviceRoleClient();
  try {
    const cfg = loadConfig();
    const user = await authedUserFromRequest(req);
    if (!user) return jsonError(QB_ERROR.oauthStartUnauthorized, cid, 401, origin);
    const { data: conn } = await admin
      .from("quickbooks_connections")
      .select("*")
      .eq("seller_id", user.id)
      .order("connected_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!conn) return jsonError(QB_ERROR.noConnection, cid, 404, origin);
    const stored = conn as StoredConnection;
    connectionId = stored.id;
    const { bundle } = await ensureFreshAccess(admin, cfg, stored);

    const info = await quickbooksGet(
      cfg,
      bundle.access_token,
      stored.realm_id,
      `/companyinfo/${stored.realm_id}`,
    ) as { CompanyInfo?: { CompanyName?: string; LegalName?: string } };
    const companyName =
      info?.CompanyInfo?.CompanyName ?? info?.CompanyInfo?.LegalName ?? stored.company_name;

    const { error: snapErr } = await admin.from("quickbooks_report_snapshots").insert({
      connection_id: stored.id,
      business_id: stored.business_id!,
      report_type: "company_info",
      raw_payload: info as unknown as Record<string, unknown>,
      normalized_payload: {
        company_name: companyName,
        realm_masked: maskRealm(stored.realm_id),
        environment: stored.environment,
      },
      fetched_at: new Date().toISOString(),
    });
    if (snapErr) {
      await admin
        .from("quickbooks_connections")
        .update({ last_error: safeLastError(QB_ERROR.companyInfoSnapshotFailed, cid) })
        .eq("id", stored.id);
      return jsonError(QB_ERROR.companyInfoSnapshotFailed, cid, 500, origin);
    }

    const nowIso = new Date().toISOString();
    await admin
      .from("quickbooks_connections")
      .update({
        company_name: companyName,
        status: "connected",
        last_synced_at: nowIso,
        last_error: null,
        access_token_expires_at: bundle.access_token_expires_at,
        refresh_token_expires_at: bundle.refresh_token_expires_at,
      })
      .eq("id", stored.id);

    logSafe({
      correlation_id: cid,
      action: "company_info",
      seller_id: user.id,
      connection_id: stored.id,
      realm_masked: maskRealm(stored.realm_id),
      status: "ok",
    });

    return new Response(
      JSON.stringify({
        connectionId: stored.id,
        realmIdMasked: maskRealm(stored.realm_id),
        companyName,
        environment: stored.environment,
        status: "connected",
        connectedAt: stored.connected_at,
        lastSyncedAt: nowIso,
        accessTokenExpiresAt: bundle.access_token_expires_at,
        refreshTokenExpiresAt: bundle.refresh_token_expires_at,
        correlationId: cid,
      }),
      { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  } catch (e) {
    const code = toErrorCode(e, QB_ERROR.companyInfoFetchFailed);
    if (connectionId) {
      await admin
        .from("quickbooks_connections")
        .update({ status: "needs_attention", last_error: safeLastError(code, cid) })
        .eq("id", connectionId);
    }
    logSafe({ correlation_id: cid, action: "company_info", error_code: code, error: safeError(e) });
    return jsonError(code, cid, 500, origin);
  }
});
