-- Migration v13: Performance — missing indexes, per-row auth.uid() re-eval, redundant policies
-- Run this in Supabase SQL Editor
--
-- All three findings came directly from Supabase's own performance advisor,
-- run as part of a full storage/performance audit. Unlike v11/v12, none of
-- this touches a function's schema or search_path — it's index creation and
-- mechanical, semantics-preserving policy rewrites, so it doesn't carry the
-- same risk. Verified anyway with the same simulated-role check used
-- throughout tonight (authenticated, Dr. Ishwari's real JWT) before and
-- after, plus a fresh advisor pull confirming all three finding types are
-- gone with zero new WARN/ERROR-level results.
--
-- 1. 19 foreign key columns had no covering index — can_access_patient()
--    runs an EXISTS check against patients/handoffs on almost every RLS
--    check, on every row, on every table, every 15 seconds (the auto-refresh
--    interval) across all 3 surfaces. Invisible at 1 patient; would become a
--    real, growing cost as the clinic's real patient count grows.
-- 2. 8 policies called auth.uid() directly in a way Postgres re-evaluates
--    per row instead of once per query. Rewritten per Supabase's own
--    documented pattern: auth.uid() -> (select auth.uid()) — identical
--    result, evaluated once.
-- 3. 5 tables had both a `for all` policy and a redundant, fully-subsumed
--    `for select` policy — Postgres has to evaluate both (OR'd) on every
--    read. Dropped the narrower one on each; access is unchanged, since the
--    broader `all` policy already covered every case the narrower one did.

create index if not exists idx_appointments_patient_id on appointments(patient_id);
create index if not exists idx_appointments_practitioner_id on appointments(practitioner_id);
create index if not exists idx_case_templates_created_by on case_templates(created_by);
create index if not exists idx_case_visits_appointment_id on case_visits(appointment_id);
create index if not exists idx_case_visits_practitioner_id on case_visits(practitioner_id);
create index if not exists idx_check_ins_patient_id on check_ins(patient_id);
create index if not exists idx_check_ins_prescription_id on check_ins(prescription_id);
create index if not exists idx_documents_patient_id on documents(patient_id);
create index if not exists idx_dose_reminders_patient_id on dose_reminders(patient_id);
create index if not exists idx_dose_reminders_prescription_id on dose_reminders(prescription_id);
create index if not exists idx_handoffs_from_practitioner_id on handoffs(from_practitioner_id);
create index if not exists idx_handoffs_patient_id on handoffs(patient_id);
create index if not exists idx_handoffs_to_practitioner_id on handoffs(to_practitioner_id);
create index if not exists idx_messages_practitioner_id on messages(practitioner_id);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_outcomes_patient_id on outcomes(patient_id);
create index if not exists idx_outcomes_practitioner_id on outcomes(practitioner_id);
create index if not exists idx_patients_owning_practitioner_id on patients(owning_practitioner_id);
create index if not exists idx_practitioners_auth_user_id on practitioners(auth_user_id);
create index if not exists idx_prescriptions_patient_id on prescriptions(patient_id);
create index if not exists idx_prescriptions_practitioner_id on prescriptions(practitioner_id);
create index if not exists idx_time_blocks_practitioner_id on time_blocks(practitioner_id);
create index if not exists idx_video_rooms_appointment_id on video_rooms(appointment_id);

drop policy if exists "read case_templates" on case_templates;
drop policy if exists "read own handoffs" on handoffs;
drop policy if exists "read own notifications" on notifications;
drop policy if exists "read remedy_stock" on remedy_stock;
drop policy if exists "read video_rooms" on video_rooms;

alter policy "insert own practitioner row" on practitioners
  with check (auth_user_id = (select auth.uid()));

alter policy "update own or owner manages team" on practitioners
  using (auth_user_id = (select auth.uid()) or is_clinic_owner())
  with check (auth_user_id = (select auth.uid()) or is_clinic_owner());

alter policy "insert patients" on patients
  with check (my_practitioner_id() is not null or auth_user_id = (select auth.uid()));

alter policy "manage own notifications" on notifications
  using (user_id = (select auth.uid()) or user_id is null)
  with check (user_id = (select auth.uid()) or user_id is null);

alter policy "read own profile" on profiles
  using (id = (select auth.uid()));

alter policy "update own profile" on profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "insert own profile" on profiles
  with check (id = (select auth.uid()));
