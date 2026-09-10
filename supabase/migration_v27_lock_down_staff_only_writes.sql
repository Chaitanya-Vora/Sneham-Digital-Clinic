-- Migration v27: staff-only writes on clinically-authored tables
--
-- Verified live before this migration (via pg_policies / pg_proc):
-- migration_v9_rls_hardening.sql's dynamic-loop insert/update policies on
-- all 9 patient-linked tables (appointments, prescriptions,
-- dose_reminders, check_ins, outcomes, documents, case_data, case_visits,
-- messages) are scoped ONLY by internal.can_access_patient(patient_id).
-- That function (migration_v14_move_to_internal_with_explicit_qualification.sql)
-- returns true whenever `target_patient_id = internal.my_patient_id()` —
-- i.e. whenever the caller simply IS that patient — with no requirement
-- that the actor be staff. Confirmed live:
--   select tablename, cmd, qual, with_check from pg_policies
--   where tablename in (...9 tables...) and cmd in ('INSERT','UPDATE');
--   -- every row: internal.can_access_patient(patient_id)
-- This means a patient's own authenticated Supabase session could call
-- the REST API directly and insert/update rows in tables the app's own
-- UI never lets a patient write to — forging a prescription, an
-- appointment status, a clinical outcome, or a case note — entirely
-- bypassing the app's business logic. Pre-existing, unrelated to the
-- prescription draft/cancel feature; found and fixed as its own pass.
--
-- Classification (verified against actual patient-facing code, not
-- assumed from table names — see src/patient/PatientApp.tsx call sites):
--   Fully patient-legitimate, left unchanged: appointments (self-booking +
--   reschedule), check_ins (check-in submission), messages (chat).
--   Fully staff-only, insert+update now restricted: outcomes, documents,
--   case_data, case_visits — no patient call site reaches any of these.
--   Mixed — insert restricted to staff, but a genuine patient UPDATE
--   exists on exactly one column each: prescriptions (the "dose reminders
--   on/off" toggle, PatientApp.tsx -> setRemindersEnabled -> reminders_enabled
--   only) and dose_reminders (the "mark dose taken today" checkbox,
--   PatientApp.tsx -> toggleDoseLogged -> logged_today only). RLS can gate
--   rows but not which columns changed within an allowed row, so these two
--   get a trigger instead of a blanket update restriction.

-- ── Fully staff-only tables: insert + update require an active practitioner ──
-- Ownership/handoff scoping from can_access_patient is preserved (AND'd),
-- not replaced — this only additionally excludes the patient-is-self branch,
-- since a patient session has no practitioners row and my_practitioner_id()
-- returns null for them.

drop policy if exists "insert accessible outcomes" on outcomes;
create policy "insert accessible outcomes" on outcomes for insert to authenticated
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');
drop policy if exists "update accessible outcomes" on outcomes;
create policy "update accessible outcomes" on outcomes for update to authenticated
  using (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active')
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');

drop policy if exists "insert accessible documents" on documents;
create policy "insert accessible documents" on documents for insert to authenticated
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');
drop policy if exists "update accessible documents" on documents;
create policy "update accessible documents" on documents for update to authenticated
  using (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active')
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');

drop policy if exists "insert accessible case_data" on case_data;
create policy "insert accessible case_data" on case_data for insert to authenticated
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');
drop policy if exists "update accessible case_data" on case_data;
create policy "update accessible case_data" on case_data for update to authenticated
  using (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active')
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');

drop policy if exists "insert accessible case_visits" on case_visits;
create policy "insert accessible case_visits" on case_visits for insert to authenticated
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');
drop policy if exists "update accessible case_visits" on case_visits;
create policy "update accessible case_visits" on case_visits for update to authenticated
  using (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active')
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');

-- ── prescriptions / dose_reminders: insert is staff-only, update is column-guarded ──
-- Patients never create either row (a prescription is authored by a
-- practitioner; a dose reminder is generated when one publishes) — only
-- insert needs the same staff-only tightening as above.

drop policy if exists "insert accessible prescriptions" on prescriptions;
create policy "insert accessible prescriptions" on prescriptions for insert to authenticated
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');

drop policy if exists "insert accessible dose_reminders" on dose_reminders;
create policy "insert accessible dose_reminders" on dose_reminders for insert to authenticated
  with check (internal.can_access_patient(patient_id) and internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active');

-- UPDATE on both tables is deliberately left as-is (can_access_patient,
-- unchanged) — a patient genuinely does need to update their own row here.
-- What they must NOT be able to do is change any column except the one
-- their own UI actually exposes. RLS can't express "this column didn't
-- change" in a WITH CHECK clause, so a trigger does it instead: an active
-- staff session may change anything; a non-staff (i.e. patient) session
-- may only change the allowed column(s) — any other column differing
-- between OLD and NEW raises and rolls back the whole statement.

create or replace function internal.reject_disallowed_patient_columns()
returns trigger
language plpgsql
security definer
set search_path = internal, public
as $function$
declare
  allowed_cols text[] := tg_argv;
  col text;
begin
  if internal.my_practitioner_id() is not null and internal.my_practitioner_status() = 'active' then
    return new; -- staff may change any column; RLS above still scopes which rows
  end if;
  for col in select jsonb_object_keys(to_jsonb(new)) loop
    if col = any(allowed_cols) then continue; end if;
    if to_jsonb(old) -> col is distinct from to_jsonb(new) -> col then
      raise exception 'Column % cannot be changed by a patient session', col;
    end if;
  end loop;
  return new;
end;
$function$;

drop trigger if exists guard_patient_prescription_columns on prescriptions;
create trigger guard_patient_prescription_columns
  before update on prescriptions
  for each row execute function internal.reject_disallowed_patient_columns('reminders_enabled');

drop trigger if exists guard_patient_dose_reminder_columns on dose_reminders;
create trigger guard_patient_dose_reminder_columns
  before update on dose_reminders
  for each row execute function internal.reject_disallowed_patient_columns('logged_today');

-- ── Post-migration verification — run these, expect exactly these values ──
-- select tablename, cmd, with_check from pg_policies
-- where tablename in ('outcomes','documents','case_data','case_visits')
-- and cmd = 'INSERT';
-- -- every with_check should now include "my_practitioner_status() = 'active'"
--
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgname in ('guard_patient_prescription_columns','guard_patient_dose_reminder_columns');
-- -- both should exist
