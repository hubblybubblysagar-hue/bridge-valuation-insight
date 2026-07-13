import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Sparkles, TrendingUp, Users } from "lucide-react";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/store";
import { fmtCurrency } from "@/lib/valuation";

export const Route = createFileRoute("/seller/valuation")({
  head: () => ({ meta: [{ title: "Your valuation — ExitBridge" }] }),
  component: ValuationPage,
});

export function ValuationPage() {
  const navigate = useNavigate();
  const v = useAppState((s) => s.valuation);
  const business = useAppState((s) => s.business);

  if (!v) {
    return (
      <SellerLayout>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Complete the valuation flow to see your preliminary range.</p>
          <Button className="mt-4 bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => navigate({ to: "/seller/connect" })}>
            Start valuation
          </Button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-gold">Preliminary Business Value</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Your confidential valuation range
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A directional estimate based on owner-provided and QuickBooks-connected
          financials. Not a certified appraisal.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gold/40 bg-card p-8 shadow-premium">
          <div className="flex flex-wrap items-end gap-8">
            <ValueColumn label="Low" value={v.low} muted />
            <ValueColumn label="Base" value={v.base} big />
            <ValueColumn label="High" value={v.high} muted />
          </div>
          <div className="mt-8 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-gradient-to-r from-navy via-gold to-navy dark:from-gold/30 dark:via-gold dark:to-gold/30" />
          </div>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <Stat label="Adjusted SDE" value={fmtCurrency(v.sde)} />
            <Stat label="Implied SDE multiple" value={`${v.multipleLow}x – ${v.multipleHigh}x`} />
            <Stat label="Confidence" value={v.confidence} />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Methodology.</strong> ExitBridge
            estimates Adjusted SDE from connected or owner-provided financials,
            applies an industry benchmark multiple, and adjusts the range based
            on revenue quality, owner dependence, customer concentration,
            transition support, and financial documentation quality.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            This is a preliminary directional estimate, not a certified
            appraisal, fairness opinion, tax opinion, legal advice, or
            financing commitment.
          </p>
        </div>

        <aside className="space-y-4">
          <Button asChild size="lg" className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
            <Link to="/seller/teaser">Generate anonymous teaser <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href="mailto:hello@exitbridge.example?subject=ExitBridge%20Snapshot">
              Book founder-reviewed Snapshot — $499
            </a>
          </Button>
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            Industry: <span className="font-medium text-foreground">{business?.industry ?? "—"}</span>.
            Multiples and adjustments update as your inputs change.
          </div>
        </aside>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <InsightCard icon={TrendingUp} title="Key value drivers" items={v.drivers} tone="gold" />
        <InsightCard icon={AlertTriangle} title="Key buyer concerns" items={v.concerns.length ? v.concerns : ["No material concerns flagged by the questionnaire."]} tone="muted" />
        <InsightCard icon={Sparkles} title="What could increase value before sale" items={v.upside.length ? v.upside : ["Continue institutionalizing operations and diversifying revenue."]} tone="gold" />
        <InsightCard icon={Users} title="Likely buyer types" items={v.buyerTypes} tone="muted" />
        <InsightCard icon={TrendingUp} title="Financing readiness" items={[
          v.sde > 250000 ? "SDE profile is generally consistent with SBA acquisition financing." : "SDE profile may require creative financing structures.",
          "Buyers will typically require reviewed financials before term sheets.",
        ]} tone="muted" />
        <InsightCard icon={AlertTriangle} title="Owner dependence risk" items={[
          v.drivers.find((d) => d.toLowerCase().includes("institution")) ?? "Reduce day-to-day owner dependence to widen buyer pool.",
        ]} tone="muted" />
      </div>
    </SellerLayout>
  );
}

function ValueColumn({ label, value, big, muted }: { label: string; value: number; big?: boolean; muted?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-semibold tracking-tight ${big ? "text-4xl text-foreground sm:text-5xl" : "text-2xl"} ${muted ? "text-muted-foreground" : ""}`}>
        {fmtCurrency(value)}
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, items, tone }: { icon: typeof Users; title: string; items: string[]; tone: "gold" | "muted" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className={`h-4 w-4 ${tone === "gold" ? "text-gold" : "text-muted-foreground"}`} />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "gold" ? "bg-gold" : "bg-navy/50 dark:bg-gold/50"}`} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
