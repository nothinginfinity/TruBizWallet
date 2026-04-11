import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import {
  CreditCard,
  Bell,
  BarChart3,
  LayoutDashboard,
  Sun,
  Moon,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Wallet from "@/pages/Wallet";
import Reminders from "@/pages/Reminders";
import Scoreboard from "@/pages/Scoreboard";
import NotFound from "@/pages/not-found";

function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wallet", label: "Wallet", icon: CreditCard },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/scoreboard", label: "Scoreboard", icon: BarChart3 },
];

function Sidebar({ dark, toggleDark }: { dark: boolean; toggleDark: () => void }) {
  const [location] = useLocation();

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r border-border bg-card h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-foreground" fill="currentColor" aria-label="CreditStack logo">
            <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
            <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2"/>
            <rect x="5" y="14" width="4" height="2" rx="0.5" fill="currentColor"/>
            <rect x="11" y="14" width="4" height="2" rx="0.5" fill="currentColor"/>
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground leading-none">CreditStack</p>
          <p className="text-xs text-muted-foreground mt-0.5">Business Wallet</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" || location === "" : location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">7-Layer Strategy</span>
        </div>
        <ThemeToggle dark={dark} toggle={toggleDark} />
      </div>
    </aside>
  );
}

function AppLayout() {
  const [dark, setDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar dark={dark} toggleDark={() => setDark(d => !d)} />
      <main className="flex-1 min-w-0 overflow-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/reminders" component={Reminders} />
          <Route path="/scoreboard" component={Scoreboard} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppLayout />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
