import { Switch, Route, Router, useLocation, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Wallet from "@/pages/Wallet";
import Reminders from "@/pages/Reminders";
import Scoreboard from "@/pages/Scoreboard";
import NotFound from "@/pages/not-found";

// Tab bar icons — inline SVGs for crispness
function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={0.15}/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={0.15}/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={0.15}/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={0.15}/>
    </svg>
  );
}

function IconWallet({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2.5" fill={active ? "currentColor" : "none"} fillOpacity={0.12}/>
      <path d="M2 10h20"/>
      <circle cx="17.5" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function IconBell({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill={active ? "currentColor" : "none"} fillOpacity={0.12}/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function IconScore({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 12l5.5-5.5" />
      <circle cx="12" cy="12" r="2" fill={active ? "currentColor" : "none"} fillOpacity={0.3} stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

const TABS = [
  { href: "/wallet",     label: "Home",      Icon: IconWallet },
  { href: "/dashboard",  label: "Dashboard", Icon: IconDashboard },
  { href: "/reminders",  label: "Reminders", Icon: IconBell },
  { href: "/scoreboard", label: "Score",     Icon: IconScore },
];

function BottomTabBar() {
  const [location] = useLocation();

  return (
    <nav className="tab-bar" role="tablist">
      {TABS.map(({ href, label, Icon }) => {
        const active = location === href || location.startsWith(href + "/");
        return (
          <a
            key={href}
            href={`#${href}`}
            className={`tab-bar-item${active ? " active" : ""}`}
            role="tab"
            aria-selected={active}
            data-testid={`tab-${label.toLowerCase()}`}
          >
            <span className="tab-icon">
              <Icon active={active} />
            </span>
            {label}
          </a>
        );
      })}
    </nav>
  );
}

function AppLayout() {
  // Force dark mode always — Apple Wallet is dark
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <Switch>
        <Route path="/"><Redirect to="/wallet" /></Route>
        <Route path="/wallet" component={Wallet} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/scoreboard" component={Scoreboard} />
        <Route component={NotFound} />
      </Switch>
      <BottomTabBar />
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
