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

## Gaps found in the PDF comparison — all closed

- [x] Appointment now auto-scopes the case sheet to visit type (first visit
      vs. follow-up vs. acute) on both web and practitioner mobile — spec's rule 01.
- [x] Publishing a prescription now auto-books the follow-up (web and
      practitioner mobile) — spec's rule 04.
- [x] Reports page: added new-patients-this-month, a 6-month new-vs-returning
      visits chart, and a real "Rebalance gently" action — on top of
      follow-up-rate and caseload-by-practitioner, which turned out to
      already exist (missed in the first PDF comparison pass).
- [x] Today's practitioner-switch is now real: schedule is scoped to the
      logged-in practitioner by default, and the Owner gets a "Mine /
      Everyone" toggle showing the whole team's actual schedule for the day
      (not just a follow-up count).
- [x] Patient check-in is now a continuous 0–100% slider, not 5 discrete buttons.
- [x] Email added as a third share channel on prescriptions (WhatsApp/SMS/Email).
- [x] Real "save as template" for prescriptions — practitioners build a
      library of their own presets (remedy/potency/dose/repetition/duration/
      prep), one tap loads one back. New `rx_templates` column on
      `practitioners`, applied and confirmed live.
- [x] "Same as last time" booking shortcut on the patient app, plus the
      practitioner picker now marks "your regular doctor" vs. "Covering".
- [x] Handoffs now appear on the patient's case timeline (who, when, why).
- [x] Billing: full invoice history + reprint on a patient's profile, "Record
      payment" flow, PDF export with clinic letterhead (placeholder text
      letterhead until you provide the real one).
- [x] Case notes / Prescriptions / Follow-ups are now real standalone screens
      reachable directly from the sidebar — no longer routed through a
      patient's profile first.
- [x] Messages panel on a patient's profile had an unbounded-height bug
      (looked broken/collapsed) — fixed to a fixed, scrollable height.

**Click-tested live (logged in as Dr. Ishwari, against the real database) —
not just read from the diff:** Messages panel renders at a fixed 420px card
with a real internal scroll region; Billing section shows directly on Chiku
Vora's profile with a working "Record payment" entry point; potency and
duration are genuine `<input>` fields (typed "50M" and "21" into them live,
values held, nothing disabled); Prescriptions / Case notes / Follow-ups all
open as direct sidebar screens with real data, no profile detour; Reports
shows "New this month", the visits-by-month chart, and practitioner
workload. The Owner-only Mine/Everyone toggle is confirmed by code + the
database (Neha's row is `role = 'Owner'`, Ishwari's is `'Practitioner'`, and
Ishwari's own Today screen correctly shows no toggle) but wasn't
click-tested as Neha herself — that would need her password.

## Row Level Security — status

- [x] **Table-level policies: fixed and confirmed live.** Every table
      (`patients`, `appointments`, `prescriptions`, all 18 tables) previously
      had `USING (true)` — any logged-in account could read/write any row.
      Replaced with real ownership-based policies (Owner sees everything, a
      practitioner sees their own + unassigned + handed-off-to-them patients,
      a patient sees only their own records). Verified two ways: simulated-role
      SQL (`set local role authenticated` + a real JWT claim) and live
      Supabase advisor check — confirmed `rls_enabled: true` on all 18 tables
      right now.
- [ ] **Smaller, separate finding: 7 internal helper functions
      (`my_patient_id`, `my_practitioner_id`, `my_practitioner_role`,
      `is_clinic_owner`, `can_access_patient`, `handle_new_user`,
      `rls_auto_enable`) are still directly callable via
      `/rest/v1/rpc/<name>`** by anyone logged in (Supabase's security
      advisor flags this as a WARN, not an error). Tried to close this
      tonight by revoking direct execute access — that broke RLS entirely for
      about a minute (every policy calls these same functions internally, and
      Postgres checks execute-privilege against the querying role even inside
      a policy, not just the function's owner). Caught it immediately via a
      live check, reverted, confirmed normal access restored before touching
      anything else. Real risk if left as-is is low — no patient *data* leaks
      this way, at most someone logged in could get a true/false "can I
      access patient X" answer, or read back their own id/role. The correct
      fix (move these functions to a schema Supabase doesn't expose over the
      API, which doesn't touch grants at all) needs each function's body
      checked first — doing that properly is a separate, dedicated pass, not
      something to rush tonight. Full account in
      `supabase/migration_v11_lock_down_helper_functions.sql`.

## Master / assistant visibility — status

- [x] Dr. Neha Tripathi's login is `role = 'Owner'` in the database
      (confirmed directly via query) — she sees her own calendar, plus the
      "Mine / Everyone" toggle to see the whole team's schedule for the day.
- [x] Dr. Ishwari's login is `role = 'Practitioner'` — her calendar is scoped
      to only her own assigned/covering cases, with no toggle to see anyone
      else's (there's nothing wider for a non-Owner to switch to — RLS
      already limits what her account can fetch to her own caseload).

## Deployed

- [x] Committed (`ff5deeb`), pushed, and deployed to production —
      https://sneham-clinic.vercel.app — confirmed loading correctly
      post-deploy.

## Still to do

- [ ] Click-test the Owner Mine/Everyone toggle as Neha herself (needs her
      password — everything else about it is confirmed via code + database).
- [ ] Full storage/load-performance audit across case files, documents, audio,
      billing, follow-ups (partially covered by code-splitting so far)
- [ ] Apply the real clinic letterhead once provided (currently a text-based
      placeholder letterhead in PDF exports)
- [ ] The real fix for the RLS helper-function RPC exposure (schema
      relocation) — see the Row Level Security section above.
