import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BuyerLayout } from "@/components/BuyerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setState, useAppState, type AppState } from "@/lib/store";

export const Route = createFileRoute("/buyer/")({
  head: () => ({ meta: [{ title: "Deal feed — ExitBridge" }] }),
  component: BuyerFeed,
});

const DEALS = [
  {
    id: "d1",
    title: "Home Services Company — Northeast",
    industry: "HVAC / Plumbing",
    region: "Northeast",
    revenue: "$2.6M – $3.1M",
    sde: "$540K – $660K",
    status: "Exploratory",
  },
  {
    id: "d2",
    title: "Profitable E-commerce Brand — Southwest",
    industry: "E-commerce",
    region: "Southwest",
    revenue: "$4.1M – $4.8M",
    sde: "$720K – $860K",
    status: "Exploratory",
  },
  {
    id: "d3",
    title: "B2B SaaS Business — Remote",
    industry: "SaaS",
    region: "Remote",
    revenue: "$1.8M – $2.2M",
    sde: "$450K – $560K",
    status: "Exploratory",
  },
];

export function BuyerFeed() {
  const user = useAppState((s) => s.user);
  const ndas = useAppState((s) => s.ndaRequests);
  const [open, setOpen] = useState<string | null>(null);

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEALS.map((d) => {
          const already = ndas.some((n) => n.dealTitle === d.title);
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

      <NDADialog
        deal={DEALS.find((d) => d.id === open) ?? null}
        onClose={() => setOpen(null)}
        defaultEmail={user?.email ?? ""}
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
  defaultEmail,
}: {
  deal: { id: string; title: string } | null;
  onClose: () => void;
  defaultEmail: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");

  return (
    <Dialog open={!!deal} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request NDA access</DialogTitle>
        </DialogHeader>
        {deal && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!agreed) return toast.error("Please confirm confidentiality.");
              if (!signature.trim()) return toast.error("Please type your signature.");
              const req: AppState["ndaRequests"][number] = {
                id: crypto.randomUUID(),
                dealTitle: deal.title,
                buyerName: name,
                email,
                submittedAt: new Date().toISOString(),
              };
              setState((s) => ({ ndaRequests: [req, ...s.ndaRequests] }));
              toast.success("Your NDA request has been submitted.");
              onClose();
              setName(""); setSignature(""); setAgreed(false);
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
              <Button type="submit" className="bg-gold text-gold-foreground hover:bg-gold/90">Request Access</Button>
            </DialogFooter>
            <p className="text-[11px] text-muted-foreground">
              CIM access is coming soon. ExitBridge will notify the seller and coordinate next steps.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
