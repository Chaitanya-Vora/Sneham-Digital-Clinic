-- Migration v14: RLS helper functions moved to a non-exposed schema — succeeded
-- Run this in Supabase SQL Editor
--
-- Third attempt at closing the advisor's "SECURITY DEFINER function callable
-- directly via /rest/v1/rpc" finding (see v11 and v12 for the first two,
-- both of which broke live RLS access and were reverted). This one worked.
--
-- What was different: v12 moved the functions to schema `internal` and set
-- each one's `search_path` to `'internal, public'`, expecting that to
-- resolve their unqualified internal calls (can_access_patient calling
-- is_clinic_owner(), etc.). It didn't — a live test immediately failed with
-- "function is_clinic_owner() does not exist", even though the identical
-- shape (SECURITY DEFINER SQL functions, 3 levels of unqualified nested
-- calls, matching search_path) worked fine in an isolated sandbox schema.
-- Never fully explained why the real functions behaved differently — could
-- be SQL-function inlining interacting with search_path in a way specific
-- to these functions, could be a stale cached plan on whatever connection
-- ran the ALTER. Reverted immediately either way.
--
-- This attempt removes search_path from the equation entirely: every
-- reference inside every function body is explicitly schema-qualified
-- (internal.my_practitioner_id(), public.patients, etc.), so there's no
-- resolution order left to get wrong regardless of inlining or caching.
-- Verified live immediately after: simulated-role checks as both a regular
-- practitioner and the Owner (exercising can_access_patient's full branch,
-- including is_clinic_owner()) all returned the expected data with no
-- errors; a fresh security advisor pull shows all 7 functions no longer
-- flagged (only link_patient_auth remains, which is intentional — it's the
-- one meant to be called directly); both the on_auth_user_created trigger
-- and the ensure_rls event trigger correctly followed their function to
-- internal (confirmed via pg_get_triggerdef / pg_event_trigger — Postgres
-- tracks these by OID, not by re-parsing a name, so the schema move alone
-- was never going to break either trigger).

create schema if not exists internal;

alter function public.my_practitioner_id() set schema internal;
alter function public.my_practitioner_role() set schema internal;
alter function public.my_patient_id() set schema internal;
alter function public.is_clinic_owner() set schema internal;
alter function public.can_access_patient(text) set schema internal;
alter function public.handle_new_user() set schema internal;
alter function public.rls_auto_enable() set schema internal;

create or replace function internal.my_practitioner_id() returns text
 language sql stable security definer set search_path to 'internal, public'
as $function$
  select id from public.practitioners where auth_user_id = auth.uid() limit 1;
$function$;

create or replace function internal.my_practitioner_role() returns text
 language sql stable security definer set search_path to 'internal, public'
as $function$
  select role from public.practitioners where auth_user_id = auth.uid() limit 1;
$function$;

create or replace function internal.my_patient_id() returns text
 language sql stable security definer set search_path to 'internal, public'
as $function$
  select id from public.patients where auth_user_id = auth.uid() limit 1;
$function$;

create or replace function internal.is_clinic_owner() returns boolean
 language sql stable security definer set search_path to 'internal, public'
as $function$
  select coalesce(internal.my_practitioner_role() = 'Owner', false);
$function$;

create or replace function internal.can_access_patient(target_patient_id text) returns boolean
 language sql stable security definer set search_path to 'internal, public'
as $function$
  select
    internal.is_clinic_owner()
    or target_patient_id = internal.my_patient_id()
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
    );
$function$;

-- handle_new_user and rls_auto_enable needed no body changes — both already
-- fully-qualified their only cross-schema reference (public.profiles) or
-- had none at all — so only the schema move applied to them.

-- link_patient_auth stays in public, unchanged — it's the one function
-- meant to be called directly (patients call it during self-registration).
