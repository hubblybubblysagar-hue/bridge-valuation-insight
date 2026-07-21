// Disconnects the seller's QuickBooks connection. Revokes the Intuit token
// (best-effort), deletes the vault secret, and marks the connection disconnected.
import {
  authedUserFromRequest,
  corsHeaders,
  correlationId,
  deleteTokenSecret,
  getTokenBundle,
  loadConfig,
  logSafe,
  maskRealm,
  revokeToken,
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
      return new Response(JSON.stringify({ ok: true, note: "no_connection" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const stored = conn as StoredConnection;

    let lastError: string | null = null;
    if (stored.token_secret_id) {
      try {
        const bundle = await getTokenBundle(admin, stored.token_secret_id);
        if (bundle) {
          const ok = await revokeToken(cfg, bundle.refresh_token);
          if (!ok) lastError = "intuit_revoke_non_ok";
        }
      } catch (e) {
        lastError = `revoke: ${safeError(e)}`;
      }
      try {
        await deleteTokenSecret(admin, stored.token_secret_id);
      } catch (e) {
        lastError = `vault_delete: ${safeError(e)}`;
      }
    }

    await admin
      .from("quickbooks_connections")
      .update({
        token_secret_id: null,
        status: "disconnected",
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        last_error: lastError,
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
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (e) {
    logSafe({ correlation_id: cid, action: "disconnect", status: "error", error: safeError(e) });
    return new Response(JSON.stringify({ error: "disconnect_failed" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
