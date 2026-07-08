import { Building2, MapPin, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { Business, Valuation } from "@/lib/store";
import { fmtCurrency, INDUSTRIES } from "@/lib/valuation";

const REGIONS: Record<string, string> = {
  CA: "West Coast", OR: "West Coast", WA: "West Coast",
  TX: "Southwest", AZ: "Southwest", NM: "Southwest", NV: "Southwest",
  NY: "Northeast", NJ: "Northeast", CT: "Northeast", MA: "Northeast", PA: "Northeast",
  FL: "Southeast", GA: "Southeast", NC: "Southeast", SC: "Southeast",
  IL: "Midwest", OH: "Midwest", MI: "Midwest", IN: "Midwest", WI: "Midwest",
};

export function regionForState(state: string) {
  return REGIONS[state?.toUpperCase()] ?? "United States";
}

interface Props {
  business: Business;
  valuation: Valuation;
  revenue: number;
}

export function TeaserDocument({ business, valuation, revenue }: Props) {
  const industryLabel = INDUSTRIES.find((i) => i.value === business.industry)?.label ?? "Business";
  const region = regionForState(business.state);
  const title = `Established ${industryLabel} Company in the ${region}`;

  const revenueRange = bandRevenue(revenue);
  const sdeRange = bandSde(valuation.sde);

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-elegant print:shadow-none sm:p-12">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-gold">Confidential Opportunity</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div>Prepared via ExitBridge</div>
          <div>Anonymous Teaser</div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Business Overview</h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">
          An established {industryLabel.toLowerCase()} company operating in the {region.toLowerCase()} market
          with {business.yearsInBusiness || "multiple"} years of history and a team of approximately{" "}
          {business.employees || "several"} employees. The business generates consistent cash flow with a
          professionalized operating model and clear opportunities for continued growth under new ownership.
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <MetricCard icon={TrendingUp} label="Revenue (range)" value={revenueRange} />
        <MetricCard icon={Building2} label="Adjusted SDE (range)" value={sdeRange} />
        <MetricCard icon={MapPin} label="Region" value={region} />
        <MetricCard icon={Users} label="Employees" value={String(business.employees || "—")} />
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Investment Highlights</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground/90">
            {(valuation.drivers.length ? valuation.drivers : ["Established operating history with diversified revenue base."]).slice(0, 4).map((d) => (
              <li key={d} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> {d}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Growth Opportunities</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground/90">
            {(valuation.upside.length
              ? valuation.upside
              : [
                  "Expand service coverage into adjacent metros.",
                  "Institutionalize sales and marketing to accelerate pipeline.",
                  "Introduce recurring service plans to deepen customer relationships.",
                ]
            ).slice(0, 4).map((u) => (
              <li key={u} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-navy dark:bg-gold" /> {u}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Transition Profile</h2>
          <p className="mt-3 text-sm text-foreground/90">
            Owner is exploring a sale primarily for {reasonLabel(business.reason)} and is
            open to a reasonable transition period to support continuity of operations
            and customer relationships.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Buyer Fit</h2>
          <p className="mt-3 text-sm text-foreground/90">
            Suited to individual acquisition entrepreneurs, search funds, strategic
            acquirers in adjacent markets, and small private equity groups seeking a
            stable platform investment.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Confidentiality: This teaser is intentionally anonymized. Business name,
            address, ownership, and customer details are withheld. Interested parties
            must execute a mutual NDA before any identifying information or full
            confidential information memorandum is shared. Figures are preliminary,
            owner-provided, and directional — not a certified valuation or appraisal.
          </p>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function reasonLabel(r: string) {
  switch (r) {
    case "retirement": return "retirement planning";
    case "burnout": return "personal transition";
    case "new-opportunity": return "a new professional opportunity";
    case "succession": return "succession planning";
    case "testing": return "exploring current market valuation";
    default: return "strategic reasons";
  }
}

function bandRevenue(r: number) {
  if (!r) return "—";
  const low = Math.floor(r * 0.9 / 100000) * 100000;
  const high = Math.ceil(r * 1.1 / 100000) * 100000;
  return `${fmtCurrency(low)} – ${fmtCurrency(high)}`;
}
function bandSde(s: number) {
  if (!s) return "—";
  const low = Math.floor(s * 0.9 / 10000) * 10000;
  const high = Math.ceil(s * 1.1 / 10000) * 10000;
  return `${fmtCurrency(low)} – ${fmtCurrency(high)}`;
}
