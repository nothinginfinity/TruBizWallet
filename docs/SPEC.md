# TruBizWallet – Smart Spend & Reimbursement Layer

## Goal

Extend the existing **TruBizWallet** business‑credit‑wallet so that:

- A small‑business owner can:
  - Use business cards to pay for client‑related expenses (meals, gas, supplies, etc.).
  - Tag those spends to a specific client.
  - Mark them as **reimbursable**.
  - Send a reconciliation / payment link (Zelle, Venmo, or cash receipt) to that client.
- Those transactions then:
  - Appear in the wallet as normal business activity.
  - Are tracked in a reimbursement queue.
  - Help build **legitimate business‑credit history** via real‑world spend, not circular "wash" transactions.

This aligns with IRS‑friendly, non‑fraudulent business expense tracking.

---

## User Flows

### 1. Smart New Spend

From the **Wallet** or **Spend** view:

1. User taps **"New spend"**.
2. App uses device location + merchant name to infer **merchant category** (gas, restaurant, supplies, other).
3. User enters **amount**, optionally tags a **client**, toggles **"Reimbursable?"**, and confirms **card** (or accepts suggestion).
4. App:
   - Logs a row in `activity` with `client_id`, `reimbursable`, location, and category.
   - If reimbursable → creates a row in `reimbursements` with status `draft`.
   - Updates card balance and utilization.

### 2. Manage Reimbursements

From a **Reimbursements** tab:

- List of pending reimbursements (client name, amount, merchant, date).
- **"Send request"** → generates a Zelle / Venmo / cash‑receipt link, marks status `sent`.
- **"Mark paid"** → marks `reimbursement_status = received`, logs `reimbursement_received_at`.

### 3. Client‑Centric View

From a **Clients** tab:

- List: name, phone, preferred payment method, total open balance.
- Detail: all reimbursable spends for that client + "Send all open" button.

---

## Schema Additions

### New table: `clients`

```sql
clients (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  zelle_handle  TEXT,
  venmo_handle  TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL   -- ISO8601
)
```

### Extend existing `activity` table

```sql
ALTER TABLE activity
  ADD COLUMN client_id                 INTEGER REFERENCES clients(id),
  ADD COLUMN reimbursable              BOOLEAN DEFAULT FALSE,
  ADD COLUMN reimbursement_status      TEXT DEFAULT 'none',   -- none | pending | received
  ADD COLUMN reimbursement_sent_at     TEXT,
  ADD COLUMN reimbursement_received_at TEXT,
  ADD COLUMN reimbursement_amount      NUMERIC,
  ADD COLUMN location_name             TEXT,
  ADD COLUMN location_lat              REAL,
  ADD COLUMN location_lng              REAL,
  ADD COLUMN merchant_category         TEXT DEFAULT 'other'   -- gas | restaurant | supplies | other
```

### New table: `reimbursements`

```sql
reimbursements (
  id           INTEGER PRIMARY KEY,
  activity_id  INTEGER NOT NULL REFERENCES activity(id),
  client_id    INTEGER NOT NULL REFERENCES clients(id),
  amount       NUMERIC NOT NULL,
  method       TEXT DEFAULT 'zelle',   -- zelle | venmo | cash | check
  status       TEXT DEFAULT 'draft',   -- draft | sent | paid | cancelled
  sent_at      TEXT,
  paid_at      TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL           -- ISO8601
)
```

---

## Card Rules / Smart‑Card Suggestion

When a user starts a new spend, the app suggests a card by:

1. Matching `merchant_category` to per‑category preferred card rules.
2. Checking current utilization — avoid cards over 30%.
3. Respecting per‑card monthly spend caps.

Config lives in **Settings → Card rules** (per‑category preferred card + utilization threshold).

Future API:

```
GET /api/cards/suggest?category=gas&amount=45
→ { suggested_card_id, reason }
```

---

## New API Routes

### Clients
- `POST   /api/clients`
- `GET    /api/clients`
- `GET    /api/clients/:id`

### Activity
- `POST   /api/activity` — extended with reimbursable fields
- `GET    /api/activity/reimbursable` — all pending reimbursable activity

### Reimbursements
- `POST   /api/reimbursements`
- `PATCH  /api/reimbursements/:id`
- `GET    /api/reimbursements` — filter by status

---

## UI / Navigation Additions

### New tabs (alongside existing Dashboard / Wallet / Reminders / Scoreboard)

- **Spend** — new spend form
- **Clients** — client list + detail
- **Reimbursements** — queue with send / mark‑paid actions

### New Spend form fields

| Field | Notes |
|---|---|
| Amount | Required |
| Merchant | Auto‑filled from geo or manual |
| Card | Suggested + override |
| Client | Optional picker |
| Reimbursable? | Toggle |
| Category | Hidden, auto‑detected |

---

## Compliance Guardrails

All reimbursable spends must be **real business expenses** (meals with clients, client fuel, supplies). The app:

- Stores timestamp, location, merchant, client, and category for IRS audit‑readiness.
- Never prompts or incentivizes circular cash↔card wash cycles.
- Terms of Service must state: for legitimate business use only.

---

## Rollout Phases

### V1 — MVP
- `clients` table + extended `activity` + `reimbursements` table.
- Drizzle migration.
- New spend form (client tag + reimbursable toggle).
- Reimbursement queue (send + mark paid).

### V2
- Card rules engine + smart card suggestion.
- Geo‑detection → auto merchant category.
- "Send all open" per client.

### V3
- Bank / Zelle / Venmo webhook reconciliation.
- Per‑client CSV + tax export.
- Multi‑user team spend submission.
