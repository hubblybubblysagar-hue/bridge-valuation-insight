import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, Keyboard, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { setState, useAppState, type Financials } from "@/lib/store";
import { persistFinancials } from "@/lib/persist";

export const Route = createFileRoute("/seller/connect")({
  head: () => ({ meta: [{ title: "Connect QuickBooks — ExitBridge" }] }),
  component: ConnectPage,
});

const MOCK: Financials = {
  revenue: 2850000,
  grossProfit: 1425000,
  operatingExpenses: 1000000,
  netIncome: 425000,
  ownerCompensation: 120000,
  oneTimeExpenses: 35000,
  personalAddbacks: 20000,
  otherAddbacks: 0,
};

export function ConnectPage() {
  const qb = useAppState((s) => s.qbConnected);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"qb" | "upload" | "manual">("qb");

  const connect = () => {
    setLoading(true);
    setTimeout(async () => {
      setState({ qbConnected: true, financials: MOCK });
      try {
        await persistFinancials(MOCK, "quickbooks_mock", { mock: true });
      } catch (err) {
        toast.error((err as Error).message);
      }
      setLoading(false);
      toast.success("QuickBooks connected successfully");
      navigate({ to: "/seller/business" });
    }, 1400);
  };

  return (
    <SellerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Connect your financials</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          QuickBooks is the fastest, most accurate path. You can also upload
          statements or enter rough numbers manually.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: "qb", label: "QuickBooks", icon: Lock },
          { id: "upload", label: "Upload statements", icon: FileSpreadsheet },
          { id: "manual", label: "Enter manually", icon: Keyboard },
        ].map((t) => {
          const Icon = t.icon;
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id as typeof mode)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                active ? "border-navy bg-navy text-navy-foreground dark:border-gold dark:bg-gold dark:text-gold-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {mode === "qb" && (
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground dark:bg-gold dark:text-gold-foreground">
              <Lock className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-foreground">Connect QuickBooks (Read-only)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ExitBridge uses read-only access to analyze your financial
                statements. We never modify your books, contact your customers,
                or list your business without approval.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {qb ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" /> QuickBooks connected
                  </div>
                ) : null}
                <Button
                  size="lg"
                  onClick={connect}
                  disabled={loading}
                  className="bg-gold text-gold-foreground hover:bg-gold/90"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Securely connecting…</>
                  ) : qb ? (
                    "Refresh connection"
                  ) : (
                    "Connect QuickBooks"
                  )}
                </Button>
                {qb && (
                  <Button variant="outline" size="lg" onClick={() => navigate({ to: "/seller/business" })}>
                    Continue
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <Reassurance>Read-only access</Reassurance>
            <Reassurance>Encrypted in transit</Reassurance>
            <Reassurance>Disconnect anytime</Reassurance>
          </div>
        </div>
      )}

      {mode === "upload" && (
        <UploadOrManual
          title="Upload financial statements"
          body="Drop a QuickBooks export, P&L PDF, or CSV. We'll parse the essentials."
        />
      )}
      {mode === "manual" && (
        <UploadOrManual
          title="Enter rough numbers"
          body="Approximate is fine to start — you can refine later."
        />
      )}
    </SellerLayout>
  );
}

function Reassurance({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <CheckCircle2 className="h-4 w-4 text-gold" /> {children}
    </div>
  );
}

function UploadOrManual({ title, body }: { title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-10 text-center text-sm text-muted-foreground">
        Drag files here or click to browse. (Coming soon — QuickBooks connection is available today.)
      </div>
      <div className="mt-6">
        <Button
          onClick={async () => {
            setState({ qbConnected: true, financials: MOCK });
            try { await persistFinancials(MOCK, "upload", { sample: true }); } catch (err) { toast.error((err as Error).message); }
            toast.success("Using sample financials to continue");
            navigate({ to: "/seller/business" });
          }}
          className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground"
        >
          Continue with sample data
        </Button>
      </div>
    </div>
  );
}
