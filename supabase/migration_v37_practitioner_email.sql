-- The Owner's "Pending approval" card in Settings only ever showed a
-- self-chosen display name — no way to actually verify who's asking before
-- clicking Approve. Storing the real signed-in email (never editable by
-- the signee themselves) closes that.
alter table practitioners add column if not exists email text;
