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

- [x] **Chiku Vora's duplicate appointments — root cause fixed.** Her patient
      login had a phantom *practitioner* row created for it (a gap in an
      earlier fix), and the patient app's "Book a visit" screen defaulted to
      `practitioners[0]` instead of her actual assigned doctor — so bookings
      silently landed on the wrong practitioner (herself). Fixed the default
      to always use the patient's real assigned doctor, fixed 4 other "your
      doctor" display spots with the same assumption, added a double-tap
      guard on booking. Data cleaned up per your approval: reassigned her
      real message + patient ownership to Dr. Ishwari, deleted the 9 bad
      appointments and the 2 stray practitioner rows. Deployed.
- [x] **Customizable case-taking templates.** Practitioners can create their
      own templates (sections + fields, free-text or chip-select) from
      either the web case sheet or practitioner mobile — not limited to the
      4 built-in ones anymore. New `case_templates` table in Supabase.
      Type-checked and build-verified; **not** click-through verified in the
      browser this round (the preview pane was reporting `document.hidden`,
      which pauses the animation the screen relies on) — worth trying
      yourself and flagging anything off.

## Found, needs your decision (not yet acted on)

- [ ] "Messages" tab inside a patient's profile (practitioner view) duplicates
      the Inbox tab — what should happen to it?
- [ ] Mechanism for a practitioner to search/view any patient's case on
      mobile without a scheduled follow-up first — to design together.

## Still to do

- [ ] Past case visit snapshots: make properly viewable/editable (currently read-only)
- [ ] Full storage/load-performance audit across case files, documents, audio,
      billing, follow-ups (partially covered by code-splitting so far)
- [ ] Structured page-by-page comparison against `Sneham Design Web and App - F.pdf`
      (PDF fully read; comparison + gap list not yet written up)
- [ ] Apply the real clinic letterhead once provided (currently a text-based
      placeholder letterhead in PDF exports)
- [ ] Final confirmation summary once everything above is resolved
