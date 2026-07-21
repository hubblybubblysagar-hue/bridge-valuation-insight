// Starts the QuickBooks OAuth flow for the authenticated seller.
// Requires a valid Supabase user JWT (verify_jwt=true in config.toml).
import {
  authedUserFromRequest,
  buildAuthorizationUrl,
  corsHeaders,
  correlationId,
  generateOAuthState,
  loadConfig,
  logSafe,
  safeError,
  serviceRoleClient,
  sha256Hex,
} from "../_shared/quickbooks.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  const cid = correlationId();
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const cfg = loadConfig();
    const user = await authedUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const admin = serviceRoleClient();

    // Require seller role.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.role !== "seller") {
      return new Response(JSON.stringify({ error: "seller role required" }), {
        status: 403,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Find or create the seller's business.
    const { data: existing } = await admin
      .from("businesses")
      .select("id")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let businessId = existing?.id ?? null;
    if (!businessId) {
      const { data: created, error: createErr } = await admin
        .from("businesses")
        .insert({ seller_id: user.id, status: "draft" })
        .select("id")
        .single();
      if (createErr) throw createErr;
      businessId = created.id;
    }

    // Invalidate previous unconsumed states for this seller to keep the table tidy.
    await admin
      .from("quickbooks_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("seller_id", user.id)
      .is("consumed_at", null);

    const rawState = generateOAuthState();
    const stateHash = await sha256Hex(rawState);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await admin.from("quickbooks_oauth_states").insert({
      seller_id: user.id,
      business_id: businessId,
      state_hash: stateHash,
      expires_at: expiresAt,
    });
    if (insErr) throw insErr;

    const authorizationUrl = buildAuthorizationUrl(cfg, rawState);
    logSafe({ correlation_id: cid, action: "oauth_start", seller_id: user.id, status: "ok" });
    return new Response(JSON.stringify({ authorizationUrl, expiresAt }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (e) {
    logSafe({ correlation_id: cid, action: "oauth_start", status: "error", error: safeError(e) });
    return new Response(JSON.stringify({ error: "oauth_start_failed" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
