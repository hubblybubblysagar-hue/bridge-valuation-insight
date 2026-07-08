import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
  Building2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { GrowthChart } from "@/components/GrowthChart";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO — editorial serif, cream, vertical label */}
      <section className="relative border-b border-border/70">
        <VerticalLabel>A confidential path to exit</VerticalLabel>
        <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <Reveal>
                <h1 className="font-serif text-[44px] leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-[76px]">
                  Know what your business
                  <br />
                  could be worth.{" "}
                  <span className="italic text-olive">Before it's obvious.</span>
                </h1>
              </Reveal>
              <Reveal delay={150}>
                <p className="mt-8 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
                  ExitBridge turns your QuickBooks financials into a confidential
                  valuation range, adjusted earnings estimate, and anonymous
                  buyer-ready teaser in minutes.
                </p>
              </Reveal>
              <Reveal delay={280}>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-md bg-olive px-6 text-olive-foreground hover:bg-olive/90"
                  >
                    <Link to="/signup">
                      Connect QuickBooks
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Link
                    to="/sample-teaser"
                    className="group inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground"
                  >
                    See sample teaser
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </Reveal>
            </div>

            <Reveal delay={200}>
              <HeroTeaserCard />
            </Reveal>
          </div>

          <Reveal delay={400}>
            <div className="mt-16 grid gap-6 border-t border-border/70 pt-8 text-xs uppercase tracking-[0.18em] text-foreground/50 sm:grid-cols-2 lg:grid-cols-4">
              <FootLabel>Read-only QuickBooks</FootLabel>
              <FootLabel>Anonymous by default</FootLabel>
              <FootLabel>No public listing</FootLabel>
              <FootLabel>Seller approves outreach</FootLabel>
            </div>
          </Reveal>
        </div>
      </section>

      {/* THESIS – dark ink section with chart */}
      <section id="thesis" className="relative overflow-hidden bg-ink text-ink-foreground">
        <div className="pointer-events-none absolute inset-0 dot-bg opacity-60" />
        <VerticalLabel dark>The thesis</VerticalLabel>
        <div className="relative mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <Reveal>
                <h2 className="font-serif text-4xl leading-[1.05] text-ink-foreground sm:text-5xl lg:text-6xl">
                  Preparation defines
                  <br />
                  <span className="italic text-olive-soft">outcomes.</span>
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="mt-6 max-w-md text-ink-foreground/70">
                  How an owner walks into a sale conversation is often worth more
                  than the sale itself.
                </p>
              </Reveal>

              <div className="mt-14 space-y-10">
                <ThesisPoint
                  title="Most owners find out too late."
                  body="By the time a broker is engaged, the range is set — and the leverage is gone."
                />
                <ThesisPoint
                  title="Buyers price certainty."
                  body="Clean books, normalized earnings, and articulated risk expand the multiple you're offered."
                />
                <ThesisPoint
                  title="Anonymity is leverage."
                  body="Testing interest without a public listing keeps you in control of narrative, timing, and price."
                />
              </div>
            </div>

            <div className="lg:pt-2">
              <Reveal delay={200}>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm sm:p-8">
                  <div className="mb-6 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-foreground/50">
                        Hypothetical growth of $10K
                      </div>
                      <div className="mt-1 font-serif text-2xl">
                        Sale outcome by preparation
                      </div>
                    </div>
                  </div>
                  <div className="text-ink-foreground/80">
                    <GrowthChart />
                  </div>
                  <div className="mt-6 grid gap-2 text-xs text-ink-foreground/60 sm:grid-cols-3">
                    <LegendDot color="var(--olive-soft)" label="ExitBridge-informed" />
                    <LegendDot color="oklch(0.6 0.06 90)" label="Broker-led" />
                    <LegendDot color="oklch(0.72 0.015 100)" label="Unplanned" />
                  </div>
                  <p className="mt-6 text-[11px] leading-relaxed text-ink-foreground/40">
                    Illustrative only. Not a projection, guarantee, or advice.
                    Actual sale outcomes depend on business, market, and buyer
                    dynamics.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Barriers – editorial floating labels on dark */}
      <section className="relative overflow-hidden border-t border-white/5 bg-ink text-ink-foreground">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-70" />
        <VerticalLabel dark>The problem</VerticalLabel>
        <div className="relative mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-28">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-block rounded-sm border border-white/10 bg-white/5 px-5 py-3 font-serif text-2xl italic text-ink-foreground sm:text-3xl">
                Selling a business is opaque by design.
              </div>
            </div>
          </Reveal>

          <div className="relative mx-auto mt-16 grid min-h-[300px] max-w-5xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {[
              { label: "Broker-controlled process", icon: Lock },
              { label: "Opaque valuation", icon: FileText },
              { label: "Public exposure risk", icon: Building2 },
              { label: "Buyer information asymmetry", icon: Users },
              { label: "Slow, high-friction diligence", icon: ShieldCheck },
              { label: "Limited price discovery", icon: UserCheck },
            ].map((b, i) => (
              <Reveal key={b.label} delay={i * 90}>
                <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-ink-foreground/80 shadow-[0_0_0_1px_var(--olive)]/0 hover:border-olive-soft/40">
                  <b.icon className="h-3.5 w-3.5 text-olive-soft" />
                  {b.label}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <div className="mx-auto mt-16 max-w-3xl rounded-md border border-olive/40 bg-olive/15 px-6 py-5 text-center font-serif text-2xl italic text-ink-foreground sm:text-3xl">
              ExitBridge exists to give owners the read they've never had.
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works – editorial numbered rows */}
      <section id="how" className="relative border-b border-border/70">
        <VerticalLabel>How it works</VerticalLabel>
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <h2 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Four quiet steps <span className="italic text-olive">from question to answer.</span>
              </h2>
              <p className="max-w-md text-foreground/70 lg:pt-4">
                No listings. No open marketplace. No one contacts a buyer until
                you say yes.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 divide-y divide-border/70 border-y border-border/70">
            {[
              { t: "Connect QuickBooks securely.", d: "Read-only OAuth. Nothing is changed in your books." },
              { t: "Review AI-normalized earnings.", d: "Add back owner comp, one-time expenses, and personal items to reach Adjusted SDE." },
              { t: "Generate an anonymous teaser.", d: "A boutique one-page opportunity summary with no identifying details." },
              { t: "Privately test buyer interest.", d: "Only after you approve, and only against anonymous buyer profiles." },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 100}>
                <div className="group grid grid-cols-[64px_1fr_auto] items-baseline gap-6 py-8 sm:grid-cols-[80px_1fr_auto] sm:py-10">
                  <div className="font-serif text-2xl text-olive sm:text-3xl">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl sm:text-3xl">{s.t}</h3>
                    <p className="mt-2 max-w-lg text-sm text-foreground/70">{s.d}</p>
                  </div>
                  <ArrowUpRight className="hidden h-5 w-5 shrink-0 text-foreground/30 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-olive sm:block" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sample teaser preview */}
      <section id="teaser" className="border-b border-border/70 bg-secondary/40">
        <VerticalLabel>The teaser</VerticalLabel>
        <div className="mx-auto grid max-w-[1400px] gap-16 px-6 py-24 lg:grid-cols-2 lg:px-10 lg:py-32">
          <div className="lg:pr-10">
            <Reveal>
              <h2 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                The one-pager buyers <span className="italic text-olive">actually read.</span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-6 max-w-md text-foreground/70">
                A calm, boutique-quality summary of the opportunity — with none
                of the identifying details. You review and approve before it is
                ever shared.
              </p>
            </Reveal>
            <Reveal delay={280}>
              <ul className="mt-8 space-y-3 text-sm text-foreground/85">
                {[
                  "Anonymous industry & region positioning",
                  "Adjusted SDE and revenue as ranges only",
                  "Investment highlights & growth opportunities",
                  "Transition profile and buyer fit",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-2 h-1 w-4 shrink-0 bg-olive" /> {i}
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Button
                  asChild
                  className="h-11 rounded-md bg-ink px-5 text-ink-foreground hover:bg-ink/90"
                >
                  <Link to="/sample-teaser">See the full sample</Link>
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <HeroTeaserCard variant="tall" />
          </Reveal>
        </div>
      </section>

      {/* Stats / portfolio-inspired band */}
      <section className="border-b border-border/70">
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-28">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Built by operators, <span className="italic text-olive">for owners.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-foreground/70">
                ExitBridge combines M&A rigor with the privacy every owner
                deserves before they explore what's next.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid divide-x divide-border/70 border border-border/70 md:grid-cols-3">
            <BigStat number="4x" label="Faster to a defensible valuation range" />
            <BigStat number="0" label="Public listings, ever" />
            <BigStat number="37" label="Anonymous buyer profiles per average match run" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border/70">
        <VerticalLabel>Pricing</VerticalLabel>
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-2">
              <h2 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Start free. <span className="italic text-olive">Upgrade if it's worth it.</span>
              </h2>
              <p className="max-w-md text-foreground/70 lg:pt-4">
                Instant estimate at no cost. A founder-reviewed Snapshot when
                you want a hand-refined opinion.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-6 lg:grid-cols-2">
            <Reveal delay={100}>
              <PricingCard
                tier="Instant"
                price="$0"
                priceSuffix="/ estimate"
                blurb="Everything you need to get a private, directional read on value."
                items={[
                  "Connect QuickBooks or upload financials",
                  "Adjusted SDE estimate",
                  "Preliminary valuation range",
                  "Anonymous one-page teaser",
                ]}
                cta="Start free"
                to="/signup"
                tone="ink"
              />
            </Reveal>
            <Reveal delay={200}>
              <PricingCard
                tier="ExitBridge Snapshot"
                price="$499"
                priceSuffix="one-time"
                blurb="A hand-reviewed valuation memo and teaser, prepared by our team."
                items={[
                  "Everything in Instant",
                  "Founder review of adjusted earnings",
                  "Refined valuation memo with commentary",
                  "Polished teaser and buyer-fit notes",
                ]}
                cta="Book Snapshot"
                to="/signup"
                tone="olive"
                featured
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Final CTA – dark ink */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <div className="pointer-events-none absolute inset-0 dot-bg opacity-50" />
        <div className="relative mx-auto max-w-[1400px] px-6 py-28 lg:px-10 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <h2 className="font-serif text-4xl leading-[1.05] sm:text-6xl lg:text-7xl">
                Have a private conversation
                <br />
                with <span className="italic text-olive-soft">your own numbers</span> first.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mx-auto mt-6 max-w-lg text-ink-foreground/70">
                Connect QuickBooks, see a confidential valuation range, and
                decide on your own timeline.
              </p>
            </Reveal>
            <Reveal delay={350}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-md bg-olive px-6 text-olive-foreground hover:bg-olive/90"
                >
                  <Link to="/signup">Connect QuickBooks</Link>
                </Button>
                <Link
                  to="/sample-teaser"
                  className="group inline-flex items-center gap-2 text-sm text-ink-foreground/80 hover:text-ink-foreground"
                >
                  See sample teaser
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 bg-background">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-6 py-12 lg:flex-row lg:items-center lg:px-10">
          <div className="flex items-center gap-4">
            <span className="font-serif text-xl">ExitBridge</span>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} — Preliminary valuations only, not a certified appraisal.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <Link to="/signup" className="hover:text-foreground">Create account</Link>
            <Link to="/buyer-signup" className="hover:text-foreground">I'm a buyer</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function VerticalLabel({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute left-3 top-24 z-10 hidden xl:block ${
        dark ? "text-ink-foreground/45" : "text-foreground/40"
      }`}
    >
      <div
        className={`vertical-label whitespace-nowrap border px-2 py-4 ${
          dark ? "border-white/15" : "border-border"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function FootLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-1 w-6 bg-olive" />
      <span>{children}</span>
    </div>
  );
}

function ThesisPoint({ title, body }: { title: string; body: string }) {
  return (
    <Reveal>
      <div>
        <h3 className="font-serif text-2xl text-ink-foreground sm:text-3xl">{title}</h3>
        <p className="mt-2 max-w-sm text-sm text-ink-foreground/60">{body}</p>
      </div>
    </Reveal>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function BigStat({ number, label }: { number: string; label: string }) {
  return (
    <div className="px-6 py-12 text-center sm:py-16">
      <div className="font-serif text-6xl leading-none text-olive sm:text-7xl lg:text-8xl">
        {number}
      </div>
      <div className="mx-auto mt-5 max-w-[220px] text-sm text-foreground/70">{label}</div>
    </div>
  );
}

function PricingCard({
  tier,
  price,
  priceSuffix,
  blurb,
  items,
  cta,
  to,
  tone,
  featured,
}: {
  tier: string;
  price: string;
  priceSuffix: string;
  blurb: string;
  items: string[];
  cta: string;
  to: "/signup";
  tone: "ink" | "olive";
  featured?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-lg border p-8 sm:p-10 ${
        featured ? "border-olive/50 bg-card shadow-elegant" : "border-border bg-card"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-8 rounded-sm bg-olive px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-olive-foreground">
          Founder-reviewed
        </div>
      )}
      <div className="text-xs uppercase tracking-[0.2em] text-foreground/50">{tier}</div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-serif text-5xl">{price}</span>
        <span className="text-sm text-foreground/60">{priceSuffix}</span>
      </div>
      <p className="mt-4 max-w-sm text-sm text-foreground/70">{blurb}</p>
      <ul className="mt-8 flex-1 space-y-3 text-sm text-foreground/85">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-2 h-1 w-4 shrink-0 bg-olive" /> {i}
          </li>
        ))}
      </ul>
      <Button
        asChild
        className={`mt-10 h-11 rounded-md ${
          tone === "olive"
            ? "bg-olive text-olive-foreground hover:bg-olive/90"
            : "bg-ink text-ink-foreground hover:bg-ink/90"
        }`}
      >
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}

function HeroTeaserCard({ variant }: { variant?: "tall" }) {
  return (
    <div
      className={`relative rounded-lg border border-border bg-card shadow-elegant ${
        variant === "tall" ? "p-8" : "p-7"
      }`}
    >
      <div className="absolute -top-3 left-6 rounded-sm bg-ink px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-foreground">
        Confidential
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
        Anonymous opportunity
      </div>
      <h3 className="mt-3 font-serif text-2xl leading-tight sm:text-3xl">
        Established HVAC Services Company
        <br />
        in the <span className="italic text-olive">Northeast.</span>
      </h3>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6">
        {[
          ["Revenue", "$2.6M – $3.1M"],
          ["Adjusted SDE", "$540K – $660K"],
          ["Region", "Northeast"],
          ["Employees", "~24"],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/50">{k}</div>
            <div className="mt-1 font-serif text-xl">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2 text-xs text-foreground/70">
        <div className="flex gap-2"><span className="mt-1.5 h-1 w-3 shrink-0 bg-olive" /> 20+ year operating history with diversified base</div>
        <div className="flex gap-2"><span className="mt-1.5 h-1 w-3 shrink-0 bg-olive" /> Institutionalized dispatch & scheduling</div>
        <div className="flex gap-2"><span className="mt-1.5 h-1 w-3 shrink-0 bg-olive" /> Owner open to reasonable transition support</div>
      </div>

      <div className="mt-6 rounded-sm border border-border bg-secondary/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        Business name, address, and ownership withheld pending mutual NDA.
        Preliminary, directional figures.
      </div>
    </div>
  );
}
