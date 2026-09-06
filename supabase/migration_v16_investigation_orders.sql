-- Investigation orders: the set of lab tests/scans a practitioner asks a
-- patient to get done, printed as a requisition slip. Same shape and RLS
-- pattern as every other clinic table (prescriptions, documents, etc.).

create table if not exists investigation_orders (
  id text primary key,
  patient_id text not null references patients(id),
  practitioner_id text not null references practitioners(id),
  tests text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table investigation_orders enable row level security;
create policy "Authenticated users can read investigation orders" on investigation_orders for select to authenticated using (true);
create policy "Authenticated users can manage investigation orders" on investigation_orders for all to authenticated using (true);

create index if not exists investigation_orders_patient_id_idx on investigation_orders(patient_id);
create index if not exists investigation_orders_practitioner_id_idx on investigation_orders(practitioner_id);
