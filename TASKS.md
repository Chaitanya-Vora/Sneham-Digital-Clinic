# Sneham Digital Clinic — Launch Readiness Task List

Living checklist of everything requested so far. Updated as work progresses —
if a conversation ever loses context, read this file first to see what's
done and what's left.

## Done

- [x] All 9 critical + 23 other audit findings from `audit-triage.html`
- [x] Google OAuth "Unable to exchange external code" error
- [x] Branded Supabase auth emails (confirmation + recovery templates)
- [x] Password reset flow (was auto-logging in instead of prompting for a new password)
- [x] Removed practitioner/patient/web surface toggle from production web build
- [x] Freeform prescription + billing editing (web and practitioner mobile)
- [x] Billing/invoice feature added to practitioner mobile (didn't exist before)
- [x] PDF export with clinic letterhead for prescriptions and invoices
- [x] Bundle-size reduction via code-splitting (1.5MB → 665KB main chunk)
- [x] **Production crash "Cannot read properties of undefined (reading 'name')"**
      — root cause: sidebar nav ("Case notes"/"Prescriptions"/"Follow-ups") and
      the Cmd+K "Write a prescription" command opened patient-scoped screens
      without ever setting a real patient, so a leftover demo patient id
      (`pt-ananya`, which doesn't exist in production) hit a force-unwrapped
      `.find()!` and crashed. Fixed both the navigation (now sends you to pick
      a patient first) and hardened all 6 unsafe lookups app-wide to fail
      gracefully instead of crashing. Verified in-browser against production
      data and deployed (commit `077bd5b`).

## Found, needs your decision (not yet acted on)

- [ ] **Chiku Vora's duplicate appointments — root cause found.** All 8 extra
      "Follow-up" appointments are attributed to a phantom *practitioner* row
      literally named "Chiku" (her own patient login accidentally got a
      practitioner profile created for it — a gap in an earlier fix this
      session), not to Dr. Ishwari. They were created in two rapid bursts
      (5 bookings in 15 seconds on Aug 27, 2 more in 4 seconds on Aug 29),
      which points to the patient-app booking flow firing multiple times per
      action rather than someone intentionally booking 8 follow-ups. Needs:
      (a) a code fix so patient-side booking can never resolve "the
      practitioner" to the patient's own account, and (b) a decision on what
      to do with the 9 real-but-wrong appointment rows already in the
      database (reassign to Dr. Ishwari, or delete the extras) — flagging
      rather than touching real patient data without asking.
- [ ] "Messages" tab inside a patient's profile (practitioner view) duplicates
      the Inbox tab — what should happen to it?
- [ ] Mechanism for a practitioner to search/view any patient's case on
      mobile without a scheduled follow-up first — to design together.

## Still to do

- [ ] Case-taking templates: make customizable (currently 4 hardcoded in `caseTemplate.ts`)
- [ ] Past case visit snapshots: make properly viewable/editable (currently read-only)
- [ ] Full storage/load-performance audit across case files, documents, audio,
      billing, follow-ups (partially covered by code-splitting so far)
- [ ] Structured page-by-page comparison against `Sneham Design Web and App - F.pdf`
      (PDF fully read; comparison + gap list not yet written up)
- [ ] Apply the real clinic letterhead once provided (currently a text-based
      placeholder letterhead in PDF exports)
- [ ] Final confirmation summary once everything above is resolved
