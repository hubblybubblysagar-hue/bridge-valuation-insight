import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { DemoStage } from "@/components/DemoStage";
import { BuyerLayout } from "@/components/BuyerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEMO_BUYER_EMAIL,
  DEMO_DEALS,
  setState,
  useAppState,
  type AppState,
} from "@/lib/store";

export const Route = createFileRoute("/demo/buyer/nda-request")({
  head: () => ({ meta: [{ title: "QA — NDA request" }] }),
  component: () => (
    <DemoStage stage="buyer-nda-request" label="QA Mode · NDA Request">
      <NDARequestDemo />
    </DemoStage>
  ),
});

function NDARequestDemo() {
  const ndas = useAppState((s) => s.ndaRequests);
  const [open, setOpen] = useState(true);
  const deal = DEMO_DEALS[0];
  const [name, setName] = useState("Alex Reviewer");
  const [email, setEmail] = useState(DEMO_BUYER_EMAIL);
  const [agreed, setAgreed] = useState(true);
  const [signature, setSignature] = useState("Alex Reviewer");

  return (
    <BuyerLayout>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-gold">
          Confidential Opportunity
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Request NDA access
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Reviewing: <span className="font-medium text-foreground">{deal.title}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">
            Anonymous
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{deal.title}</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <Meta k="Industry" v={deal.industry} />
            <Meta k="Region" v={deal.region} />
            <Meta k="Revenue" v={deal.revenue} />
            <Meta k="Adjusted SDE" v={deal.sde} />
          </dl>
          <Button
            className="mt-6 w-full bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground"
            onClick={() => setOpen(true)}
          >
            Open NDA request form
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h3 className="text-sm font-semibold text-foreground">Your NDA requests</h3>
          {ndas.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No NDA requests yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {ndas.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-success"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">{n.dealTitle}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link
              to="/buyer/ndas"
              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              View full NDA history →
            </Link>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request NDA access</DialogTitle>
          </DialogHeader>
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
              setOpen(false);
            }}
          >
            <div className="text-sm text-muted-foreground">
              Opportunity:{" "}
              <span className="font-medium text-foreground">{deal.title}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Buyer name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={agreed}
                onCheckedChange={(c) => setAgreed(!!c)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                I agree to keep this opportunity confidential and not contact the
                business directly.
              </span>
            </label>
            <div className="space-y-1.5">
              <Label>Digital signature (type full name)</Label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Jane Doe"
                className="font-serif italic"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gold text-gold-foreground hover:bg-gold/90"
              >
                Request Access
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
