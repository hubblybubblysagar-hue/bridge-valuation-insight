import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setState, useAppState, type RiskAnswers } from "@/lib/store";
import { computeValuation } from "@/lib/valuation";

export const Route = createFileRoute("/seller/risk")({
  head: () => ({ meta: [{ title: "Buyer risk questions — ExitBridge" }] }),
  component: RiskPage,
});

function RiskPage() {
  const navigate = useNavigate();
  const business = useAppState((s) => s.business);
  const financials = useAppState((s) => s.financials);
  const existing = useAppState((s) => s.risk);
  const [form, setForm] = useState<RiskAnswers>(
    existing ?? {
      customerConcentration: "",
      ownerRelationships: "",
      transitionSupport: "",
      revenueType: "",
      facility: "",
      keyEmployees: "",
      bookQuality: "",
    },
  );

  const set = (k: keyof RiskAnswers, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SellerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">A few buyer-risk questions</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          These shape the valuation range and the risk-and-opportunity notes on
          your teaser. Skip any you're not sure about.
        </p>
      </div>

      <form
        className="grid gap-5 rounded-2xl border border-border bg-card p-8 shadow-elegant sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!business || !financials) {
            toast.error("Complete earlier steps first.");
            return;
          }
          const val = computeValuation(business.industry, financials, form);
          setState({ risk: form, valuation: val });
          toast.success("Valuation generated");
          navigate({ to: "/seller/valuation" });
        }}
      >
        <Field label="Largest customer % of revenue">
          <Input type="number" min={0} max={100} placeholder="e.g. 18" value={form.customerConcentration} onChange={(e) => set("customerConcentration", e.target.value)} />
        </Field>
        <Choice label="Does the owner personally manage most customer relationships?" value={form.ownerRelationships} onChange={(v) => set("ownerRelationships", v)} options={[["yes", "Yes"], ["some", "Some"], ["no", "No"]]} />
        <Choice label="Would the owner stay for a transition period?" value={form.transitionSupport} onChange={(v) => set("transitionSupport", v)} options={[["yes", "Yes"], ["limited", "Limited"], ["no", "No"]]} />
        <Choice label="Revenue type" value={form.revenueType} onChange={(v) => set("revenueType", v)} options={[["recurring", "Recurring"], ["repeat", "Repeat customer"], ["project", "Project-based"], ["one-time", "One-time"]]} />
        <Choice label="Facility" value={form.facility} onChange={(v) => set("facility", v)} options={[["own", "Owned"], ["lease", "Leased"], ["none", "None / mobile"]]} />
        <Choice label="Are there key employees critical to day-to-day?" value={form.keyEmployees} onChange={(v) => set("keyEmployees", v)} options={[["yes", "Yes"], ["some", "Some"], ["no", "No"]]} />
        <Field label="How clean are your books?">
          <Select value={form.bookQuality} onValueChange={(v) => set("bookQuality", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="very-clean">Very clean</SelectItem>
              <SelectItem value="mostly-clean">Mostly clean</SelectItem>
              <SelectItem value="somewhat-messy">Somewhat messy</SelectItem>
              <SelectItem value="not-sure">Not sure</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2 mt-2 flex justify-end">
          <Button type="submit" size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
            Generate my valuation
          </Button>
        </div>
      </form>
    </SellerLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
