// Local UI cache + Supabase-backed auth for ExitBridge.
// Demo/QA routes call seedDemoStage() and remain local-only (no DB writes).
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "seller" | "buyer";

export interface User {
  id: string;
  email: string;
  role: Role;
  fullName?: string | null;
}

export interface Financials {
  revenue: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
  ownerCompensation: number;
  oneTimeExpenses: number;
  personalAddbacks: number;
  otherAddbacks: number;
}

export interface Business {
  name: string;
  industry: string;
  city: string;
  state: string;
  yearsInBusiness: number | "";
  employees: number | "";
  reason: string;
  timeline: string;
}

export interface RiskAnswers {
  customerConcentration: string;
  ownerRelationships: string;
  transitionSupport: string;
  revenueType: string;
  facility: string;
  keyEmployees: string;
  bookQuality: string;
}

export interface Valuation {
  low: number;
  base: number;
  high: number;
  sde: number;
  multipleLow: number;
  multipleBase: number;
  multipleHigh: number;
  confidence: "Low" | "Medium" | "High";
  drivers: string[];
  concerns: string[];
  upside: string[];
  buyerTypes: string[];
}

export interface AppState {
  user: User | null;
  qbConnected: boolean;
  business: Business | null;
  financials: Financials | null;
  risk: RiskAnswers | null;
  valuation: Valuation | null;
  teaserApproved: boolean;
  outreachApproved: boolean;
  currentBusinessId: string | null;
  currentFinancialsId: string | null;
  currentValuationId: string | null;
  currentTeaserId: string | null;
  ndaRequests: Array<{
    id: string;
    dealTitle: string;
    buyerName: string;
    email: string;
    submittedAt: string;
  }>;
}

const STORAGE_KEY = "exitbridge-state-v2";

const defaultState: AppState = {
  user: null,
  qbConnected: false,
  business: null,
  financials: null,
  risk: null,
  valuation: null,
  teaserApproved: false,
  outreachApproved: false,
  currentBusinessId: null,
  currentFinancialsId: null,
  currentValuationId: null,
  currentTeaserId: null,
  ndaRequests: [],
};

let state: AppState = defaultState;
const listeners = new Set<() => void>();

function load() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...defaultState, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
}

function persist() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let hydrated = false;
function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  load();
  hydrated = true;
  listeners.forEach((l) => l());
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  useEffect(() => {
    ensureHydrated();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(defaultState),
  );
}

// ---------------- Auth (Supabase) ----------------

async function loadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    role: (data.role as Role) ?? "seller",
    fullName: data.full_name,
  };
}

export async function signUp(
  email: string,
  password: string,
  role: Role,
  fullName?: string,
): Promise<User> {
  const emailRedirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { role, full_name: fullName ?? null },
    },
  });
  if (error) throw new Error(error.message);
  const authUser = data.user;
  if (!authUser) throw new Error("Signup failed — please try again.");

  const { error: insertError } = await supabase.from("profiles").insert({
    id: authUser.id,
    email,
    role,
    full_name: fullName ?? null,
  });
  // Ignore duplicate profile errors (e.g. reconfirmation).
  if (insertError && !/duplicate/i.test(insertError.message)) {
    throw new Error(insertError.message);
  }

  const user: User = { id: authUser.id, email, role, fullName: fullName ?? null };
  setState({ ...defaultState, user });
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  // Local demo bypass — keeps QA/demo review paths working with no real backend account.
  if (
    (email === DEMO_SELLER_EMAIL || email === DEMO_BUYER_EMAIL) &&
    password === DEMO_PASSWORD
  ) {
    const role: Role = email === DEMO_BUYER_EMAIL ? "buyer" : "seller";
    const user: User = { id: `demo-${role}`, email, role };
    setState({ ...defaultState, user });
    return user;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Invalid email or password.");
  const profile = (await loadProfile(data.user.id)) ?? {
    id: data.user.id,
    email: data.user.email ?? email,
    role: "seller" as Role,
  };
  setState({ ...defaultState, user: profile });
  return profile;
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch {
    /* noop */
  }
  setState({ ...defaultState });
}

/** Called from __root on auth state change — rehydrate user for real sessions. */
export async function hydrateSessionUser() {
  try {
    const { data } = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) {
      if (state.user && !state.user.id.startsWith("demo-")) {
        setState({ ...defaultState });
      }
      return;
    }
    const profile = await loadProfile(authUser.id);
    if (profile) setState({ user: profile });
  } catch {
    /* noop */
  }
}

// ---------------- QA / Demo seed ----------------

export const DEMO_SELLER_EMAIL = "seller@exitbridge.demo";
export const DEMO_BUYER_EMAIL = "buyer@exitbridge.demo";
export const DEMO_PASSWORD = "Demo123!";

export const DEMO_BUSINESS: Business = {
  name: "Harborview HVAC Services",
  industry: "hvac",
  city: "Boston",
  state: "MA",
  yearsInBusiness: 18,
  employees: 14,
  reason: "succession",
  timeline: "6-12",
};

export const DEMO_FINANCIALS: Financials = {
  revenue: 2_850_000,
  grossProfit: 1_425_000,
  operatingExpenses: 1_000_000,
  netIncome: 425_000,
  ownerCompensation: 120_000,
  oneTimeExpenses: 35_000,
  personalAddbacks: 20_000,
  otherAddbacks: 0,
};

export const DEMO_RISK: RiskAnswers = {
  customerConcentration: "18",
  ownerRelationships: "yes",
  transitionSupport: "yes",
  revenueType: "repeat",
  facility: "owned",
  keyEmployees: "yes",
  bookQuality: "mostly-clean",
};

export const DEMO_VALUATION: Valuation = {
  low: 1_560_000,
  base: 1_920_000,
  high: 2_160_000,
  sde: 600_000,
  multipleLow: 2.6,
  multipleBase: 3.2,
  multipleHigh: 3.6,
  confidence: "Medium",
  drivers: [
    "Long operating history",
    "Stable service demand",
    "Strong local reputation",
    "Meaningful adjusted owner earnings",
  ],
  concerns: [
    "Owner involvement in customer relationships",
    "Need to validate add-backs",
    "Customer concentration should be reviewed",
    "Transition plan needs to be documented",
  ],
  upside: [
    "Institutionalize customer relationships to reduce owner dependence",
    "Document a formal transition plan",
    "Introduce recurring service plans to deepen customer retention",
  ],
  buyerTypes: [
    "Individual acquisition entrepreneurs",
    "Search fund buyers",
    "Strategic acquirers",
    "Small private equity groups",
    "Local operators",
  ],
};

export const DEMO_BUYER_MATCHES = {
  total: 37,
  categories: [
    { name: "Individual acquisition entrepreneurs", count: 14 },
    { name: "Search fund buyers", count: 9 },
    { name: "Strategic acquirers", count: 6 },
    { name: "Small private equity groups", count: 5 },
    { name: "Local operators", count: 3 },
  ],
};

export const DEMO_DEALS = [
  {
    id: "demo-deal-1",
    title: "Established HVAC Services Company in the Northeast",
    industry: "HVAC",
    region: "Northeast",
    revenue: "$2.6M – $3.1M",
    sde: "$540K – $660K",
    status: "Exploratory",
  },
  {
    id: "demo-deal-2",
    title: "Profitable E-commerce Brand in the Southwest",
    industry: "E-commerce",
    region: "Southwest",
    revenue: "$4.1M – $4.8M",
    sde: "$720K – $860K",
    status: "Exploratory",
  },
  {
    id: "demo-deal-3",
    title: "B2B SaaS Business with Recurring Revenue",
    industry: "SaaS",
    region: "Remote",
    revenue: "$1.8M – $2.2M",
    sde: "$450K – $560K",
    status: "Exploratory",
  },
];

export const DEMO_NDA_REQUEST = {
  id: "demo-nda-1",
  dealTitle: DEMO_DEALS[0].title,
  buyerName: "Alex Reviewer",
  email: DEMO_BUYER_EMAIL,
  submittedAt: new Date().toISOString(),
};

/** No-op on Supabase (demo login uses the in-app bypass in signIn). */
export function ensureDemoAccounts() {
  /* no-op */
}

export type DemoStage =
  | "seller-start"
  | "seller-qb-connected"
  | "seller-financial-review"
  | "seller-valuation"
  | "seller-teaser"
  | "seller-buyer-interest"
  | "buyer-feed"
  | "buyer-nda-request";

export function seedDemoStage(stage: DemoStage) {
  ensureHydrated();

  const isBuyer = stage.startsWith("buyer");
  const user: User = isBuyer
    ? { id: "demo-buyer", email: DEMO_BUYER_EMAIL, role: "buyer" }
    : { id: "demo-seller", email: DEMO_SELLER_EMAIL, role: "seller" };

  const base: Partial<AppState> = {
    ...defaultState,
    user,
  };

  switch (stage) {
    case "seller-start":
      setState(base);
      return;
    case "seller-qb-connected":
      setState({ ...base, qbConnected: true, financials: DEMO_FINANCIALS });
      return;
    case "seller-financial-review":
      setState({
        ...base,
        qbConnected: true,
        financials: DEMO_FINANCIALS,
        business: DEMO_BUSINESS,
      });
      return;
    case "seller-valuation":
    case "seller-teaser":
      setState({
        ...base,
        qbConnected: true,
        financials: DEMO_FINANCIALS,
        business: DEMO_BUSINESS,
        risk: DEMO_RISK,
        valuation: DEMO_VALUATION,
        teaserApproved: stage === "seller-teaser",
      });
      return;
    case "seller-buyer-interest":
      setState({
        ...base,
        qbConnected: true,
        financials: DEMO_FINANCIALS,
        business: DEMO_BUSINESS,
        risk: DEMO_RISK,
        valuation: DEMO_VALUATION,
        teaserApproved: true,
        outreachApproved: false,
      });
      return;
    case "buyer-feed":
      setState(base);
      return;
    case "buyer-nda-request":
      setState({ ...base, ndaRequests: [DEMO_NDA_REQUEST] });
      return;
  }
}
