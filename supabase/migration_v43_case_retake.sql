-- Case retake: a full re-interview when a remedy didn't work. Kept as its
-- own flag + reason on a case visit rather than a new case template — a
-- retake can still use whichever template structure fits the case (e.g.
-- Chronic), it's a reason tag, not a different form.

alter table case_visits add column if not exists is_retake boolean not null default false;
alter table case_visits add column if not exists retake_reason text;
