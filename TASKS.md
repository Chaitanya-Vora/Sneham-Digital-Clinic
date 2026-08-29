# Sneham Digital Clinic — Launch Readiness Task List

Living checklist of everything requested so far. Updated as work progresses —
if a conversation ever loses context, read this file first to see what's
done and what's left.

## Done

- [x] All 9 critical + 23 other audit findings from `audit-triage.html`
- [x] Google OAuth "Unable to exchange external code" error
- [x] **Branded auth emails — actually live now.** Confirm-signup and reset-password
      emails are sent via Resend custom SMTP (Supabase's default mailer doesn't allow
      template editing at all) with the Sneham-branded HTML, not just written to a
      file. Sender is Resend's shared address until a real domain is bought.
- [x] Password reset flow (was auto-logging in instead of prompting for a new password)
- [x] Signup confirmation link now shows an "email verified" screen instead of
      silently logging in (mirrors the reset-password fix — Supabase has no
      dedicated event for this, so it's detected via the confirmation URL's
      own `type=signup`, same as the native deep-link handler already does
      for `type=recovery`).
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
- [x] **Past case visits are now editable.** Amending a past visit's notes
      stamps an `editedAt` timestamp shown next to the visit, so it's visible
      a record was changed after the fact (per your explicit choice, having
      weighed that this trades away a frozen audit trail).
- [x] **Full page-by-page comparison against the design PDF, delivered.**
      Sent as a standalone report. Headline: core clinical workflow (case-taking,
      prescriptions, follow-ups) matches or exceeds the spec. Specific gaps
      found are broken out below instead of staying vague.

## Found, needs your decision (not yet acted on)

- [ ] "Messages" tab inside a patient's profile (practitioner view) duplicates
      the Inbox tab — what should happen to it? (Worth noting: the design
      PDF's own patient-app home screen doesn't feature messaging at all —
      it has Book / Remedies / Reminders / Documents instead.)
- [ ] Mechanism for a practitioner to search/view any patient's case on
      mobile without a scheduled follow-up first — to design together.

- [x] **Offline queueing for case notes & prescriptions — the top-priority gap,
      closed.** Real `navigator.onLine`/online/offline listeners now drive the
      offline flag (previously only inferred from whether the last sync happened
      to succeed). A save attempted while offline is held in a persisted queue
      instead of firing at a doomed request, and drains automatically the moment
      connectivity returns. Verified end-to-end against the real database —
      network to Supabase actually blocked, confirmed nothing written, network
      restored, confirmed the queued write landed with no manual retry.

## Gaps found in the PDF comparison, roughly by priority

- [ ] Appointment doesn't auto-scope the case sheet to visit type (first visit
      vs. follow-up vs. acute) — spec's rule 01.
- [ ] Publishing a prescription doesn't auto-book the follow-up — spec's rule 04.
- [ ] Reports page tracks outcome-quality metrics instead of the spec's
      volume/growth ones — no visits-by-month trend, no follow-up-adherence %,
      no **caseload-by-practitioner** (now genuinely useful with 2 practitioners
      on staff).
- [ ] Today's Day/Week/All-practitioners switch is a static label, not a real
      control; no mini calendar or follow-ups-due list on Today (only a count).
- [ ] Patient check-in is 5 discrete buttons, not the spec's 0–100% slider
      (you'd independently flagged the slider as arguably better yourself).
- [ ] Smaller: no Email share channel on prescriptions (WhatsApp/SMS only), no
      real "save as template" for prescriptions, no "same as last time" booking
      shortcut, practitioner picker doesn't mark "your regular" vs "covering",
      handoffs don't appear on the patient's case timeline.

## Still to do

- [ ] Full storage/load-performance audit across case files, documents, audio,
      billing, follow-ups (partially covered by code-splitting so far)
- [ ] Apply the real clinic letterhead once provided (currently a text-based
      placeholder letterhead in PDF exports)
- [ ] Final confirmation summary once everything above is resolved
