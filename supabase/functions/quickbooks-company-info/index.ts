// Verifies the seller's QuickBooks connection by refreshing (if needed) and
// fetching CompanyInfo. Returns only safe metadata — never tokens.
import {
  authedUserFromRequest,
  corsHeaders,
  correlationId,
  ensureFreshAccess,
  loadConfig,
  logSafe,
  maskRealm,
  quickbooksGet,
  safeError,
  serviceRoleClient,
  type StoredConnection,
} from "../_shared/quickbooks.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  const cid = correlationId();
  try {
    const cfg = loadConfig();
    const user = await authedUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const admin = serviceRoleClient();
    const { data: conn } = await admin
      .from("quickbooks_connections")
      .select("*")
      .eq("seller_id", user.id)
      .order("connected_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!conn) {
      return new Response(JSON.stringify({ error: "no_connection" }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const stored = conn as StoredConnection;
    const { bundle } = await ensureFreshAccess(admin, cfg, stored);

    const info = await quickbooksGet(
      cfg,
      bundle.access_token,
      stored.realm_id,
      `/companyinfo/${stored.realm_id}`,
    ) as { CompanyInfo?: { CompanyName?: string; LegalName?: string } };
    const companyName =
      info?.CompanyInfo?.CompanyName ?? info?.CompanyInfo?.LegalName ?? stored.company_name;

    await admin.from("quickbooks_report_snapshots").insert({
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
      }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  } catch (e) {
    logSafe({ correlation_id: cid, action: "company_info", status: "error", error: safeError(e) });
    return new Response(JSON.stringify({ error: "company_info_failed" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
