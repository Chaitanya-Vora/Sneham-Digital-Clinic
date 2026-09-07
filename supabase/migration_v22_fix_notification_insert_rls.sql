-- "manage own notifications" (added in migration_v9_rls_hardening.sql) uses
-- one ALL-commands policy: user_id = auth.uid() or user_id is null. That's
-- right for reading/updating/deleting — you should only see or manage your
-- own — but it also silently blocks INSERT, because the entire point of a
-- notification is that the SENDER creates a row for the RECIPIENT's user_id,
-- which is never the sender's own auth.uid(). Every cross-user notification
-- (a consult finishing so the patient gets notified, a handoff, a second
-- opinion request) has been failing this policy with a 403 and being
-- swallowed by writeThrough's fire-and-forget insert — found live while
-- testing the new second-opinion feature, but it affects every existing
-- notification path that targets someone other than the sender.
--
-- Split into a permissive INSERT (matching every other table's own policy
-- in this schema — prescriptions, appointments, etc. are all `for all
-- using (true)`) and keep SELECT/UPDATE/DELETE restricted to your own.
drop policy if exists "manage own notifications" on notifications;

create policy "read own notifications" on notifications
  for select using (user_id = auth.uid() or user_id is null);

create policy "insert any notification" on notifications
  for insert to authenticated with check (true);

create policy "update own notifications" on notifications
  for update using (user_id = auth.uid() or user_id is null);

create policy "delete own notifications" on notifications
  for delete using (user_id = auth.uid() or user_id is null);
