// Safe, aggregated QuickBooks QA status. JWT required, ENABLE_BACKEND_QA must
// be true, and the caller must be a seller or admin. Returns booleans, counts,
// timestamps, and safe codes only — never identifiers, names, or tokens.
import {
  authedUserFromRequest,
  buildInfo,
  corsHeaders,
  correlationId,
  isOriginAllowed,
  jsonError,
  logSafe,
  QB_ERROR,
  safeError,
  serviceRoleClient,
} from "../_shared/quickbooks.ts";

const MIGRATION_VERSION = "20260731_qb_service_bridges";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cid = correlationId();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (!isOriginAllowed(origin)) return jsonError(QB_ERROR.originNotAllowed, cid, 403, origin);
  try {
    if ((Deno.env.get("ENABLE_BACKEND_QA") ?? "false") !== "true") {
      return jsonError(QB_ERROR.qaDisabled, cid, 403, origin);
    }
    const user = await authedUserFromRequest(req);
    if (!user) return jsonError(QB_ERROR.oauthStartUnauthorized, cid, 401, origin);

    const admin = serviceRoleClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return jsonError(QB_ERROR.forbiddenRole, cid, 403, origin);
    }

    const { data: conn } = await admin
      .from("quickbooks_connections")
      .select("id, status, token_secret_id, connected_at, last_synced_at, last_error")
      .eq("seller_id", user.id)
      .order("connected_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let snapshotCount = 0;
    if (conn) {
      const { count } = await admin
        .from("quickbooks_report_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("connection_id", conn.id)
        .eq("report_type", "company_info");
      snapshotCount = count ?? 0;
    }

    const info = buildInfo();
    const rawLastError = (conn?.last_error as string | null) ?? null;
    const safeLastErrorCode = rawLastError ? rawLastError.split(":")[0] : null;

    logSafe({ correlation_id: cid, action: "qa_status", seller_id: user.id, status: "ok" });

    return new Response(
      JSON.stringify({
        appEnvironment: info.appEnvironment,
        buildCommit: info.buildCommit,
        connectionExists: Boolean(conn),
        connectionStatus: conn?.status ?? null,
        tokenSecretPresent: Boolean(conn?.token_secret_id),
        companyInfoRetrieved: snapshotCount > 0,
        companyInfoSnapshotCount: snapshotCount,
        connectedAt: conn?.connected_at ?? null,
        lastVerifiedAt: conn?.last_synced_at ?? null,
        safeLastErrorCode,
        latestCorrelationId: cid,
        migrationVersion: MIGRATION_VERSION,
      }),
      { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  } catch (e) {
    logSafe({ correlation_id: cid, action: "qa_status", status: "error", error: safeError(e) });
    return jsonError(QB_ERROR.noConnection, cid, 500, origin);
  }
});
