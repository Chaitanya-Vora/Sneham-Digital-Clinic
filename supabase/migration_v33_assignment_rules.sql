-- Migration v33: persist the "Assignment rules" toggles on Settings
--
-- Investigated per a spawned follow-up to the Staff & Permissions fix
-- (migration_v32): autoAssignBookings/walkInsSharedQueue/
-- outOfOfficeDelegation (src/web/WebApp.tsx, "Assignment rules" card)
-- were pure local useState — never persisted, and grepping the whole
-- src/ tree found nothing anywhere else that reads any of the three
-- flags. Unlike Staff & Permissions, though, the underlying behaviors
-- these describe don't exist in the app at all yet, in any form:
--   - "Auto-assign new bookings": every booking path (patient
--     self-booking, walk-in, web/practitioner booking) already always
--     ties the appointment to a specific practitioner at creation time
--     (scheduleFollowUp always takes a practitionerId) — there is no
--     "unassigned, first-come" alternative to switch to.
--   - "Walk-ins to shared queue": WalkInButton always books directly to
--     the current practitioner; there is no unassigned/shared queue
--     concept anywhere in the appointments model.
--   - "Out-of-office delegation": there is no "away" status or
--     "covering practitioner" concept on Practitioner at all.
-- Building the real behaviors is a genuinely separate, larger feature.
-- This migration only fixes the honest, in-scope bug: the toggle state
-- silently resetting on every reload. The app now says plainly that
-- these are saved preferences, not yet-enforced rules.

create table if not exists assignment_rules (
  id text primary key default 'default',
  auto_assign_bookings boolean not null default true,
  walk_ins_shared_queue boolean not null default true,
  out_of_office_delegation boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into assignment_rules (id) values ('default') on conflict (id) do nothing;

alter table assignment_rules enable row level security;

create policy "Authenticated users can read assignment rules" on assignment_rules
  for select to authenticated using (true);

create policy "Owner can manage assignment rules" on assignment_rules
  for update to authenticated using (internal.is_clinic_owner()) with check (internal.is_clinic_owner());

-- ── Verification ──
-- select * from assignment_rules;
--   -> one row, id='default', auto_assign_bookings=true,
--      walk_ins_shared_queue=true, out_of_office_delegation=false —
--      matches the old useState defaults exactly, so this ships with
--      zero visible behavior change until the Owner toggles something.
