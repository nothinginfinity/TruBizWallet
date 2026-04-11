import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard, Bell, TrendingUp, AlertTriangle,
  CheckCircle2, ChevronRight, Zap, Calendar
} from "lucide-react";
import { Link } from "wouter";
import type { Card as CardType, Reminder, ScoreSnapshot } from "@shared/schema";
import { format } from "date-fns";

function utilizationColor(pct: number, goal: number) {
  if (pct <= goal) return "text-emerald-600 dark:text-emerald-400";
  if (pct <= goal * 1.5) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-500";
}

function utilizationBg(pct: number, goal: number) {
  if (pct <= goal) return "bg-emerald-500";
  if (pct <= goal * 1.5) return "bg-yellow-500";
  return "bg-red-500";
}

export default function Dashboard() {
  const { data: cards = [], isLoading: cardsLoading } = useQuery<CardType[]>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
    },
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

  // Cards with payments due in the next 7 days
  const upcomingPayments = cards.filter(c => {
    const daysUntil = c.dueDay >= monthDay
      ? c.dueDay - monthDay
      : (30 - monthDay) + c.dueDay;
    return daysUntil <= 7;
  });

  if (cardsLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-secondary rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="h-28 bg-secondary rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <CreditCard className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Your wallet is empty</h1>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          Add your TrueBuild business credit cards to start tracking utilization,
          set usage goals, and get payment reminders.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => seedMutation.mutate()} variant="outline" size="sm">
            Load demo data
          </Button>
          <Link href="/wallet">
            <Button size="sm" data-testid="button-add-card">
              Add your first card
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1100px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="kpi-score">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Usage Score</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-score-value">
                  {latestScore ? Math.round(latestScore.overallScore) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Credit usage health / 100</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-utilization">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg Utilization</p>
                <p className={`text-3xl font-bold mt-1 ${avgUtil <= 10 ? "text-emerald-600 dark:text-emerald-400" : avgUtil <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500"}`}
                   data-testid="text-utilization">
                  {avgUtil.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Target: under 10%</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-cards">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">On Goal</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-on-goal">
                  {cardsOnGoal}<span className="text-base text-muted-foreground">/{cards.length}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Cards within usage goal</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-reminders">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-pending-reminders">
                  {pendingReminders.length}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Reminders due</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${pendingReminders.length > 0 ? "bg-yellow-500/10" : "bg-secondary"}`}>
                <Bell className={`w-4 h-4 ${pendingReminders.length > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card utilization list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Card Utilization</h2>
            <Link href="/wallet">
              <button className="flex items-center gap-1 text-xs text-primary hover:underline" data-testid="link-all-cards">
                Manage cards <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
          <div className="space-y-2">
            {cards.map((card) => {
              const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
              const onGoal = util <= card.usageGoalPct;
              return (
                <Card key={card.id} className="overflow-hidden" data-testid={`card-utilization-${card.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: card.color }}
                        >
                          {card.issuer.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{card.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">••••{card.last4} · Layer {card.layer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${utilizationColor(util, card.usageGoalPct)}`}>
                          {util.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">of {card.usageGoalPct}% goal</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Progress
                        value={Math.min(util, 100)}
                        className="h-1.5 bg-secondary"
                        data-testid={`progress-util-${card.id}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>${card.currentBalance.toLocaleString()} balance</span>
                        <span>${card.creditLimit.toLocaleString()} limit</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right column: upcoming reminders + payments */}
        <div className="space-y-4">
          {/* Upcoming payments */}
          {upcomingPayments.length > 0 && (
            <Card className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <CardTitle className="text-sm text-yellow-700 dark:text-yellow-400">Payments Due Soon</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {upcomingPayments.map(card => {
                  const daysUntil = card.dueDay >= monthDay
                    ? card.dueDay - monthDay
                    : (30 - monthDay) + card.dueDay;
                  return (
                    <div key={card.id} className="flex items-center justify-between text-sm" data-testid={`payment-due-${card.id}`}>
                      <span className="font-medium truncate">{card.issuer}</span>
                      <div className="text-right ml-2 shrink-0">
                        <span className="font-semibold">${card.currentBalance.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground block">
                          {daysUntil === 0 ? "Today!" : `in ${daysUntil}d`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Reminders */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Reminders</CardTitle>
                </div>
                <Link href="/reminders">
                  <button className="text-xs text-primary hover:underline">See all</button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {pendingReminders.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center gap-3" data-testid={`reminder-item-${r.id}`}>
                  <button
                    onClick={() => completeMutation.mutate(r.id)}
                    className="w-4 h-4 rounded-full border-2 border-border hover:border-primary shrink-0 transition-colors"
                    data-testid={`button-complete-reminder-${r.id}`}
                    aria-label="Mark complete"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.dueDay && (
                      <p className="text-xs text-muted-foreground">Day {r.dueDay} of month</p>
                    )}
                  </div>
                  {r.amount && (
                    <span className="text-xs font-semibold text-primary shrink-0">${r.amount.toLocaleString()}</span>
                  )}
                </div>
              ))}
              {pendingReminders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">All caught up 🎉</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
