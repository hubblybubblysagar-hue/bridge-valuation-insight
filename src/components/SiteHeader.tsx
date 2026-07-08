import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="/#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
          <a href="/#teaser" className="text-sm text-muted-foreground hover:text-foreground">Sample teaser</a>
          <a href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="bg-navy text-navy-foreground hover:bg-navy/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90">
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
