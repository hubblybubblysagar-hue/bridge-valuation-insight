import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

export function QAModeBadge({ label = "QA Mode" }: { label?: string }) {
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 sm:right-4 sm:top-4">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-gold/60 bg-navy px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold shadow-elegant">
        <FlaskConical className="h-3.5 w-3.5" />
        {label}
        <Link
          to="/debug/state"
          className="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold hover:bg-gold/20"
        >
          debug
        </Link>
      </div>
    </div>
  );
}
