-- ============================================================
-- Migration: 0001_smart_spend
-- Feature:   V1 Smart Spend & Reimbursement Layer
-- Adds:      clients table
--            reimbursements table
--            new columns on activity table
-- Safe to run on existing databases (uses IF NOT EXISTS / ADD COLUMN)
-- ============================================================

-- ------------------------------------------------------------
-- 1. clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  phone             TEXT,
  email             TEXT,
  zelle_handle      TEXT,
  venmo_handle      TEXT,
  preferred_payment TEXT    NOT NULL DEFAULT 'zelle', -- zelle | venmo | cash | check
  notes             TEXT,
  created_at        TEXT    NOT NULL                  -- ISO8601
);

-- ------------------------------------------------------------
-- 2. Extend activity (SQLite requires one ADD COLUMN per statement)
-- ------------------------------------------------------------
ALTER TABLE activity ADD COLUMN client_id                 INTEGER REFERENCES clients(id);
ALTER TABLE activity ADD COLUMN reimbursable              INTEGER NOT NULL DEFAULT 0;   -- boolean
ALTER TABLE activity ADD COLUMN reimbursement_status      TEXT    NOT NULL DEFAULT 'none'; -- none | pending | received
ALTER TABLE activity ADD COLUMN reimbursement_sent_at     TEXT;   -- ISO8601
ALTER TABLE activity ADD COLUMN reimbursement_received_at TEXT;   -- ISO8601
ALTER TABLE activity ADD COLUMN reimbursement_amount      REAL;   -- partial reimbursements
ALTER TABLE activity ADD COLUMN location_name             TEXT;
ALTER TABLE activity ADD COLUMN location_lat              REAL;
ALTER TABLE activity ADD COLUMN location_lng              REAL;
ALTER TABLE activity ADD COLUMN merchant_category         TEXT    NOT NULL DEFAULT 'other'; -- gas | restaurant | supplies | other

-- ------------------------------------------------------------
-- 3. reimbursements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reimbursements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id  INTEGER NOT NULL REFERENCES activity(id),
  client_id    INTEGER NOT NULL REFERENCES clients(id),
  amount       REAL    NOT NULL,
  method       TEXT    NOT NULL DEFAULT 'zelle',  -- zelle | venmo | cash | check
  status       TEXT    NOT NULL DEFAULT 'draft',  -- draft | sent | paid | cancelled
  sent_at      TEXT,   -- ISO8601
  paid_at      TEXT,   -- ISO8601
  notes        TEXT,
  created_at   TEXT    NOT NULL                   -- ISO8601
);
