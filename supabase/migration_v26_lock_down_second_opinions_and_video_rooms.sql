-- second_opinions and video_rooms both shipped with a blanket
-- `using (true)` policy, never scoped to the ownership-based access check
-- every other patient-linked table has (same class of gap v18 already
-- fixed for invoices/investigation_orders) — meaning any authenticated
-- account, including a patient's own login, could read or write ANY
-- patient's second-opinion consultations or video-call bookkeeping.
--
-- internal.can_access_patient is the real, current, explicitly-qualified
-- function — referenced schema-qualified here, not via search_path.

drop policy if exists "Authenticated users can manage second opinions" on second_opinions;
drop policy if exists "Authenticated users can read second opinions" on second_opinions;
create policy "read accessible second opinions" on second_opinions for select to authenticated
  using (internal.can_access_patient(patient_id));
create policy "insert accessible second opinions" on second_opinions for insert to authenticated
  with check (internal.can_access_patient(patient_id));
create policy "update accessible second opinions" on second_opinions for update to authenticated
  using (internal.can_access_patient(patient_id)) with check (internal.can_access_patient(patient_id));
create policy "delete accessible second opinions" on second_opinions for delete to authenticated
  using (internal.can_access_patient(patient_id));

-- video_rooms has no patient_id column of its own — it's scoped through
-- the appointment it belongs to.
drop policy if exists "manage video_rooms" on video_rooms;
create policy "read accessible video_rooms" on video_rooms for select to authenticated
  using (internal.can_access_patient((select patient_id from appointments where id = video_rooms.appointment_id)));
create policy "insert accessible video_rooms" on video_rooms for insert to authenticated
  with check (internal.can_access_patient((select patient_id from appointments where id = video_rooms.appointment_id)));
create policy "update accessible video_rooms" on video_rooms for update to authenticated
  using (internal.can_access_patient((select patient_id from appointments where id = video_rooms.appointment_id)))
  with check (internal.can_access_patient((select patient_id from appointments where id = video_rooms.appointment_id)));
create policy "delete accessible video_rooms" on video_rooms for delete to authenticated
  using (internal.can_access_patient((select patient_id from appointments where id = video_rooms.appointment_id)));
