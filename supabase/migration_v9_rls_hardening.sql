-- Migration v9: Real role-based Row Level Security
-- Run this in Supabase SQL Editor
--
-- Every table previously had a single "USING (true)" policy for any
-- authenticated user — any logged-in account, patient or practitioner,
-- could read or write every row directly via the Supabase client,
-- bypassing the app's own access logic entirely. This replaces that with
-- policies that actually check who's asking:
--   - An Owner (the practice owner/master login) can see and manage everything.
--   - A non-Owner practitioner (Assistant/Practitioner/Receptionist) can see
--     patients they own, unassigned patients (so they can be claimed), and
--     patients handed off to them — not another practitioner's caseload.
--   - A patient can only ever see their own records.

-- ── Identity helpers ──────────────────────────────────────────
-- security definer so these can read practitioners/patients to resolve
-- "who is asking" even though those tables are themselves RLS-protected —
-- otherwise resolving identity would require bypassing RLS in the first
-- place, a chicken-and-egg problem standard in every RLS setup like this.

create or replace function my_practitioner_id() returns text
language sql stable security definer set search_path = public as $$
  select id from practitioners where auth_user_id = auth.uid() limit 1;
$$;

create or replace function my_practitioner_role() returns text
language sql stable security definer set search_path = public as $$
  select role from practitioners where auth_user_id = auth.uid() limit 1;
$$;

create or replace function my_patient_id() returns text
language sql stable security definer set search_path = public as $$
  select id from patients where auth_user_id = auth.uid() limit 1;
$$;

create or replace function is_clinic_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_practitioner_role() = 'Owner', false);
$$;

-- True if the current user may see/act on this specific patient: the
-- clinic owner, the patient themselves, the patient's own practitioner,
-- anyone (any practitioner) for a not-yet-assigned patient so it can be
-- claimed, or a practitioner an active handoff has been accepted to.
create or replace function can_access_patient(target_patient_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_clinic_owner()
    or target_patient_id = my_patient_id()
    or exists (
      select 1 from patients p
      where p.id = target_patient_id
      and (p.owning_practitioner_id = my_practitioner_id() or p.owning_practitioner_id is null)
    )
    or exists (
      select 1 from handoffs h
      where h.patient_id = target_patient_id
      and h.to_practitioner_id = my_practitioner_id()
      and h.status = 'accepted'
    );
$$;

-- ── practitioners ── team roster; not patient data, safe to read broadly
drop policy if exists "auth read practitioners" on practitioners;
drop policy if exists "auth manage practitioners" on practitioners;
create policy "read practitioners" on practitioners for select to authenticated using (true);
create policy "insert own practitioner row" on practitioners for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy "update own or owner manages team" on practitioners for update to authenticated
  using (auth_user_id = auth.uid() or is_clinic_owner())
  with check (auth_user_id = auth.uid() or is_clinic_owner());

-- ── patients ──
drop policy if exists "auth read patients" on patients;
drop policy if exists "auth manage patients" on patients;
create policy "read accessible patients" on patients for select to authenticated
  using (can_access_patient(id));
create policy "insert patients" on patients for insert to authenticated
  with check (my_practitioner_id() is not null or auth_user_id = auth.uid());
create policy "update accessible patients" on patients for update to authenticated
  using (can_access_patient(id)) with check (can_access_patient(id));

-- Self-registration can match an existing practitioner-created record by
-- phone number and link it instead of creating a duplicate. At the moment
-- of linking, the patient doesn't yet satisfy can_access_patient (that's
-- what this call establishes) — a narrow security definer function instead
-- of a general "auth_user_id is null" RLS carve-out, so a client can only
-- ever set auth_user_id to their own uid on an unclaimed row and nothing else.
create or replace function link_patient_auth(target_patient_id text) returns void
language sql security definer set search_path = public as $$
  update patients set auth_user_id = auth.uid()
  where id = target_patient_id and auth_user_id is null;
$$;

-- ── tables scoped straight off patient_id ──
do $$
declare
  t text;
begin
  foreach t in array array['appointments', 'prescriptions', 'dose_reminders', 'check_ins', 'outcomes', 'documents', 'case_data', 'case_visits', 'messages']
  loop
    execute format('drop policy if exists %I on %I', 'auth read ' || t, t);
    execute format('drop policy if exists %I on %I', 'auth manage ' || t, t);
    execute format('drop policy if exists %I on %I', 'Allow all for authenticated users', t);
    execute format('create policy %I on %I for select to authenticated using (can_access_patient(patient_id))', 'read accessible ' || t, t);
    execute format('create policy %I on %I for insert to authenticated with check (can_access_patient(patient_id))', 'insert accessible ' || t, t);
    execute format('create policy %I on %I for update to authenticated using (can_access_patient(patient_id)) with check (can_access_patient(patient_id))', 'update accessible ' || t, t);
    execute format('create policy %I on %I for delete to authenticated using (can_access_patient(patient_id))', 'delete accessible ' || t, t);
  end loop;
end $$;

-- ── handoffs ── visible/manageable by either side of the handoff, or the owner
drop policy if exists "auth read handoffs" on handoffs;
drop policy if exists "auth manage handoffs" on handoffs;
create policy "read own handoffs" on handoffs for select to authenticated
  using (is_clinic_owner() or from_practitioner_id = my_practitioner_id() or to_practitioner_id = my_practitioner_id());
create policy "manage own handoffs" on handoffs for all to authenticated
  using (is_clinic_owner() or from_practitioner_id = my_practitioner_id() or to_practitioner_id = my_practitioner_id())
  with check (is_clinic_owner() or from_practitioner_id = my_practitioner_id() or to_practitioner_id = my_practitioner_id());

-- ── notifications ── strictly your own
drop policy if exists "read own notifications" on notifications;
drop policy if exists "auth manage notifications" on notifications;
create policy "read own notifications" on notifications for select to authenticated
  using (user_id = auth.uid());
create policy "manage own notifications" on notifications for all to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid() or user_id is null);

-- ── time_blocks ── schedules are visible clinic-wide (for booking around
-- each other), but only the owning practitioner or the clinic owner edits one
drop policy if exists "auth read time_blocks" on time_blocks;
drop policy if exists "auth manage time_blocks" on time_blocks;
create policy "read time_blocks" on time_blocks for select to authenticated using (true);
create policy "manage own time_blocks" on time_blocks for insert to authenticated
  with check (practitioner_id = my_practitioner_id() or is_clinic_owner());
create policy "update own time_blocks" on time_blocks for update to authenticated
  using (practitioner_id = my_practitioner_id() or is_clinic_owner())
  with check (practitioner_id = my_practitioner_id() or is_clinic_owner());
create policy "delete own time_blocks" on time_blocks for delete to authenticated
  using (practitioner_id = my_practitioner_id() or is_clinic_owner());

-- ── remedy_stock, case_templates, video_rooms ── clinic-shared, not
-- patient-identifying; stay open to any authenticated practitioner/patient
drop policy if exists "auth read remedy_stock" on remedy_stock;
drop policy if exists "auth manage remedy_stock" on remedy_stock;
create policy "read remedy_stock" on remedy_stock for select to authenticated using (true);
create policy "manage remedy_stock" on remedy_stock for all to authenticated using (true) with check (true);

drop policy if exists "Allow all for authenticated users" on case_templates;
create policy "read case_templates" on case_templates for select to authenticated using (true);
create policy "manage case_templates" on case_templates for all to authenticated using (true) with check (true);

drop policy if exists "auth read video_rooms" on video_rooms;
drop policy if exists "auth manage video_rooms" on video_rooms;
create policy "read video_rooms" on video_rooms for select to authenticated using (true);
create policy "manage video_rooms" on video_rooms for all to authenticated using (true) with check (true);

-- ── profiles ── unused by the app today, but tighten it anyway since it exists
drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Allow insert for own profile" on profiles;
create policy "read own profile" on profiles for select to authenticated using (id = auth.uid());
create policy "update own profile" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "insert own profile" on profiles for insert to authenticated with check (id = auth.uid());

-- These helpers are only meant to be evaluated inside policy expressions,
-- not called directly — Supabase auto-exposes every function as a
-- POST /rest/v1/rpc/<name> endpoint, so without this an authenticated user
-- could call can_access_patient(id) directly to probe arbitrary patient ids.
-- Revoking direct execute doesn't affect policy evaluation, which runs
-- under the function owner's rights regardless of the caller's own grants.
revoke execute on function my_practitioner_id() from anon, authenticated;
revoke execute on function my_practitioner_role() from anon, authenticated;
revoke execute on function my_patient_id() from anon, authenticated;
revoke execute on function is_clinic_owner() from anon, authenticated;
revoke execute on function can_access_patient(text) from anon, authenticated;
