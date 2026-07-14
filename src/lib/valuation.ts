import type { Financials, RiskAnswers, Valuation } from "./store";

const REGIONS: Record<string, string> = {
  CA: "West Coast", OR: "West Coast", WA: "West Coast",
  TX: "Southwest", AZ: "Southwest", NM: "Southwest", NV: "Southwest",
  NY: "Northeast", NJ: "Northeast", CT: "Northeast", MA: "Northeast", PA: "Northeast",
  FL: "Southeast", GA: "Southeast", NC: "Southeast", SC: "Southeast",
  IL: "Midwest", OH: "Midwest", MI: "Midwest", IN: "Midwest", WI: "Midwest",
};

export function regionForState(state: string) {
  return REGIONS[(state ?? "").toUpperCase()] ?? "United States";
}

export const INDUSTRIES: { value: string; label: string; multiple: number }[] = [
  { value: "hvac", label: "HVAC", multiple: 3.2 },
  { value: "plumbing", label: "Plumbing", multiple: 3.1 },
  { value: "electrical", label: "Electrical", multiple: 3.0 },
  { value: "roofing", label: "Roofing", multiple: 2.8 },
  { value: "landscaping", label: "Landscaping", multiple: 2.6 },
  { value: "pest", label: "Pest Control", multiple: 3.4 },
  { value: "healthcare", label: "Healthcare Services", multiple: 3.5 },
  { value: "ecommerce", label: "E-commerce", multiple: 2.7 },
  { value: "saas", label: "SaaS", multiple: 3.8 },
  { value: "professional", label: "Professional Services", multiple: 2.9 },
  { value: "other", label: "Other", multiple: 2.8 },
];

export function computeSDE(f: Financials): number {
  return (
    (f.netIncome || 0) +
    (f.ownerCompensation || 0) +
    (f.oneTimeExpenses || 0) +
    (f.personalAddbacks || 0) +
    (f.otherAddbacks || 0)
  );
}

export function computeValuation(
  industry: string,
  financials: Financials,
  risk: RiskAnswers,
): Valuation {
  const ind = INDUSTRIES.find((i) => i.value === industry) ?? INDUSTRIES[INDUSTRIES.length - 1];
  const sde = computeSDE(financials);

  let baseMult = ind.multiple;
  const drivers: string[] = [];
  const concerns: string[] = [];
  const upside: string[] = [];

  // Revenue type
  if (risk.revenueType === "recurring") {
    baseMult += 0.4;
    drivers.push("Recurring revenue base improves buyer confidence and multiple.");
  } else if (risk.revenueType === "repeat") {
    baseMult += 0.2;
    drivers.push("Strong repeat customer patterns support a higher multiple.");
  } else if (risk.revenueType === "one-time") {
    baseMult -= 0.2;
    concerns.push("One-time revenue creates repeatability risk for buyers.");
    upside.push("Convert one-time engagements into maintenance or subscription plans.");
  }

  // Revenue type additions
  if (risk.revenueType === "project") {
    concerns.push("Project-based revenue may require buyers to diligence backlog and pipeline durability.");
  }

  // Customer concentration
  const ccRaw = (risk.customerConcentration ?? "").trim();
  if (ccRaw === "") {
    concerns.push("Customer concentration should be validated before sharing with buyers.");
  } else {
    const cc = parseFloat(ccRaw);
    if (!Number.isNaN(cc)) {
      if (cc > 30) {
        baseMult -= 0.3;
        concerns.push(`Customer concentration above 30% (${cc}%) reduces buyer confidence.`);
        upside.push("Diversify top-customer revenue below 20% of total.");
      } else if (cc <= 15) {
        drivers.push("Diversified customer base with no single concentration risk.");
      }
    }
  }

  // Owner dependence
  if (risk.ownerRelationships === "yes") {
    baseMult -= 0.25;
    concerns.push("Owner personally manages most customer relationships.");
    upside.push("Delegate key accounts and document customer relationships before sale.");
  } else if (risk.ownerRelationships === "some") {
    baseMult -= 0.1;
    concerns.push("Some customer relationships appear owner-influenced and should be transition-planned.");
  } else if (risk.ownerRelationships === "no") {
    drivers.push("Customer relationships are institutionalized across the team.");
  }

  // Transition
  if (risk.transitionSupport === "yes") {
    baseMult += 0.15;
    drivers.push("Owner willing to support a transition period.");
  } else if (risk.transitionSupport === "limited") {
    baseMult += 0.05;
    concerns.push("Limited seller transition support may narrow the buyer pool.");
  }

  // Employees / operational depth
  if (risk.keyEmployees === "yes") {
    drivers.push("Key employees provide operational continuity.");
  } else if (risk.keyEmployees === "some") {
    concerns.push("Some operational continuity exists, but key-person dependencies should be documented.");
  } else if (risk.keyEmployees === "no") {
    concerns.push("Limited operational depth outside the owner.");
    upside.push("Hire or promote a general manager to reduce owner dependence.");
  }

  // Books / confidence
  let confidence: Valuation["confidence"] = "Medium";
  if (risk.bookQuality === "very-clean") {
    confidence = "High";
  } else if (risk.bookQuality === "mostly-clean") {
    confidence = "Medium";
  } else if (risk.bookQuality === "somewhat-messy" || risk.bookQuality === "not-sure") {
    confidence = "Low";
    concerns.push("Bookkeeping quality may lengthen buyer diligence.");
    upside.push("Reconcile books and produce reviewed financial statements.");
  } else {
    confidence = "Medium";
    concerns.push("Bookkeeping quality should be validated with source financials.");
  }

  const spread = confidence === "High" ? 0.2 : confidence === "Medium" ? 0.3 : 0.4;
  const mLow = Math.max(1.2, baseMult - spread);
  const mHigh = baseMult + spread;

  const buyerTypes = [
    "Individual acquisition entrepreneurs",
    "Search funds",
    "Strategic acquirers in adjacent markets",
    "Small private equity groups",
    "Local operators seeking geographic expansion",
  ];

  return {
    low: Math.round((sde * mLow) / 1000) * 1000,
    base: Math.round((sde * baseMult) / 1000) * 1000,
    high: Math.round((sde * mHigh) / 1000) * 1000,
    sde,
    multipleLow: +mLow.toFixed(2),
    multipleBase: +baseMult.toFixed(2),
    multipleHigh: +mHigh.toFixed(2),
    confidence,
    drivers,
    concerns,
    upside,
    buyerTypes,
  };
}

export const fmtCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
