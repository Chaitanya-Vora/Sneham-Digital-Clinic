-- Migration v30: change scheduled backup cadence from daily to weekly
--
-- Daily backups (migration_v29) were judged unnecessarily frequent for this
-- clinic's actual write volume. Switching to a weekly run, same low-traffic
-- time slot. New snapshots write under a "weekly/" prefix (the single
-- pre-existing file at daily/2026-09-12.json is left in place — harmless,
-- ages out on its own, not worth a migration step to move one file).
--
-- Retention widened from 30 to 90 days alongside the cadence change: 30
-- days of daily snapshots kept ~30 backups, but 30 days of weekly snapshots
-- would only keep ~4 — too thin a safety net. 90 days keeps ~12-13 weekly
-- snapshots, a comparable margin of recoverability.
--
-- Applied live and verified:
--   - select cron.unschedule('daily-clinic-backup'); -- removed old job
--   - select cron.schedule('weekly-clinic-backup', '0 21 * * 0', ...);
--   - Confirmed via cron.job that only the new weekly job remains, active.

select cron.unschedule('daily-clinic-backup');

select cron.schedule(
  'weekly-clinic-backup',
  '0 21 * * 0', -- Sunday 21:00 UTC = Monday 2:30 AM IST, same low-traffic slot as before
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
-- select jobid, jobname, schedule, active from cron.job;
--   -> only 'weekly-clinic-backup' should appear, '0 21 * * 0', active true
-- The edge function itself (supabase/functions/scheduled-backup/index.ts)
-- was updated in the same commit: RETENTION_DAYS 30 -> 90, and the storage
-- path/prefix changed from "daily/<date>.json" to "weekly/<date>.json".
