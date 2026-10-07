-- Live updates: a public bucket holding each phone app's signed web bundle and a
-- tiny manifest (see docs/LIVE_UPDATES.md).
--
-- Layout:  ota/practitioner/manifest.json + b<build>.zip
--          ota/patient/manifest.json      + b<build>.zip
--
-- SECURITY — read before changing anything here:
-- Whatever sits in this bucket is code the phones will run. Two things protect
-- the clinic's data:
--   1. Every bundle must carry a signature from that app's private key (kept on
--      the owner's Mac, never in this database) or the phone refuses it.
--   2. This bucket deliberately has NO insert/update/delete policy for app users
--      — only the owner's service key (or the dashboard) can upload.
-- Do not add storage policies that mention bucket 'ota'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ota', 'ota', true,
  20971520, -- 20 MB; a bundle is well under 1 MB
  array['application/zip', 'application/x-zip-compressed', 'application/json']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
