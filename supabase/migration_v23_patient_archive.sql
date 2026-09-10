-- Migration v23: Patient archiving — soft, reversible removal from active
-- rosters/pickers. Mirrors invoices.cancelled_at (migration_v17_invoices.sql)
-- rather than a new status enum: a nullable timestamp is a pure
-- boolean-plus-audit-trail, orthogonal to the existing `assignment` field.
--
-- No RLS policy change needed: archiving/restoring is an ordinary UPDATE
-- on an ordinary column, and "update accessible patients"
-- (migration_v9_rls_hardening.sql) already permits it for anyone who can
-- already edit this patient today.

alter table patients add column if not exists archived_at timestamptz;
create index if not exists idx_patients_archived_at on patients(archived_at);
