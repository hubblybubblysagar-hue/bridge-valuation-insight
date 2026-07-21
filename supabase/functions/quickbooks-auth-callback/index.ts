// Intuit OAuth redirect target. verify_jwt=false; security is enforced by
// one-time state validation via private.consume_quickbooks_oauth_state.
import {
  corsHeaders,
  correlationId,
  createTokenSecret,
  exchangeAuthorizationCode,
  loadConfig,
  logSafe,
  maskRealm,
  quickbooksGet,
  safeError,
  serviceRoleClient,
  sha256Hex,
} from "../_shared/quickbooks.ts";

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const cid = correlationId();
  let appUrl = "";
  try {
    const cfg = loadConfig();
    appUrl = cfg.appUrl;
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const realmId = url.searchParams.get("realmId");
    const oauthError = url.searchParams.get("error");

    if (!state) {
      logSafe({ correlation_id: cid, action: "oauth_callback", status: "missing_state" });
      return redirect(`${appUrl}/seller/connect?quickbooks=error`);
    }

    const admin = serviceRoleClient();
    const stateHash = await sha256Hex(state);
    const { data: consumed, error: consumeErr } = await admin.rpc(
      "consume_quickbooks_oauth_state" as never,
      { _state_hash: stateHash } as never,
    );
    if (consumeErr) throw consumeErr;
    const row = Array.isArray(consumed) ? consumed[0] : consumed;
    if (!row || !row.seller_id) {
      logSafe({ correlation_id: cid, action: "oauth_callback", status: "invalid_state" });
      return redirect(`${appUrl}/seller/connect?quickbooks=error`);
    }
    const sellerId = row.seller_id as string;
    const businessId = (row.business_id as string | null) ?? null;

    if (oauthError) {
      logSafe({ correlation_id: cid, action: "oauth_callback", seller_id: sellerId, status: "denied" });
      return redirect(`${appUrl}/seller/connect?quickbooks=denied`);
    }
    if (!code || !realmId) {
      logSafe({ correlation_id: cid, action: "oauth_callback", seller_id: sellerId, status: "missing_params" });
      return redirect(`${appUrl}/seller/connect?quickbooks=error`);
    }

    // Exchange auth code
    const bundle = await exchangeAuthorizationCode(cfg, code);

    // Upsert connection metadata (without token secret yet)
    const { data: existing } = await admin
      .from("quickbooks_connections")
      .select("id, token_secret_id")
      .eq("seller_id", sellerId)
      .eq("realm_id", realmId)
      .maybeSingle();

    let connectionId: string;
    let secretId: string;

    if (existing) {
      connectionId = existing.id;
      if (existing.token_secret_id) {
        // Update existing vault secret
        await admin.rpc("update_quickbooks_token_secret" as never, {
          _secret_id: existing.token_secret_id,
          _bundle: bundle as unknown as Record<string, unknown>,
        } as never);
        secretId = existing.token_secret_id;
      } else {
        secretId = await createTokenSecret(
          admin,
          bundle,
          `qb_tokens_${sellerId}_${realmId}`,
        );
      }
      await admin
        .from("quickbooks_connections")
        .update({
          business_id: businessId,
          environment: cfg.environment,
          scope: "com.intuit.quickbooks.accounting",
          token_secret_id: secretId,
          status: "connected",
          connected_at: new Date().toISOString(),
          access_token_expires_at: bundle.access_token_expires_at,
          refresh_token_expires_at: bundle.refresh_token_expires_at,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);
    } else {
      secretId = await createTokenSecret(
        admin,
        bundle,
        `qb_tokens_${sellerId}_${realmId}`,
      );
      const { data: inserted, error: insErr } = await admin
        .from("quickbooks_connections")
        .insert({
          seller_id: sellerId,
          business_id: businessId,
          realm_id: realmId,
          environment: cfg.environment,
          scope: "com.intuit.quickbooks.accounting",
          token_secret_id: secretId,
          status: "connected",
          connected_at: new Date().toISOString(),
          access_token_expires_at: bundle.access_token_expires_at,
          refresh_token_expires_at: bundle.refresh_token_expires_at,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      connectionId = inserted.id;
    }

    // Fetch CompanyInfo (GET-only)
    let companyName: string | null = null;
    try {
      const info = await quickbooksGet(cfg, bundle.access_token, realmId, `/companyinfo/${realmId}`) as {
        CompanyInfo?: { CompanyName?: string; LegalName?: string };
      };
      companyName = info?.CompanyInfo?.CompanyName ?? info?.CompanyInfo?.LegalName ?? null;

      await admin.from("quickbooks_report_snapshots").insert({
        connection_id: connectionId,
        business_id: businessId!,
        report_type: "company_info",
        raw_payload: info as unknown as Record<string, unknown>,
        normalized_payload: {
          company_name: companyName,
          realm_masked: maskRealm(realmId),
          environment: cfg.environment,
        },
        fetched_at: new Date().toISOString(),
      });

      await admin
        .from("quickbooks_connections")
        .update({
          company_name: companyName,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", connectionId);
    } catch (infoErr) {
      // Connection still valid; record safe error but keep status connected.
      await admin
        .from("quickbooks_connections")
        .update({ last_error: `companyinfo: ${safeError(infoErr)}` })
        .eq("id", connectionId);
    }

    logSafe({
      correlation_id: cid,
      action: "oauth_callback",
      seller_id: sellerId,
      connection_id: connectionId,
      realm_masked: maskRealm(realmId),
      status: "connected",
    });
    return redirect(`${appUrl}/seller/connect?quickbooks=connected`);
  } catch (e) {
    logSafe({ correlation_id: cid, action: "oauth_callback", status: "error", error: safeError(e) });
    return redirect(`${appUrl || ""}/seller/connect?quickbooks=error`);
  }
});
