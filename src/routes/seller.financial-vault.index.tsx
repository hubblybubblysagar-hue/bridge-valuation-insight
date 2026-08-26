import { createFileRoute, Link } from "@tanstack/react-router";
// Snapshot lifecycle labels shown on vault cards.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { PageHeading, SectionCard, SourceChip } from "@/components/workspace";
import { fmtDateOnly } from "@/lib/date-only";
import { reparseQuickBooksSnapshots } from "@/lib/qb-sync.functions";
import { Button } from "@/components/ui/button";
import {
  loadVaultData,
  syncFinancials,
  type VaultData,
  type VaultSnapshotMeta,
} from "@/lib/quickbooks";
import {
  SYNC_REPORT_TYPE_LABELS,
  type SyncReportType,
} from "@/lib/qb-report-plan";

export const Route = createFileRoute("/seller/financial-vault/")({
  head: () => ({ meta: [{ title: "Financial Vault — ExitBridge" }] }),
  component: FinancialVaultPage,
});

const SECTIONS: {
  id: string;
  title: string;
  description: string;
  types: SyncReportType[];
}[] = [
  {
    id: "core",
    title: "Core financials",
    description: "The statements buyers and lenders ask for first.",
    types: ["profit_and_loss", "balance_sheet", "cash_flow"],
  },
  {
    id: "working-capital",
    title: "Working capital",
    description: "What the business is owed — and what it owes.",
    types: ["aged_receivables", "aged_payables"],
  },
  {
    id: "accounting",
    title: "Accounting detail",
    description: "The underlying ledger structure behind the statements.",
    types: ["trial_balance", "account_list"],
  },
  {
    id: "company",
    title: "Company",
    description: "The verified identity of the connected QuickBooks company.",
    types: ["company_info"],
  },
];

const SNAPSHOT_STATUS_LABELS: Record<string, string> = {
  ready: "Validated",
  validated: "Validated",
  reconciled: "Reconciled",
  parsed: "Parsed",
  retrieved: "Retrieved",
  empty_source: "Empty source",
  parse_failed: "Parse failed",
  validation_failed: "Check failed",
  reconciliation_warning: "Reconciliation warning",
  api_failed: "API failed",
  persistence_failed: "Save failed",
  synced: "Synced",
};

function snapshotStatusLabel(status: string): string {
  return SNAPSHOT_STATUS_LABELS[status] ?? status;
}

function fmtDate(iso: string | null | undefined): string {
  // Report periods are date-only values — render without timezone math.
  return fmtDateOnly(iso);
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function periodLabel(s: VaultSnapshotMeta): string {
  if (s.periodStart && s.periodEnd) return `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`;
  if (s.periodEnd) return `As of ${fmtDate(s.periodEnd)}`;
  return "Current";
}

/** Latest snapshot per (report type, period) — input is fetched_at desc. */
function latestSnapshots(snapshots: VaultSnapshotMeta[]): VaultSnapshotMeta[] {
  const seen = new Set<string>();
  const out: VaultSnapshotMeta[] = [];
  for (const s of snapshots) {
    const key = `${s.reportType}|${s.periodStart ?? ""}|${s.periodEnd ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function FinancialVaultPage() {
  const [data, setData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reparsing, setReparsing] = useState(false);

  const reload = useCallback(async () => {
    const fresh = await loadVaultData();
    setData(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const latest = useMemo(() => latestSnapshots(data?.snapshots ?? []), [data]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await syncFinancials();
      if (result.status === "completed") {
        toast.success(`Synced ${result.successfulCount} reports from QuickBooks`);
      } else if (result.status === "partial") {
        toast.warning(
          `Synced ${result.successfulCount} reports; ${result.failedCount} could not be retrieved.`,
        );
      } else {
        toast.error("The QuickBooks sync could not retrieve reports. Try again shortly.");
      }
      await reload();
    } catch (e) {
      toast.error((e as Error).message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const runReparse = async () => {
    setReparsing(true);
    try {
      const r = await reparseQuickBooksSnapshots();
      toast.success(
        r.reparsed > 0
          ? `Re-parsed ${r.reparsed} stored reports with the current parser (source data untouched).`
          : "All stored reports already use the current parser.",
      );
      await reload();
    } catch (e) {
      toast.error((e as Error).message || "Re-parse failed");
    } finally {
      setReparsing(false);
    }
  };

  const connected =
    data?.connection?.status === "connected" && data.connection.tokenSecretPresent;

  return (
    <SellerLayout>
      <PageHeading
        eyebrow={{ index: "02", label: "Verify" }}
        title="Financial Vault"
        description="Your transaction-preparation workspace. Every document here is retrieved read-only from QuickBooks, stored immutably, and traceable to its source."
      />

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your vault…
        </div>
      ) : !connected ? (
        <div
          data-testid="vault-empty"
          className="rounded-2xl border border-border bg-card p-10 text-center shadow-elegant"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-navy-foreground dark:bg-gold dark:text-gold-foreground">
            <Landmark className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-2xl text-foreground">
            The vault fills itself once QuickBooks is connected
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Connect your QuickBooks company and ExitBridge will retrieve your financial statements
            read-only — never writing to your books.
          </p>
          <Button asChild className="mt-6 bg-gold text-gold-foreground hover:bg-gold/90">
            <Link to="/seller/connect">
              Connect QuickBooks <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="QuickBooks source"
            description="Read-only access. Reports are snapshotted immutably — every sync creates new versions, never edits history."
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={runReparse}
                  disabled={reparsing || syncing}
                  data-testid="vault-reparse-button"
                >
                  {reparsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Re-parsing…
                    </>
                  ) : (
                    "Re-parse stored reports"
                  )}
                </Button>
                <Button
                  onClick={runSync}
                  disabled={syncing || reparsing}
                  data-testid="vault-sync-button"
                  className="bg-gold text-gold-foreground hover:bg-gold/90"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing reports…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" /> Sync from QuickBooks
                    </>
                  )}
                </Button>
              </div>
            }
            testId="vault-source"
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <Meta label="Company">{data?.connection?.companyName ?? "—"}</Meta>
              <Meta label="Realm">{data?.connection?.realmIdMasked || "—"}</Meta>
              <Meta label="Last synced">{fmtDateTime(data?.connection?.lastSyncedAt)}</Meta>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SourceChip source="quickbooks" />
              {data?.connection?.environment === "sandbox" && (
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sandbox
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> GET-only requests · tokens stay
                server-side
              </span>
            </div>
          </SectionCard>

          {latest.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No reports synced yet. Run your first sync to populate the vault with your P&amp;L,
                balance sheet, cash flow, and more.
              </p>
            </div>
          ) : (
            SECTIONS.map((section) => {
              const items = latest.filter((s) =>
                section.types.includes(s.reportType as SyncReportType),
              );
              if (items.length === 0) return null;
              return (
                <SectionCard
                  key={section.id}
                  title={section.title}
                  description={section.description}
                  testId={`vault-section-${section.id}`}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((s) => (
                      <Link
                        key={s.id}
                        to="/seller/financial-vault/report/$snapshotId"
                        params={{ snapshotId: s.id }}
                        data-testid="vault-report-card"
                        className="group flex flex-col rounded-xl border border-border bg-background p-4 transition-colors hover:border-gold/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground">
                            {SYNC_REPORT_TYPE_LABELS[s.reportType as SyncReportType] ??
                              s.reportType}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{periodLabel(s)}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <SourceChip source="quickbooks" />
                          {s.reportBasis && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {s.reportBasis}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span
                            data-testid="vault-snapshot-status"
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              s.status === "ready" || s.status === "validated" || s.status === "reconciled"
                                ? "bg-success/10 text-success"
                                : s.status === "empty_source"
                                  ? "bg-muted text-muted-foreground"
                                  : s.status.endsWith("_failed") || s.status === "validation_failed"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {snapshotStatusLabel(s.status)}
                          </span>
                          <span>
                            {fmtDateTime(s.fetchedAt)}
                            {s.rowCount != null && s.rowCount > 0 ? ` · ${s.rowCount} rows` : ""}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </SectionCard>
              );
            })
          )}

          {data && data.runs.length > 0 && (
            <SectionCard
              title="Sync history"
              description="Every retrieval is auditable — expand a run to see each request, its outcome, and safe error references."
              testId="vault-runs"
            >
              <ul className="divide-y divide-border">
                {data.runs.map((run) => (
                  <li key={run.id} data-testid="vault-run-row" className="py-1">
                    <details className="group">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div className="flex items-center gap-3">
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              run.status === "completed"
                                ? "bg-success/10 text-success"
                                : run.status === "running"
                                  ? "bg-muted text-muted-foreground"
                                  : run.status === "partial"
                                    ? "bg-gold/15 text-gold"
                                    : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {run.status}
                          </span>
                          <span className="text-foreground">
                            {run.successfulCount} synced
                            {run.failedCount > 0 ? ` · ${run.failedCount} failed` : ""}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {fmtDateTime(run.completedAt ?? run.startedAt)}
                        </span>
                      </summary>
                      {run.results.length === 0 ? (
                        <p className="px-7 pb-3 text-xs text-muted-foreground">
                          No per-request manifest was recorded for this run.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 px-7 pb-3" data-testid="vault-run-manifest">
                          {run.results.map((item, i) => (
                            <li
                              key={i}
                              className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-foreground">
                                {item.label ??
                                  SYNC_REPORT_TYPE_LABELS[item.reportType as SyncReportType] ??
                                  item.reportType}
                              </span>
                              {item.kind === "company_metadata" && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  metadata
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  item.status === "ready" ||
                                  item.status === "validated" ||
                                  item.status === "retrieved"
                                    ? "bg-success/10 text-success"
                                    : item.status === "empty_source"
                                      ? "bg-muted text-muted-foreground"
                                      : "bg-destructive/10 text-destructive"
                                }`}
                              >
                                {snapshotStatusLabel(item.status)}
                              </span>
                              <span className="text-muted-foreground">
                                {item.financialRowCount != null && item.financialRowCount > 0
                                  ? `${item.financialRowCount} financial rows`
                                  : item.rowCount
                                    ? `${item.rowCount} rows`
                                    : "—"}
                              </span>
                              {item.httpStatus != null && (
                                <span className="text-muted-foreground">HTTP {item.httpStatus}</span>
                              )}
                              {item.intuitErrorCode && (
                                <span className="text-muted-foreground">
                                  Intuit {item.intuitErrorCode}
                                </span>
                              )}
                              {item.errorCode && (
                                <span className="font-mono text-[10px] text-destructive">
                                  {item.errorCode}
                                </span>
                              )}
                              {item.attempts != null && item.attempts > 1 && (
                                <span className="text-muted-foreground">
                                  {item.attempts} attempts
                                </span>
                              )}
                              {item.fallbackOfPeriod && (
                                <span className="text-muted-foreground">narrowed retry</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

        </div>
      )}
    </SellerLayout>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
