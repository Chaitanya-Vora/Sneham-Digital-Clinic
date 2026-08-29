-- Migration v5: Patient-doctor messaging
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  sender TEXT NOT NULL CHECK (sender IN ('practitioner', 'patient')),
  text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_patient ON messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
