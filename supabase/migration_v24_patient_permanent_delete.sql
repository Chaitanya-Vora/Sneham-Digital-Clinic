-- Migration v24: Permanent, cascading patient deletion.
--
-- patients has select/insert/update RLS (migration_v9_rls_hardening.sql)
-- but no delete policy. This adds one, mirroring
-- migration_v20_practitioner_delete_policy.sql's exact precedent, for
-- defense-in-depth if anything ever issues a raw
-- supabase.from('patients').delete() directly. The real gate is inside the
-- RPC below, which runs SECURITY DEFINER (bypasses RLS entirely) and does
-- its own explicit owner check before touching anything.

create policy "owner deletes patient" on patients for delete to authenticated
  using (internal.is_clinic_owner());

-- Cascading delete, in FK-safe order (verified live via
-- information_schema.referential_constraints — every FK to patients is
-- NO ACTION except case_visits/messages, which CASCADE automatically but
-- are still deleted explicitly here for clarity):
--   video_rooms.appointment_id      -> appointments   (NO ACTION)
--   dose_reminders.prescription_id  -> prescriptions   (NO ACTION)
--   check_ins.prescription_id       -> prescriptions   (NO ACTION)
--   invoices.appointment_id         -> appointments    (NO ACTION)
--   case_visits.appointment_id      -> appointments    (NO ACTION)
--   everything else with patient_id -> patients         (NO ACTION)
-- So: video_rooms before appointments; dose_reminders/check_ins before
-- prescriptions; invoices/case_visits before appointments; prescriptions
-- and appointments before patients.

create or replace function public.permanently_delete_patient(target_patient_id text)
returns void
language plpgsql
security definer
set search_path = internal, public
as $function$
begin
  if not internal.is_clinic_owner() then
    raise exception 'Only the clinic owner can permanently delete a patient.';
  end if;

  if not exists (select 1 from public.patients where id = target_patient_id) then
    raise exception 'Patient % not found.', target_patient_id;
  end if;

  delete from public.video_rooms where appointment_id in
    (select id from public.appointments where patient_id = target_patient_id);
  delete from public.dose_reminders where patient_id = target_patient_id;
  delete from public.check_ins where patient_id = target_patient_id;
  delete from public.invoices where patient_id = target_patient_id;
  delete from public.case_visits where patient_id = target_patient_id;
  delete from public.investigation_orders where patient_id = target_patient_id;
  delete from public.second_opinions where patient_id = target_patient_id;
  delete from public.handoffs where patient_id = target_patient_id;
  delete from public.outcomes where patient_id = target_patient_id;
  delete from public.documents where patient_id = target_patient_id;
  delete from public.messages where patient_id = target_patient_id;
  delete from public.case_data where patient_id = target_patient_id;
  delete from public.prescriptions where patient_id = target_patient_id;
  delete from public.appointments where patient_id = target_patient_id;
  delete from public.patients where id = target_patient_id;
end;
$function$;

revoke execute on function public.permanently_delete_patient(text) from public, anon;
grant execute on function public.permanently_delete_patient(text) to authenticated;
