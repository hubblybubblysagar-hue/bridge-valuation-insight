import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Keyboard, Loader2, Lock, PlugZap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { setState, useAppState, type Financials } from "@/lib/store";
import { persistFinancials } from "@/lib/persist";
import {
  disconnectQuickBooks,
  loadConnectionSummary,
  startQuickBooksOAuth,
  verifyCompanyInfo,
  type QbConnectionSummary,
} from "@/lib/quickbooks";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return "—"; }
}

export function ConnectPage() {
  const qb = useAppState((s) => s.qbConnected);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"qb" | "upload" | "manual">("qb");
  const [conn, setConn] = useState<QbConnectionSummary | null>(null);
  const [busy, setBusy] = useState<"start" | "verify" | "disconnect" | null>(null);

  useEffect(() => {
    // Load real connection state on mount + surface callback query params.
    loadConnectionSummary().then(setConn).catch(() => setConn(null));
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("quickbooks");
    if (flag === "connected") toast.success("QuickBooks connected");
    else if (flag === "denied") toast.error("QuickBooks connection was cancelled");
    else if (flag === "error") toast.error("We couldn't complete the QuickBooks connection. Please try again.");
    if (flag) {
      params.delete("quickbooks");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, []);

  const startOAuth = async () => {
    setBusy("start");
    try {
      const { authorizationUrl } = await startQuickBooksOAuth();
      window.location.href = authorizationUrl;
    } catch (e) {
      toast.error((e as Error).message || "Could not start QuickBooks connect");
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy("verify");
    try {
      const fresh = await verifyCompanyInfo();
      setConn(fresh);
      toast.success("QuickBooks connection verified");
    } catch (e) {
      toast.error((e as Error).message || "Verification failed");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await disconnectQuickBooks();
      setConn(await loadConnectionSummary());
      toast.success("QuickBooks disconnected");
    } catch (e) {
      toast.error((e as Error).message || "Could not disconnect");
    } finally {
      setBusy(null);
    }
  };

  const isConnected = conn?.status === "connected" && conn.tokenSecretPresent;

  const mockConnect = () => {
    setLoading(true);
    setTimeout(async () => {
      setState({ qbConnected: true, financials: MOCK });
      try { await persistFinancials(MOCK, "quickbooks_mock", { mock: true }); }
      catch (err) { toast.error((err as Error).message); }
      setLoading(false);
      toast.success("Sample financials loaded");
      navigate({ to: "/seller/business" });
    }, 900);
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
          {isConnected ? (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> QuickBooks connected
                </div>
                {conn?.environment === "sandbox" && (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sandbox
                  </span>
                )}
              </div>
              <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <Row label="Company">{conn?.companyName ?? "—"}</Row>
                <Row label="Realm ID">{conn?.realmIdMasked || "—"}</Row>
                <Row label="Connected">{fmtDate(conn?.connectedAt)}</Row>
                <Row label="Last verified">{fmtDate(conn?.lastSyncedAt)}</Row>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={verify} disabled={busy !== null} className="bg-gold text-gold-foreground hover:bg-gold/90">
                  {busy === "verify" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : "Verify connection"}
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/seller/business" })}>
                  Continue to business details
                </Button>
                <button
                  onClick={disconnect}
                  disabled={busy !== null}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {busy === "disconnect" ? "Disconnecting…" : "Disconnect QuickBooks"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground dark:bg-gold dark:text-gold-foreground">
                <PlugZap className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-foreground">Connect QuickBooks</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ExitBridge connects to your QuickBooks company to retrieve financial
                  information used in your confidential analysis. ExitBridge does not create,
                  edit, or delete anything in QuickBooks.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={startOAuth}
                    disabled={busy !== null}
                    className="bg-gold text-gold-foreground hover:bg-gold/90"
                  >
                    {busy === "start" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to Intuit…</>
                    ) : (
                      <>Connect QuickBooks securely</>
                    )}
                  </Button>
                </div>
                <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <Reassurance>ExitBridge performs GET-only QuickBooks requests</Reassurance>
                  <Reassurance>Tokens remain server-side</Reassurance>
                  <Reassurance>Disconnect at any time</Reassurance>
                  <Reassurance>Nothing shared with buyers without your approval</Reassurance>
                </div>
                {qb && (
                  <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Sample QuickBooks financials are loaded locally for preview.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "upload" && (
        <UploadOrManual
          title="Upload financial statements"
          body="Drop a QuickBooks export, P&L PDF, or CSV. We'll parse the essentials."
          onSample={mockConnect}
          loading={loading}
        />
      )}
      {mode === "manual" && (
        <UploadOrManual
          title="Enter rough numbers"
          body="Approximate is fine to start — you can refine later."
          onSample={mockConnect}
          loading={loading}
        />
      )}
    </SellerLayout>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Reassurance({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <CheckCircle2 className="h-4 w-4 text-gold" /> {children}
    </div>
  );
}

function UploadOrManual({ title, body, onSample, loading }: { title: string; body: string; onSample: () => void; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-10 text-center text-sm text-muted-foreground">
        Drag files here or click to browse. (Coming soon — QuickBooks connection is available today.)
      </div>
      <div className="mt-6">
        <Button
          onClick={onSample}
          disabled={loading}
          className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</> : "Continue with sample data"}
        </Button>
      </div>
    </div>
  );
}
