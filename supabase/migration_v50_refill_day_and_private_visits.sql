-- Two optional settings the doctor asked for. Purely additive: nothing existing changes, every old
-- row keeps its current behaviour, and the app only sends these columns when she uses the feature.
--
-- 1. The refill reminder ("Remind me about a refill") used to appear on a fixed day 21 after
--    prescribing. She now chooses the day per prescription. NULL = the usual 21.
--
-- 2. A visit she books for her own reference — the patient is not notified and it never appears in
--    their app. false = an ordinary visit (every existing row).
alter table prescriptions add column if not exists restock_reminder_days integer
  check (restock_reminder_days is null or restock_reminder_days between 1 and 180);

alter table appointments add column if not exists hidden_from_patient boolean not null default false;
