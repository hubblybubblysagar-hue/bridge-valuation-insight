import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchCompanyInfoForConnection,
  listConnectionsForSeller,
  reparseStoredSnapshots,
  syncConnectionFinancials,
  SyncError,
} from "./qb-sync.server";
import type { SyncRunResult } from "./qb-report-plan";

export interface QbConnectionSummary {
  id: string;
  businessId: string | null;
  realmId: string;
  environment: string;
  companyName: string | null;
  status: string;
}

export const getQuickBooksConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QbConnectionSummary[]> => {
    const rows = await listConnectionsForSeller(context.supabase as never, context.userId);
    return rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      realmId: r.realm_id,
      environment: r.environment,
      companyName: r.company_name,
      status: r.status,
    }));
  });

export const verifyQuickBooksConnection = createServerFn({ method: "POST" })
  .inputValidator((data: { connectionId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const rows = await listConnectionsForSeller(context.supabase as never, context.userId);
    const connection = rows.find((r) => r.id === data.connectionId);
    if (!connection) throw new Error("Connection not found");
    try {
      return await fetchCompanyInfoForConnection(context.supabase as never, connection);
    } catch (err) {
      if (err instanceof SyncError) throw new Error(`${err.code}: ${err.message}`);
      throw err;
    }
  });

export const syncQuickBooksFinancials = createServerFn({ method: "POST" })
  .inputValidator((data: { connectionId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<SyncRunResult> => {
    const rows = await listConnectionsForSeller(context.supabase as never, context.userId);
    const connection = rows.find((r) => r.id === data.connectionId);
    if (!connection) throw new Error("Connection not found");
    try {
      return await syncConnectionFinancials(context.supabase as never, connection);
    } catch (err) {
      if (err instanceof SyncError) throw new Error(`${err.code}: ${err.message}`);
      throw err;
    }
  });

/**
 * Re-run the current parser over existing snapshots in place. Only
 * normalized_payload / row_count / status change — raw source data is
 * immutable and never rewritten.
 */
export const reparseQuickBooksSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return reparseStoredSnapshots(context.supabase as never, context.userId);
  });
