-- Migration v28: practitioner deactivation
--
-- There was no way to remove a practitioner who has left the clinic —
-- rejectPractitioner (src/core/store.ts) hard-deletes a row, which is only
-- safe for a never-approved pending signup (nothing references it yet); an
-- already-active practitioner has patients, appointments, prescriptions,
-- and case notes with practitioner_id foreign keys pointing at them, so a
-- hard delete would either be rejected by FK constraints or orphan
-- history. Adding a third status, mirroring the existing pending/active
-- gate rather than a parallel archived_at field, because status is
-- already the exact value internal.can_access_patient() checks
-- (internal.my_practitioner_status() = 'active') — an 'inactive'
-- practitioner automatically loses clinical access through that existing
-- check with no RLS function change needed.

alter table practitioners drop constraint if exists practitioners_status_check;
alter table practitioners add constraint practitioners_status_check
  check (status = any (array['pending','active','inactive']));
