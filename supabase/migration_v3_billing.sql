-- Sneham Digital Clinic — Migration v3: Add billing columns to appointments
-- Run this in Supabase Dashboard → SQL Editor → New query

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS fee numeric;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status text CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'paid', 'waived'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_mode text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at timestamptz;
