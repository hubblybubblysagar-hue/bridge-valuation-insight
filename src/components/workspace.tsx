// Internal workspace design system — editorial grammar carried from the
// landing page into the authenticated product: restrained serif headings,
// gold section cues, calm surfaces, explicit provenance chips.
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

/** Small uppercase gold cue above page titles: "03 · Normalize". */
export function PageEyebrow({ index, label }: { index?: string; label: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
      {index ? `${index} · ${label}` : label}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: { index?: string; label: string };
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow && <PageEyebrow index={eyebrow.index} label={eyebrow.label} />}
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  testId,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-border bg-card p-6 shadow-elegant md:p-8"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export type FlowStepState = "done" | "current" | "todo";

export interface FlowStep {
  index: string;
  label: string;
  to: string;
  state: FlowStepState;
}

/** The six-step seller preparation journey, rendered as a quiet rail. */
export function FlowProgress({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto" data-testid="flow-progress">
      {steps.map((step, i) => (
        <li key={step.index} className="flex shrink-0 items-center">
          <Link
            to={to as never}
            className="group flex items-center gap-2 rounded-full px-2 py-1"
            data-step-state={step.state}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                step.state === "done"
                  ? "bg-olive text-olive-foreground"
                  : step.state === "current"
                    ? "bg-gold text-gold-foreground"
                    : "border border-border bg-muted text-muted-foreground"
              }`}
            >
              {step.state === "done" ? <Check className="h-3 w-3" /> : step.index}
            </span>
            <span
              className={`text-xs font-medium ${
                step.state === "current"
                  ? "text-foreground"
                  : step.state === "done"
                    ? "text-foreground/80"
                    : "text-muted-foreground"
              } group-hover:text-foreground`}
            >
              {step.label}
            </span>
          </Link>
          {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export type SourceKind = "quickbooks" | "sample" | "seller";

/** Explicit provenance chip — every financial figure carries one. */
export function SourceChip({ source, testId }: { source: SourceKind; testId?: string }) {
  if (source === "quickbooks") {
    return (
      <span
        data-testid={testId ?? "source-chip"}
        className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success" /> From QuickBooks
      </span>
    );
  }
  if (source === "sample") {
    return (
      <span
        data-testid={testId ?? "source-chip"}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Sample data
      </span>
    );
  }
  return (
    <span
      data-testid={testId ?? "source-chip"}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Seller-provided
    </span>
  );
}
