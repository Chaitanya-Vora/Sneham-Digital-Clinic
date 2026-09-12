-- Migration v34: persist Clinic details, Working hours, and Notification
-- preferences on Settings — the same "looks interactive, does nothing"
-- bug already fixed for Staff & Permissions (v32) and Assignment rules
-- (v33), found while investigating those two.
--
-- Confirmed before writing this: clinicName/consultDuration/notifPrefs
-- were all plain useState with no backing table (grepped src/ for every
-- key — nothing else reads them). consultDuration DOES have one real
-- effect — ScheduleSettings uses it client-side to compute "N slots/week"
-- — but that calculation itself runs on other local, never-persisted
-- state (workingDays, morning/evening session times), and that card's own
-- "Save schedule" button is exactly as fake as "Save changes" above it.
-- Fixing consultDuration alone would leave that same card half-fake, so
-- this migration covers the whole cluster together.
--
-- Two tables, split by who owns the data:
--   - clinic_settings: genuinely clinic-wide (one name, one default
--     consult length for the whole practice) — Owner-editable, like
--     role_permissions/assignment_rules.
--   - practitioner_settings: working days/hours and notification
--     preferences are personal to whichever practitioner is logged in
--     (ScheduleSettings has only ever been rendered for currentId, never
--     for anyone else) — each practitioner can only read/write their own
--     row.

create table if not exists clinic_settings (
  id text primary key default 'default',
  clinic_name text not null default 'Sneham Digital Clinic',
  consult_duration_min integer not null default 20,
  updated_at timestamptz not null default now()
);

insert into clinic_settings (id) values ('default') on conflict (id) do nothing;

alter table clinic_settings enable row level security;

create policy "Authenticated users can read clinic settings" on clinic_settings
  for select to authenticated using (true);

create policy "Owner can manage clinic settings" on clinic_settings
  for update to authenticated using (internal.is_clinic_owner()) with check (internal.is_clinic_owner());

create table if not exists practitioner_settings (
  practitioner_id text primary key references practitioners(id) on delete cascade,
  working_days text[] not null default array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  morning_start text not null default '09:00',
  morning_end text not null default '13:00',
  evening_start text not null default '16:00',
  evening_end text not null default '19:00',
  notif_new_booking boolean not null default true,
  notif_follow_up_due boolean not null default true,
  notif_low_stock boolean not null default false,
  notif_patient_checkin boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table practitioner_settings enable row level security;

-- Readable clinic-wide (e.g. an Owner glancing at a colleague's working
-- hours for scheduling) but only the practitioner themself can write it.
create policy "Authenticated users can read practitioner settings" on practitioner_settings
  for select to authenticated using (true);

create policy "A practitioner can manage their own settings" on practitioner_settings
  for insert to authenticated with check (practitioner_id = internal.my_practitioner_id());

create policy "A practitioner can update their own settings" on practitioner_settings
  for update to authenticated using (practitioner_id = internal.my_practitioner_id()) with check (practitioner_id = internal.my_practitioner_id());

-- ── Verification ──
-- select * from clinic_settings;
--   -> one row, id='default', clinic_name='Sneham Digital Clinic',
--      consult_duration_min=20 — matches the old useState defaults.
-- select * from practitioner_settings;
--   -> empty until a practitioner first saves — fetch falls back to the
--      same hardcoded defaults the old useState had, so this ships with
--      zero visible behavior change until someone edits and saves.
