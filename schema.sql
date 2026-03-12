-- ═══════════════════════════════════════════════════════════
--  Qubitedge Summer Internship 2026 — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════

-- Create database (run this separately if needed)
-- CREATE DATABASE qubitedge_internship;

-- Connect to the database before running below:
-- \c qubitedge_internship

-- ── ENUM TYPES ──────────────────────────────────────────────
CREATE TYPE application_status AS ENUM ('Pending', 'Approved', 'Rejected', 'On Hold');

-- ── MAIN REGISTRATIONS TABLE ────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  id                SERIAL PRIMARY KEY,
  ref_id            VARCHAR(20) UNIQUE NOT NULL,         -- e.g. QLT-2026-4821

  -- Personal
  student_name      VARCHAR(120) NOT NULL,
  mobile            VARCHAR(15)  NOT NULL,
  email             VARCHAR(180) NOT NULL UNIQUE,
  city              VARCHAR(100),

  -- Academic
  college_name      VARCHAR(255) NOT NULL,
  college_id        VARCHAR(60),
  department        VARCHAR(120) NOT NULL,
  semester          VARCHAR(30),

  -- Preferences
  interested_domains TEXT[],                             -- array e.g. {Web Development, ML}
  courses_selected   TEXT[]       NOT NULL,              -- array e.g. {4 Weeks Internship}

  -- Payment
  transaction_id    VARCHAR(100) NOT NULL UNIQUE,
  amount_paid       NUMERIC(10,2) NOT NULL,
  payment_date      DATE          NOT NULL,
  receipt_url       TEXT,                                -- path/URL to uploaded receipt file

  -- Meta
  status            application_status DEFAULT 'Pending',
  admin_notes       TEXT,
  email_verified    BOOLEAN DEFAULT FALSE,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUTO-UPDATE updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registrations_updated
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_reg_email      ON registrations(email);
CREATE INDEX idx_reg_mobile     ON registrations(mobile);
CREATE INDEX idx_reg_status     ON registrations(status);
CREATE INDEX idx_reg_submitted  ON registrations(submitted_at DESC);
CREATE INDEX idx_reg_ref        ON registrations(ref_id);

-- ── SAMPLE VIEW: DASHBOARD SUMMARY ──────────────────────────
CREATE OR REPLACE VIEW registration_summary AS
SELECT
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE status = 'Pending')            AS pending,
  COUNT(*) FILTER (WHERE status = 'Approved')           AS approved,
  COUNT(*) FILTER (WHERE status = 'Rejected')           AS rejected,
  COUNT(*) FILTER (WHERE status = 'On Hold')            AS on_hold,
  SUM(amount_paid)                                      AS total_revenue,
  COUNT(*) FILTER (WHERE submitted_at > NOW() - INTERVAL '24 hours') AS last_24h
FROM registrations;
