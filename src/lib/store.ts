// Local-storage backed reactive store. Structured so a Supabase backend
// can slot in later without changing components.
import { useEffect, useSyncExternalStore } from "react";

export type Role = "seller" | "buyer";

export interface User {
  id: string;
  email: string;
  role: Role;
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
  ndaRequests: Array<{
    id: string;
    dealTitle: string;
    buyerName: string;
    email: string;
    submittedAt: string;
  }>;
}

const STORAGE_KEY = "exitbridge-state-v1";

const defaultState: AppState = {
  user: null,
  qbConnected: false,
  business: null,
  financials: null,
  risk: null,
  valuation: null,
  teaserApproved: false,
  outreachApproved: false,
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
  try {
    ensureDemoAccounts();
  } catch {
    /* noop */
  }
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

// --- Auth helpers (localStorage only for MVP) ---
interface StoredAccount {
  email: string;
  password: string;
  role: Role;
}
const ACCOUNTS_KEY = "exitbridge-accounts-v1";

function loadAccounts(): StoredAccount[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveAccounts(a: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

export function signUp(email: string, password: string, role: Role): User {
  const accounts = loadAccounts();
  if (accounts.some((a) => a.email === email)) {
    throw new Error("An account with that email already exists.");
  }
  accounts.push({ email, password, role });
  saveAccounts(accounts);
  const user: User = { id: crypto.randomUUID(), email, role };
  setState({ user });
  return user;
}

export function signIn(email: string, password: string): User {
  const accounts = loadAccounts();
  const found = accounts.find((a) => a.email === email && a.password === password);
  if (!found) throw new Error("Invalid email or password.");
  const user: User = { id: crypto.randomUUID(), email, role: found.role };
  setState({ user });
  return user;
}

export function signOut() {
  setState({ user: null });
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

export function ensureDemoAccounts() {
  if (typeof localStorage === "undefined") return;
  const accounts = loadAccounts();
  const upsert = (email: string, role: Role) => {
    const idx = accounts.findIndex((a) => a.email === email);
    const entry: StoredAccount = { email, password: DEMO_PASSWORD, role };
    if (idx >= 0) accounts[idx] = entry;
    else accounts.push(entry);
  };
  upsert(DEMO_SELLER_EMAIL, "seller");
  upsert(DEMO_BUYER_EMAIL, "buyer");
  saveAccounts(accounts);
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
  ensureDemoAccounts();

  const isBuyer = stage.startsWith("buyer");
  const user: User = isBuyer
    ? { id: "demo-buyer", email: DEMO_BUYER_EMAIL, role: "buyer" }
    : { id: "demo-seller", email: DEMO_SELLER_EMAIL, role: "seller" };

  const base: Partial<AppState> = {
    user,
    business: null,
    financials: null,
    risk: null,
    valuation: null,
    qbConnected: false,
    teaserApproved: false,
    outreachApproved: false,
    ndaRequests: [],
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
      setState({ ...base, user });
      return;
    case "buyer-nda-request":
      setState({ ...base, user, ndaRequests: [DEMO_NDA_REQUEST] });
      return;
  }
}

