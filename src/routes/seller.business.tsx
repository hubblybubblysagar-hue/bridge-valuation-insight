import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setState, useAppState, type Business } from "@/lib/store";
import { INDUSTRIES } from "@/lib/valuation";

export const Route = createFileRoute("/seller/business")({
  head: () => ({ meta: [{ title: "Business basics — ExitBridge" }] }),
  component: BusinessPage,
});

function BusinessPage() {
  const navigate = useNavigate();
  const existing = useAppState((s) => s.business);
  const [form, setForm] = useState<Business>(
    existing ?? {
      name: "",
      industry: "hvac",
      city: "",
      state: "",
      yearsInBusiness: "",
      employees: "",
      reason: "",
      timeline: "",
    },
  );
  const set = <K extends keyof Business>(k: K, v: Business[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SellerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">A little context</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          These details never appear in your anonymous teaser — they help us
          benchmark your valuation and shape buyer-fit commentary.
        </p>
      </div>

      <form
        className="rounded-2xl border border-border bg-card p-8 shadow-elegant"
        onSubmit={(e) => {
          e.preventDefault();
          setState({ business: form });
          toast.success("Saved");
          navigate({ to: "/seller/financial-review" });
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business name">
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Kept confidential" />
          </Field>
          <Field label="Industry">
            <Select value={form.industry} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} placeholder="e.g. NY" maxLength={2} />
          </Field>
          <Field label="Years in business">
            <Input type="number" min={0} value={form.yearsInBusiness} onChange={(e) => set("yearsInBusiness", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Number of employees">
            <Input type="number" min={0} value={form.employees} onChange={(e) => set("employees", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Reason for exploring a sale">
            <Select value={form.reason} onValueChange={(v) => set("reason", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retirement">Retirement</SelectItem>
                <SelectItem value="burnout">Burnout</SelectItem>
                <SelectItem value="new-opportunity">New opportunity</SelectItem>
                <SelectItem value="succession">Succession planning</SelectItem>
                <SelectItem value="testing">Testing valuation</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Desired sale timeline">
            <Select value={form.timeline} onValueChange={(v) => set("timeline", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not-sure">Not sure</SelectItem>
                <SelectItem value="0-6">0–6 months</SelectItem>
                <SelectItem value="6-12">6–12 months</SelectItem>
                <SelectItem value="12+">12+ months</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-8 flex justify-end">
          <Button type="submit" className="bg-gold text-gold-foreground hover:bg-gold/90">
            Continue to financial review
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
