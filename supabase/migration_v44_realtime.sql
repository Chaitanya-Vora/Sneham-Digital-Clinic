-- Turns on Postgres-native realtime change notifications for the tables
-- that need to feel "live" across devices: a new appointment, an incoming
-- message, a published prescription, a handoff, a new patient, a check-in,
-- or a bill should reach every open screen within a second or two, instead
-- of waiting for the next 15-second poll (removed in app code alongside
-- this migration — see store.ts / *App.tsx).
--
-- Tables intentionally left out (case_data, documents, settings, etc.)
-- change far less often and aren't worth the extra subscription — they
-- still get picked up by the slower safety-net refresh.
alter publication supabase_realtime add table
  appointments,
  messages,
  prescriptions,
  handoffs,
  patients,
  check_ins,
  invoices;
