import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BuyerLayout } from "@/components/BuyerLayout";
import { Button } from "@/components/ui/button";
import { signOut, useAppState } from "@/lib/store";

export const Route = createFileRoute("/buyer/account")({
  head: () => ({ meta: [{ title: "Account — ExitBridge" }] }),
  component: BuyerAccount,
});

function BuyerAccount() {
  const user = useAppState((s) => s.user);
  const navigate = useNavigate();
  return (
    <BuyerLayout>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Account</h1>
      <div className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Email</div>
            <div className="mt-1 text-sm text-foreground">{user?.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Role</div>
            <div className="mt-1 text-sm capitalize text-foreground">{user?.role ?? "—"}</div>
          </div>
        </div>
        <div className="mt-8 flex gap-2">
          <Button variant="outline" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            Sign out
          </Button>
        </div>
      </div>
    </BuyerLayout>
  );
}
