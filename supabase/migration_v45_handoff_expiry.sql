-- Handoff.covering_until has only ever stored a formatted display string
-- ("Fri, 3 Oct", "Tomorrow") — fine to show, impossible to compare against
-- today to know whether coverage has actually expired. Adds a real ISO date
-- alongside it so "is this handoff still active?" can be computed live,
-- the same way every other "due today" stat in this app already is —
-- no cron job, no backend job, just a comparable date to read.
--
-- Nullable: existing handoff rows keep their display string untouched and
-- simply won't be treated as "currently covering" until a new one is sent.
alter table handoffs add column if not exists covering_until_date text;
