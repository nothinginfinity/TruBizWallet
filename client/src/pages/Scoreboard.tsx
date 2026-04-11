import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import {
  TrendingUp, TrendingDown, Award, Target, Layers,
  CheckCircle2, AlertCircle, Info
} from "lucide-react";
import type { Card as CardType, ScoreSnapshot } from "@shared/schema";
import { format, parseISO } from "date-fns";

const LAYERS = [
  { num: 1, name: "Foundation", desc: "EIN, D-U-N-S, business registration", color: "#6366f1" },
  { num: 2, name: "Compliance", desc: "Business address, phone, NAICS code", color: "#8b5cf6" },
  { num: 3, name: "Starter Trade", desc: "First reportable vendor accounts", color: "#ec4899" },
  { num: 4, name: "Builder Trade", desc: "First no-PG business credit cards", color: "#f59e0b" },
  { num: 5, name: "Profile Building", desc: "Strong D&B, Experian, Equifax scores", color: "#10b981" },
  { num: 6, name: "High-Limit", desc: "Strategic $45K+ credit applications", color: "#0ea5e9" },
  { num: 7, name: "Capital Access", desc: "SBA loans, fintech, SBSS optimization", color: "#14b8a6" },
];

function ScoreGauge({ score }: { score: number }) {
  const capped = Math.min(Math.max(score, 0), 100);
  let label = "Excellent";
  let color = "#10b981";
  if (capped < 50) { label = "Needs Work"; color = "#ef4444"; }
  else if (capped < 70) { label = "Fair"; color = "#f59e0b"; }
  else if (capped < 85) { label = "Good"; color = "#0ea5e9"; }

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (capped / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
          <circle
            cx="64" cy="64" r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{Math.round(capped)}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge className="mt-2" style={{ backgroundColor: color + "20", color }}>{label}</Badge>
    </div>
  );
}

function UtilizationBar({ card }: { card: CardType }) {
  const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
  const onGoal = util <= card.usageGoalPct;
  let barColor = "#10b981";
  if (util > card.usageGoalPct * 1.5) barColor = "#ef4444";
  else if (util > card.usageGoalPct) barColor = "#f59e0b";

  return (
    <div className="space-y-1" data-testid={`score-card-${card.id}`}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
          <span className="font-medium truncate max-w-[150px]">{card.name}</span>
          <Badge variant="outline" className="text-xs">L{card.layer}</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {util.toFixed(1)}% / {card.usageGoalPct}% goal
          </span>
          {onGoal
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <AlertCircle className="w-4 h-4 text-yellow-500" />}
        </div>
      </div>
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        {/* Goal marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
          style={{ left: `${Math.min(card.usageGoalPct, 100)}%` }}
        />
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(util, 100)}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>${card.currentBalance.toLocaleString()}</span>
        <span>${card.creditLimit.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function Scoreboard() {
  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: snapshots = [] } = useQuery<ScoreSnapshot[]>({
    queryKey: ["/api/scores"],
  });

  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const scoreTrend = latest && prev ? latest.overallScore - prev.overallScore : null;

  const totalCredit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance = cards.reduce((s, c) => s + c.currentBalance, 0);
  const avgUtil = totalCredit > 0 ? (totalBalance / totalCredit) * 100 : 0;

  // Layer coverage
  const layersActive = [...new Set(cards.map(c => c.layer))];
  const maxLayer = layersActive.length > 0 ? Math.max(...layersActive) : 0;

  // Cards on/off goal
  const onGoalCards = cards.filter(c => {
    const util = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0;
    return util <= c.usageGoalPct;
  });
  const overGoalCards = cards.filter(c => {
    const util = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0;
    return util > c.usageGoalPct;
  });

  // Chart data
  const chartData = snapshots.map(s => ({
    date: format(parseISO(s.date), "MMM d"),
    score: Math.round(s.overallScore),
    util: parseFloat(s.avgUtilization.toFixed(1)),
  }));

  const barData = cards.map(c => ({
    name: `${c.issuer} ••${c.last4}`,
    util: parseFloat((c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0).toFixed(1)),
    goal: c.usageGoalPct,
    color: c.currentBalance / c.creditLimit * 100 <= c.usageGoalPct ? "#10b981" : "#f59e0b",
  }));

  return (
    <div className="p-8 space-y-8 max-w-[1000px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Scoreboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track your credit usage health and TrueBuild layer progress
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Add cards to your wallet to see your scoreboard.</p>
        </div>
      ) : (
        <>
          {/* Top row: gauge + stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gauge */}
            <Card className="flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Credit Usage Score</p>
                <ScoreGauge score={latest?.overallScore ?? 0} />
                {scoreTrend !== null && (
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${scoreTrend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {scoreTrend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {scoreTrend > 0 ? "+" : ""}{scoreTrend.toFixed(1)} pts today
                  </div>
                )}
              </div>
            </Card>

            {/* Stats */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg Utilization</p>
                  <p className={`text-2xl font-bold mt-2 ${avgUtil <= 10 ? "text-emerald-600 dark:text-emerald-400" : avgUtil <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500"}`}>
                    {avgUtil.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Target: under 10% for best scores</p>
                  <Progress value={Math.min(avgUtil, 100)} className="h-1 mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cards On Goal</p>
                  <p className="text-2xl font-bold mt-2">
                    {onGoalCards.length}
                    <span className="text-base text-muted-foreground">/{cards.length}</span>
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {onGoalCards.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        ✓ {onGoalCards.map(c => c.issuer).join(", ")} on track
                      </p>
                    )}
                    {overGoalCards.length > 0 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠ {overGoalCards.map(c => c.issuer).join(", ")} over goal
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Credit</p>
                  <p className="text-2xl font-bold mt-2">${totalCredit.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${(totalCredit - totalBalance).toLocaleString()} available
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Highest Layer</p>
                  <p className="text-2xl font-bold mt-2">Layer {maxLayer}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {LAYERS[maxLayer - 1]?.name || "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Score trend chart */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#scoreGrad)" strokeWidth={2} dot={false} name="Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Per-card utilization bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Card Utilization vs. Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cards.map(card => <UtilizationBar key={card.id} card={card} />)}
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                <div className="w-0.5 h-3 bg-foreground/30 rounded" />
                <span>Vertical line = your usage goal for that card</span>
              </div>
            </CardContent>
          </Card>

          {/* 7-Layer progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                TrueBuild 7-Layer Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {LAYERS.map(layer => {
                  const hasCards = layersActive.includes(layer.num);
                  const layerCards = cards.filter(c => c.layer === layer.num);
                  const isNext = !hasCards && layer.num === maxLayer + 1;
                  return (
                    <div
                      key={layer.num}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${hasCards ? "bg-secondary/60" : isNext ? "border border-dashed border-border" : "opacity-50"}`}
                      data-testid={`layer-row-${layer.num}`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: hasCards ? layer.color : "hsl(var(--muted))" }}
                      >
                        {hasCards ? "✓" : layer.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          {layer.name}
                          {isNext && <Badge variant="outline" className="ml-2 text-xs">Next Layer</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{layer.desc}</p>
                        {layerCards.length > 0 && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {layerCards.map(c => `${c.issuer} ••${c.last4}`).join(", ")}
                          </p>
                        )}
                      </div>
                      {hasCards && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Credit tips */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex gap-3">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-primary">Credit Usage Tips</p>
                  <ul className="space-y-1 text-muted-foreground text-xs list-disc ml-4">
                    <li>Keep each card's utilization at or below your usage goal (ideally under 10%)</li>
                    <li>Always pay before your card's reporting date, not just the due date</li>
                    <li>Spread spending across multiple cards — avoid concentrating on one</li>
                    <li>Never let a card hit 0% for too many months — bureaus want to see active use</li>
                    <li>Pay full balance whenever possible — interest is your enemy</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
