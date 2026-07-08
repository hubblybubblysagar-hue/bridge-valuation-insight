import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { setState, useAppState } from "@/lib/store";

export const Route = createFileRoute("/seller/buyer-interest")({
  head: () => ({ meta: [{ title: "Buyer interest — ExitBridge" }] }),
  component: BuyerInterestPage,
});

const CATEGORIES = [
  { name: "Individual acquisition entrepreneurs", count: 14 },
  { name: "Search fund buyers", count: 9 },
  { name: "Strategic acquirers", count: 6 },
  { name: "Small private equity groups", count: 5 },
  { name: "Local operators", count: 3 },
];

function BuyerInterestPage() {
  const approved = useAppState((s) => s.outreachApproved);
  const valuation = useAppState((s) => s.valuation);
  const [confirming, setConfirming] = useState(false);

  return (
    <SellerLayout>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-gold">Private Buyer Interest Test</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {valuation
            ? "Based on your business profile, ExitBridge found potential buyer matches."
            : "Complete your valuation to see potential buyer matches."}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          37 matched buyer profiles across five categories. Your business will
          never be shared publicly. Outreach only happens after you approve.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {CATEGORIES.map((c) => (
            <div key={c.name} className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-elegant">
              <div>
                <div className="text-sm font-semibold text-foreground">{c.name}</div>
                <div className="text-xs text-muted-foreground">Anonymous profile match</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-foreground">{c.count}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">matches</div>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-gold" />
              <p className="text-sm text-muted-foreground">
                Your business will never be shared publicly. Buyer outreach uses
                only your anonymous teaser and only happens after you approve.
              </p>
            </div>
          </div>

          {approved ? (
            <div className="rounded-2xl border border-success/30 bg-success/10 p-6 text-sm text-foreground">
              <CheckCircle2 className="mb-2 h-5 w-5 text-success" />
              Your anonymous teaser has been queued for confidential buyer
              interest testing. We'll notify you as matched buyers respond.
            </div>
          ) : (
            <>
              <Button
                size="lg"
                disabled={!valuation || confirming}
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                onClick={() => {
                  setConfirming(true);
                  setTimeout(() => {
                    setState({ outreachApproved: true });
                    toast.success("Anonymous outreach approved");
                    setConfirming(false);
                  }, 800);
                }}
              >
                <Users className="mr-2 h-4 w-4" /> Approve anonymous outreach
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <a href="mailto:hello@exitbridge.example?subject=ExitBridge%20Snapshot">
                  Schedule founder-reviewed Snapshot
                </a>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full">
                <Link to="/seller">Not ready yet</Link>
              </Button>
            </>
          )}

          <div className="rounded-2xl border border-gold/40 bg-card p-6 shadow-premium">
            <div className="text-xs font-semibold uppercase tracking-widest text-gold">Upgrade</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Upgrade to a founder-reviewed ExitBridge Snapshot for $499 to have
              our team refine the valuation memo and buyer targeting.
            </p>
          </div>
        </aside>
      </div>
    </SellerLayout>
  );
}
