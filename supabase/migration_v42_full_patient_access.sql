-- A second doctor can be trusted to see every patient — not just their own
-- roster or an accepted handoff — without making them the clinic Owner.
-- Settings-only, Owner-granted, per practitioner.

alter table practitioners add column if not exists full_patient_access boolean not null default false;

-- Same privileged-column trigger as status/role/auth_user_id/invite_code
-- (migration_v38) — a non-owner must never be able to grant this to
-- themselves via a direct row update.
create or replace function internal.protect_practitioner_privileged_columns()
returns trigger language plpgsql security definer set search_path = internal, public
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
    new.full_patient_access := old.full_patient_access;
  end if;
  return new;
end;
$$;

create or replace function internal.my_full_patient_access()
returns boolean
language sql stable security definer
set search_path = internal, public
as $$
  select coalesce(full_patient_access, false) from public.practitioners where auth_user_id = auth.uid() order by created_at asc limit 1;
$$;

-- Same shape as migration_v19's can_access_patient — one more OR branch,
-- still gated behind an active status (a pending/inactive account with the
-- flag somehow set still gets nothing, same as every other path here).
create or replace function internal.can_access_patient(target_patient_id text)
returns boolean
language sql stable security definer
set search_path = internal, public
as $$
  select
    target_patient_id = internal.my_patient_id()
    or (
      internal.my_practitioner_status() = 'active'
      and (
        internal.is_clinic_owner()
        or internal.my_full_patient_access()
        or exists (
          select 1 from public.patients p
          where p.id = target_patient_id
          and (p.owning_practitioner_id = internal.my_practitioner_id() or p.owning_practitioner_id is null)
        )
        or exists (
          select 1 from public.handoffs h
          where h.patient_id = target_patient_id
          and h.to_practitioner_id = internal.my_practitioner_id()
          and h.status = 'accepted'
        )
      )
    );
$$;
