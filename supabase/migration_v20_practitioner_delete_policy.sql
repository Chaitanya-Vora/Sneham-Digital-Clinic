-- practitioners had insert/select/update policies but no delete policy at
-- all — Postgres RLS defaults to deny with no matching policy, and
-- PostgREST doesn't treat "0 rows matched after RLS" as an error, so
-- rejecting a pending practitioner (Settings → Pending approval → Reject)
-- silently "succeeded" while deleting nothing. Found by actually testing
-- the Reject button end-to-end against the real database, not just reading
-- the code. Only the Owner should ever be able to remove a practitioner row.
create policy "owner deletes practitioner" on practitioners for delete
  using (internal.is_clinic_owner());
