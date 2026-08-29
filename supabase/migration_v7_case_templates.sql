-- Migration v7: Custom case-taking templates
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS case_templates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES practitioners(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_templates_created_at ON case_templates(created_at);

ALTER TABLE case_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON case_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
