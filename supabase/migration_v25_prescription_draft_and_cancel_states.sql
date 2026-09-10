-- Migration v25: Prescription draft & cancel states
--
-- Today a prescription can only ever be "published" — published_at is NOT
-- NULL and set unconditionally the instant a row is created, and creating
-- one always fires the patient notification + dose reminders in the same
-- breath. This adds two more lifecycle states so a doctor can:
--   - save a prescription without sending it (a draft — invisible to the
--     patient, editable later, publishable later from the same row), and
--   - cancel a mistaken PUBLISHED prescription without deleting it (stays
--     on the doctor's own record, clearly marked, vanishes from the
--     patient's app) — same never-hard-delete/flip-a-status pattern
--     invoices already use (migration_v17_invoices.sql).

alter table prescriptions
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published', 'cancelled'));

-- A draft hasn't been published — published_at should be genuinely NULL,
-- not a placeholder. This only relaxes the constraint; no existing value
-- is touched (verified: 23 existing rows, 0 with a null published_at).
alter table prescriptions alter column published_at drop not null;

-- Mirrors invoices.cancelled_at exactly.
alter table prescriptions add column if not exists cancelled_at timestamptz;

-- created_at/updated_at do NOT exist on the live table today. created_at
-- is now required: once published_at can be null, it's the only reliable,
-- always-populated sort key. Backfilled from published_at for every
-- existing row, since until today publishing was always immediate/atomic
-- with creation — published_at IS every existing row's true creation moment.
alter table prescriptions add column if not exists created_at timestamptz;
update prescriptions set created_at = published_at where created_at is null;
alter table prescriptions alter column created_at set not null;
alter table prescriptions alter column created_at set default now();

alter table prescriptions add column if not exists updated_at timestamptz;
update prescriptions set updated_at = published_at where updated_at is null;
alter table prescriptions alter column updated_at set not null;
alter table prescriptions alter column updated_at set default now();
