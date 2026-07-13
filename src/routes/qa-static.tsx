import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { TeaserDocument } from "@/components/Teaser";
import {
  DEMO_BUSINESS,
  DEMO_DEALS,
  DEMO_FINANCIALS,
  DEMO_VALUATION,
} from "@/lib/store";
import { fmtCurrency } from "@/lib/valuation";

export const Route = createFileRoute("/qa-static")({
  head: () => ({
    meta: [
      { title: "ExitBridge QA Static Preview" },
      {
        name: "description",
        content:
          "Static, non-authenticated previews of ExitBridge product states for review.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QAStaticPage,
});

function QAStaticPage() {
  const v = DEMO_VALUATION;
  const f = DEMO_FINANCIALS;
  const b = DEMO_BUSINESS;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-40 border-b border-border bg-navy px-6 py-2 text-xs font-semibold uppercase tracking-widest text-white">
        QA Static Preview · Seeded demo data only
      </div>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <h1 className="font-serif text-4xl">ExitBridge QA Static Preview</h1>
          <p className="mt-2 text-muted-foreground">
            Read-only snapshot of major product states. No auth, no
            localStorage, no navigation required.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            QA routes use seeded demo data only. No real QuickBooks, seller,
            buyer, or financial information is shown.
          </p>
        </header>

        <Section
          title="Landing preview"
          note="See the full landing at / — this is a static excerpt."
        >
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-xs uppercase tracking-widest text-gold">
              ExitBridge
            </div>
            <h3 className="mt-2 font-serif text-2xl">
              Know what your business could be worth before you talk to a
              broker.
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Connect QuickBooks to generate a confidential valuation range,
              adjusted earnings estimate, and anonymous buyer-ready teaser in
              minutes.
            </p>
          </div>
        </Section>

        <Section title="QuickBooks connected preview">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              QuickBooks connected · read-only
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Revenue" value={fmtCurrency(f.revenue)} />
              <Stat label="Gross profit" value={fmtCurrency(f.grossProfit)} />
              <Stat label="Net income" value={fmtCurrency(f.netIncome)} />
            </div>
          </div>
        </Section>

        <Section title="Financial review preview">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Owner compensation" value={fmtCurrency(f.ownerCompensation)} />
            <Stat label="One-time expenses" value={fmtCurrency(f.oneTimeExpenses)} />
            <Stat label="Personal addbacks" value={fmtCurrency(f.personalAddbacks)} />
            <Stat label="Adjusted SDE" value={fmtCurrency(v.sde)} />
          </div>
        </Section>

        <Section title="Valuation preview">
          <div className="rounded-lg border border-gold/40 bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Low" value={fmtCurrency(v.low)} />
              <Stat label="Base" value={fmtCurrency(v.base)} />
              <Stat label="High" value={fmtCurrency(v.high)} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <Stat label="SDE" value={fmtCurrency(v.sde)} />
              <Stat
                label="Multiple range"
                value={`${v.multipleLow}x – ${v.multipleHigh}x`}
              />
              <Stat label="Confidence" value={v.confidence} />
            </div>
          </div>
        </Section>

        <Section title="Teaser preview">
          <TeaserDocument business={b} valuation={v} revenue={f.revenue} />
        </Section>

        <Section title="Buyer interest preview">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Example match pool: 37 buyer profiles across five categories.
              Your business is never shared publicly. Outreach uses only your
              anonymous teaser and only after you approve.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["Individual acquisition entrepreneurs", 14],
                ["Search fund buyers", 9],
                ["Strategic acquirers", 6],
                ["Small private equity groups", 5],
                ["Local operators", 3],
              ].map(([name, n]) => (
                <li
                  key={String(name)}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-2"
                >
                  <span>{name}</span>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-gold" />
              In production, buyer matches will be based on verified
              acquisition criteria, available capital, geography, industry
              preference, and seller approval.
            </div>
          </div>
        </Section>

        <Section title="Buyer deal card preview">
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_DEALS.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="text-xs uppercase tracking-widest text-gold">
                  {d.industry} · {d.region}
                </div>
                <h3 className="mt-2 font-serif text-lg">{d.title}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Revenue: <span className="text-foreground">{d.revenue}</span></div>
                  <div>SDE: <span className="text-foreground">{d.sde}</span></div>
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Status: {d.status}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {note && <p className="mb-3 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
}
