# Sneham Digital Clinic — Project Retrospective

A working reference for everything covered in this build session: what we built, what broke and why, the tools used and when to reach for them, and the genuinely tricky procedures worth not re-learning from scratch. Organized by topic, not strictly by time — jump to whatever you need.

---

## 1. What got built

**Practitioner mobile app — brought to feature parity with web (Tier A scope: patient-facing clinical work, not admin/Settings/Reports):**
- Phone display + WhatsApp reach-out (`tel:`/`wa.me` links — no need to save a contact first) on both the patient quick-view peek and the full Patient Detail screen.
- Edit patient details, archive/restore, PDF export, referral source tracking.
- Instant Meeting (ad-hoc Jitsi video calls) on web and practitioner surfaces.
- Patient name → bottom-sheet quick view (Chief complaint / current remedy / last seen / prescriptions), reused across Today, Follow-ups, and Calendar.
- Calendar: per-practitioner schedule switching (Owner-only chips), "Reassign to me," and a full Block Time system (custom 30-min time picker, color-coded categories, conflict detection against existing appointments/blocks) — reachable from both Today and Calendar via one shared component.
- Native-feel polish: animated splash screen (tied to real auth-loading time, not an artificial delay), a proper Android back-button handler (prevents the "swipe back exits the app instantly" problem), consistent circular back-buttons across every screen, consistent icon-chip treatment on info cards, a real WhatsApp-brand-colored icon instead of a muted outline.

**Real settings, not fake toggles:** Assignment rules, notification preferences, clinic details, and working hours all got real Supabase tables wired end-to-end (`assignment_rules`, `clinic_settings`, `practitioner_settings`) — previously these UI controls didn't persist anything.

**Access control, built from scratch this session:**
- An invite-code system: a new practitioner lands on "Waiting for approval" with zero data access; the Owner generates a one-time code from Settings and shares it out of band; only entering that exact code unlocks the account. Enforced by a database trigger + two security-definer RPCs (`generate_invite_code`, `redeem_invite_code`) — not just a UI gate.
- A branded "someone wants to join" email pipeline (Resend + an Edge Function + a `pg_net` database trigger) — built and tested end-to-end, currently blocked only on Resend needing a verified domain (see §5).

**Real native push notifications** (Firebase Cloud Messaging): device registration, token storage, a Deno-based sending function that signs its own Google OAuth token from the service-account key (no external auth library), and a live trigger — a new chat message now sends a real notification to whichever side didn't send it.

**Android build pipeline:** `scripts/build-apks.sh` produces separate signed-for-sideload debug APKs for the practitioner and patient surfaces from one codebase, swapping `applicationId`/app name/icon per surface and restoring them afterward.

---

## 2. The big bugs — what they were, why they mattered

### Critical: self-privilege-escalation in `practitioners`
**What we found:** any authenticated practitioner — including a pending signup or an account the Owner had deactivated — could update their *own* row's `status` and `role` directly, e.g. set themselves to `active` + `Owner`. This completely bypassed the approval system. Confirmed exploitable with a direct, reproducible test before fixing it, and re-tested the identical attack afterward to confirm it was closed.

**Why it happened:** the original RLS policy only checked `auth_user_id = auth.uid() OR is_clinic_owner()` — it never restricted *which columns* a non-owner could touch on their own row.

**The fix:** a `BEFORE UPDATE` trigger that forcibly resets `status`/`role`/`auth_user_id`/`invite_code` back to their old values for anyone who isn't the Owner — regardless of what the RLS policy would otherwise allow through. RLS policies decide *whether* a row is reachable; a trigger is what you reach for when you need to protect *specific columns* within a reachable row. A session-local flag (`set_config('internal.bypass_practitioner_guard', ...)`) lets the one legitimate exception (code redemption) through without weakening the general case.

### A second, quieter gap: operational tables readable by anyone authenticated
`clinic_settings`, `assignment_rules`, `practitioner_settings`, `role_permissions`, `time_blocks`, and the full `practitioners` roster were all on a blanket "any authenticated user can read" policy — meaning even a properly-pending account (blocked from the *app UI*) could still pull this data via a direct API call, since the UI gate was never a real security boundary. Real patient-linked data (`patients`, `appointments`, `prescriptions`, etc.) was never actually exposed — those were correctly gated the whole time via `internal.can_access_patient`. Fixed by requiring active practitioner status on the exposed tables, with a carve-out so patients can still read basic practitioner directory info (needed to show "your doctor" in the patient app) and everyone can still read their own row.

**Lesson:** a client-side "if pending, show a blocking screen" check is UX, not security. The database is the only real boundary — always verify with a raw, authenticated-role SQL simulation of the exact account in question, not just by clicking through the app.

### Real navigation bug: Back needing an extra tap
Root cause: React 18 StrictMode double-invokes state-updater functions in development specifically to catch impure updaters — and a nested `setState`-inside-`setState` pattern in the overlay navigation code was exactly that kind of impurity, silently duplicating history-stack entries. Fixed by collapsing three separate `useState`s into one atomic `overlayNav` state, updated via a single pure `setState` call per action. This only ever showed up in local dev (`npm run dev`) — StrictMode is a no-op in production builds — so it would never have surfaced on the deployed app, but was still a real bug worth fixing at the source.

### Android WebView native-popup corruption
A native popup (date/time picker, long-press paste) renders as a blank white box when it's anchored beneath a screen transition whose CSS transform never got cleared back to `none` after the animation settled. Framer Motion leaves a resting `transform: translateX(...)` applied even once a slide is fully finished. Fixed everywhere this pattern occurs (`BottomSheet`, and every screen-level slide transition) by clearing the inline transform in `onAnimationComplete`. This was already known and fixed once in this codebase (on `BottomSheet` specifically) before this session found the same gap on the *screen-level* overlay transitions, which is exactly where a real date-picker crash happened live on a device.

---

## 3. Tools used, and what each was actually for

| Tool | What it was for here |
|---|---|
| **Supabase MCP (`execute_sql`, `apply_migration`)** | Reading real data, writing every schema migration, and — critically — *simulating* RLS as a specific real user (`set_config('request.jwt.claims', ...); set local role authenticated;` inside a `begin`/`rollback` transaction) to prove a security fix actually worked, without ever needing a live browser session. |
| **Supabase MCP (`deploy_edge_function`, `query_logs`)** | Shipping the two Deno functions (email + push) and reading their actual `console.error` output afterward (`source = 'function_logs'`) to see the *real* failure reason instead of guessing. |
| **Browser pane (`javascript_tool`, `read_page`, `preview_logs`)** | Live-testing the mobile app. `computer` click actions timed out unreliably this session — JS-dispatched clicks via `javascript_tool` were the reliable substitute throughout. `preview_logs` (the actual dev-server terminal output) was trustworthy; `read_console_messages` was not (see §4). |
| **Bash (`curl`)** | Directly testing a deployed Edge Function's behavior (missing secret → wrong `from` address → real send) without needing the app UI at all — the fastest way to isolate exactly which layer was failing. |
| **Bash (`scripts/build-apks.sh`)** | Producing the actual installable APKs, verified afterward with `file`/`unzip -l` (checking for a real `AndroidManifest.xml` + `classes.dex`) rather than just trusting the build didn't error. |
| **Memory files** | Two genuinely open items (Jitsi real-device connection failure, Resend domain) saved as persistent memory so a future session doesn't re-diagnose them from zero or forget they're still open. |

---

## 4. Mistakes, false alarms, and testing-environment quirks

These cost real time this session — worth not repeating:

- **Chasing a "double exchange" theory for a Google OAuth failure that was actually a server-side credential mismatch.** The error text (`4/0A...`, Google's own auth-code format) was the tell — it meant the failure was happening on Supabase's server *before* any client code ever ran, so no client-side fix could have addressed it. Read the exact error format before assuming which layer owns the bug.
- **Assuming Sentry errors were live bugs.** Two `ReferenceError`s in Sentry turned out to be transient Vite hot-reload artifacts from mid-refactor edits earlier in the *same session* — proven by a fresh cold-restart test showing the feature working perfectly, plus confirming via `git status` that nothing broken had ever been committed or deployed. Sentry timestamps + your own recent edit history are worth cross-checking before treating a dashboard alert as current truth.
- **A self-inflicted false bug report**: believing an appointment edit hadn't saved, when the real issue was checking the wrong appointment ID in the database. Caught by re-verifying against the *correct* ID before reporting it as a bug.
- **`read_console_messages` returns a stale, cumulative buffer across server restarts** — not reliable for "is there an error right now." `preview_logs` (the real dev-server output) was the trustworthy source all session.
- **CSS `text-transform: uppercase` makes `innerText`/`textContent` checks lie** — a mixed-case string in the source can read back fully uppercase in a DOM check, producing a false "text doesn't match" failure. Confirm visually (screenshot) when a text-based assertion looks wrong.
- **A screenshot taken immediately after a click/navigation can show a stale, mid-animation frame** — several apparent bugs resolved themselves after waiting 1–3 seconds before asserting anything.

---

## 5. Deferred / still open

- **Jitsi video calls didn't actually connect on a real two-device test.** Built and looked correct in every code-level check, but not yet root-caused against a real call. (See memory: `jitsi_connection_issue.md`.)
- **Resend has no verified domain**, so the new "practitioner wants to join" email can't send to anyone but the developer's own account email yet — a real domain purchase + DNS verification would fix this and also give the live web app a proper URL instead of its current auto-generated Vercel one. (See memory: `resend_domain_deferred.md`.) The actual security gate (invite codes) does not depend on this — it already works without email.
- **Drag-to-reschedule** was deliberately *not* built after weighing it honestly: the existing tap-to-select-then-tap-target flow is more reliable on a small touch screen, and building real drag would first require turning Calendar's agenda list into an hourly grid. Revisit only if the current flow genuinely proves too slow in practice.

---

*Written at the end of a long session covering practitioner-app parity, a full calendar/block-time feature, a critical access-control vulnerability found and fixed, and a from-scratch push-notification pipeline. Keep this alongside `CLAUDE.md`.*
