import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 50% 0%, oklch(0.75 0.14 85 / 0.15), transparent 70%), radial-gradient(60% 60% at 90% 20%, oklch(0.19 0.04 260 / 0.1), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Confidential valuation & anonymous buyer interest testing
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Know what your business could be worth{" "}
              <span className="text-gold">before you talk to a broker.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
              ExitBridge turns your QuickBooks financials into a confidential
              valuation range, adjusted earnings estimate, and anonymous
              buyer-ready teaser in minutes.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 bg-gold px-6 text-gold-foreground shadow-elegant hover:bg-gold/90"
              >
                <Link to="/signup">
                  Connect QuickBooks <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-border px-6"
              >
                <Link to="/sample-teaser">See Sample Teaser</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Read-only QuickBooks review · No public listing · You approve any buyer outreach
            </p>
          </div>
        </div>
      </section>

      {/* Trust cards */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TrustCard icon={Lock} title="Read-only QuickBooks review" body="ExitBridge analyzes your financials with read-only access. We never modify your books." />
            <TrustCard icon={ShieldCheck} title="Anonymous by default" body="Your business identity is never revealed without your explicit approval." />
            <TrustCard icon={Building2} title="No public listing" body="Your business is never posted to a public marketplace or search directory." />
            <TrustCard icon={UserCheck} title="Seller approves all outreach" body="No buyer is ever contacted about your business until you say yes." />
            <TrustCard icon={FileText} title="Preliminary valuation" body="A directional range based on your inputs — not a certified appraisal." />
            <TrustCard icon={Users} title="Boutique-quality teaser" body="A one-page anonymous teaser in the format buyers already expect." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              A quiet, private way to explore what's possible.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Four steps from connection to confidential buyer interest testing.
            </p>
          </div>
          <ol className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", t: "Connect QuickBooks securely", d: "Read-only OAuth. Nothing is changed in your books." },
              { n: "02", t: "Review AI-normalized earnings", d: "Add back owner comp, one-time expenses, and personal items." },
              { n: "03", t: "Generate an anonymous teaser", d: "A boutique one-pager with no identifying details." },
              { n: "04", t: "Privately test buyer interest", d: "Only after you approve, and only against anonymous profiles." },
            ].map((s) => (
              <li key={s.n} className="relative rounded-xl border border-border bg-card p-6 shadow-elegant">
                <div className="text-xs font-semibold tracking-widest text-gold">{s.n}</div>
                <h3 className="mt-3 text-base font-semibold text-foreground">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Sample teaser preview */}
      <section id="teaser" className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-gold">Sample Teaser</div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              The one-pager buyers actually read.
            </h2>
            <p className="mt-4 text-muted-foreground">
              A calm, boutique-quality summary of the opportunity — with none of
              the identifying details. You review and approve before it is ever
              shared with a buyer.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/90">
              {[
                "Anonymous industry & region positioning",
                "Adjusted SDE and revenue as ranges only",
                "Investment highlights & growth opportunities",
                "Transition profile and buyer fit",
              ].map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-gold" /> {i}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground">
                <Link to="/sample-teaser">See the full sample</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -translate-y-4 translate-x-4 rounded-2xl border border-border/70 bg-muted/60" aria-hidden />
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-premium">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">Confidential Opportunity</div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Established HVAC Services Company in the Northeast
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Revenue", "$2.6M – $3.1M"],
                  ["Adjusted SDE", "$540K – $660K"],
                  ["Region", "Northeast"],
                  ["Employees", "~24"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-background p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2 text-xs text-muted-foreground">
                <div>· 20+ year operating history with diversified customer base</div>
                <div>· Institutionalized dispatch & scheduling operations</div>
                <div>· Owner open to reasonable transition support</div>
              </div>
              <div className="mt-5 rounded-md border border-border bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Confidentiality: Business name, address, and ownership withheld
                pending mutual NDA. Preliminary, directional figures.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Simple, transparent pricing.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Upgrade when you want a founder-reviewed opinion.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Free</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-foreground">$0</span>
                <span className="text-sm text-muted-foreground">/ instant estimate</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Everything you need to get a private, directional read on value.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/90">
                {["Connect QuickBooks or upload financials", "Adjusted SDE estimate", "Preliminary valuation range", "Anonymous one-page teaser"].map((i) => (
                  <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-gold" /> {i}</li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-secondary dark:text-secondary-foreground">
                <Link to="/signup">Start free</Link>
              </Button>
            </div>
            <div className="relative rounded-2xl border border-gold/40 bg-card p-8 shadow-premium">
              <div className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-foreground">
                Founder-reviewed
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold">ExitBridge Snapshot</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-foreground">$499</span>
                <span className="text-sm text-muted-foreground">one-time</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                A hand-reviewed valuation memo and teaser, prepared by our team.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/90">
                {[
                  "Everything in Free",
                  "Founder review of adjusted earnings",
                  "Refined valuation memo with commentary",
                  "Polished teaser and buyer-fit notes",
                ].map((i) => (
                  <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-gold" /> {i}</li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full bg-gold text-gold-foreground hover:bg-gold/90">
                <Link to="/signup">Book Snapshot</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-navy p-10 text-navy-foreground shadow-premium sm:p-16">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Have a private conversation with your own numbers first.
            </h2>
            <p className="mt-4 max-w-2xl text-navy-foreground/80">
              Connect QuickBooks, see a confidential valuation range, and decide
              on your own timeline. No listings. No obligations.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 bg-gold px-6 text-gold-foreground hover:bg-gold/90">
                <Link to="/signup">Connect QuickBooks</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-navy-foreground/25 bg-transparent px-6 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                <Link to="/sample-teaser">See sample teaser</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ExitBridge. Preliminary valuations only — not a certified appraisal.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Create account</Link>
            <Link to="/buyer-signup">I'm a buyer</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 text-navy dark:bg-gold/10 dark:text-gold">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
