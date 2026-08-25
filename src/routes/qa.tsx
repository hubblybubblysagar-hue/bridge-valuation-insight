import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FlaskConical, Globe, Home, LayoutTemplate, ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/qa")({
  head: () => ({
    meta: [
      { title: "ExitBridge QA Review" },
      { name: "description", content: "Direct links to seeded demo states for product review." },
      { property: "og:title", content: "ExitBridge QA Review" },
      { property: "og:description", content: "Direct links to seeded demo states for product review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ExitBridge QA Review" },
      { name: "twitter:description", content: "Direct links to seeded demo states for product review." },
    ],
  }),
  component: QAReviewPage,
});

const SELLER_LINKS = [
  { to: "/demo/seller/start", label: "Seller start" },
  { to: "/demo/seller/quickbooks-connected", label: "QuickBooks connected" },
  { to: "/demo/seller/financial-review", label: "Financial review" },
  { to: "/demo/seller/valuation", label: "Valuation" },
  { to: "/demo/seller/teaser", label: "Teaser" },
  { to: "/demo/seller/buyer-interest", label: "Buyer interest" },
];

const BUYER_LINKS = [
  { to: "/demo/buyer/feed", label: "Buyer feed" },
  { to: "/demo/buyer/nda-request", label: "NDA request" },
];

const PUBLIC_LINKS = [
  { to: "/", label: "Homepage" },
  { to: "/signup", label: "Sign up" },
  { to: "/login", label: "Sign in" },
  { to: "/buyer-signup", label: "Buyer sign up" },
  { to: "/sample-teaser", label: "Sample teaser" },
];

function QAReviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1100px] px-6 py-16 lg:py-24">
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold">
            <FlaskConical className="h-3.5 w-3.5" />
            QA Environment
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            ExitBridge QA Review
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Direct links to seeded demo states for product review.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <SectionCard
            title="Seller Demo Routes"
            icon={LayoutTemplate}
            links={SELLER_LINKS}
            accent="gold"
          />
          <SectionCard
            title="Buyer Demo Routes"
            icon={Globe}
            links={BUYER_LINKS}
            accent="gold"
          />
          <SectionCard
            title="Public Pages"
            icon={Home}
            links={PUBLIC_LINKS}
            accent="navy"
          />
          <SectionCard
            title="Debug"
            icon={ShieldAlert}
            links={[
              { to: "/debug/state", label: "Debug state" },
              { to: "/seller/financial-vault", label: "Financial Vault (requires real seller sign-in)" },
            ]}
            accent="navy"
          />
        </div>

        <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center text-sm text-navy">
          <p>
            QA routes use seeded demo data only. No real QuickBooks, seller, buyer, or financial information is shown.
          </p>
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  links,
  accent,
}: {
  title: string;
  icon: typeof Home;
  links: { to: string; label: string }[];
  accent: "gold" | "navy";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
      <div className="mb-5 flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            accent === "gold" ? "bg-gold text-gold-foreground" : "bg-navy text-navy-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-navy">{title}</h2>
      </div>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.to}>
            <QaLink to={link.to}>{link.label}</QaLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QaLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-gold/60 hover:bg-gold/5 hover:text-navy"
    >
      <span>{children}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-gold" />
    </Link>
  );
}
