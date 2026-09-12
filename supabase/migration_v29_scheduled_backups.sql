-- Migration v29: scheduled database backups
--
-- Real patient/prescription/billing data with no confirmed backup or
-- point-in-time-recovery configuration on this project's plan — this adds
-- an application-level safety net independent of the Supabase plan tier:
-- a daily Edge Function run (supabase/functions/scheduled-backup) that
-- dumps every table to one JSON file in a private "backups" storage
-- bucket, pruning anything older than 30 days.
--
-- Applied live and verified end-to-end before being written here:
--   - Manually invoked the deployed function once — response was
--     {"ok":true,"path":"daily/2026-09-12.json","errors":[],"tableCount":19}
--   - Confirmed the file actually exists in storage.objects at 125KB,
--     a plausible size for this project's real row counts.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

insert into storage.buckets (id, name, public) values ('backups', 'backups', false)
  on conflict (id) do nothing;
-- Deliberately no storage.objects RLS policy for this bucket — the backup
-- function writes via the service-role key (bypasses RLS entirely), and
-- nothing else needs to read a full raw data dump. Safer default: nobody
-- (not even an authenticated app user) can read these files by any path
-- except the Supabase dashboard/service-role access.

-- The following two secrets must be created once, live, with the real
-- values — NOT written here, so the anon key and project URL never sit in
-- a committed migration file even though the anon key is already public
-- in the client bundle:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<the same VITE_SUPABASE_ANON_KEY already in .env>', 'anon_key');
-- (Already done live for this project before this migration was written.)

select cron.schedule(
  'daily-clinic-backup',
  '0 21 * * *', -- 21:00 UTC = 2:30 AM IST, low-traffic hours
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scheduled-backup',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now())
  );
  $$
);

-- ── Verification ──
-- select jobid, jobname, schedule, active from cron.job where jobname = 'daily-clinic-backup';
-- select name, metadata->>'size' as size_bytes, created_at from storage.objects
--   where bucket_id = 'backups' order by created_at desc;
-- To restore from a snapshot: download the file from the "backups" bucket
-- (Supabase dashboard → Storage → backups → daily/<date>.json) — it's one
-- JSON object with a `tables` key holding every table's full row set,
-- exactly as returned by `select *`, ready to re-insert per table if ever
-- needed.
