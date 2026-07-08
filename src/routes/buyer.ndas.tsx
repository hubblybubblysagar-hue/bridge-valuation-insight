import { createFileRoute } from "@tanstack/react-router";
import { BuyerLayout } from "@/components/BuyerLayout";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/buyer/ndas")({
  head: () => ({ meta: [{ title: "My NDAs — ExitBridge" }] }),
  component: NDAsPage,
});

function NDAsPage() {
  const ndas = useAppState((s) => s.ndaRequests);
  return (
    <BuyerLayout>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">My NDA requests</h1>
      <p className="mt-2 text-muted-foreground">Track the status of your confidentiality requests.</p>
      {ndas.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          You haven't requested any NDAs yet. Browse the deal feed to get started.
        </div>
      ) : (
        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-elegant">
          {ndas.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="text-sm font-semibold text-foreground">{n.dealTitle}</div>
                <div className="text-xs text-muted-foreground">Submitted {new Date(n.submittedAt).toLocaleString()}</div>
              </div>
              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Awaiting seller review</div>
            </div>
          ))}
        </div>
      )}
    </BuyerLayout>
  );
}
