import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Download, Users } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/SellerLayout";
import { TeaserDocument } from "@/components/Teaser";
import { Button } from "@/components/ui/button";
import { setState, useAppState } from "@/lib/store";

export const Route = createFileRoute("/seller/teaser")({
  head: () => ({ meta: [{ title: "Anonymous teaser — ExitBridge" }] }),
  component: TeaserPage,
});

function TeaserPage() {
  const navigate = useNavigate();
  const business = useAppState((s) => s.business);
  const financials = useAppState((s) => s.financials);
  const valuation = useAppState((s) => s.valuation);

  if (!business || !financials || !valuation) {
    return (
      <SellerLayout>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Complete your valuation to generate a teaser.</p>
          <Button className="mt-4 bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => navigate({ to: "/seller/connect" })}>
            Start valuation
          </Button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">Confidential Teaser</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Your anonymous one-pager</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            No name, no address, no owner, no customers. Just enough for the
            right buyer to say "tell me more" — under NDA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Share link copied");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy share link
          </Button>
          <Button
            className="bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={() => {
              setState({ teaserApproved: true });
              navigate({ to: "/seller/buyer-interest" });
            }}
          >
            <Users className="mr-2 h-4 w-4" /> Privately test buyer interest
          </Button>
        </div>
      </div>

      <TeaserDocument business={business} valuation={valuation} revenue={financials.revenue} />

      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground print:hidden">
        Prefer a hand-polished version? <Link to="/seller/valuation" className="font-medium text-foreground underline-offset-4 hover:underline">Book a founder-reviewed Snapshot ($499)</Link> and our team will refine the memo and teaser copy.
      </div>
    </SellerLayout>
  );
}
