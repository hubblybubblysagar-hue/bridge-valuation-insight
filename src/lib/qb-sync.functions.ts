// Thin server-function wrapper for the QuickBooks financial sync.
// All logic lives in qb-sync.server.ts (loaded inside the handler so no
// server-only code reaches the client bundle).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SyncRunResult } from "./qb-report-plan";

export const syncQuickBooksFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = (input ?? {}) as { reportTypes?: unknown };
    const reportTypes =
      Array.isArray(d.reportTypes) && d.reportTypes.length > 0
        ? d.reportTypes.filter((t): t is string => typeof t === "string")
        : null;
    return { reportTypes };
  })
  .handler(async ({ data, context }): Promise<SyncRunResult> => {
    const { runFinancialSync } = await import("./qb-sync.server");
    return runFinancialSync(context.userId, context.supabase, data.reportTypes);
  });
