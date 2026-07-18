import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BuyerLayout } from "@/components/BuyerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppState } from "@/lib/store";
import { loadApprovedTeasers, submitNdaRequest, type ApprovedTeaser } from "@/lib/persist";
import { INDUSTRIES } from "@/lib/valuation";

export const Route = createFileRoute("/buyer/")({
  head: () => ({ meta: [{ title: "Deal feed — ExitBridge" }] }),
  component: BuyerFeed,
});

interface Deal {
  id: string;
  business_id: string | null;
  title: string;
  industry: string;
  region: string;
  revenue: string;
  sde: string;
  status: string;
}

const FALLBACK_DEALS: Deal[] = [
  { id: "d1", business_id: null, title: "Home Services Company — Northeast", industry: "HVAC / Plumbing", region: "Northeast", revenue: "$2.6M – $3.1M", sde: "$540K – $660K", status: "Exploratory" },
  { id: "d2", business_id: null, title: "Profitable E-commerce Brand — Southwest", industry: "E-commerce", region: "Southwest", revenue: "$4.1M – $4.8M", sde: "$720K – $860K", status: "Exploratory" },
  { id: "d3", business_id: null, title: "B2B SaaS Business — Remote", industry: "SaaS", region: "Remote", revenue: "$1.8M – $2.2M", sde: "$450K – $560K", status: "Exploratory" },
];

function teaserToDeal(t: ApprovedTeaser): Deal {
  const snap = (t.financial_snapshot ?? {}) as { revenue_range?: string; sde_range?: string; region?: string };
  const industryLabel = INDUSTRIES.find((i) => i.value === t.industry)?.label ?? t.industry ?? "Business";
  return {
    id: t.id,
    business_id: t.business_id,
    title: t.title ?? industryLabel,
    industry: industryLabel,
    region: snap.region ?? t.region ?? "—",
    revenue: snap.revenue_range ?? "—",
    sde: snap.sde_range ?? "—",
    status: "Exploratory",
  };
}

export function BuyerFeed() {
  const user = useAppState((s) => s.user);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const isDemo = user?.id?.startsWith("demo-");

  useEffect(() => {
    if (isDemo) {
      setDeals(FALLBACK_DEALS);
      return;
    }
    loadApprovedTeasers()
      .then((teasers) => setDeals(teasers.map(teaserToDeal)))
      .catch(() => setDeals([]));
  }, [isDemo]);

  return (
    <BuyerLayout>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-gold">Confidential Opportunities</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Deal feed</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Anonymous, seller-approved opportunities matched to your criteria.
          Request NDA access to explore any that fit.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-elegant">
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">No opportunities yet</div>
          <h3 className="mt-2 text-lg font-semibold text-foreground">Your matched deal feed is empty</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            When a seller approves an anonymous teaser that matches your acquisition criteria,
            it will appear here. You'll be notified as new opportunities are added.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {deals.map((d) => {
            const already = submitted.has(d.id);
            return (
              <div key={d.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-elegant">
                <div className="text-xs font-semibold uppercase tracking-widest text-gold">Anonymous</div>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{d.title}</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <Meta k="Industry" v={d.industry} />
                  <Meta k="Region" v={d.region} />
                  <Meta k="Revenue" v={d.revenue} />
                  <Meta k="Adjusted SDE" v={d.sde} />
                </dl>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  Status: {d.status}
                </div>
                <div className="mt-6 flex-1" />
                {already ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> NDA request submitted
                  </div>
                ) : (
                  <Button onClick={() => setOpen(d.id)} className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground">
                    Request NDA Access
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NDADialog
        deal={deals.find((d) => d.id === open) ?? null}
        onClose={() => setOpen(null)}
        onSubmitted={(id) => setSubmitted((prev) => new Set(prev).add(id))}
        defaultEmail={user?.email ?? ""}
        isDemo={!!isDemo}
      />
    </BuyerLayout>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-foreground">{v}</div>
    </div>
  );
}

function NDADialog({
  deal,
  onClose,
  onSubmitted,
  defaultEmail,
  isDemo,
}: {
  deal: Deal | null;
  onClose: () => void;
  onSubmitted: (id: string) => void;
  defaultEmail: string;
  isDemo: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open={!!deal} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request NDA access</DialogTitle>
        </DialogHeader>
        {deal && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!agreed) return toast.error("Please confirm confidentiality.");
              if (!signature.trim()) return toast.error("Please type your signature.");
              setSubmitting(true);
              try {
                if (!isDemo && deal.id.length > 20) {
                  await submitNdaRequest({
                    teaserId: deal.id,
                    businessId: deal.business_id,
                    buyerName: name,
                    buyerEmail: email,
                    signature,
                  });
                }
                onSubmitted(deal.id);
                toast.success("Your NDA request has been submitted. ExitBridge will notify the seller and coordinate next steps.");
                onClose();
                setName(""); setSignature(""); setAgreed(false);
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="text-sm text-muted-foreground">Opportunity: <span className="font-medium text-foreground">{deal.title}</span></div>
            <div className="space-y-1.5">
              <Label>Buyer name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
              <span className="text-muted-foreground">
                I agree to keep this opportunity confidential and not contact the business directly.
              </span>
            </label>
            <div className="space-y-1.5">
              <Label>Digital signature (type full name)</Label>
              <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Jane Doe" className="font-serif italic" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gold text-gold-foreground hover:bg-gold/90">
                {submitting ? "Submitting…" : "Request Access"}
              </Button>
            </DialogFooter>
            <p className="text-[11px] text-muted-foreground">
              ExitBridge will notify the seller and coordinate next steps.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
