-- Sneham Digital Clinic — Migration v2 (Full Production Schema)
-- Run this in Supabase Dashboard → SQL Editor → New query
--
-- This replaces the tables from migration.sql with the full
-- production schema. All app data was in localStorage, so no
-- real data is lost by dropping the old tables.

-- STEP 1: Drop triggers before tables (trigger ON clause needs the relation to exist)
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patients') THEN
    DROP TRIGGER IF EXISTS patients_updated_at ON patients;
  END IF;
END $$;
DROP FUNCTION IF EXISTS set_updated_at();

-- Drop old tables from migration.sql (child tables first)
DROP TABLE IF EXISTS outcomes CASCADE;
DROP TABLE IF EXISTS check_ins CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

-- STEP 2: Alter profiles to match new schema
ALTER TABLE profiles DROP COLUMN IF EXISTS specialty;
ALTER TABLE profiles DROP COLUMN IF EXISTS qualifications;
ALTER TABLE profiles DROP COLUMN IF EXISTS registration_no;
ALTER TABLE profiles DROP COLUMN IF EXISTS updated_at;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='practitioner_id'
  ) THEN ALTER TABLE profiles ADD COLUMN practitioner_id text UNIQUE;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'Owner')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- STEP 3: Create practitioners
CREATE TABLE IF NOT EXISTS practitioners (
  id text PRIMARY KEY,
  name text NOT NULL,
  initials text NOT NULL,
  role text NOT NULL DEFAULT 'Practitioner',
  specialty text NOT NULL DEFAULT 'Homeopathy',
  qualifications text,
  registration_no text,
  open_cases int NOT NULL DEFAULT 0,
  remedy_list text[] NOT NULL DEFAULT '{}',
  auth_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read practitioners" ON practitioners FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage practitioners" ON practitioners FOR ALL TO authenticated USING (true);


-- STEP 4: Create patients
CREATE TABLE IF NOT EXISTS patients (
  id text PRIMARY KEY,
  ws_code text NOT NULL,
  name text NOT NULL,
  initials text NOT NULL,
  age int NOT NULL,
  sex text NOT NULL CHECK (sex IN ('Female','Male','Other')),
  location text NOT NULL DEFAULT '',
  patient_since text NOT NULL,
  chief_complaint text NOT NULL DEFAULT '',
  current_remedy text,
  last_seen text NOT NULL DEFAULT 'Never',
  owning_practitioner_id text REFERENCES practitioners(id),
  assignment text NOT NULL DEFAULT 'Unassigned',
  allergies text NOT NULL DEFAULT '',
  regular_medication text NOT NULL DEFAULT '',
  last_outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patients" ON patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage patients" ON patients FOR ALL TO authenticated USING (true);


-- STEP 5: Create appointments
CREATE TABLE IF NOT EXISTS appointments (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  practitioner_id text NOT NULL REFERENCES practitioners(id),
  time text NOT NULL,
  day_label text NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  type text NOT NULL DEFAULT 'In person' CHECK (type IN ('In person','Video')),
  status text NOT NULL DEFAULT 'Upcoming',
  tag text,
  reason text,
  is_first_visit boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read appointments" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage appointments" ON appointments FOR ALL TO authenticated USING (true);


-- STEP 6: Create prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  practitioner_id text NOT NULL REFERENCES practitioners(id),
  remedy text NOT NULL,
  potency text NOT NULL,
  dose_globules int NOT NULL DEFAULT 2,
  repetition text NOT NULL,
  duration_days int,
  preparation text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now(),
  shared_via text[] NOT NULL DEFAULT '{}',
  reminders_enabled boolean NOT NULL DEFAULT false,
  reminder_times text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read prescriptions" ON prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage prescriptions" ON prescriptions FOR ALL TO authenticated USING (true);


-- STEP 7: Create dose_reminders
CREATE TABLE IF NOT EXISTS dose_reminders (
  id text PRIMARY KEY,
  prescription_id text NOT NULL REFERENCES prescriptions(id),
  patient_id text NOT NULL REFERENCES patients(id),
  remedy text NOT NULL,
  potency text NOT NULL,
  time text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('Morning','Evening','As needed')),
  logged_today boolean NOT NULL DEFAULT false
);
ALTER TABLE dose_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read dose_reminders" ON dose_reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage dose_reminders" ON dose_reminders FOR ALL TO authenticated USING (true);


-- STEP 8: Create check_ins
CREATE TABLE IF NOT EXISTS check_ins (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  prescription_id text NOT NULL REFERENCES prescriptions(id),
  improvement_pct int NOT NULL DEFAULT 0,
  change_chips text[] NOT NULL DEFAULT '{}',
  free_text text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  marked text NOT NULL CHECK (marked IN ('better','same','worse'))
);
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read check_ins" ON check_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage check_ins" ON check_ins FOR ALL TO authenticated USING (true);


-- STEP 9: Create handoffs
CREATE TABLE IF NOT EXISTS handoffs (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  from_practitioner_id text NOT NULL REFERENCES practitioners(id),
  to_practitioner_id text NOT NULL REFERENCES practitioners(id),
  covering_until text NOT NULL,
  note jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  patient_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read handoffs" ON handoffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage handoffs" ON handoffs FOR ALL TO authenticated USING (true);


-- STEP 10: Create outcomes
CREATE TABLE IF NOT EXISTS outcomes (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  practitioner_id text NOT NULL REFERENCES practitioners(id),
  date timestamptz NOT NULL DEFAULT now(),
  remedy text NOT NULL,
  outcome text NOT NULL,
  note text NOT NULL DEFAULT ''
);
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read outcomes" ON outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage outcomes" ON outcomes FOR ALL TO authenticated USING (true);


-- STEP 11: Create documents
CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Prescription','Report','Invoice')),
  format text NOT NULL DEFAULT 'PDF',
  size text NOT NULL DEFAULT '',
  date text NOT NULL,
  uploaded_by text NOT NULL CHECK (uploaded_by IN ('patient','practitioner')),
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage documents" ON documents FOR ALL TO authenticated USING (true);


-- STEP 12: Create notifications
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  surface text NOT NULL CHECK (surface IN ('web','practitioner','patient')),
  kind text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT 'Just now',
  read boolean NOT NULL DEFAULT false,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','purple')),
  pending boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "auth manage notifications" ON notifications FOR ALL TO authenticated USING (true);


-- STEP 13: Create time_blocks
CREATE TABLE IF NOT EXISTS time_blocks (
  id text PRIMARY KEY,
  practitioner_id text NOT NULL REFERENCES practitioners(id),
  day_label text NOT NULL,
  start_hour int NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  reason text NOT NULL DEFAULT 'Lunch'
);
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read time_blocks" ON time_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage time_blocks" ON time_blocks FOR ALL TO authenticated USING (true);


-- STEP 14: Create remedy_stock
CREATE TABLE IF NOT EXISTS remedy_stock (
  id serial PRIMARY KEY,
  name text NOT NULL,
  potency text NOT NULL,
  qty int NOT NULL DEFAULT 0,
  low boolean NOT NULL DEFAULT false,
  UNIQUE(name, potency)
);
ALTER TABLE remedy_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read remedy_stock" ON remedy_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage remedy_stock" ON remedy_stock FOR ALL TO authenticated USING (true);


-- STEP 15: Create case_data
CREATE TABLE IF NOT EXISTS case_data (
  patient_id text PRIMARY KEY REFERENCES patients(id),
  sections jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE case_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read case_data" ON case_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage case_data" ON case_data FOR ALL TO authenticated USING (true);


-- STEP 16: Create video_rooms
CREATE TABLE IF NOT EXISTS video_rooms (
  id text PRIMARY KEY,
  appointment_id text NOT NULL REFERENCES appointments(id),
  room_id text NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','ended')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE video_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read video_rooms" ON video_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage video_rooms" ON video_rooms FOR ALL TO authenticated USING (true);


-- STEP 17: Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-documents', 'clinic-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth upload clinic docs') THEN
    CREATE POLICY "auth upload clinic docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinic-documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth read clinic docs') THEN
    CREATE POLICY "auth read clinic docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'clinic-documents');
  END IF;
END $$;


-- STEP 18: Re-create any missing profiles for existing auth users
INSERT INTO profiles (id, full_name, role)
SELECT id, coalesce(raw_user_meta_data->>'full_name', email), 'Owner'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
