import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Keyboard,
  Loader2,
  Lock,
  PlugZap,
} from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setState, type Financials } from "@/lib/store";
import { persistFinancials } from "@/lib/persist";
import {
  companyInfoSnapshotCount,
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

/** Clearly-labelled demonstration numbers. Never presented as QuickBooks data. */
const SAMPLE_FINANCIALS: Financials = {
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
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

type Busy = "start" | "verify" | "disconnect" | "sample" | "callback" | null;

export function ConnectPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"qb" | "upload" | "manual">("qb");
  const [conn, setConn] = useState<QbConnectionSummary | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const fresh = await loadConnectionSummary();
      setConn(fresh);
      return fresh;
    } catch {
      setConn(null);
      return null;
    }
  }, []);

  // Mount: load real connection truth, then interpret any callback hint.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params =
        typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
      const flag = params.get("quickbooks");
      const code = params.get("code");
      const cid = params.get("cid");

      if (flag && typeof window !== "undefined") {
        params.delete("quickbooks");
        params.delete("code");
        params.delete("cid");
        const qs = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      }

      if (flag === "connected") setBusy("callback");
      const fresh = await reload();
      if (cancelled) return;

      if (flag === "denied") {
        setCallbackError("You cancelled the QuickBooks authorization. Nothing was connected.");
        setBusy(null);
        return;
      }
      if (flag === "error") {
        setCallbackError(
          `We returned from Intuit, but ExitBridge could not verify the connection. Reference: ${code ?? "unknown"}${cid ? ` / ${cid}` : ""}`,
        );
        setBusy(null);
        return;
      }
      if (flag !== "connected") {
        setBusy(null);
        return;
      }

      // quickbooks=connected is only a hint. Prove it.
      const valid = fresh && fresh.status === "connected" && fresh.tokenSecretPresent;
      if (!valid) {
        setCallbackError(
          `We returned from Intuit, but ExitBridge could not verify the connection. Reference: connection_not_verified${cid ? ` / ${cid}` : ""}`,
        );
        setBusy(null);
        return;
      }

      let snapshots = await companyInfoSnapshotCount(fresh.id);
      if (snapshots === 0) {
        try {
          const verified = await verifyCompanyInfo();
          if (cancelled) return;
          setConn(verified);
          snapshots = await companyInfoSnapshotCount(verified.id);
        } catch {
          /* handled below */
        }
      }
      if (cancelled) return;
      if (snapshots > 0) {
        setCallbackError(null);
        toast.success("QuickBooks connected successfully");
      } else {
        setCallbackError(
          `We returned from Intuit, but ExitBridge could not verify the connection. Reference: company_info_fetch_failed${cid ? ` / ${cid}` : ""}`,
        );
      }
      setBusy(null);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const startOAuth = async () => {
    setBusy("start");
    setCallbackError(null);
    try {
      const { authorizationUrl } = await startQuickBooksOAuth();
      window.location.href = authorizationUrl;
    } catch (e) {
      toast.error((e as Error).message || "Could not start the QuickBooks connection");
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy("verify");
    try {
      setConn(await verifyCompanyInfo());
      toast.success("QuickBooks connection verified");
    } catch (e) {
      toast.error((e as Error).message || "Verification failed");
    } finally {
      setBusy(null);
    }
  };

  const doDisconnect = async () => {
    setConfirmDisconnect(false);
    setBusy("disconnect");
    try {
      await disconnectQuickBooks();
      await reload();
      toast.success("QuickBooks disconnected");
    } catch (e) {
      toast.error((e as Error).message || "Could not disconnect");
    } finally {
      setBusy(null);
    }
  };

  const useSampleData = async () => {
    setBusy("sample");
    try {
      setState({ qbConnected: false, financials: SAMPLE_FINANCIALS });
      await persistFinancials(SAMPLE_FINANCIALS, "quickbooks_mock", { sample: true });
      toast.success("Sample data loaded");
      navigate({ to: "/seller/business" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const isConnected = conn?.status === "connected" && conn.tokenSecretPresent;

  return (
    <SellerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Connect your financials</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          QuickBooks is the fastest, most accurate path. You can also upload statements, enter rough
          numbers manually, or explore ExitBridge with clearly-labelled sample data.
        </p>
      </div>

      {callbackError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p data-testid="qb-callback-error">{callbackError}</p>
        </div>
      )}

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
                active
                  ? "border-navy bg-navy text-navy-foreground dark:border-gold dark:bg-gold dark:text-gold-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
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
            <div data-testid="qb-connected-state">
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
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  onClick={verify}
                  disabled={busy !== null}
                  className="bg-gold text-gold-foreground hover:bg-gold/90"
                >
                  {busy === "verify" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify connection"
                  )}
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/seller/business" })}>
                  Continue to business details
                </Button>
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={busy !== null}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {busy === "disconnect" ? "Disconnecting…" : "Disconnect QuickBooks"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4" data-testid="qb-disconnected-state">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground dark:bg-gold dark:text-gold-foreground">
                <PlugZap className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-foreground">Connect QuickBooks</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ExitBridge connects to your QuickBooks company to retrieve financial information
                  used in your confidential analysis. ExitBridge does not create, edit, or delete
                  anything in QuickBooks.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={startOAuth}
                    disabled={busy !== null}
                    data-testid="qb-connect-button"
                    className="bg-gold text-gold-foreground hover:bg-gold/90"
                  >
                    {busy === "start" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to Intuit…
                      </>
                    ) : (
                      <>Connect QuickBooks securely</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setMode("upload")}>
                    Upload statements
                  </Button>
                  <Button variant="outline" onClick={() => setMode("manual")}>
                    Enter manually
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={useSampleData}
                    disabled={busy !== null}
                    data-testid="qb-sample-button"
                  >
                    {busy === "sample" ? "Loading sample data…" : "Use sample data for demonstration"}
                  </Button>
                </div>
                <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <Reassurance>ExitBridge performs GET-only QuickBooks requests</Reassurance>
                  <Reassurance>Tokens remain server-side</Reassurance>
                  <Reassurance>Disconnect at any time</Reassurance>
                  <Reassurance>Nothing shared with buyers without your approval</Reassurance>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "upload" && (
        <UploadOrManual
          title="Upload financial statements"
          body="Drop a QuickBooks export, P&L PDF, or CSV. We'll parse the essentials."
          onSample={useSampleData}
          loading={busy === "sample"}
        />
      )}
      {mode === "manual" && (
        <UploadOrManual
          title="Enter rough numbers"
          body="Approximate is fine to start — you can refine later."
          onSample={useSampleData}
          loading={busy === "sample"}
        />
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
            <AlertDialogDescription>
              ExitBridge will revoke its Intuit access and delete the stored credentials. Your
              business profile, financials, valuation, teaser, and NDA activity are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function UploadOrManual({
  title,
  body,
  onSample,
  loading,
}: {
  title: string;
  body: string;
  onSample: () => void;
  loading: boolean;
}) {
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
          data-testid="qb-sample-button-alt"
          className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </>
          ) : (
            "Continue with sample data"
          )}
        </Button>
      </div>
    </div>
  );
}
