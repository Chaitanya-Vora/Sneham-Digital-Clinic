-- Richer time-block (personal/business calendar entries): a color category
-- and fine-grained (15-min) start times instead of whole-hour-only.
-- Additive/widening only — no data loss, existing rows keep working.

alter table time_blocks alter column start_hour type numeric using start_hour::numeric;
alter table time_blocks add column if not exists color text not null default 'green';
