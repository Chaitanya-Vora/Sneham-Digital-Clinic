-- Her ask: when she prescribes a course of medicine, an optional way to be
-- reminded around day 21 to call the patient about a refill — separate from
-- the existing dose reminders (which are patient-facing "take it now"
-- checkboxes, not about running low). Deliberately no scheduled job here —
-- "due" is computed live on Today, the same way Follow-ups due already is;
-- this column is just the per-prescription opt-in, off by default so it
-- only ever shows up where she's actually asked for it.
alter table prescriptions add column if not exists restock_reminder_enabled boolean not null default false;
