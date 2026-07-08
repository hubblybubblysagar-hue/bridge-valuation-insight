import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Building2,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  Users,
  UserCircle,
} from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { signOut, useAppState } from "@/lib/store";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/seller", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/seller/valuation", label: "My Valuation", icon: FileBarChart },
  { to: "/seller/teaser", label: "My Teaser", icon: FileText },
  { to: "/seller/buyer-interest", label: "Buyer Interest", icon: Users },
  { to: "/seller/account", label: "Account", icon: UserCircle },
];

export function SellerLayout({ children }: { children: ReactNode }) {
  const user = useAppState((s) => s.user);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      // give the store a beat to hydrate
      const t = setTimeout(() => {
        if (useAppStateSnapshot()?.user == null) navigate({ to: "/login" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-sidebar-foreground/70">
            <Building2 className="h-3.5 w-3.5" />
            Seller workspace
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
            onClick={() => {
              signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 md:px-8">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            Signed in as <span className="text-foreground">{user?.email ?? "…"}</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

// tiny helper to peek current state without subscribing
function useAppStateSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("exitbridge-state-v1") || "null");
  } catch {
    return null;
  }
}
