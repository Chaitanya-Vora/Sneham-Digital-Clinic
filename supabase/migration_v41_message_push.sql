-- Real push notification for a new chat message — the actual "like
-- WhatsApp" case. Notifies whichever side didn't send it, looking up their
-- auth user id fresh each time (practitioners.auth_user_id /
-- patients.auth_user_id) so it works the moment either side has a linked
-- account and a registered device, with no further wiring needed.
create or replace function internal.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = internal, public, extensions
as $$
declare
  recipient_auth_id uuid;
  sender_name text;
begin
  if new.sender = 'patient' then
    select auth_user_id into recipient_auth_id from practitioners where id = new.practitioner_id;
    select name into sender_name from patients where id = new.patient_id;
  else
    select auth_user_id into recipient_auth_id from patients where id = new.patient_id;
    select name into sender_name from practitioners where id = new.practitioner_id;
  end if;

  if recipient_auth_id is not null then
    perform net.http_post(
      url := 'https://oiibzrjnrkzagpkqnhbr.supabase.co/functions/v1/send-push',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'user_id', recipient_auth_id,
        'title', coalesce(sender_name, 'New message'),
        'body', left(new.text, 100)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_new_message on messages;
create trigger on_new_message
  after insert on messages
  for each row
  execute function internal.notify_new_message();
