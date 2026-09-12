-- Migration v32: real, editable staff permissions
--
-- The "Staff & permissions" table on Settings claimed to show "the same
-- gates the app itself enforces, not just a reference chart" — but it was
-- a hardcoded grid; the actual gates scattered through WebApp.tsx
-- (role === 'Assistant' || role === 'Receptionist' checks on case-note
-- access, case assignment, and handoff acceptance) were separately
-- hardcoded to match it. Clicking a cell did nothing. This makes it real:
-- one table both the UI and the app's own gates read from, editable by
-- the Owner.
--
-- Scoped to Assistant/Receptionist only — Owner and Practitioner have
-- never been restricted by any of these checks anywhere in the app, so
-- they stay fixed at full access rather than newly becoming restrictable
-- (that would be a bigger behavioral change than "make the existing
-- reference chart interactive").
--
-- "Schedule & billing" is deliberately not part of this table: no gate
-- for it exists anywhere in the app today (every role already passes),
-- so there is nothing real to make editable yet without inventing a new
-- restriction nobody asked for.

create table if not exists role_permissions (
  role text primary key check (role in ('Assistant', 'Receptionist')),
  see_case_notes boolean not null default false,
  assign_cases boolean not null default false,
  accept_handoffs boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into role_permissions (role, see_case_notes, assign_cases, accept_handoffs) values
  ('Assistant', false, false, false),
  ('Receptionist', false, false, true)
on conflict (role) do nothing;

alter table role_permissions enable row level security;

-- Every logged-in practitioner needs to read this (to know their own
-- gates); only the Owner can change it.
create policy "Authenticated users can read role permissions" on role_permissions
  for select to authenticated using (true);

create policy "Owner can manage role permissions" on role_permissions
  for update to authenticated using (internal.is_clinic_owner()) with check (internal.is_clinic_owner());

-- ── Verification ──
-- select * from role_permissions;
--   -> Assistant: all false. Receptionist: see_case_notes false,
--      assign_cases false, accept_handoffs true. Matches the previous
--      hardcoded table exactly, so this ships with zero behavior change
--      until the Owner actually edits something.
