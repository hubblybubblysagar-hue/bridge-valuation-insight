import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { signUp, type Role } from "@/lib/store";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — ExitBridge" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("seller");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  if (confirmSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center"><Logo /></div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{confirmSent}</span>.
              Confirm your address, then sign in to continue.
            </p>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => navigate({ to: "/login" })} className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90">
                Go to sign in
              </Button>
              <Button variant="outline" onClick={() => setConfirmSent(null)}>Use a different email</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Confidential by default. No public listing.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                const { user, needsEmailConfirmation } = await signUp(email.trim(), password, role, fullName.trim() || undefined);
                if (needsEmailConfirmation) {
                  setConfirmSent(email.trim());
                } else {
                  toast.success("Account created");
                  navigate({ to: user.role === "buyer" ? "/buyer" : "/seller" });
                }
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setLoading(false);
              }
            }}
          >

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>I am a…</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="grid grid-cols-2 gap-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${role === "seller" ? "border-navy bg-navy/5 dark:border-gold dark:bg-gold/5" : "border-border"}`}>
                  <RadioGroupItem value="seller" /> Seller
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${role === "buyer" ? "border-navy bg-navy/5 dark:border-gold dark:bg-gold/5" : "border-border"}`}>
                  <RadioGroupItem value="buyer" /> Buyer
                </label>
              </RadioGroup>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

