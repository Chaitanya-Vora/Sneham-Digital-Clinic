-- Migration v15: Free-text prescription body
-- Run this in Supabase SQL Editor
--
-- Homeopaths often avoid writing plain remedy names on a prescription
-- patients can read, so patients can't self-medicate without supervision —
-- doctors use their own shorthand instead ("Px" for Phosphorus, etc). This
-- column holds exactly what should print on the slip, typed freely by the
-- doctor rather than assembled from the structured remedy/potency/dose/
-- repetition fields. Nullable and additive — existing prescriptions and the
-- structured fields (still used for dose reminders and reporting) are
-- unaffected; the PDF export falls back to the structured rendering when
-- this is empty.

alter table prescriptions add column if not exists body_text text;
