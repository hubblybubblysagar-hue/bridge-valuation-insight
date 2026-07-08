import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-navy text-navy-foreground">
        <span className="text-sm font-bold tracking-tight">EB</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        ExitBridge
      </span>
    </Link>
  );
}
