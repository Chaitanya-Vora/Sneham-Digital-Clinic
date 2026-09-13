-- CRITICAL FIX: the existing "update own row" policy on practitioners let
-- any authenticated practitioner set THEIR OWN status/role to anything —
-- including 'active'/'Owner' — via a plain client-side update. Confirmed
-- exploitable: a pending or inactive account could self-promote to full
-- Owner access, completely bypassing the approval gate. A BEFORE UPDATE
-- trigger is the standard, unambiguous way to protect specific columns
-- regardless of what RLS policy logic allows through — it always has
-- clean access to both the old and new row, unlike a WITH CHECK clause.
--
-- This also builds the invite-code system: the Owner generates a code for
-- a specific pending request (generate_invite_code), shares it out of
-- band, and the requester redeems it (redeem_invite_code) — the ONLY way
-- a non-owner's status can ever change, via a security-definer function
-- that deliberately bypasses the guard for that one, code-verified write.

alter table practitioners add column if not exists invite_code text;

create or replace function internal.protect_practitioner_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = internal, public
as $$
begin
  if current_setting('internal.bypass_practitioner_guard', true) = 'true' then
    return new;
  end if;
  if not internal.is_clinic_owner() then
    new.status := old.status;
    new.role := old.role;
    new.auth_user_id := old.auth_user_id;
    new.invite_code := old.invite_code;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_columns on practitioners;
create trigger protect_privileged_columns
  before update on practitioners
  for each row
  execute function internal.protect_practitioner_privileged_columns();

-- Owner-only: mint a code for a specific pending signup and hand it back
-- to display/share. Raises rather than silently no-ops if called by
-- anyone else, so a misuse attempt is loud, not swallowed.
create or replace function public.generate_invite_code(target_practitioner_id text)
returns text
language plpgsql
security definer
set search_path = internal, public
as $$
declare
  new_code text;
begin
  if not internal.is_clinic_owner() then
    raise exception 'Only the clinic owner can generate invite codes';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  perform set_config('internal.bypass_practitioner_guard', 'true', true);
  update practitioners set invite_code = new_code where id = target_practitioner_id;
  return new_code;
end;
$$;

-- Anyone can call this, but it only ever succeeds for the CALLER's own
-- pending row and only with the exact code the owner minted for it — a
-- wrong guess or someone else's code changes nothing and returns false,
-- with no hint about what the right value looks like.
create or replace function public.redeem_invite_code(submitted_code text)
returns boolean
language plpgsql
security definer
set search_path = internal, public
as $$
declare
  my_id text;
  stored_code text;
begin
  select id, invite_code into my_id, stored_code
  from practitioners
  where auth_user_id = auth.uid()
  order by created_at asc
  limit 1;

  if my_id is null or stored_code is null or stored_code <> upper(trim(submitted_code)) then
    return false;
  end if;

  perform set_config('internal.bypass_practitioner_guard', 'true', true);
  update practitioners set status = 'active', invite_code = null where id = my_id;
  return true;
end;
$$;

grant execute on function public.generate_invite_code(text) to authenticated;
grant execute on function public.redeem_invite_code(text) to authenticated;
