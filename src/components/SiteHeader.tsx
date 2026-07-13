import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-foreground/70 md:flex">
            <a href="/#thesis" className="transition-colors hover:text-foreground">About</a>
            <a href="/#how" className="transition-colors hover:text-foreground">How it works</a>
            <Link to="/sample-teaser" className="transition-colors hover:text-foreground">Sample Teaser</Link>
            <a href="/#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden text-sm text-foreground/70 hover:text-foreground sm:inline">
            Sign in
          </Link>
          <ThemeToggle />
          <Button asChild className="h-9 rounded-md bg-olive px-4 text-olive-foreground shadow-none hover:bg-olive/90">
            <Link to="/signup">Connect QuickBooks</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
