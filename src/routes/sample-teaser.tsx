import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { TeaserDocument } from "@/components/Teaser";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/sample-teaser")({
  head: () => ({ meta: [{ title: "Sample teaser — ExitBridge" }] }),
  component: SampleTeaser,
});

function SampleTeaser() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Home</Link>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">Illustrative Example</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Sample anonymous teaser</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            This is an example only. Real teasers are generated from your own financials
            and business details, and are anonymized before any buyer sees them.
          </p>
        </div>

        <TeaserDocument
          business={{
            name: "",
            industry: "hvac",
            city: "",
            state: "NY",
            yearsInBusiness: 22,
            employees: 24,
            reason: "retirement",
            timeline: "6-12",
          }}
          revenue={2850000}
          valuation={{
            low: 1620000,
            base: 1920000,
            high: 2220000,
            sde: 600000,
            multipleLow: 2.7,
            multipleBase: 3.2,
            multipleHigh: 3.7,
            confidence: "Medium",
            drivers: [
              "Recurring service contract base supports predictable cash flow.",
              "Diversified customer base with no single concentration risk.",
              "Owner open to a reasonable transition period.",
            ],
            concerns: [],
            upside: [
              "Expand into adjacent commercial HVAC segments.",
              "Introduce annual maintenance plans to deepen recurring revenue.",
              "Build regional coverage through targeted tuck-in acquisitions.",
            ],
            buyerTypes: [],
          }}
        />

        <div className="mt-10 text-center">
          <Button asChild size="lg" className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground">
            <Link to="/signup">Generate my confidential teaser</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
