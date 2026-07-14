import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { signUp } from "@/lib/store";
import { persistBuyerProfile } from "@/lib/persist";

export const Route = createFileRoute("/buyer-signup")({
  head: () => ({ meta: [{ title: "Buyer signup — ExitBridge" }] }),
  component: BuyerSignup,
});

function BuyerSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    buyerType: "individual",
    industries: "",
    geography: "",
    revenueRange: "",
    sdeRange: "",
    capital: "",
    timeline: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create a buyer account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what you're looking for. You'll only see opportunities that match.
          </p>
          <form
            className="mt-6 grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const { needsEmailConfirmation } = await signUp(form.email.trim(), form.password || "buyer-demo", "buyer", form.name.trim() || undefined);
                if (needsEmailConfirmation) {
                  toast.success("Check your email to confirm your account, then sign in to finish your profile.");
                  navigate({ to: "/login" });
                  return;
                }
                await persistBuyerProfile({
                  buyerType: form.buyerType,
                  industries: form.industries,
                  geography: form.geography,
                  revenueRange: form.revenueRange,
                  sdeRange: form.sdeRange,
                  capital: form.capital,
                  timeline: form.timeline,
                });
                toast.success("Buyer account created");
                navigate({ to: "/buyer" });

              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Field label="Full name"><Input required value={form.name} onChange={(e) => set("name")(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => set("email")(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" required minLength={6} value={form.password} onChange={(e) => set("password")(e.target.value)} /></Field>
            <Field label="Buyer type">
              <Select value={form.buyerType} onValueChange={set("buyerType")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual buyer</SelectItem>
                  <SelectItem value="search-fund">Search fund</SelectItem>
                  <SelectItem value="strategic">Strategic acquirer</SelectItem>
                  <SelectItem value="pe">Private equity</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Target industries" full><Input placeholder="e.g. HVAC, plumbing, healthcare services" value={form.industries} onChange={(e) => set("industries")(e.target.value)} /></Field>
            <Field label="Target geography"><Input placeholder="e.g. Northeast US, remote" value={form.geography} onChange={(e) => set("geography")(e.target.value)} /></Field>
            <Field label="Target revenue range"><Input placeholder="e.g. $1M – $10M" value={form.revenueRange} onChange={(e) => set("revenueRange")(e.target.value)} /></Field>
            <Field label="Target SDE / EBITDA"><Input placeholder="e.g. $300K – $2M" value={form.sdeRange} onChange={(e) => set("sdeRange")(e.target.value)} /></Field>
            <Field label="Available capital"><Input placeholder="e.g. $500K equity + SBA" value={form.capital} onChange={(e) => set("capital")(e.target.value)} /></Field>
            <Field label="Timeline to acquire" full>
              <Select value={form.timeline} onValueChange={set("timeline")}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-6">0–6 months</SelectItem>
                  <SelectItem value="6-12">6–12 months</SelectItem>
                  <SelectItem value="12+">12+ months</SelectItem>
                  <SelectItem value="not-sure">Not sure</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                Create buyer account
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
