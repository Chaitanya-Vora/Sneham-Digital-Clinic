-- Migration v31: patient referral source
--
-- Feeds the new "Where patients come from" chart on Reports. Optional and
-- nullable — every existing patient predates this field and simply shows
-- as "Not recorded" on the chart until someone fills it in on that
-- patient's edit form, or a new patient is added with it set.

alter table patients add column if not exists referral_source text;

alter table patients drop constraint if exists patients_referral_source_check;
alter table patients add constraint patients_referral_source_check
  check (referral_source is null or referral_source = any (array['Offline','Instagram','References','Referral']));
