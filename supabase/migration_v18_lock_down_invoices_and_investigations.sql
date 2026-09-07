-- invoices (v17) and investigation_orders (v16) were both added AFTER the
-- RLS hardening pass (v9) and never got the same ownership-scoped policy
-- every other patient-linked table has — they shipped with the original
-- blanket `using (true)`, meaning any authenticated account (any
-- practitioner, or a patient logged in on their own phone) could read or
-- write ANY patient's invoices and lab-test orders. Closing that the same
-- way v9 closed it for appointments/prescriptions/etc.
--
-- internal.can_access_patient is the real, current, explicitly-qualified
-- function (moved off `public` in v14, on the third and only attempt that
-- didn't break live access) — referencing it schema-qualified here rather
-- than relying on search_path, same discipline v14 established.

drop policy if exists "Authenticated users can read invoices" on invoices;
drop policy if exists "Authenticated users can manage invoices" on invoices;
create policy "read accessible invoices" on invoices for select to authenticated
  using (internal.can_access_patient(patient_id));
create policy "insert accessible invoices" on invoices for insert to authenticated
  with check (internal.can_access_patient(patient_id));
create policy "update accessible invoices" on invoices for update to authenticated
  using (internal.can_access_patient(patient_id)) with check (internal.can_access_patient(patient_id));
create policy "delete accessible invoices" on invoices for delete to authenticated
  using (internal.can_access_patient(patient_id));

drop policy if exists "Authenticated users can read investigation orders" on investigation_orders;
drop policy if exists "Authenticated users can manage investigation orders" on investigation_orders;
create policy "read accessible investigation orders" on investigation_orders for select to authenticated
  using (internal.can_access_patient(patient_id));
create policy "insert accessible investigation orders" on investigation_orders for insert to authenticated
  with check (internal.can_access_patient(patient_id));
create policy "update accessible investigation orders" on investigation_orders for update to authenticated
  using (internal.can_access_patient(patient_id)) with check (internal.can_access_patient(patient_id));
create policy "delete accessible investigation orders" on investigation_orders for delete to authenticated
  using (internal.can_access_patient(patient_id));
