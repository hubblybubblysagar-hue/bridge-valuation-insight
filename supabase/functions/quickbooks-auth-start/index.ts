// Starts the QuickBooks OAuth flow for the authenticated seller.
// Requires a valid Supabase user JWT (verify_jwt=true in config.toml).
import {
  authedUserFromRequest,
  buildAuthorizationUrl,
  corsHeaders,
  correlationId,
  generateOAuthState,
  isOriginAllowed,
  jsonError,
  loadConfig,
  logSafe,
  QB_ERROR,
  safeError,
  serviceRoleClient,
  sha256Hex,
  toErrorCode,
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

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.role !== "seller") {
      return jsonError(QB_ERROR.oauthStartSellerRequired, cid, 403, origin);
    }

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
      if (createErr) return jsonError(QB_ERROR.oauthStateCreateFailed, cid, 500, origin);
      businessId = created.id;
    }

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
    if (insErr) return jsonError(QB_ERROR.oauthStateCreateFailed, cid, 500, origin);

    const authorizationUrl = buildAuthorizationUrl(cfg, rawState);
    logSafe({ correlation_id: cid, action: "oauth_start", seller_id: user.id, status: "ok" });
    return new Response(JSON.stringify({ authorizationUrl, expiresAt, correlationId: cid }), {
      status: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (e) {
    const code = toErrorCode(e, QB_ERROR.oauthStateCreateFailed);
    logSafe({ correlation_id: cid, action: "oauth_start", error_code: code, error: safeError(e) });
    return jsonError(code, cid, 500, origin);
  }
});
