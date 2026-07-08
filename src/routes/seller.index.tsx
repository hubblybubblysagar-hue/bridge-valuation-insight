import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSpreadsheet, Keyboard, Lock } from "lucide-react";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/seller/")({
  head: () => ({ meta: [{ title: "Seller workspace — ExitBridge" }] }),
  component: SellerHome,
});

function SellerHome() {
  const qb = useAppState((s) => s.qbConnected);
  const valuation = useAppState((s) => s.valuation);

  return (
    <SellerLayout>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-gold">Welcome</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Let's see what your business could be worth.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Connect QuickBooks to generate a confidential valuation range and
          anonymous buyer-ready teaser. You control everything from here.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-navy-foreground dark:bg-gold dark:text-gold-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Start with QuickBooks</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ExitBridge uses read-only access to analyze your financial
                statements. We never modify your books, contact your customers,
                or list your business without approval.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/seller/connect">
                {qb ? "Continue QuickBooks flow" : "Connect QuickBooks"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {valuation && (
              <Button asChild variant="outline" size="lg">
                <Link to="/seller/valuation">View my valuation</Link>
              </Button>
            )}
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <FallbackCard icon={FileSpreadsheet} title="Upload financials" body="P&L, CSV, or PDF export" to="/seller/connect" />
            <FallbackCard icon={Keyboard} title="Enter numbers manually" body="Rough figures are fine to start" to="/seller/connect" />
          </div>
        </div>
        <aside className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h3 className="text-sm font-semibold text-foreground">Your commitments to yourself</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> Anonymous by default</li>
            <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> No public listing</li>
            <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> You approve any buyer outreach</li>
            <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> Preliminary valuation, not a certified appraisal</li>
          </ul>
        </aside>
      </div>
    </SellerLayout>
  );
}

function FallbackCard({ icon: Icon, title, body, to }: { icon: typeof Lock; title: string; body: string; to: string }) {
  return (
    <Link
      to={to as "/seller/connect"}
      className="group flex items-start gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-navy/40 dark:hover:border-gold/40"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </Link>
  );
}
