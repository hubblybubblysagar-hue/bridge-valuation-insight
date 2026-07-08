import { Link } from "@tanstack/react-router";

export function Logo({ className = "", tone = "ink" }: { className?: string; tone?: "ink" | "cream" }) {
  const color = tone === "cream" ? "text-cream" : "text-foreground";
  return (
    <Link to="/" className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className={`font-serif text-2xl leading-none ${color}`}>ExitBridge</span>
      <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-olive" />
    </Link>
  );
}
