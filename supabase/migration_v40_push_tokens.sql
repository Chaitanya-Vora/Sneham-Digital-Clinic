-- Stores each device's FCM registration token so the server knows where to
-- send a push. A user can have more than one (phone + tablet, or after
-- reinstalling), hence its own table rather than a column on profiles.
create table if not exists push_tokens (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  surface text not null check (surface in ('practitioner', 'patient')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table push_tokens enable row level security;

-- A user only ever manages their own device tokens — nothing here is
-- patient data, but there's still no reason anyone but the owning user (or
-- the server, via the service role key the Edge Function uses, which
-- bypasses RLS entirely) should read or write a row.
create policy "read own push tokens" on push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "insert own push tokens" on push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "delete own push tokens" on push_tokens
  for delete to authenticated using (user_id = auth.uid());
