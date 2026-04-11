import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer
} from "recharts";
import { Award, Target, TrendingUp } from "lucide-react";
import type { Card as CardType, ScoreSnapshot } from "@shared/schema";
import { format, parseISO } from "date-fns";

const LAYERS = [
  { num: 1, name: "Foundation",      desc: "EIN, D-U-N-S, business registration",       color: "#818cf8" },
  { num: 2, name: "Compliance",      desc: "Business address, phone, NAICS code",        color: "#a78bfa" },
  { num: 3, name: "Starter Trade",   desc: "First reportable vendor accounts",           color: "#f472b6" },
  { num: 4, name: "Builder Trade",   desc: "First no-PG business credit cards",          color: "#fbbf24" },
  { num: 5, name: "Profile Build",   desc: "Strong D&B, Experian, Equifax scores",       color: "#34d399" },
  { num: 6, name: "High-Limit",      desc: "Strategic $45K+ credit applications",        color: "#38bdf8" },
  { num: 7, name: "Capital Access",  desc: "SBA loans, fintech, SBSS optimization",      color: "#2dd4bf" },
];

function gradeInfo(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "#34d399" };
  if (score >= 70) return { label: "Good",      color: "#38bdf8" };
  if (score >= 50) return { label: "Fair",      color: "#fbbf24" };
  return { label: "Needs Work", color: "#f87171" };
}

function ScoreHero({ score, latestSnap }: { score: number; latestSnap?: ScoreSnapshot }) {
  const R = 68;
  const C = 2 * Math.PI * R;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const dash = pct * C;
  const { label, color } = gradeInfo(score);

  return (
    <div className="flex flex-col items-center pt-14 pb-6 px-4">
      {/* Big ring */}
      <div className="relative" style={{ width: 180, height: 180 }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          <circle
            cx="90" cy="90" r={R}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={C * 0.25}
            transform="rotate(-90 90 90)"
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1), stroke 0.5s ease" }}
          />
          {/* Glow */}
          <circle
            cx="90" cy="90" r={R}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={C * 0.25}
            transform="rotate(-90 90 90)"
            opacity="0.3"
            style={{ filter: "blur(4px)", transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)", color }}>
            {Math.round(score)}
          </span>
          <span className="text-[11px] text-white/30 uppercase tracking-widest">/ 100</span>
          <span className="text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full" style={{ color, background: `${color}20` }}>
            {label}
          </span>
        </div>
      </div>

      {/* Sub-stats */}
      {latestSnap && (
        <div className="flex gap-6 mt-4">
          <div className="text-center">
            <p className="text-xs text-white/30 uppercase tracking-widest">Avg Util</p>
            <p className="text-base font-bold">{latestSnap.avgUtilization.toFixed(1)}%</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-xs text-white/30 uppercase tracking-widest">Cards</p>
            <p className="text-base font-bold">{latestSnap.totalCards}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-xs text-white/30 uppercase tracking-widest">Credit</p>
            <p className="text-base font-bold">${latestSnap.totalCredit.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scoreboard() {
  const { data: cards = [], isLoading: cardsLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: scores = [], isLoading: scoresLoading } = useQuery<ScoreSnapshot[]>({
    queryKey: ["/api/scores"],
  });

  const latestScore = scores[scores.length - 1];
  const score = latestScore ? latestScore.overallScore : 0;

  const totalCredit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance = cards.reduce((s, c) => s + c.currentBalance, 0);
  const avgUtil = totalCredit > 0 ? (totalBalance / totalCredit) * 100 : 0;

  const highestLayer = cards.length > 0 ? Math.max(...cards.map(c => c.layer)) : 0;

  const chartData = scores.slice(-10).map(s => ({
    date: format(parseISO(s.date), "M/d"),
    score: Math.round(s.overallScore),
    util: parseFloat(s.avgUtilization.toFixed(1)),
  }));

  if (cardsLoading || scoresLoading) {
    return (
      <div className="page-content px-4 pt-14 space-y-4">
        <div className="skeleton h-44 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="page-content flex flex-col items-center justify-center text-center px-6 gap-4">
        <Award className="w-16 h-16 text-white/10 mt-20" />
        <p className="font-semibold">No score data yet</p>
        <p className="text-sm text-white/35">Add cards and start tracking to see your usage score.</p>
      </div>
    );
  }

  return (
    <div className="page-content px-4">
      {/* Score hero */}
      <ScoreHero score={score} latestSnap={latestScore} />

      {/* Card utilization bars */}
      <div className="mb-5">
        <p className="section-label mb-3">Card Utilization</p>
        <div className="space-y-2">
          {cards.map(card => {
            const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
            const onGoal = util <= card.usageGoalPct;
            const uColor = util <= card.usageGoalPct ? "#34d399" : util <= card.usageGoalPct * 1.5 ? "#fbbf24" : "#f87171";
            return (
              <div key={card.id} className="glass-panel p-4" data-testid={`score-card-${card.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                    <span className="text-sm font-medium truncate max-w-[160px]">{card.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ color: onGoal ? "#34d399" : "#f87171", background: onGoal ? "#34d39920" : "#f8717120" }}>
                      {onGoal ? "On goal" : "Over goal"}
                    </span>
                    <span className="text-sm font-bold" style={{ color: uColor }}>{util.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Bar with goal marker */}
                <div className="relative h-2 rounded-full bg-white/8">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(util, 100)}%`, background: uColor }}
                  />
                  {/* Goal marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-white/30"
                    style={{ left: `${Math.min(card.usageGoalPct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-white/30">${card.currentBalance.toLocaleString()} balance</span>
                  <span className="text-[10px] text-white/30">Goal: {card.usageGoalPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score history chart */}
      {chartData.length > 1 && (
        <div className="mb-5">
          <p className="section-label mb-3">Score History</p>
          <div className="glass-panel p-4">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0f0f18", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  itemStyle={{ color: "#c9a227" }}
                />
                <Area type="monotone" dataKey="score" stroke="#c9a227" strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 7-Layer Progress */}
      <div className="mb-5">
        <p className="section-label mb-3">7-Layer Strategy</p>
        <div className="ios-list">
          {LAYERS.map(layer => {
            const hasCards = cards.some(c => c.layer === layer.num);
            const active = layer.num <= highestLayer;
            return (
              <div key={layer.num} className="ios-list-row" data-testid={`layer-row-${layer.num}`}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: active ? `${layer.color}25` : "rgba(255,255,255,0.05)",
                    color: active ? layer.color : "rgba(255,255,255,0.2)",
                    border: `1.5px solid ${active ? layer.color + "60" : "rgba(255,255,255,0.08)"}`
                  }}
                >
                  {layer.num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${active ? "" : "text-white/30"}`}>{layer.name}</p>
                  <p className="text-[10px] text-white/25 truncate">{layer.desc}</p>
                </div>
                {hasCards && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: layer.color, background: `${layer.color}20` }}>
                    {cards.filter(c => c.layer === layer.num).length} card{cards.filter(c => c.layer === layer.num).length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Score formula */}
      <div className="mb-6">
        <p className="section-label mb-3">Score Formula</p>
        <div className="glass-panel p-4 space-y-2.5">
          {[
            { icon: Target, label: "Utilization Score", desc: "max(0, 100 − max(0, avgUtil−5) × 3)", weight: "60%" },
            { icon: TrendingUp, label: "Goal Score", desc: "Cards on goal / total cards × 100", weight: "40%" },
          ].map(({ icon: Icon, label, desc, weight }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{label}</p>
                  <span className="text-xs font-bold text-primary">{weight}</span>
                </div>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
