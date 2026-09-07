# Sneham Digital Clinic — Launch Readiness Task List

Living checklist of everything requested so far. Updated as work progresses —
if a conversation ever loses context, read this file first to see what's
done and what's left.

## Done

- [x] **Real clinic letterhead applied to every PDF.** Logo and Dr. Neha's
      actual signature pulled from the real letterhead file, along with her
      real address (Chiplun, replacing the placeholder "Bandra clinic" text
      shown in the app's own UI too), registration number, and
      qualifications — single source of truth in `letterheadAssets.ts`.
      Caught and fixed a corrupted-base64 bug the hard way (rendered an
      actual generated PDF and looked at it — "wrong PNG signature" — fixed
      by having Vite encode the image files itself instead of a
      hand-transcribed string), plus a potency/remedy-name text overlap and
      a broken Rx-symbol glyph, both found the same way.
- [x] **Every official document prints under Dr. Neha Tripathi specifically**
      — the clinic's registered principal — regardless of which
      practitioner (her or an assistant) actually published it in the app.
      Previously showed whoever was logged in, which also meant Neha's
      signature image could appear next to a different doctor's name.
- [x] **Real free-text prescription body.** Homeopaths often deliberately
      avoid writing plain remedy names so patients can't self-medicate,
      using their own shorthand instead (e.g. "Px" for Phosphorus). Added a
      genuine free-text field — auto-filled from the structured remedy/
      potency/dose fields as a starting point (which still drive dose
      reminders and reporting), but whatever the doctor actually types is
      what prints, verbatim, as plain typed text with no box or icons
      around it. Web console only so far — practitioner mobile's Quick Rx
      still uses the old structured-only writer.
- [x] **Reports page rebuilt against the actual design PDF, not memory.** Found
      it had drifted from spec — a 5-tile stat row that didn't match, plus
      three whole sections never in the spec (Outcome distribution, a
      "Weekly revenue" chart that turned out to be fabricated from activity
      count × a flat fee rather than real payments, and a "Quick stats"
      block). Rebuilt to the spec's exact 4 tiles (Total visits, New
      patients, Follow-up adherence, Revenue), corrected Follow-up adherence
      to measure real attendance instead of "has a reason filled in," and
      moved Most prescribed / Caseload by practitioner into the sidebar
      layout the spec actually shows. Commit `e30f67c`.
- [x] **Duplicate outcome records — root cause fixed, not just deleted.** The
      Save-outcome button (both mobile and web) had no guard against being
      pressed more than once. Found 4 near-identical "Partial" records on
      Chiku Vora's real case (3 within about a minute, a 4th an hour later
      under a different login) — deleted the 3 duplicates, kept the
      earliest as the genuine record, and closed the actual mechanism so a
      repeat tap is now a no-op on both screens. Commit `b80b273`.
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

## Done (this session)

- [x] **Prescription letterhead font size + spacing fixed.** The overlay text
      was 24pt against the template's own actual 22.31pt (measured directly
      off its embedded font, not assumed) — now matches exactly. Date and Sex
      were printing jammed against their labels ("Date:31 Aug 2026") because
      the source document has no space there (unlike Patient Name/Age/
      Diagnosis, which do) — nudged just those two x-positions to match.
      Patient Name and Diagnosis now shrink-to-fit their printed line instead
      of running off the end for a long value, down to a 13pt floor.
- [x] **Diagnosed and fixed the recurring "keeps crashing, have to click
      Restart app" bug.** Root cause: every deploy renames the app's JS chunk
      files; a browser tab open since before the latest deploy 404s the next
      time it tries to load a screen it hasn't already loaded, crashing to
      the manual "Something went wrong" screen. `ErrorBoundary.tsx` now
      auto-reloads once on that specific failure (silently picks up the
      current build) instead of showing an error, falling back to the manual
      restart screen only if a reload doesn't actually fix it.
- [x] **Investigation orders (lab tests/scans) — built and verified live.**
      Same real letterhead as prescriptions (client's explicit call — she has
      no separate format for this). Search-only picker per her instruction
      (no checkbox/category browser): typing the start of a word — including
      a category name like "thyroid" — surfaces matching tests to add;
      multi-word queries like "vitamin d" work too. New `investigation_orders`
      table (migration v16, applied), full store/db wiring, PDF export
      reusing the prescription template's placeholder logic. Web console only
      so far — reachable from a patient's page via "Order investigations".
- [x] Free-text prescription body ported to practitioner mobile's Quick Rx —
      same auto-fill-then-freeform pattern as the web console, verified live.
- [x] Click-tested the Owner Mine/Everyone toggle as Neha herself (now have
      her login). Confirmed on **web**: switching to "Everyone" shows a
      "Your team today" section with Dr Ishwari's schedule underneath — the
      master practitioner does see assistants' schedules there.
- [x] Investigation orders brought to the practitioner mobile app too —
      "Order investigations" now on the patient detail screen's action row,
      same search-only picker and PDF export as web (shared matching logic
      now lives in `core/investigations.ts` so both stay in sync). Verified
      live on mobile: multi-word search, category-name search, and a
      generated PDF all confirmed correct.
- [x] "Tabs redirect to select-a-patient" report — confirmed resolved by you,
      closing out. (Never found an independent repro or root cause myself —
      noting that honestly rather than claiming a specific fix.)

- [x] **Team schedule brought to practitioner mobile too, matching web.**
      `TodayGrid.tsx` was pulling every practitioner's appointments with no
      filter at all — worse than "not visible," it was always-shown and
      unlabeled, with Start/End/Reschedule/No-show all live on every row
      regardless of whose appointment it was (Neha's phone could show
      Ishwari's active consult with a working "End" button on it). Fixed:
      her own schedule is the default everywhere (stats, the active-consult
      banner, the grid) with a new Mine/Everyone toggle (Owner-only,
      matching web) to merge in the team's appointments; a teammate's
      appointment shows their name as a tag and is tap-to-view only, no
      action buttons. Added the same "Your team today" card as web, placed
      below her own schedule + Block time. Verified live as Neha: toggle
      switches correctly, team card renders both teammates.
- [x] **Add Patient tested end-to-end on practitioner mobile**, per your ask
      — search sheet's "+" → validation (blocked empty submit with inline
      errors) → registered → landed on the new patient's case sheet →
      confirmed searchable afterward. Created one real test record in the
      process: "ZZTEST Delete Me" — flagging it, not deleting it without
      you asking.
- [x] Found and fixed a real bug while testing: Add Patient's Location field
      defaulted to a pre-filled "Bandra" (not just a placeholder — an actual
      value that would submit if untouched). Now starts blank with
      "Chiplun" as an example placeholder only.

- [x] **Full billing/invoicing module — web + practitioner mobile, built and
      live-verified end to end.** New `Invoice` entity (its own table,
      migration v17, real sequential invoice numbers via a Postgres identity
      column, decoupled from appointments so a phone-call quick bill needs
      no visit behind it). Itemized lines, partial payment, edit and cancel
      (cancel never deletes — stays visible in history, excluded from
      revenue). "Quick bill" reachable from Today on both surfaces and from
      a patient's own page. Reports and Today's revenue stat now sum real
      `amountReceived` from invoices instead of a derived appointment fee.
      PDF rewritten to match her actual bill format — itemized table, amount
      in words, bank/UPI details, a real scannable QR (decoded it back
      during testing to confirm the exact amount/invoice number encoded).
      Verified live: multi-item partial-payment bill created, edited,
      cancelled — confirmed revenue updates correctly at each step, then
      cleaned up the test invoices from the real DB afterward.
- [x] **Found and fixed a real bug during that testing: ₹ printed as a
      garbled superscript character on every invoice PDF.** The PDF
      library's default font has no Rupee glyph and was silently
      substituting something else instead of erroring. Fixed by embedding a
      real font (subset to just the glyphs the invoice needs, ~16KB) and
      confirmed correct on a fresh render.
- [x] **WhatsApp / SMS / Email share buttons wired up for real** — on the web
      prescription writer and mobile Quick Rx, these used to only toggle a
      local tag with zero actual effect. Now they open the real WhatsApp/
      SMS/email link, prefilled, and only mark themselves "sent" if a phone
      number was actually on file (with a toast when it isn't) — verified
      both the no-phone-on-file case and the successful-send case.
- [x] Consultation fee default corrected to ₹950 (was a placeholder 1500).
- [x] Prescription potency chips: added 50M, CM, LM. Repetition: added "Once
      only today" (treated everywhere the same way "As needed" already is —
      no forced duration, no auto-booked follow-up, dose reminders off).
- [x] Modality field labels corrected: "Better for" / "Worse for" →
      "Better by" / "Worse by", across all three case templates (chronic,
      acute, first-visit).
- [x] Added an "Insert standard instructions" shortcut to the prescription's
      Preparation field (web + mobile) that fills in her standard
      medicine-instructions text (dosing, SOS, the avoid-list) — she still
      edits in the bottle-specific remedy/potency per patient.
- [x] Clinic-location switcher (sidebar, web) was showing three fake
      hardcoded names ("Andheri clinic", "Thane clinic" — never real, never
      wired to anything). Corrected to her actual two locations, Chiplun and
      Pune. Note: this switcher still doesn't filter anything by location —
      it never did — just the names were wrong before. Making it actually
      filter appointments/patients by location would be a real follow-up
      feature, not a bug fix, if you want it.
- [x] **Found and fixed a real data-loss bug: case notes could appear to
      "delete what you just typed."** Root cause wasn't the spacebar itself —
      the 15-second background refresh could land mid-edit (before the
      ~1 second autosave finished) and snap the field back to the
      last-saved server copy. Most visible right after finishing a word,
      which is why it read as "the spacebar deletes it." Now any patient
      with an unconfirmed edit in flight keeps their local text through that
      refresh instead of being overwritten.
- [x] Diagnosed the Android paste-popup glitch (blank white box with an icon,
      appearing on long-press-to-paste) — a known Android WebView bug where
      a CSS transform on an ancestor of a text field corrupts the native
      paste popup's position. Fixed on all four auth screens (Login, Signup,
      Forgot/Reset password) by dropping their entrance animation's
      slide-transform in favor of opacity-only (matching this app's own
      established motion convention elsewhere). If it still shows up on a
      screen reached by sliding in from the side (e.g. Add Patient), that's
      the same root cause in the navigation-transition system — a separate,
      larger fix, flagging rather than guessing at it under time pressure.

- [x] Nested `<button>` in the web Prescriptions overview screen — fixed by
      switching the outer row to `Pressable as="div"` (the same pattern
      already used everywhere else in the app for a clickable row with an
      inner action button). Verified live: the validateDOMNesting warning is
      gone, the row click still opens the patient, and "Write again" still
      opens the prescription writer directly without also triggering the
      row's click.

## Done (2026-09-06, launch-readiness pass)

- [x] **Web console got its own dedicated Messages section** (decided: option
      2 of 2 offered). New top-level "Messages" nav item — a real two-pane
      inbox (conversation list + open thread), matching mobile's Inbox tab
      but using the desktop console's extra width instead of squeezing the
      same chat widget into a narrow sidebar card. The old per-patient
      Messages card is now a lightweight preview (last message + unread
      count) that deep-links into the real conversation. Verified live:
      nav badge, opening a conversation, and the patient-page "open
      conversation" link all confirmed working end to end.
- [x] **Reports page compared page-by-page against the actual design PDF
      again** (`Sneham Design Web and App - F.pdf`, page 8) — found two real
      gaps the first two comparison passes missed: no Month/Year toggle (all
      4 stats were silently all-time, never actually scoped to a period), and
      no Export button at all (the spec's own caption literally says
      "exportable for the accountant"). Both built: a working Month/Year
      toggle that genuinely re-scopes Total visits/New patients/Revenue/
      Follow-up adherence/Most-prescribed to the selected period (Caseload by
      practitioner stays a live snapshot, not period-scoped — "open cases
      right now" isn't a historical metric); real period-over-period deltas
      on each stat tile, but only shown when there's an actual prior-period
      baseline to compare against — never a fabricated/infinite swing for a
      new clinic with no history yet.
- [x] **CSV export added — doubles as your "back up patient data" ask.** The
      new Export button (Patients / Appointments / Prescriptions / Invoices,
      each its own CSV) is exactly where the design spec always intended an
      export to live, so this was the natural, unobtrusive place for it
      rather than a separate new "backup" feature. Opens cleanly in Excel
      (UTF-8 BOM so ₹ and names don't mangle). Web console only for now.
- [x] **Re-verified the full audit-triage list (48 findings) against the
      current code, not old notes** — dispatched 4 independent checks
      covering identity/sync, Quick Rx/Today/Calendar, RLS/security/Jitsi/
      timer-leak, and the remaining findings 15-48. Result: everything
      checked out fixed **except** the 3 items below, which are real.
- [x] **Found and fixed: a failed case-data fetch could still silently wipe
      case histories from view.** The poll-race fix from earlier only
      protected patients with an edit actively in flight — `fetchAllCaseData`
      itself was the one fetch function (of 19) that didn't increment the
      shared hydrate-error counter on failure, so a fetch that failed for
      just that one table looked like a clean hydrate to the rest of the
      app and quietly replaced every *already-saved* patient's case data
      with nothing. One-line fix in `src/core/db.ts`, now consistent with
      every other fetch function.
- [ ] **Found, NOT yet applied — needs a real decision/action from you:**
      `invoices` and `investigation_orders` (added in migrations v17/v16,
      after the RLS hardening pass) still ship the original blanket
      `using (true)` policy — any logged-in account could read or write any
      patient's bills or lab orders. Every other patient-linked table was
      already scoped by `can_access_patient()`; these two were missed.
      Fix written: `supabase/migration_v18_lock_down_invoices_and_investigations.sql`.
      **Not applied to the live database** — my Supabase connection dropped
      mid-session (ENOTFOUND, likely transient) with no fallback credentials
      available locally. Either run that file's SQL in the Supabase
      Dashboard's SQL Editor yourself, or ask me to apply it once the
      connection is back.
- [ ] **Smaller, found but not fixed this round:** a few write paths
      (notification inserts, `markMessagesRead`) are still fire-and-forget
      with nothing surfaced on failure — lower severity than the writes that
      already got this (case notes, prescriptions, invoices). Practitioner
      mobile's grid view has no no-show action wired on a card (list view
      does). Tap-target sizing (44px min) was only fixed on the patient app —
      practitioner mobile and web still have several sub-44px controls
      (Toggle, Stepper, Chip in the shared design system).
- [x] Jitsi double-join (the original audio-howl bug) re-confirmed fixed by
      reading the actual guard in `VideoConsult.tsx` directly — native join
      is gated by a `hasOpenedRef` that survives a React StrictMode
      mount→cleanup→mount, and the native vs. web(iframe) paths are mutually
      exclusive branches so they can't double-join each other either. Not
      click-tested live this round (would need a real second participant to
      confirm no audio doubling) — code-level guard is unambiguous, so
      treating this as solid without a live redo.

## Still to do

- [ ] Hydrate-everything-every-15-seconds architecture — explicitly not a
      priority right now (your call). Revisit once real data volume makes it
      worth doing.
- [ ] Document/image compression before upload — lower priority, see the
      storage/performance audit above.
- [ ] **Apply `migration_v18_lock_down_invoices_and_investigations.sql` to
      the live database** — see above, this is the one real open item before
      real patient billing/lab data should go live.
- [ ] Fire-and-forget writes on notifications/`markMessagesRead`; grid-view
      no-show action; tap-target sizing outside the patient app — all lower
      severity, listed above.
