// Disconnects the seller's QuickBooks connection. Revokes the Intuit token
// (best-effort), deletes the vault secret, and marks the connection disconnected.
// Never deletes business, financial, valuation, teaser, NDA, or snapshot rows.
import {
  authedUserFromRequest,
  corsHeaders,
  correlationId,
  deleteTokenSecret,
  getTokenBundle,
  isOriginAllowed,
  jsonError,
  loadConfig,
  logSafe,
  maskRealm,
  QB_ERROR,
  type QbErrorCode,
  revokeToken,
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
  try {
    const cfg = loadConfig();
    const user = await authedUserFromRequest(req);
    if (!user) return jsonError(QB_ERROR.oauthStartUnauthorized, cid, 401, origin);
    const admin = serviceRoleClient();
    const { data: conn } = await admin
      .from("quickbooks_connections")
      .select("*")
      .eq("seller_id", user.id)
      .order("connected_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!conn) {
      return new Response(JSON.stringify({ ok: true, note: "no_connection", correlationId: cid }), {
        status: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }
    const stored = conn as StoredConnection;

    let lastErrorCode: QbErrorCode | null = null;
    if (stored.token_secret_id) {
      try {
        const bundle = await getTokenBundle(admin, stored.token_secret_id);
        if (bundle) {
          const ok = await revokeToken(cfg, bundle.refresh_token);
          if (!ok) lastErrorCode = QB_ERROR.disconnectRevokeFailed;
        }
      } catch (e) {
        lastErrorCode = toErrorCode(e, QB_ERROR.disconnectRevokeFailed);
      }
      try {
        await deleteTokenSecret(admin, stored.token_secret_id);
      } catch {
        lastErrorCode = QB_ERROR.disconnectVaultDeleteFailed;
      }
    }

    await admin
      .from("quickbooks_connections")
      .update({
        token_secret_id: null,
        status: "disconnected",
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        last_error: lastErrorCode ? safeLastError(lastErrorCode, cid) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stored.id);

    logSafe({
      correlation_id: cid,
      action: "disconnect",
      seller_id: user.id,
      connection_id: stored.id,
      realm_masked: maskRealm(stored.realm_id),
      status: "ok",
      error_code: lastErrorCode ?? undefined,
    });
    return new Response(JSON.stringify({ ok: true, correlationId: cid, errorCode: lastErrorCode }), {
      status: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (e) {
    const code = toErrorCode(e, QB_ERROR.disconnectVaultDeleteFailed);
    logSafe({ correlation_id: cid, action: "disconnect", error_code: code, error: safeError(e) });
    return jsonError(code, cid, 500, origin);
  }
});
