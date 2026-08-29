-- Sneham Digital Clinic — Full Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ─── Profiles (links auth.users to clinic identity) ───
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'Practitioner' check (role in ('Owner','Practitioner','Assistant','Receptionist')),
  practitioner_id text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'Practitioner');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ─── Practitioners ───
create table if not exists practitioners (
  id text primary key,
  name text not null,
  initials text not null,
  role text not null default 'Practitioner',
  specialty text not null default 'Homeopathy',
  qualifications text,
  registration_no text,
  open_cases int not null default 0,
  remedy_list text[] not null default '{}',
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table practitioners enable row level security;
create policy "Authenticated users can read practitioners" on practitioners for select to authenticated using (true);
create policy "Owners can manage practitioners" on practitioners for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'Owner')
);


-- ─── Patients ───
create table if not exists patients (
  id text primary key,
  ws_code text not null,
  name text not null,
  initials text not null,
  age int not null,
  sex text not null check (sex in ('Female','Male','Other')),
  location text not null default '',
  patient_since text not null,
  chief_complaint text not null default '',
  current_remedy text,
  last_seen text not null default 'Never',
  owning_practitioner_id text references practitioners(id),
  assignment text not null default 'Unassigned',
  allergies text not null default '',
  regular_medication text not null default '',
  last_outcome text,
  created_at timestamptz not null default now()
);

alter table patients enable row level security;
create policy "Authenticated users can read patients" on patients for select to authenticated using (true);
create policy "Authenticated users can manage patients" on patients for all to authenticated using (true);


-- ─── Appointments ───
create table if not exists appointments (
  id text primary key,
  patient_id text not null references patients(id),
  practitioner_id text not null references practitioners(id),
  time text not null,
  day_label text not null,
  duration_min int not null default 30,
  type text not null default 'In person' check (type in ('In person','Video')),
  status text not null default 'Upcoming',
  tag text,
  reason text,
  is_first_visit boolean default false,
  created_at timestamptz not null default now()
);

alter table appointments enable row level security;
create policy "Authenticated users can read appointments" on appointments for select to authenticated using (true);
create policy "Authenticated users can manage appointments" on appointments for all to authenticated using (true);


-- ─── Prescriptions ───
create table if not exists prescriptions (
  id text primary key,
  patient_id text not null references patients(id),
  practitioner_id text not null references practitioners(id),
  remedy text not null,
  potency text not null,
  dose_globules int not null default 2,
  repetition text not null,
  duration_days int,
  preparation text not null default '',
  published_at timestamptz not null default now(),
  shared_via text[] not null default '{}',
  reminders_enabled boolean not null default false,
  reminder_times text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table prescriptions enable row level security;
create policy "Authenticated users can read prescriptions" on prescriptions for select to authenticated using (true);
create policy "Authenticated users can manage prescriptions" on prescriptions for all to authenticated using (true);


-- ─── Dose Reminders ───
create table if not exists dose_reminders (
  id text primary key,
  prescription_id text not null references prescriptions(id),
  patient_id text not null references patients(id),
  remedy text not null,
  potency text not null,
  time text not null,
  slot text not null check (slot in ('Morning','Evening','As needed')),
  logged_today boolean not null default false,
  created_at timestamptz not null default now()
);

alter table dose_reminders enable row level security;
create policy "Authenticated users can read dose_reminders" on dose_reminders for select to authenticated using (true);
create policy "Authenticated users can manage dose_reminders" on dose_reminders for all to authenticated using (true);


-- ─── Check-ins ───
create table if not exists check_ins (
  id text primary key,
  patient_id text not null references patients(id),
  prescription_id text not null references prescriptions(id),
  improvement_pct int not null default 0,
  change_chips text[] not null default '{}',
  free_text text not null default '',
  submitted_at timestamptz not null default now(),
  marked text not null check (marked in ('better','same','worse'))
);

alter table check_ins enable row level security;
create policy "Authenticated users can read check_ins" on check_ins for select to authenticated using (true);
create policy "Authenticated users can manage check_ins" on check_ins for all to authenticated using (true);


-- ─── Handoffs ───
create table if not exists handoffs (
  id text primary key,
  patient_id text not null references patients(id),
  from_practitioner_id text not null references practitioners(id),
  to_practitioner_id text not null references practitioners(id),
  covering_until text not null,
  note jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  patient_notified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table handoffs enable row level security;
create policy "Authenticated users can read handoffs" on handoffs for select to authenticated using (true);
create policy "Authenticated users can manage handoffs" on handoffs for all to authenticated using (true);


-- ─── Outcomes ───
create table if not exists outcomes (
  id text primary key,
  patient_id text not null references patients(id),
  practitioner_id text not null references practitioners(id),
  date timestamptz not null default now(),
  remedy text not null,
  outcome text not null,
  note text not null default ''
);

alter table outcomes enable row level security;
create policy "Authenticated users can read outcomes" on outcomes for select to authenticated using (true);
create policy "Authenticated users can manage outcomes" on outcomes for all to authenticated using (true);


-- ─── Documents ───
create table if not exists documents (
  id text primary key,
  patient_id text not null references patients(id),
  name text not null,
  kind text not null check (kind in ('Prescription','Report','Invoice')),
  format text not null default 'PDF',
  size text not null default '',
  date text not null,
  uploaded_by text not null check (uploaded_by in ('patient','practitioner')),
  file_url text,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;
create policy "Authenticated users can read documents" on documents for select to authenticated using (true);
create policy "Authenticated users can manage documents" on documents for all to authenticated using (true);


-- ─── Notifications ───
create table if not exists notifications (
  id text primary key,
  surface text not null check (surface in ('web','practitioner','patient')),
  kind text not null,
  title text not null,
  message text not null default '',
  time text not null default 'Just now',
  read boolean not null default false,
  severity text not null default 'info' check (severity in ('info','warn','purple')),
  pending boolean default false,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
create policy "Users can read own notifications" on notifications for select using (user_id = auth.uid() or user_id is null);
create policy "Authenticated users can manage notifications" on notifications for all to authenticated using (true);


-- ─── Time Blocks ───
create table if not exists time_blocks (
  id text primary key,
  practitioner_id text not null references practitioners(id),
  day_label text not null,
  start_hour int not null,
  duration_min int not null default 60,
  reason text not null default 'Lunch'
);

alter table time_blocks enable row level security;
create policy "Authenticated users can read time_blocks" on time_blocks for select to authenticated using (true);
create policy "Authenticated users can manage time_blocks" on time_blocks for all to authenticated using (true);


-- ─── Remedy Stock ───
create table if not exists remedy_stock (
  id serial primary key,
  name text not null,
  potency text not null,
  qty int not null default 0,
  low boolean not null default false,
  unique(name, potency)
);

alter table remedy_stock enable row level security;
create policy "Authenticated users can read remedy_stock" on remedy_stock for select to authenticated using (true);
create policy "Authenticated users can manage remedy_stock" on remedy_stock for all to authenticated using (true);


-- ─── Case Data (JSONB per patient) ───
create table if not exists case_data (
  patient_id text primary key references patients(id),
  sections jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table case_data enable row level security;
create policy "Authenticated users can read case_data" on case_data for select to authenticated using (true);
create policy "Authenticated users can manage case_data" on case_data for all to authenticated using (true);


-- ─── Video Consult Rooms (for 100ms integration) ───
create table if not exists video_rooms (
  id text primary key,
  appointment_id text not null references appointments(id),
  room_id text not null,
  status text not null default 'waiting' check (status in ('waiting','active','ended')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table video_rooms enable row level security;
create policy "Authenticated users can read video_rooms" on video_rooms for select to authenticated using (true);
create policy "Authenticated users can manage video_rooms" on video_rooms for all to authenticated using (true);


-- ─── Storage bucket for documents ───
insert into storage.buckets (id, name, public) values ('clinic-documents', 'clinic-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'clinic-documents');
create policy "Authenticated users can read documents" on storage.objects
  for select to authenticated using (bucket_id = 'clinic-documents');
