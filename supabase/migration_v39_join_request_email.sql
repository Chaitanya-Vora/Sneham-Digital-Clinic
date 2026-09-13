-- Fires the notify-join-request Edge Function the instant a new pending
-- practitioner signup is created — no manual Database Webhook click-through
-- needed, pg_net is already enabled on this project. Fire-and-forget: if
-- the email fails to send for any reason, the signup itself is unaffected,
-- the in-app "Pending approval" card is still the source of truth.
create or replace function internal.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = internal, public, extensions
as $$
begin
  if new.status = 'pending' then
    perform net.http_post(
      url := 'https://oiibzrjnrkzagpkqnhbr.supabase.co/functions/v1/notify-join-request',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('practitioner_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_join_request on practitioners;
create trigger on_join_request
  after insert on practitioners
  for each row
  execute function internal.notify_join_request();
