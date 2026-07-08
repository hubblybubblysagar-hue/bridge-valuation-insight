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
  confidence: "Low" | "Moderate" | "High";
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
