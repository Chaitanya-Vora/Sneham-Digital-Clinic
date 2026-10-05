-- Migration v47: optional photos / voice notes on a follow-up outcome.
--
-- Additive only — existing rows get an empty list, older app builds simply
-- ignore the new column. Files live in their own PRIVATE bucket (not
-- clinic-documents, whose policies let any signed-in user read any object)
-- with staff-only policies scoped through internal.can_access_patient, so a
-- patient session can never read a doctor's follow-up photos or voice notes
-- and a covering doctor still can. Path convention: <patient_id>/<file>.

alter table public.outcomes
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('followup-attachments', 'followup-attachments', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "staff read followup attachments" on storage.objects;
create policy "staff read followup attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'followup-attachments'
    and internal.my_practitioner_id() is not null
    and internal.my_practitioner_status() = 'active'
    and internal.can_access_patient((storage.foldername(name))[1])
  );

drop policy if exists "staff upload followup attachments" on storage.objects;
create policy "staff upload followup attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'followup-attachments'
    and internal.my_practitioner_id() is not null
    and internal.my_practitioner_status() = 'active'
    and internal.can_access_patient((storage.foldername(name))[1])
  );

drop policy if exists "staff delete followup attachments" on storage.objects;
create policy "staff delete followup attachments" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'followup-attachments'
    and internal.my_practitioner_id() is not null
    and internal.my_practitioner_status() = 'active'
    and internal.can_access_patient((storage.foldername(name))[1])
  );
