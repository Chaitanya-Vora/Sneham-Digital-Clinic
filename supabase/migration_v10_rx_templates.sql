-- Migration v10: Saved prescription templates
-- Run this in Supabase SQL Editor

ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS rx_templates JSONB NOT NULL DEFAULT '[]';
