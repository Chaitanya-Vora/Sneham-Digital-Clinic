-- Second opinion: read-only case sharing with a colleague, with a question
-- attached. Ownership of the case never changes — this is a request +
-- response, not a handoff. Same shape and RLS pattern as every other
-- clinic table (prescriptions, investigation_orders, etc.).

create table if not exists second_opinions (
  id text primary key,
  patient_id text not null references patients(id),
  from_practitioner_id text not null references practitioners(id),
  to_practitioner_id text not null references practitioners(id),
  question text not null default '',
  response text,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table second_opinions enable row level security;
create policy "Authenticated users can read second opinions" on second_opinions for select to authenticated using (true);
create policy "Authenticated users can manage second opinions" on second_opinions for all to authenticated using (true);

create index if not exists second_opinions_patient_id_idx on second_opinions(patient_id);
create index if not exists second_opinions_to_practitioner_id_idx on second_opinions(to_practitioner_id);
