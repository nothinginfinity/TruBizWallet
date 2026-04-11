# TruBizWallet — CreditStack

A business credit wallet MVP for TrueBuild customers. Track corporate credit cards, monitor utilization vs. goals, manage payment reminders, and visualize progress through TrueBuild's 7-Layer Strategy.

## Features

- **Dashboard** — KPI row (usage score, avg utilization, on-goal cards, pending reminders), card utilization list, payments due soon, and upcoming reminders
- **Wallet** — Add/delete cards, log spend/payments, view activity per card, cards grouped by TrueBuild layer
- **Reminders** — Add/complete/delete reminders sorted by urgency, tabs for pending/completed
- **Scoreboard** — Circular usage score gauge, utilization bars with goal markers, 7-Layer progress tracker, recharts area chart history, credit tips

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express (Node.js)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Routing**: Hash-based (`useHashLocation`)
- **Theme**: Navy + gold TrueBuild-inspired fintech palette, full dark mode

## Getting Started

```bash
npm install
npx drizzle-kit push      # create/migrate the SQLite schema
npm run dev               # start dev server on port 5000
```

Seed demo data (3 cards, activities, reminders):
```
POST /api/seed
```

## Score Algorithm

```
overallScore = utilScore × 0.6 + goalScore × 0.4
utilScore    = max(0, 100 − max(0, avgUtil − 5) × 3)
goalScore    = (cardsOnGoal / totalCards) × 100
```

## Schema

| Table | Key Fields |
|---|---|
| `cards` | id, name, issuer, last4, creditLimit, currentBalance, usageGoalPct, dueDay, reportingDay, layer (1-7) |
| `activity` | id, cardId, type (spend/payment/statement), amount, merchant, date |
| `reminders` | id, cardId, type (payment/spend/reporting/custom), dueDate, recurring, completed |
| `scoreSnapshots` | id, date (unique YYYY-MM-DD), overallScore, avgUtilization, totalCredit, totalBalance |

## Future: NAV Integration

- `scoreSnapshots` table is ready to add a `navScore` field
- `reportingDay` per card enables "pay before reporting date" reminders
- Scoreboard layer progress display is already wired
