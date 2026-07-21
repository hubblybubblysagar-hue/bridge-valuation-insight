// Protected QA page for exercising real Supabase-backed persistence
// as the current signed-in user. RLS applies; no admin privileges.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QAModeBadge } from "@/components/QAModeBadge";
import {
  DEMO_BUSINESS,
  DEMO_FINANCIALS,
  DEMO_RISK,
  DEMO_VALUATION,
  getState,
  useAppState,
} from "@/lib/store";
import { computeValuation } from "@/lib/valuation";
import {
  approveBuyerInterestTest,
  hydrateSellerWorkspace,
  loadApprovedTeasers,
  loadBuyerNdaRequests,
  loadSellerNdaRequests,
  persistBusiness,
  persistBuyerProfile,
  persistFinancials,
  persistRisk,
  persistTeaser,
  persistValuation,
  submitNdaRequest,
} from "@/lib/persist";
import {
  countCompanyInfoSnapshots,
  disconnectQuickBooks,
  loadConnectionSummary,
  startQuickBooksOAuth,
  verifyCompanyInfo,
  type QbConnectionSummary,
} from "@/lib/quickbooks";

export const Route = createFileRoute("/qa-backend")({
  head: () => ({
    meta: [
      { title: "QA — Backend persistence" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: QaBackendPage,
});

interface Counts {
  approvedTeasers: number;
  ndaVisible: number;
}

function QaBackendPage() {
  const navigate = useNavigate();
  const state = useAppState((s) => s);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [profileRow, setProfileRow] = useState<Record<string, unknown> | null>(null);
  const [counts, setCounts] = useState<Counts>({ approvedTeasers: 0, ndaVisible: 0 });
  const [logs, setLogs] = useState<Array<{ ts: string; ok: boolean; msg: string }>>([]);

  const log = (ok: boolean, msg: string) =>
    setLogs((l) => [{ ts: new Date().toLocaleTimeString(), ok, msg }, ...l].slice(0, 40));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setAuthUserId(uid);
      setChecking(false);
      if (!uid) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      setProfileRow(profile ?? null);
      await refreshCounts();
    })();
  }, []);

  async function refreshCounts() {
    const teasers = await loadApprovedTeasers();
    const role = (profileRow?.role as string) ?? state.user?.role ?? "seller";
    const ndas = role === "buyer" ? await loadBuyerNdaRequests() : await loadSellerNdaRequests();
    setCounts({ approvedTeasers: teasers.length, ndaVisible: ndas.length });
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    try {
      const result = await fn();
      const detail = typeof result === "string" ? ` → ${result}` : "";
      log(true, `${label}${detail}`);
      await refreshCounts();
    } catch (err) {
      log(false, `${label}: ${(err as Error).message}`);
    }
  }

  if (checking) {
    return <div className="p-10 text-sm text-muted-foreground">Checking session…</div>;
  }

  if (!authUserId) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <QAModeBadge label="QA Mode · Backend" />
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <h1 className="text-xl font-semibold text-foreground">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This QA page runs against real Supabase persistence as the authenticated user.
            Please sign in with a real seller or buyer account first.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate({ to: "/login" })}>Sign in</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/signup" })}>
              Create seller account
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/buyer-signup" })}>
              Create buyer account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const role = (profileRow?.role as string) ?? state.user?.role ?? "unknown";

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <QAModeBadge label="QA Mode · Backend" />
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">
            Internal QA
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Backend persistence QA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Exercises the real Supabase-backed persistence helpers as the current user. RLS applies;
            no admin/service-role access.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <StateCard title="Auth" rows={[["User ID", authUserId], ["Role", role]]} />
          <StateCard
            title="Workspace"
            rows={[
              ["Business ID", state.currentBusinessId ?? "—"],
              ["Financials ID", state.currentFinancialsId ?? "—"],
              ["Valuation ID", state.currentValuationId ?? "—"],
              ["Teaser ID", state.currentTeaserId ?? "—"],
              ["Teaser approved (local)", String(state.outreachApproved)],
            ]}
          />
          <StateCard
            title="Buyer-visible counts (via RLS)"
            rows={[
              ["Approved teasers you can read", String(counts.approvedTeasers)],
              ["NDA requests you can read", String(counts.ndaVisible)],
            ]}
          />
          <StateCard
            title="Profile row"
            rows={Object.entries(profileRow ?? { profile: "not found" }).map(([k, v]) => [
              k,
              String(v ?? "—"),
            ])}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Seller test actions
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run("persistBusiness", () => persistBusiness(DEMO_BUSINESS))}>
              1. Save test business
            </Button>
            <Button size="sm" onClick={() => run("persistFinancials (mock QB)", () => persistFinancials(DEMO_FINANCIALS, "quickbooks_mock"))}>
              2. Save mock QB financials
            </Button>
            <Button size="sm" onClick={() => run("persistRisk", () => persistRisk(DEMO_RISK))}>
              3. Save risk answers
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run("persistValuation", async () => {
                  const val = computeValuation(DEMO_BUSINESS.industry, DEMO_FINANCIALS, DEMO_RISK) ?? DEMO_VALUATION;
                  return persistValuation(val);
                })
              }
            >
              4. Generate + save valuation
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run("persistTeaser", () => {
                  const val = getState().valuation ?? DEMO_VALUATION;
                  const fin = getState().financials ?? DEMO_FINANCIALS;
                  const biz = getState().business ?? DEMO_BUSINESS;
                  return persistTeaser(biz, val, fin.revenue);
                })
              }
            >
              5. Generate + save teaser
            </Button>
            <Button size="sm" onClick={() => run("approveBuyerInterestTest", () => approveBuyerInterestTest().then(() => "ok"))}>
              6. Approve buyer interest
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("hydrateSellerWorkspace", () => hydrateSellerWorkspace().then(() => "ok"))}>
              Reload from DB
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Buyer test actions
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                run("persistBuyerProfile", () =>
                  persistBuyerProfile({
                    buyerType: "individual",
                    industries: "hvac, plumbing",
                    geography: "Northeast, MA",
                    revenueRange: "1-5M",
                    sdeRange: "300-800K",
                    capital: "$500,000",
                    timeline: "6-12",
                  }).then(() => "ok"),
                )
              }
            >
              1. Save buyer profile
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run("loadApprovedTeasers", async () => `${(await loadApprovedTeasers()).length} teaser(s)`)
              }
            >
              2. Load approved teaser feed
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run("submitNdaRequest (first approved teaser)", async () => {
                  const teasers = await loadApprovedTeasers();
                  if (!teasers.length) throw new Error("No approved teasers visible");
                  const t = teasers[0];
                  await submitNdaRequest({
                    teaserId: t.id,
                    businessId: t.business_id,
                    buyerName: "QA Buyer",
                    buyerEmail: state.user?.email ?? "qa-buyer@example.com",
                    signature: "QA Buyer",
                  });
                  return t.id;
                })
              }
            >
              3. Submit test NDA request
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Activity log
          </h2>
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-muted-foreground">No actions run yet.</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className={l.ok ? "text-foreground" : "text-destructive"}>
                  [{l.ts}] {l.ok ? "OK  " : "ERR "} {l.msg}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Manual test checklist
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3 text-sm">
            <Checklist
              title="Seller flow"
              items={[
                "Sign up as seller",
                "Connect mock QuickBooks",
                "Save business basics",
                "Save financial review",
                "Save risk answers",
                "Generate valuation",
                "Generate teaser",
                "Approve buyer interest",
                "Refresh — data persists",
              ]}
            />
            <Checklist
              title="Buyer flow"
              items={[
                "Sign up as buyer",
                "Create buyer profile",
                "View approved anonymous teaser",
                "Request NDA access",
                "NDA request persists",
                "Seller sees NDA request",
              ]}
            />
            <Checklist
              title="Security"
              items={[
                "Buyer cannot read seller financials",
                "Buyer cannot read risk answers",
                "Buyer cannot read unapproved teasers",
                "Anon cannot read private seller tables",
                "/debug/state remains mock-only",
              ]}
            />
          </div>
          <div className="mt-6 flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/debug/state">/debug/state (mock)</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/qa">/qa (demo shortcuts)</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function StateCard({ title, rows }: { title: string; rows: Array<[string, string | null]> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="max-w-[60%] truncate font-mono text-xs text-foreground">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
