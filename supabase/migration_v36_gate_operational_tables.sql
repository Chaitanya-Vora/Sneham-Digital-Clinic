-- A pending or inactive practitioner account was already correctly blocked
-- from every patient-linked table (patients, appointments, prescriptions,
-- etc. all route through internal.can_access_patient, which requires
-- status = 'active'). But several clinic-wide operational tables were left
-- on a blanket "any authenticated user" policy from when they were first
-- added — readable by a pending signup or a since-deactivated account too,
-- independent of whatever the client UI gate does (RLS is the real
-- boundary; a client-side check is not). This closes that gap.

drop policy if exists "Authenticated users can read assignment rules" on assignment_rules;
create policy "active practitioners read assignment rules" on assignment_rules
  for select to authenticated using (internal.my_practitioner_status() = 'active');

drop policy if exists "Authenticated users can read clinic settings" on clinic_settings;
create policy "active practitioners read clinic settings" on clinic_settings
  for select to authenticated using (internal.my_practitioner_status() = 'active');

drop policy if exists "Authenticated users can read practitioner settings" on practitioner_settings;
create policy "active practitioners read practitioner settings" on practitioner_settings
  for select to authenticated using (internal.my_practitioner_status() = 'active');

drop policy if exists "Authenticated users can read role permissions" on role_permissions;
create policy "active practitioners read role permissions" on role_permissions
  for select to authenticated using (internal.my_practitioner_status() = 'active');

drop policy if exists "read time_blocks" on time_blocks;
create policy "active practitioners read time_blocks" on time_blocks
  for select to authenticated using (internal.my_practitioner_status() = 'active');

-- practitioners is different: everyone must still read their OWN row no
-- matter their status (the app needs that to know it should show "pending"
-- or "removed" in the first place), and a patient must still be able to
-- read practitioner directory info (name/specialty) to show "your doctor"
-- — only reading *other* practitioners' rows requires being active.
drop policy if exists "read practitioners" on practitioners;
create policy "own row, patients, or active practitioners read practitioners" on practitioners
  for select to authenticated using (
    auth_user_id = auth.uid()
    or internal.my_patient_id() is not null
    or internal.my_practitioner_status() = 'active'
  );
