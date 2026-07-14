import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { setState, useAppState, type Financials } from "@/lib/store";
import { computeSDE, fmtCurrency } from "@/lib/valuation";
import { persistFinancials } from "@/lib/persist";

export const Route = createFileRoute("/seller/financial-review")({
  head: () => ({ meta: [{ title: "Financial review — ExitBridge" }] }),
  component: ReviewPage,
});

export function ReviewPage() {
  const navigate = useNavigate();
  const financials = useAppState((s) => s.financials);
  const [form, setForm] = useState<Financials | null>(financials);

  useEffect(() => {
    if (financials && !form) setForm(financials);
  }, [financials, form]);

  if (!form) {
    return (
      <SellerLayout>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Connect QuickBooks first to load financials.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/seller/connect" })}>Connect QuickBooks</Button>
        </div>
      </SellerLayout>
    );
  }

  const sde = computeSDE(form);
  const set = (k: keyof Financials) => (v: number) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <SellerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Review your normalized earnings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Confirm the QuickBooks-derived financials and add back items that a
          new owner wouldn't inherit. This becomes your Adjusted SDE.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <ReadOnly label="Revenue" value={form.revenue} />
          <ReadOnly label="Gross profit" value={form.grossProfit} />
          <ReadOnly label="Operating expenses" value={form.operatingExpenses} />
          <ReadOnly label="Net income" value={form.netIncome} />
          <Editable label="Owner compensation" value={form.ownerCompensation} onChange={set("ownerCompensation")} />
          <Editable label="One-time expenses" value={form.oneTimeExpenses} onChange={set("oneTimeExpenses")} />
          <Editable label="Personal / discretionary addbacks" value={form.personalAddbacks} onChange={set("personalAddbacks")} />
          <Editable label="Other addbacks" value={form.otherAddbacks} onChange={set("otherAddbacks")} />
        </div>

        <aside className="rounded-2xl border border-gold/40 bg-card p-6 shadow-premium">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
            Estimated Adjusted SDE
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="What is SDE?" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Seller's Discretionary Earnings estimates the total financial
                  benefit available to one owner-operator before buyer-specific
                  financing decisions.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{fmtCurrency(sde)}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            Net income + owner comp + one-time expenses + personal addbacks + other addbacks.
          </p>
          <Button
            className="mt-6 w-full bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={async () => {
              setState({ financials: form });
              try { await persistFinancials(form, "manual"); } catch (err) { toast.error((err as Error).message); return; }
              toast.success("Financials saved");
              navigate({ to: "/seller/risk" });
            }}
          >
            Continue to risk questions
          </Button>
        </aside>
      </div>
    </SellerLayout>
  );
}

function ReadOnly({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{fmtCurrency(value)}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">From QuickBooks</div>
    </div>
  );
}

function Editable({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type="number"
        className="mt-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
