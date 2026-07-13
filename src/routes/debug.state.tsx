import { createFileRoute, Link } from "@tanstack/react-router";
import { QAModeBadge } from "@/components/QAModeBadge";
import { Button } from "@/components/ui/button";
import {
  DEMO_BUYER_MATCHES,
  DEMO_DEALS,
  DEMO_NDA_REQUEST,
  useAppState,
} from "@/lib/store";

export const Route = createFileRoute("/debug/state")({
  head: () => ({
    meta: [
      { title: "Debug — App state" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DebugState,
});

function DebugState() {
  const state = useAppState((s) => s);

  const snapshot = {
    currentUser: state.user,
    sellerProfile: state.user?.role === "seller" ? state.user : null,
    business: state.business,
    financials: state.financials,
    risk: state.risk,
    valuation: state.valuation,
    teaser: {
      approved: state.teaserApproved,
      title: state.business
        ? "Established HVAC Services Company in the Northeast"
        : null,
    },
    buyerMatches: {
      total: DEMO_BUYER_MATCHES.total,
      categories: DEMO_BUYER_MATCHES.categories,
      outreachApproved: state.outreachApproved,
    },
    buyerFeed: DEMO_DEALS,
    ndaRequests: state.ndaRequests.length
      ? state.ndaRequests
      : [DEMO_NDA_REQUEST],
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <QAModeBadge label="QA Mode · Debug" />
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gold">
              Debug
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Current mocked application state
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hidden diagnostic view. Not linked from navigation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/demo/seller/start">Seller start</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/demo/buyer/feed">Buyer feed</Link>
            </Button>
          </div>
        </div>
        <pre className="overflow-auto rounded-2xl border border-border bg-card p-6 text-xs leading-relaxed text-foreground shadow-elegant">
{JSON.stringify(snapshot, null, 2)}
        </pre>
      </div>
    </div>
  );
}
