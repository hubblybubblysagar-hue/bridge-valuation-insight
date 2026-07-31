// Intuit OAuth redirect target. verify_jwt=false; security is enforced by
// one-time state validation via public.service_qb_consume_oauth_state.
// No browser CORS is needed here — Intuit performs a top-level redirect.
import {
  consumeOAuthState,
  correlationId,
  createTokenSecret,
  exchangeAuthorizationCode,
  loadConfig,
  logSafe,
  maskRealm,
  QB_ERROR,
  type QbErrorCode,
  quickbooksGet,
  safeError,
  safeLastError,
  serviceRoleClient,
  sha256Hex,
  toErrorCode,
  updateTokenSecret,
} from "../_shared/quickbooks.ts";

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function fail(appUrl: string, code: QbErrorCode, cid: string): Response {
  return redirect(
    `${appUrl}/seller/connect?quickbooks=error&code=${encodeURIComponent(code)}&cid=${cid}`,
  );
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
      logSafe({ correlation_id: cid, action: "oauth_callback", error_code: QB_ERROR.oauthStateInvalid });
      return fail(appUrl, QB_ERROR.oauthStateInvalid, cid);
    }

    const admin = serviceRoleClient();
    const stateHash = await sha256Hex(state);
    const row = await consumeOAuthState(admin, stateHash);
    if (!row) {
      logSafe({ correlation_id: cid, action: "oauth_callback", error_code: QB_ERROR.oauthStateExpiredOrReused });
      return fail(appUrl, QB_ERROR.oauthStateExpiredOrReused, cid);
    }
    const sellerId = row.seller_id;
    const businessId = row.business_id;

    if (oauthError) {
      logSafe({ correlation_id: cid, action: "oauth_callback", seller_id: sellerId, status: "denied" });
      return redirect(`${appUrl}/seller/connect?quickbooks=denied&cid=${cid}`);
    }
    if (!code || !realmId) {
      return fail(appUrl, QB_ERROR.oauthStateInvalid, cid);
    }

    // Exchange auth code (throws QbError token_exchange_failed).
    const bundle = await exchangeAuthorizationCode(cfg, code);

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
        await updateTokenSecret(admin, existing.token_secret_id, bundle);
        secretId = existing.token_secret_id;
      } else {
        secretId = await createTokenSecret(admin, bundle, `qb_tokens_${sellerId}_${realmId}`);
      }
      const { error: updErr } = await admin
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
      if (updErr) {
        logSafe({ correlation_id: cid, action: "oauth_callback", error_code: QB_ERROR.connectionUpsertFailed });
        return fail(appUrl, QB_ERROR.connectionUpsertFailed, cid);
      }
    } else {
      secretId = await createTokenSecret(admin, bundle, `qb_tokens_${sellerId}_${realmId}`);
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
      if (insErr || !inserted) {
        logSafe({ correlation_id: cid, action: "oauth_callback", error_code: QB_ERROR.connectionUpsertFailed });
        return fail(appUrl, QB_ERROR.connectionUpsertFailed, cid);
      }
      connectionId = inserted.id;
    }

    // CompanyInfo proof (GET-only).
    try {
      const info = await quickbooksGet(cfg, bundle.access_token, realmId, `/companyinfo/${realmId}`) as {
        CompanyInfo?: { CompanyName?: string; LegalName?: string };
      };
      const companyName = info?.CompanyInfo?.CompanyName ?? info?.CompanyInfo?.LegalName ?? null;

      const { error: snapErr } = await admin.from("quickbooks_report_snapshots").insert({
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
      if (snapErr) {
        await admin
          .from("quickbooks_connections")
          .update({ last_error: safeLastError(QB_ERROR.companyInfoSnapshotFailed, cid) })
          .eq("id", connectionId);
        return fail(appUrl, QB_ERROR.companyInfoSnapshotFailed, cid);
      }

      await admin
        .from("quickbooks_connections")
        .update({ company_name: companyName, last_synced_at: new Date().toISOString(), last_error: null })
        .eq("id", connectionId);
    } catch (infoErr) {
      const code = toErrorCode(infoErr, QB_ERROR.companyInfoFetchFailed);
      await admin
        .from("quickbooks_connections")
        .update({ status: "needs_attention", last_error: safeLastError(code, cid) })
        .eq("id", connectionId);
      logSafe({ correlation_id: cid, action: "oauth_callback", error_code: code });
      return fail(appUrl, code, cid);
    }

    logSafe({
      correlation_id: cid,
      action: "oauth_callback",
      seller_id: sellerId,
      connection_id: connectionId,
      realm_masked: maskRealm(realmId),
      status: "connected",
    });
    return redirect(`${appUrl}/seller/connect?quickbooks=connected&cid=${cid}`);
  } catch (e) {
    const code = toErrorCode(e, QB_ERROR.connectionUpsertFailed);
    logSafe({ correlation_id: cid, action: "oauth_callback", error_code: code, error: safeError(e) });
    return fail(appUrl || "", code, cid);
  }
});
