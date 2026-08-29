-- Migration v4: Case visit snapshots (visit-versioned case notes)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS case_visits (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  appointment_id TEXT REFERENCES appointments(id),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  template TEXT NOT NULL DEFAULT 'chronic',
  sections JSONB NOT NULL DEFAULT '{}',
  remedy TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_visits_patient ON case_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_case_visits_date ON case_visits(date DESC);

ALTER TABLE case_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON case_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
