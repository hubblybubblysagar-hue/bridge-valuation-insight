import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BuyerLayout } from "@/components/BuyerLayout";
import { useAppState } from "@/lib/store";
import { loadBuyerNdaRequests, type StoredNdaRequest } from "@/lib/persist";

export const Route = createFileRoute("/buyer/ndas")({
  head: () => ({ meta: [{ title: "My NDAs — ExitBridge" }] }),
  component: NDAsPage,
});

function NDAsPage() {
  const user = useAppState((s) => s.user);
  const localNdas = useAppState((s) => s.ndaRequests);
  const [ndas, setNdas] = useState<StoredNdaRequest[]>([]);
  const isDemo = user?.id?.startsWith("demo-");

  useEffect(() => {
    if (isDemo) return;
    loadBuyerNdaRequests().then(setNdas).catch(() => {});
  }, [isDemo]);

  const rows = isDemo
    ? localNdas.map((n) => ({
        id: n.id,
        buyer_name: n.buyerName,
        buyer_email: n.email,
        status: "submitted",
        submitted_at: n.submittedAt,
        teaser_title: n.dealTitle,
      }))
    : ndas;

  return (
    <BuyerLayout>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">My NDA requests</h1>
      <p className="mt-2 text-muted-foreground">Track the status of your confidentiality requests.</p>
      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          You haven't requested any NDAs yet. Browse the deal feed to get started.
        </div>
      ) : (
        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-elegant">
          {rows.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="text-sm font-semibold text-foreground">{n.teaser_title ?? "Opportunity"}</div>
                <div className="text-xs text-muted-foreground">Submitted {new Date(n.submitted_at).toLocaleString()}</div>
              </div>
              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                {n.status.replace("_", " ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </BuyerLayout>
  );
}
