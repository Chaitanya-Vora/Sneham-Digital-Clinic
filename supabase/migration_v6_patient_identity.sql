-- Migration v6: Patient identity linking + missing phone column
-- Run this in Supabase SQL Editor

-- The app has sent a `phone` value on every new-patient insert since phone
-- support was added, but this column never existed here — those inserts
-- were failing. Adding it so "Add Patient" actually works.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- Links a patient row to the Supabase auth account that belongs to them,
-- the same way practitioners.auth_user_id already links a practitioner to
-- their login. Nullable: most existing patient rows were created by a
-- practitioner and have no linked login yet.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_patients_auth_user ON patients(auth_user_id);
