-- Right now anyone who completes the web/practitioner signup form gets a
-- real practitioner account instantly — no invite, no approval. This adds a
-- status gate: only the clinic's very first-ever signup (the founding
-- Owner, who has no one to approve them) starts 'active'; everyone after
-- that starts 'pending' and gets zero patient-data access until the Owner
-- approves them from Settings.

alter table practitioners add column if not exists status text not null default 'pending' check (status in ('pending', 'active'));

-- Backfill: every practitioner row that already exists today was already
-- vetted by virtue of already being in real use — never silently lock out
-- an existing login the moment this column appears.
update practitioners set status = 'active';

-- internal.my_practitioner_id() / my_practitioner_role() had no `order by`,
-- so if more than one row ever matched an auth_user_id again (the exact
-- condition a client-side bug hit today), which row won was undefined —
-- ordering by created_at makes them converge on the same (oldest, real) row
-- every time, same fix already applied client-side in ensurePractitioner().
create or replace function internal.my_practitioner_id()
returns text
language sql stable security definer
set search_path = internal, public
as $$
  select id from public.practitioners where auth_user_id = auth.uid() order by created_at asc limit 1;
$$;

create or replace function internal.my_practitioner_role()
returns text
language sql stable security definer
set search_path = internal, public
as $$
  select role from public.practitioners where auth_user_id = auth.uid() order by created_at asc limit 1;
$$;

create or replace function internal.my_practitioner_status()
returns text
language sql stable security definer
set search_path = internal, public
as $$
  select status from public.practitioners where auth_user_id = auth.uid() order by created_at asc limit 1;
$$;

-- The actual gate: a patient always reaches their own record; every other
-- path (Owner, assigned/unassigned practitioner, accepted handoff) now also
-- requires status = 'active' — a pending signup gets none of them.
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
