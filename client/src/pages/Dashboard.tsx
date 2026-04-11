import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ChevronRight, Bell, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import type { Card as CardType, Reminder, ScoreSnapshot } from "@shared/schema";
import { format } from "date-fns";

function utilizationColor(pct: number, goal: number) {
  if (pct <= goal) return "#34d399";
  if (pct <= goal * 1.5) return "#fbbf24";
  return "#f87171";
}

// Circular score gauge
function ScoreRing({ score }: { score: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const dash = pct * C;
  const grade = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        {/* Fill */}
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke={grade}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          strokeDashoffset={C * 0.25}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1), stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: grade }}>
          {Math.round(score)}
        </span>
        <span className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders/upcoming"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reminders/upcoming");
      return res.json();
    },
  });

  const { data: scores = [] } = useQuery<ScoreSnapshot[]>({
    queryKey: ["/api/scores"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/reminders/${id}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] }),
  });

  const latestScore = scores[scores.length - 1];
  const totalCredit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance = cards.reduce((s, c) => s + c.currentBalance, 0);
  const avgUtil = totalCredit > 0 ? (totalBalance / totalCredit) * 100 : 0;
  const cardsOnGoal = cards.filter(c => {
    const util = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0;
    return util <= c.usageGoalPct;
  }).length;

  const pendingReminders = reminders.filter(r => !r.completed);
  const today = new Date();
  const monthDay = today.getDate();

  const upcomingPayments = cards.filter(c => {
    const daysUntil = c.dueDay >= monthDay
      ? c.dueDay - monthDay
      : (30 - monthDay) + c.dueDay;
    return daysUntil <= 7;
  });

  if (isLoading) {
    return (
      <div className="page-content px-4 pt-14 space-y-4">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="page-content flex flex-col items-center justify-center px-6 text-center gap-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Logo */}
        <div className="mt-16 mb-2">
          <div className="w-20 h-20 rounded-[22px] flex items-center justify-center mx-auto mb-6" style={{ background: "linear-gradient(135deg, #c9a227, #a07810)" }}>
            <svg viewBox="0 0 40 28" className="w-10 h-7" fill="none">
              <rect x="1" y="1" width="38" height="26" rx="4" stroke="rgba(255,255,255,0.8)" strokeWidth="2"/>
              <path d="M1 9h38" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
              <rect x="5" y="15" width="8" height="6" rx="1.5" fill="rgba(255,255,255,0.5)"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>CreditStack</h1>
          <p className="text-sm text-white/40 max-w-xs">
            Your TrueBuild business credit wallet. Track cards, monitor utilization, and build credit faster.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}>
            Load demo data
          </Button>
          <Link href="/wallet">
            <Button size="sm" data-testid="button-add-card">Add first card</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content px-4">
      {/* Header */}
      <div className="pt-14 pb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">
            {format(today, "EEEE, MMM d")}
          </p>
          <h1 className="text-xl font-bold mt-0.5" style={{ fontFamily: "var(--font-display)" }}>Overview</h1>
        </div>
        {pendingReminders.length > 0 && (
          <Link href="/reminders">
            <div className="relative">
              <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center">
                <Bell className="w-4 h-4 text-white/60" />
              </div>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                {pendingReminders.length}
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* Score + stats row */}
      <div className="glass-panel-elevated p-5 mb-4 flex items-center gap-5">
        <ScoreRing score={latestScore ? latestScore.overallScore : 0} />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Avg Utilization</p>
            <p className="text-lg font-bold" style={{ color: utilizationColor(avgUtil, 10) }}>
              {avgUtil.toFixed(1)}%
            </p>
            <p className="text-[10px] text-white/30">Target under 10%</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">On Goal</p>
              <p className="text-base font-bold">
                {cardsOnGoal}<span className="text-white/30 text-sm">/{cards.length}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Total Credit</p>
              <p className="text-base font-bold">${totalCredit.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payments due soon */}
      {upcomingPayments.length > 0 && (
        <div className="mb-4">
          <p className="section-label">Due Soon</p>
          <div className="glass-panel border border-yellow-500/15 bg-yellow-500/5 overflow-hidden">
            {upcomingPayments.map((card, i) => {
              const daysUntil = card.dueDay >= monthDay ? card.dueDay - monthDay : (30 - monthDay) + card.dueDay;
              return (
                <div key={card.id} className={`flex items-center gap-3 px-4 py-3 ${i < upcomingPayments.length - 1 ? "border-b border-white/5" : ""}`} data-testid={`payment-due-${card.id}`}>
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.issuer} ••{card.last4}</p>
                    <p className="text-xs text-white/35">{daysUntil === 0 ? "Due today!" : `Due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`}</p>
                  </div>
                  <p className="text-sm font-bold text-yellow-400 shrink-0">${card.currentBalance.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card utilization */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Card Utilization</p>
          <Link href="/wallet">
            <button className="flex items-center gap-0.5 text-[11px] text-primary" data-testid="link-all-cards">
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
        <div className="ios-list">
          {cards.map((card, i) => {
            const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
            const onGoal = util <= card.usageGoalPct;
            const uColor = utilizationColor(util, card.usageGoalPct);
            return (
              <div key={card.id} className="ios-list-row" data-testid={`card-utilization-${card.id}`}>
                {/* Color dot */}
                <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}99)` }}>
                  {card.issuer.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium truncate mr-2">{card.name}</p>
                    <p className="text-xs font-bold shrink-0" style={{ color: uColor }}>{util.toFixed(1)}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(util, 100)}%`, background: uColor }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-[10px] text-white/30">${card.currentBalance.toLocaleString()}</p>
                    <p className="text-[10px] text-white/30">Goal {card.usageGoalPct}% · L{card.layer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reminders */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Reminders</p>
          <Link href="/reminders">
            <button className="flex items-center gap-0.5 text-[11px] text-primary">
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
        {pendingReminders.length === 0 ? (
          <div className="glass-panel p-5 text-center">
            <p className="text-sm text-white/30">All caught up</p>
          </div>
        ) : (
          <div className="ios-list">
            {pendingReminders.slice(0, 4).map(r => (
              <div key={r.id} className="ios-list-row" data-testid={`reminder-item-${r.id}`}>
                <button
                  onClick={() => completeMutation.mutate(r.id)}
                  className="w-5 h-5 rounded-full border-2 border-white/20 shrink-0 hover:border-primary transition-colors flex items-center justify-center"
                  data-testid={`button-complete-reminder-${r.id}`}
                  aria-label="Complete"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  {r.dueDay && <p className="text-xs text-white/30">Day {r.dueDay} of month</p>}
                </div>
                {r.amount && (
                  <span className="text-xs font-semibold text-primary shrink-0">${Number(r.amount).toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
