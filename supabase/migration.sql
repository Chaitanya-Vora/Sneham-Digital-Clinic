-- ═══════════════════════════════════════════════════════════════
-- Sneham Digital Clinic — Supabase Database Setup
-- Run this in your Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Profiles (auto-created on signup) ──────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'Practitioner' check (role in ('Owner','Practitioner','Assistant','Receptionist')),
  specialty text default '',
  qualifications text default '',
  registration_no text default '',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. Patients ───────────────────────────────────────────────
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  ws_code text not null,
  name text not null,
  initials text not null default '',
  age integer not null,
  sex text not null check (sex in ('Female','Male','Other')),
  location text default '',
  patient_since text default '',
  chief_complaint text default '',
  current_remedy text,
  last_seen text default 'Today',
  assignment text default 'Mine',
  allergies text default '',
  regular_medication text default '',
  last_outcome text,
  phone text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.patients enable row level security;

create policy "Authenticated users can read patients"
  on public.patients for select
  to authenticated
  using (true);

create policy "Authenticated users can insert patients"
  on public.patients for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update patients"
  on public.patients for update
  to authenticated
  using (true);

-- ── 3. Appointments ───────────────────────────────────────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  practitioner_id uuid references auth.users(id) on delete set null,
  time text not null,
  day_label text not null default 'Today',
  duration_min integer default 30,
  type text not null default 'In person' check (type in ('In person','Video')),
  status text not null default 'Upcoming',
  reason text,
  tag text,
  is_first_visit boolean default false,
  created_at timestamptz default now()
);

alter table public.appointments enable row level security;

create policy "Authenticated users can read appointments"
  on public.appointments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert appointments"
  on public.appointments for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update appointments"
  on public.appointments for update
  to authenticated
  using (true);

-- ── 4. Prescriptions ─────────────────────────────────────────
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  practitioner_id uuid references auth.users(id) on delete set null,
  remedy text not null,
  potency text not null,
  dose_globules integer default 2,
  repetition text not null,
  duration_days integer,
  preparation text default '',
  published_at timestamptz default now(),
  shared_via text[] default '{}',
  reminders_enabled boolean default false,
  reminder_times text[] default '{}'
);

alter table public.prescriptions enable row level security;

create policy "Authenticated users can read prescriptions"
  on public.prescriptions for select
  to authenticated
  using (true);

create policy "Authenticated users can insert prescriptions"
  on public.prescriptions for insert
  to authenticated
  with check (true);

-- ── 5. Check-ins ──────────────────────────────────────────────
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  prescription_id uuid references public.prescriptions(id) on delete cascade,
  improvement_pct integer default 0,
  change_chips text[] default '{}',
  free_text text default '',
  marked text not null check (marked in ('better','same','worse')),
  submitted_at timestamptz default now()
);

alter table public.check_ins enable row level security;

create policy "Authenticated users can read check_ins"
  on public.check_ins for select
  to authenticated
  using (true);

create policy "Authenticated users can insert check_ins"
  on public.check_ins for insert
  to authenticated
  with check (true);

-- ── 6. Outcomes ───────────────────────────────────────────────
create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  practitioner_id uuid references auth.users(id) on delete set null,
  date timestamptz default now(),
  remedy text not null,
  outcome text not null,
  note text default ''
);

alter table public.outcomes enable row level security;

create policy "Authenticated users can read outcomes"
  on public.outcomes for select
  to authenticated
  using (true);

create policy "Authenticated users can insert outcomes"
  on public.outcomes for insert
  to authenticated
  with check (true);

-- ── 7. Updated-at trigger ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();
