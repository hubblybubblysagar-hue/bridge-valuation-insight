import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { PageHeading, SourceChip } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  setState,
  useAppState,
  type Financials,
  type FinancialsProvenance,
} from "@/lib/store";
import { computeSDE, fmtCurrency } from "@/lib/valuation";
import { persistFinancials } from "@/lib/persist";
import { loadLatestAnnualPnL } from "@/lib/quickbooks";

export const Route = createFileRoute("/seller/financial-review")({
  head: () => ({ meta: [{ title: "Financial review — ExitBridge" }] }),
  component: ReviewPage,
});

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function ReviewPage() {
  const navigate = useNavigate();
  const financials = useAppState((s) => s.financials);
  const source = useAppState((s) => s.financialsSource);
  const provenance = useAppState((s) => s.financialsProvenance);
  const [form, setForm] = useState<Financials | null>(financials);
  const [loadingReal, setLoadingReal] = useState(!financials);

  // When nothing is loaded, try to source real figures from the latest synced P&L.
  useEffect(() => {
    if (financials) return;
    let cancelled = false;
    (async () => {
      const pnl = await loadLatestAnnualPnL();
      if (cancelled) return;
      if (pnl && pnl.revenue != null && pnl.netIncome != null) {
        const f: Financials = {
          revenue: pnl.revenue,
          grossProfit: pnl.grossProfit ?? 0,
          operatingExpenses: pnl.operatingExpenses ?? 0,
          netIncome: pnl.netIncome,
          ownerCompensation: 0,
          oneTimeExpenses: 0,
          personalAddbacks: 0,
          otherAddbacks: 0,
        };
        const prov: FinancialsProvenance = {
          snapshotId: pnl.snapshotId,
          periodStart: pnl.periodStart,
          periodEnd: pnl.periodEnd,
          basis: pnl.basis,
          fetchedAt: pnl.fetchedAt,
        };
        setForm(f);
        setState({ financials: f, financialsSource: "quickbooks", financialsProvenance: prov });
      }
      setLoadingReal(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [financials]);

  useEffect(() => {
    if (financials && !form) setForm(financials);
  }, [financials, form]);

  if (loadingReal) {
    return (
      <SellerLayout>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Looking for synced QuickBooks financials…
        </div>
      </SellerLayout>
    );
  }

  if (!form) {
    return (
      <SellerLayout>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Connect QuickBooks first to load financials.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/seller/connect" })}>
            Connect QuickBooks
          </Button>
        </div>
      </SellerLayout>
    );
  }

  const sde = computeSDE(form);
  const set = (k: keyof Financials) => (v: number) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const isQuickBooks = source === "quickbooks";
  const baseSource = isQuickBooks ? "quickbooks" : source === "sample" ? "sample" : "seller";

  const onContinue = async () => {
    setState({ financials: form });
    try {
      const persistSource =
        source === "quickbooks" ? "quickbooks" : source === "sample" ? "quickbooks_mock" : "manual";
      const rawPayload = provenance
        ? { provenance }
        : source === "sample"
          ? { sample: true }
          : undefined;
      await persistFinancials(form, persistSource, rawPayload);
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }
    toast.success("Financials saved");
    navigate({ to: "/seller/risk" });
  };

  return (
    <SellerLayout>
      <PageHeading
        eyebrow={{ index: "03", label: "Normalize" }}
        title="Review your normalized earnings"
        description="Confirm the figures below and add back items a new owner wouldn't inherit. This becomes your Adjusted SDE."
      />

      {/* Source banner — trust labels are explicit, never implied */}
      {isQuickBooks && (
        <div
          data-testid="source-banner-quickbooks"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-foreground"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          <p className="min-w-0 flex-1">
            Base figures come from your synced QuickBooks Profit &amp; Loss
            {provenance?.periodStart ? ` (${fmtPeriod(provenance.periodStart, provenance.periodEnd)}${provenance.basis ? `, ${provenance.basis} basis` : ""})` : ""}
            . Add-backs below are yours to adjust.
          </p>
          {provenance && (
            <Link
              to="/seller/financial-vault/report/$snapshotId"
              params={{ snapshotId: provenance.snapshotId }}
              className="text-sm font-medium text-success underline underline-offset-4 hover:opacity-80"
            >
              Inspect source report
            </Link>
          )}
        </div>
      )}
      {source === "sample" && (
        <div
          data-testid="source-banner-sample"
          className="mb-6 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-foreground"
        >
          <p>
            <span className="font-semibold">Sample data — demonstration only.</span> No QuickBooks
            sync is behind these numbers. Connect QuickBooks to replace them with your real
            financials.
          </p>
        </div>
      )}
      {(source === "manual" || source === "upload") && (
        <div
          data-testid="source-banner-manual"
          className="mb-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          These figures were provided by you (not synced from an accounting system).
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <ReadOnly label="Revenue" value={form.revenue} source={baseSource} />
          <ReadOnly label="Gross profit" value={form.grossProfit} source={baseSource} />
          <ReadOnly label="Operating expenses" value={form.operatingExpenses} source={baseSource} />
          <ReadOnly label="Net income" value={form.netIncome} source={baseSource} />
          <Editable
            label="Owner compensation"
            value={form.ownerCompensation}
            onChange={set("ownerCompensation")}
          />
          <Editable
            label="One-time expenses"
            value={form.oneTimeExpenses}
            onChange={set("oneTimeExpenses")}
          />
          <Editable
            label="Personal / discretionary addbacks"
            value={form.personalAddbacks}
            onChange={set("personalAddbacks")}
          />
          <Editable label="Other addbacks" value={form.otherAddbacks} onChange={set("otherAddbacks")} />
        </div>

        <aside className="rounded-2xl border border-gold/40 bg-card p-6 shadow-premium">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
            Adjusted SDE bridge
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="What is SDE?"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Seller&apos;s Discretionary Earnings estimates the total financial benefit
                  available to one owner-operator before buyer-specific financing decisions.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Bridge: each line carries its origin */}
          <dl className="mt-4 space-y-2 text-sm" data-testid="sde-bridge">
            <BridgeRow
              label="Net income"
              value={form.netIncome}
              source={baseSource}
            />
            <BridgeRow label="Owner compensation" value={form.ownerCompensation} source="seller" add />
            <BridgeRow label="One-time expenses" value={form.oneTimeExpenses} source="seller" add />
            <BridgeRow label="Personal addbacks" value={form.personalAddbacks} source="seller" add />
            <BridgeRow label="Other addbacks" value={form.otherAddbacks} source="seller" add />
          </dl>

          <div className="mt-4 border-t border-border pt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Estimated Adjusted SDE
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {fmtCurrency(sde)}
            </div>
          </div>

          <Button
            className="mt-6 w-full bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={onContinue}
          >
            Continue to risk questions
          </Button>
        </aside>
      </div>
    </SellerLayout>
  );
}

function BridgeRow({
  label,
  value,
  source,
  add,
}: {
  label: string;
  value: number;
  source: "quickbooks" | "sample" | "seller";
  add?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
        <span>
          {add ? "+ " : ""}
          {label}
        </span>
        <SourceChip source={source} />
      </dt>
      <dd className="shrink-0 tabular-nums text-foreground">{fmtCurrency(value)}</dd>
    </div>
  );
}

function ReadOnly({
  label,
  value,
  source,
}: {
  label: string;
  value: number;
  source: "quickbooks" | "sample" | "seller";
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{fmtCurrency(value)}</div>
      <div className="mt-2">
        <SourceChip source={source} />
      </div>
    </div>
  );
}

function Editable({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type="number"
        className="mt-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Seller adjustment
      </div>
    </div>
  );
}
