-- v49: "Don't reveal the remedy" — a per-prescription privacy choice.
--
-- Many homeopaths never tell the patient which remedy they are taking. The doctor
-- always records the real remedy (it drives reminders, restock calls, history and
-- follow-ups), but can mark a prescription as hidden from the patient. When it is
-- hidden, everything the patient is given — the printed slip, the WhatsApp / e-mail
-- text, the patient app, the notification and the daily dose reminder — uses the
-- doctor's own wording ("Pills No. 1", a code, or nothing at all) instead of the name.
--
-- Additive and safe to run more than once:
--   hide_remedy  false for every existing prescription (nothing changes for them)
--   slip_label   what the slip says instead of the remedy name (may be empty)
--
-- Nothing else needs to change in the database: the existing row-level security
-- already decides who can read or write a prescription row, and the trigger that
-- limits what a patient may update (only reminders_enabled) still applies.

alter table public.prescriptions
  add column if not exists hide_remedy boolean not null default false;

alter table public.prescriptions
  add column if not exists slip_label text;

comment on column public.prescriptions.hide_remedy is
  'true = the remedy name is not shown to the patient (slip, messages, patient app, reminders). The doctor always sees the real name.';
comment on column public.prescriptions.slip_label is
  'What the patient-facing slip says instead of the remedy name when hide_remedy is true (e.g. "Pills No. 1"). Empty = instructions only.';
