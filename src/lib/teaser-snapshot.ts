// Shared teaser snapshot builder used both by DB persist and UI render.
import type { Business, Valuation } from "@/lib/store";
import { INDUSTRIES, regionForState, fmtCurrency } from "@/lib/valuation";

export interface TeaserSnapshot {
  title: string;
  overview: string;
  financialSnapshot: {
    revenue_range: string;
    sde_range: string;
    region: string;
    employees: number | null;
  };
  investmentHighlights: string[];
  growthOpportunities: string[];
  transitionProfile: string;
  buyerFit: string;
  confidentialityNote: string;
}

function bandRevenue(r: number) {
  if (!r) return "—";
  const low = Math.floor((r * 0.9) / 100000) * 100000;
  const high = Math.ceil((r * 1.1) / 100000) * 100000;
  return `${fmtCurrency(low)} – ${fmtCurrency(high)}`;
}
function bandSde(s: number) {
  if (!s) return "—";
  const low = Math.floor((s * 0.9) / 10000) * 10000;
  const high = Math.ceil((s * 1.1) / 10000) * 10000;
  return `${fmtCurrency(low)} – ${fmtCurrency(high)}`;
}

function transitionSentence(reason: string): string {
  switch (reason) {
    case "retirement":
      return "The owner is exploring a sale as part of retirement planning and is open to a reasonable transition period to support continuity of operations and customer relationships.";
    case "burnout":
      return "The owner is exploring a sale as part of a personal transition and is open to a structured handover to protect operations and customer relationships.";
    case "new-opportunity":
      return "The owner is exploring a sale to pursue a new professional opportunity and is willing to support a reasonable transition period.";
    case "succession":
      return "The owner is exploring a sale as part of succession planning and is prepared to support a defined transition to the next operator.";
    case "testing":
      return "The owner is testing the current market and is open to a serious conversation with the right buyer, including a reasonable transition period.";
    default:
      return "The owner is exploring a sale for strategic reasons and is open to a reasonable transition period to support continuity of operations and customer relationships.";
  }
}

export function buildTeaserSnapshot(business: Business, valuation: Valuation, revenue: number): TeaserSnapshot {
  const industryLabel = INDUSTRIES.find((i) => i.value === business.industry)?.label ?? "Business";
  const region = regionForState(business.state);
  const title = `Established ${industryLabel} Company in the ${region}`;

  const overviewParts: string[] = [
    `An established ${industryLabel} company operating in the ${region} market`,
  ];
  if (business.yearsInBusiness) overviewParts.push(`with approximately ${business.yearsInBusiness} years of operating history`);
  if (business.employees) overviewParts.push(`and a team of approximately ${business.employees} employees`);
  const overview = `${overviewParts.join(" ")}. The business shows meaningful owner earnings based on preliminary financial inputs.`;

  return {
    title,
    overview,
    financialSnapshot: {
      revenue_range: bandRevenue(revenue),
      sde_range: bandSde(valuation.sde),
      region,
      employees: business.employees === "" ? null : Number(business.employees),
    },
    investmentHighlights: (valuation.drivers.length
      ? valuation.drivers
      : ["Established operating history with diversified revenue base."]).slice(0, 4),
    growthOpportunities: (valuation.upside.length
      ? valuation.upside
      : [
          "Expand service coverage into adjacent metros.",
          "Institutionalize sales and marketing to accelerate pipeline.",
          "Introduce recurring service plans to deepen customer relationships.",
        ]).slice(0, 4),
    transitionProfile: transitionSentence(business.reason),
    buyerFit:
      "Suited to individual acquisition entrepreneurs, search funds, strategic acquirers in adjacent markets, and small private equity groups seeking a stable platform investment.",
    confidentialityNote:
      "This teaser is intentionally anonymized. Business name, address, ownership, and customer details are withheld.",
  };
}
