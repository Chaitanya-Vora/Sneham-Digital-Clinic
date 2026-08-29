-- Migration v8: Track amendments to past case-visit snapshots
-- Run this in Supabase SQL Editor

ALTER TABLE case_visits ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
