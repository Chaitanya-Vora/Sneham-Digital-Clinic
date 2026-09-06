-- Billing gets its own table, decoupled from appointments — a quick phone-
-- call bill has no appointment behind it. Cancelling an invoice never
-- deletes it (status: 'cancelled') so history and analytics stay auditable.

create table if not exists invoices (
  id text primary key,
  invoice_no bigint generated always as identity,
  patient_id text not null references patients(id),
  practitioner_id text not null references practitioners(id),
  appointment_id text references appointments(id),
  date text not null,                 -- ISO date string, matching appointments.day_label's own convention (plain text, not a native date column)
  items jsonb not null default '[]',
  payment_mode text not null default 'Cash',
  amount_received numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','paid','partial','waived','cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

alter table invoices enable row level security;
create policy "Authenticated users can read invoices" on invoices for select to authenticated using (true);
create policy "Authenticated users can manage invoices" on invoices for all to authenticated using (true);

create index if not exists invoices_patient_id_idx on invoices(patient_id);
create index if not exists invoices_practitioner_id_idx on invoices(practitioner_id);
create index if not exists invoices_appointment_id_idx on invoices(appointment_id);

-- Backfill existing appointment-based billing data so historical revenue
-- reporting doesn't drop to zero the moment Reports/Today switch to reading
-- from invoices. Preserves the ORIGINAL date (paid_at, else the
-- appointment's own date) — never "now".
insert into invoices (id, patient_id, practitioner_id, appointment_id, date, items, payment_mode, amount_received, status, created_at, updated_at)
select
  gen_random_uuid()::text,
  a.patient_id, a.practitioner_id, a.id,
  coalesce(to_char(a.paid_at, 'YYYY-MM-DD'), a.day_label),
  jsonb_build_array(jsonb_build_object('name', coalesce(a.reason, 'Consultation'), 'qty', 1, 'unitPrice', a.fee)),
  coalesce(a.payment_mode, 'Cash'),
  case when a.payment_status = 'paid' then a.fee else 0 end,
  coalesce(a.payment_status, 'unpaid'),
  coalesce(a.paid_at, now()), coalesce(a.paid_at, now())
from appointments a
where a.fee is not null;

alter table appointments drop column if exists fee;
alter table appointments drop column if exists payment_status;
alter table appointments drop column if exists payment_mode;
alter table appointments drop column if exists paid_at;

-- Her real invoicing (a different, external billing app) already reached
-- #3165 as of the reference bill she shared. Continue that numbering rather
-- than resetting to #1 — this is a reasonable placeholder buffer above it,
-- not her confirmed exact next number; adjust with one more
-- `alter sequence ... restart with <n>` if she gives a different one.
alter sequence invoices_invoice_no_seq restart with 3200;
