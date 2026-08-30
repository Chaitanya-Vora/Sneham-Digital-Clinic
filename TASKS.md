# Sneham Digital Clinic — Launch Readiness Task List

Living checklist of everything requested so far. Updated as work progresses —
if a conversation ever loses context, read this file first to see what's
done and what's left.

## Done

- [x] All 9 critical + 23 other audit findings from `audit-triage.html`
- [x] Google OAuth "Unable to exchange external code" error — re-verified live
      tonight against production: "Continue with Google" correctly redirects
      to Google's real sign-in page with no error interstitial (the old bug
      threw before or on the return leg). Didn't complete a full sign-in
      (would need real Google credentials), but the redirect chain — the
      part that was actually broken — checks out.
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

## Found, needs your decision — resolved

- [x] **"Messages" tab duplicating the Inbox — fixed on mobile, flagged on web.**
      Turned out the two surfaces weren't actually in the same situation.
      Practitioner **mobile** genuinely had the same conversation reachable
      two ways (global Inbox, and a "Messages" sub-tab inside a patient's
      profile) — removed the profile one per your decision, Inbox is now the
      only place to read/reply. The **web console**, though, has no global
      Inbox at all — the per-patient Messages panel is its *only* messaging
      surface, so removing it there would have killed messaging on web
      entirely. Left web's panel in place rather than implement that by
      mistake; flagged below for a real decision on whether web should get
      its own Inbox to match mobile.
- [x] **Mobile patient search without a scheduled follow-up — already fixed,
      no new work needed.** Checked the current code and tested live: the
      header search icon on practitioner mobile opens any patient (search →
      select → full case) with zero dependency on a follow-up or
      appointment — confirmed by opening Chiku Vora's case straight from
      search on a phone-width viewport. This was resolved in an earlier
      audit-fix pass; the open item in this file was stale.

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
- [x] **Helper-function RPC exposure: closed, on the third attempt.** The 7
      internal helper functions (`my_patient_id`, `my_practitioner_id`,
      `my_practitioner_role`, `is_clinic_owner`, `can_access_patient`,
      `handle_new_user`, `rls_auto_enable`) were directly callable via
      `/rest/v1/rpc/<name>` by anyone logged in — a WARN-level finding, no
      patient data exposed, but real. First two attempts (revoking execute,
      then moving them to a separate `internal` schema relying on
      `search_path`) both broke live data access and were reverted within
      the same check each time — full account in
      `migration_v11_lock_down_helper_functions.sql` and
      `migration_v12_move_to_internal_schema.sql`. Third attempt moved them
      to `internal` **and** made every internal reference explicitly
      schema-qualified (`internal.my_patient_id()`, `public.patients`, etc.)
      instead of relying on search_path resolution at all — verified live as
      both a regular practitioner and the Owner (exercising every branch,
      including `is_clinic_owner()`), confirmed both the signup trigger and
      the RLS-auto-enable event trigger still correctly point at the moved
      functions, and a fresh security advisor pull shows all 7 gone —
      `link_patient_auth` is the only one still listed, which is correct,
      since patients call it directly during self-registration. Full account
      in `migration_v14_move_to_internal_with_explicit_qualification.sql`.

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

## Storage / performance audit — done

- [x] **19 missing indexes on foreign key columns, added.** `can_access_patient()`
      runs an `EXISTS` check against `patients`/`handoffs` on almost every RLS
      check, on every row, on every table, every 15 seconds (the auto-refresh),
      across all 3 surfaces. Invisible at 1 patient; would have become a real,
      growing cost as the real patient count grows. Applied and verified live
      with zero regressions (`migration_v13`).
- [x] **8 policies were re-evaluating `auth.uid()` per row instead of once per
      query** — rewritten to Supabase's own documented `(select auth.uid())`
      pattern (identical result, evaluated once). Same migration, same
      verification.
- [x] **5 tables had a redundant `select` policy fully covered by a broader
      `all` policy** — Postgres was evaluating both on every read for no
      reason. Dropped the redundant one on each; access is unchanged.
      Re-ran the security + performance advisors after: all three finding
      types are gone, zero new warnings.
- [x] Bundle/code-splitting re-confirmed still real: the 3 surfaces
      (web/practitioner/patient) are lazily loaded — a patient's phone never
      downloads the practitioner or web console code — and PDF export +
      html2canvas are their own separate lazy chunks, only fetched when
      someone actually exports a PDF.
- [x] Voice notes: re-checked against the original audit's "recording thrown
      away" bug — no longer true. `VoiceRecorder` produces a real Blob,
      `MobileCaseSheet` uploads it via `uploadDocument()` like any other file.
- [ ] **Biggest real structural finding, not fixed tonight — needs a real
      decision, not a quick patch:** every hydrate (on login, and every 15
      seconds on all 3 surfaces) does an unfiltered `select('*')` against
      every table — messages, documents, case visits, all of it, with no
      pagination or date window. Invisible right now with 1 patient and a
      handful of rows everywhere. Will not stay invisible — a clinic running
      for a year with real patient volume will eventually be pulling its
      entire history over the wire every 15 seconds, on every open tab, on
      every surface. Fixing this properly means adding real pagination or
      switching from polling to Supabase realtime subscriptions — a genuine
      design choice (how much history stays "hot", and whether it's worth
      building realtime now vs. later) worth a real conversation before I
      build it.
- [ ] **Smaller, lower priority:** documents/images upload with no
      client-side compression or size warning before hitting Supabase
      storage (project-wide cap is 50MB/file, so nothing catastrophic can
      happen, but a large scan or photo uploads exactly as large as it was
      taken). Worth adding if storage cost or upload speed becomes a real
      complaint — not urgent today.

## Still to do

- [ ] Click-test the Owner Mine/Everyone toggle as Neha herself (needs her
      password — everything else about it is confirmed via code + database).
- [ ] Apply the real clinic letterhead once provided (currently a text-based
      placeholder letterhead in PDF exports)
- [ ] Hydrate-everything-every-15-seconds architecture — explicitly not a
      priority right now (your call). Revisit once real data volume makes it
      worth doing.
- [ ] Document/image compression before upload — lower priority, see the
      storage/performance audit above.
- [ ] Decide whether the web console should get its own global Inbox
      (matching mobile) — its per-patient Messages panel is currently the
      only way to message a patient from web, so it wasn't removed.
- [ ] Small bug found while testing tonight, not yet fixed: a `<button>`
      nested inside another `<button>` in the web Prescriptions overview
      screen (invalid HTML, can make clicks behave unpredictably) — spun off
      as its own task rather than folded in here.
