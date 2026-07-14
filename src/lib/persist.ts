// Write-through persistence helpers for the seller/buyer flows.
// All helpers no-op cleanly when there is no real Supabase session
// (so QA/demo review paths continue to work without a backend user).
import { supabase } from "@/integrations/supabase/client";
import { getState, setState, type Business, type Financials, type RiskAnswers, type Valuation } from "@/lib/store";
import { computeSDE, regionForState } from "@/lib/valuation";
import { TeaserSnapshot, buildTeaserSnapshot } from "@/lib/teaser-snapshot";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// -------- Seller flow --------

export async function persistBusiness(business: Business): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const existingId = getState().currentBusinessId;
  const payload = {
    seller_id: userId,
    business_name: business.name || null,
    industry: business.industry || null,
    city: business.city || null,
    state: business.state || null,
    region: regionForState(business.state),
    years_in_business: business.yearsInBusiness === "" ? null : Number(business.yearsInBusiness),
    employees: business.employees === "" ? null : Number(business.employees),
    reason_for_sale: business.reason || null,
    desired_timeline: business.timeline || null,
  };
  if (existingId) {
    const { error } = await supabase.from("businesses").update(payload).eq("id", existingId);
    if (error) throw new Error(error.message);
    return existingId;
  }
  const { data, error } = await supabase
    .from("businesses")
    .insert({ ...payload, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  setState({ currentBusinessId: data.id });
  return data.id;
}

export async function ensureDraftBusiness(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const existing = getState().currentBusinessId;
  if (existing) return existing;
  const { data, error } = await supabase
    .from("businesses")
    .insert({ seller_id: userId, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  setState({ currentBusinessId: data.id });
  return data.id;
}

export async function persistFinancials(
  financials: Financials,
  source: "manual" | "quickbooks_mock" | "upload" | "quickbooks" = "manual",
  rawPayload?: Record<string, unknown>,
): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const businessId = (await ensureDraftBusiness()) ?? getState().currentBusinessId;
  if (!businessId) return null;
  const existingId = getState().currentFinancialsId;
  const sde = computeSDE(financials);
  const payload = {
    business_id: businessId,
    source,
    revenue: financials.revenue,
    gross_profit: financials.grossProfit,
    operating_expenses: financials.operatingExpenses,
    net_income: financials.netIncome,
    owner_compensation: financials.ownerCompensation,
    one_time_expenses: financials.oneTimeExpenses,
    personal_addbacks: financials.personalAddbacks,
    other_addbacks: financials.otherAddbacks,
    estimated_sde: sde,
    raw_payload: (rawPayload ?? {}) as never,
  };
  if (existingId) {
    const { error } = await supabase.from("seller_financials").update(payload).eq("id", existingId);
    if (error) throw new Error(error.message);
    return existingId;
  }
  const { data, error } = await supabase
    .from("seller_financials")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  setState({ currentFinancialsId: data.id });
  return data.id;
}

export async function persistRisk(risk: RiskAnswers): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const businessId = getState().currentBusinessId;
  if (!businessId) return;
  const payload = {
    business_id: businessId,
    customer_concentration: risk.customerConcentration || null,
    owner_relationships: risk.ownerRelationships || null,
    transition_support: risk.transitionSupport || null,
    revenue_type: risk.revenueType || null,
    facility_status: risk.facility || null,
    key_employees: risk.keyEmployees || null,
    book_quality: risk.bookQuality || null,
  };
  const { error } = await supabase
    .from("risk_answers")
    .upsert(payload, { onConflict: "business_id" });
  if (error) throw new Error(error.message);
}


export async function persistValuation(valuation: Valuation): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const businessId = getState().currentBusinessId;
  if (!businessId) return null;
  const financialsId = getState().currentFinancialsId;
  const payload = {
    business_id: businessId,
    financials_id: financialsId,
    low_value: valuation.low,
    base_value: valuation.base,
    high_value: valuation.high,
    estimated_sde: valuation.sde,
    low_multiple: valuation.multipleLow,
    base_multiple: valuation.multipleBase,
    high_multiple: valuation.multipleHigh,
    confidence: valuation.confidence,
    value_drivers: valuation.drivers as never,
    buyer_concerns: valuation.concerns as never,
    upside_opportunities: valuation.upside as never,
    likely_buyer_types: valuation.buyerTypes as never,
    methodology:
      "ExitBridge estimates Adjusted SDE from provided financials, applies an industry benchmark multiple, and adjusts for revenue quality, owner dependence, customer concentration, transition support, and documentation quality.",
    disclaimer:
      "Preliminary directional estimate, not a certified appraisal, fairness opinion, tax opinion, legal advice, or financing commitment.",
  };
  const { data, error } = await supabase
    .from("valuations")
    .upsert(payload, { onConflict: "business_id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  setState({ currentValuationId: data.id });

  await supabase
    .from("businesses")
    .update({ status: "valuation_generated" })
    .eq("id", businessId);
  return data.id;
}

export async function persistTeaser(
  business: Business,
  valuation: Valuation,
  revenue: number,
): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const businessId = getState().currentBusinessId;
  if (!businessId) return null;
  const valuationId = getState().currentValuationId;
  const snapshot: TeaserSnapshot = buildTeaserSnapshot(business, valuation, revenue);
  const slug = `${slugify(snapshot.title)}-${businessId.slice(0, 6)}`;
  const payload = {
    business_id: businessId,
    valuation_id: valuationId,
    title: snapshot.title,
    overview: snapshot.overview,
    financial_snapshot: snapshot.financialSnapshot as never,
    investment_highlights: snapshot.investmentHighlights as never,
    growth_opportunities: snapshot.growthOpportunities as never,
    transition_profile: snapshot.transitionProfile,
    buyer_fit: snapshot.buyerFit,
    confidentiality_note: snapshot.confidentialityNote,
    share_slug: slug,
  };
  const { data, error } = await supabase
    .from("teasers")
    .upsert(payload, { onConflict: "business_id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  setState({ currentTeaserId: data.id, teaserApproved: true });

  await supabase
    .from("businesses")
    .update({ status: "teaser_generated" })
    .eq("id", businessId);
  return data.id;
}

export async function approveBuyerInterestTest(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const businessId = getState().currentBusinessId;
  const teaserId = getState().currentTeaserId;
  if (!businessId) return;
  if (teaserId) {
    await supabase.from("teasers").update({ approved_for_outreach: true }).eq("id", teaserId);
  }
  await supabase.from("buyer_interest_tests").upsert(
    {
      business_id: businessId,
      teaser_id: teaserId,
      seller_id: userId,
      status: "approved",
      approved_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );

  await supabase
    .from("businesses")
    .update({ status: "interest_test_approved" })
    .eq("id", businessId);
}

// -------- Buyer flow --------

export async function persistBuyerProfile(profile: {
  buyerType: string;
  industries: string;
  geography: string;
  revenueRange: string;
  sdeRange: string;
  capital: string;
  timeline: string;
}): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const industries = profile.industries.split(",").map((s) => s.trim()).filter(Boolean);
  const geographies = profile.geography.split(",").map((s) => s.trim()).filter(Boolean);
  const capital = parseCurrency(profile.capital);
  const payload = {
    buyer_id: userId,
    buyer_type: profile.buyerType || null,
    target_industries: industries.length ? industries : null,
    target_geographies: geographies.length ? geographies : null,
    available_capital: capital,
    timeline_to_acquire: profile.timeline || null,
  };
  const { error } = await supabase
    .from("buyer_profiles")
    .upsert(payload, { onConflict: "buyer_id" });
  if (error) throw new Error(error.message);

}

function parseCurrency(input: string): number | null {
  const digits = input.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export interface ApprovedTeaser {
  id: string;
  business_id: string | null;
  title: string | null;
  financial_snapshot: Record<string, unknown> | null;
  overview: string | null;
  region: string | null;
  industry: string | null;
}

export async function loadApprovedTeasers(): Promise<ApprovedTeaser[]> {
  const { data, error } = await supabase
    .from("teasers")
    .select("id, business_id, title, financial_snapshot, overview, businesses(region, industry)")
    .eq("approved_for_outreach", true)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => {
    const b = (row as unknown as { businesses?: { region: string | null; industry: string | null } | null }).businesses;
    return {
      id: row.id,
      business_id: row.business_id,
      title: row.title,
      financial_snapshot: row.financial_snapshot as Record<string, unknown> | null,
      overview: row.overview,
      region: b?.region ?? null,
      industry: b?.industry ?? null,
    };
  });
}

export async function submitNdaRequest(input: {
  teaserId: string;
  businessId: string | null;
  buyerName: string;
  buyerEmail: string;
  signature: string;
}): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Please sign in to request access.");
  const { error } = await supabase.from("nda_requests").upsert(
    {
      teaser_id: input.teaserId,
      business_id: input.businessId,
      buyer_id: userId,
      buyer_name: input.buyerName,
      buyer_email: input.buyerEmail,
      signature_text: input.signature,
      confidentiality_accepted: true,
      status: "submitted",
    },
    { onConflict: "buyer_id,teaser_id", ignoreDuplicates: false },
  );
  if (error) throw new Error(error.message);

}

export interface StoredNdaRequest {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  status: string;
  submitted_at: string;
  teaser_title: string | null;
}

export async function loadBuyerNdaRequests(): Promise<StoredNdaRequest[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("nda_requests")
    .select("id, buyer_name, buyer_email, status, submitted_at, teasers(title)")
    .eq("buyer_id", userId)
    .order("submitted_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    buyer_name: row.buyer_name,
    buyer_email: row.buyer_email,
    status: row.status,
    submitted_at: row.submitted_at,
    teaser_title:
      (row as unknown as { teasers?: { title: string | null } | null }).teasers?.title ?? null,
  }));
}

export async function loadSellerNdaRequests(): Promise<StoredNdaRequest[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const businessId = getState().currentBusinessId;
  if (!businessId) return [];
  const { data, error } = await supabase
    .from("nda_requests")
    .select("id, buyer_name, buyer_email, status, submitted_at, teasers(title)")
    .eq("business_id", businessId)
    .order("submitted_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    buyer_name: row.buyer_name,
    buyer_email: row.buyer_email,
    status: row.status,
    submitted_at: row.submitted_at,
    teaser_title:
      (row as unknown as { teasers?: { title: string | null } | null }).teasers?.title ?? null,
  }));
}

// -------- Hydration --------

/**
 * Load the seller's most recent business + linked records into the local store
 * so the UI immediately reflects saved state on refresh.
 */
export async function hydrateSellerWorkspace(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!business) return;

  const [finRes, riskRes, valRes, teaserRes] = await Promise.all([
    supabase.from("seller_financials").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("risk_answers").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("valuations").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("teasers").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const financials = finRes.data;
  const risk = riskRes.data;
  const valuation = valRes.data;
  const teaser = teaserRes.data;

  setState({
    currentBusinessId: business.id,
    currentFinancialsId: financials?.id ?? null,
    currentValuationId: valuation?.id ?? null,
    currentTeaserId: teaser?.id ?? null,
    business: {
      name: business.business_name ?? "",
      industry: business.industry ?? "",
      city: business.city ?? "",
      state: business.state ?? "",
      yearsInBusiness: business.years_in_business ?? "",
      employees: business.employees ?? "",
      reason: business.reason_for_sale ?? "",
      timeline: business.desired_timeline ?? "",
    },
    financials: financials
      ? {
          revenue: Number(financials.revenue ?? 0),
          grossProfit: Number(financials.gross_profit ?? 0),
          operatingExpenses: Number(financials.operating_expenses ?? 0),
          netIncome: Number(financials.net_income ?? 0),
          ownerCompensation: Number(financials.owner_compensation ?? 0),
          oneTimeExpenses: Number(financials.one_time_expenses ?? 0),
          personalAddbacks: Number(financials.personal_addbacks ?? 0),
          otherAddbacks: Number(financials.other_addbacks ?? 0),
        }
      : null,
    qbConnected: financials?.source === "quickbooks_mock" || financials?.source === "quickbooks",
    risk: risk
      ? {
          customerConcentration: risk.customer_concentration ?? "",
          ownerRelationships: risk.owner_relationships ?? "",
          transitionSupport: risk.transition_support ?? "",
          revenueType: risk.revenue_type ?? "",
          facility: risk.facility_status ?? "",
          keyEmployees: risk.key_employees ?? "",
          bookQuality: risk.book_quality ?? "",
        }
      : null,
    valuation: valuation
      ? {
          low: Number(valuation.low_value ?? 0),
          base: Number(valuation.base_value ?? 0),
          high: Number(valuation.high_value ?? 0),
          sde: Number(valuation.estimated_sde ?? 0),
          multipleLow: Number(valuation.low_multiple ?? 0),
          multipleBase: Number(valuation.base_multiple ?? 0),
          multipleHigh: Number(valuation.high_multiple ?? 0),
          confidence: (valuation.confidence as "Low" | "Medium" | "High") ?? "Medium",
          drivers: (valuation.value_drivers as string[]) ?? [],
          concerns: (valuation.buyer_concerns as string[]) ?? [],
          upside: (valuation.upside_opportunities as string[]) ?? [],
          buyerTypes: (valuation.likely_buyer_types as string[]) ?? [],
        }
      : null,
    teaserApproved: !!teaser,
    outreachApproved: !!teaser?.approved_for_outreach,
  });
}
