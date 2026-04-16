import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Wallet from "@/pages/Wallet";
import Reminders from "@/pages/Reminders";
import Scoreboard from "@/pages/Scoreboard";
import Spend from "@/pages/Spend";
import Clients from "@/pages/Clients";
import Reimbursements from "@/pages/Reimbursements";
import NotFound from "@/pages/not-found";

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
function IconSpend({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} fillOpacity={0.1}/>
      <path d="M12 7v5l3 3"/>
      <path d="M12 3v1M12 20v1M3 12h1M20 12h1"/>
    </svg>
  );
}
function IconPeople({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" fill={active ? "currentColor" : "none"} fillOpacity={0.15}/>
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      <circle cx="18" cy="8" r="2.5"/>
      <path d="M21 20c0-2.8-1.8-5-4-5.5"/>
    </svg>
  );
}
function IconReimburse({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill={active ? "currentColor" : "none"} fillOpacity={0.1}/>
    </svg>
  );
}

const TABS = [
  { href: "/",               label: "Home",    Icon: IconDashboard },
  { href: "/wallet",         label: "Wallet",  Icon: IconWallet },
  { href: "/spend",          label: "Spend",   Icon: IconSpend },
  { href: "/clients",        label: "Clients", Icon: IconPeople },
  { href: "/reimbursements", label: "Reimburse",Icon: IconReimburse },
  { href: "/reminders",      label: "Reminders",Icon: IconBell },
  { href: "/scoreboard",     label: "Score",   Icon: IconScore },
];

function BottomTabBar() {
  const [location] = useLocation();
  return (
    <nav className="tab-bar" role="tablist">
      {TABS.map(({ href, label, Icon }) => {
        const active = href === "/"
          ? location === "/" || location === ""
          : location === href || location.startsWith(href + "/");
        return (
          <a
            key={href}
            href={`#${href}`}
            className={`tab-bar-item${active ? " active" : ""}`}
            role="tab"
            aria-selected={active}
          >
            <span className="tab-icon"><Icon active={active} /></span>
            {label}
          </a>
        );
      })}
    </nav>
  );
}

function AppLayout() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  return (
    <div className="min-h-dvh bg-background">
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/spend" component={Spend} />
        <Route path="/clients" component={Clients} />
        <Route path="/reimbursements" component={Reimbursements} />
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
