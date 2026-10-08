# Sneham Digital Clinic — Project Context for Claude Code

## What This Is

A premium homeopathy practice-management platform with 3 surfaces from one React codebase:
- **Web** (`src/web/WebApp.tsx`) — full desktop practice console
- **Practitioner APK** (`com.sneham.practitioner`) — doctor's mobile app, "Sneham Dr"
- **Patient APK** (`com.sneham.patient`) — patient's mobile app, "Sneham"

Surface is set by `VITE_DEFAULT_SURFACE` env var at build time. On web/dev, a launcher lets you switch.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
  - Project ref: `oiibzrjnrkzagpkqnhbr`
  - URL: `https://oiibzrjnrkzagpkqnhbr.supabase.co`
- **Native**: Capacitor 8 for Android APKs
- **Video**: Jitsi Meet via `@jitsi/react-sdk`
- **Icons**: `@phosphor-icons/react`
- **PDF**: Custom canvas-based export in `src/core/pdfExport.ts`

## Key Architecture

### Data Flow
- `src/core/store.ts` — Zustand store with ALL app state (patients, appointments, prescriptions, messages, etc.)
- `src/core/db.ts` — Supabase CRUD layer. `hydrateAll()` (line 848) is the ONLY read path — pulls all tables at once
- `src/core/seed.ts` — In-memory demo seed data. Used when Supabase is empty
- `src/core/types.ts` — All TypeScript interfaces (Patient, Appointment, Prescription, ChatMessage, etc.)
- `src/core/supabase.ts` — Supabase client init

### Hydrate happens at:
1. `src/App.tsx:59` — useEffect on auth user change (once at login)
2. `src/practitioner/PractitionerApp.tsx:97` — 15-second auto-refresh interval
3. Manual pull-to-refresh gestures

### Auth
- `src/auth/AuthProvider.tsx` — Supabase auth wrapper
- `src/auth/LoginScreen.tsx` — Email/password + Google OAuth
- `src/auth/SignupScreen.tsx` — Registration
- Login credentials for testing:
  - Patient: `chaitanyasm2003@gmail.com`
  - Practitioner: `ishwariwankhade@gmail.com`
  - (passwords not stored here — ask the user)

### Surface Routing
`src/App.tsx` reads `VITE_DEFAULT_SURFACE` or shows a launcher. Routes:
- `surface === 'web'` → `<WebApp />`
- `surface === 'practitioner'` → `<PractitionerApp />`
- `surface === 'patient'` → `<PatientApp />`

### Building APKs
```bash
npm run android:apks           # builds both
bash scripts/build-apks.sh patient       # just patient
bash scripts/build-apks.sh practitioner  # just practitioner
```
Output: `dist-apk/sneham-patient.apk` and `dist-apk/sneham-practitioner.apk`

The build script swaps applicationId, label, and icon background per surface. Uses JAVA_HOME at `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

### Dev Server
```bash
cd "/Users/chaitanyavora/Sneham Digital Clinic" && npm run dev
```
Runs on port 5178 (configured in `.claude/launch.json` as "sneham").

## File Map (key files with line counts)

| File | Lines | Purpose |
|------|-------|---------|
| `src/practitioner/PractitionerApp.tsx` | 1037 | Practitioner shell, tabs, overlays, InboxScreen, ChatOverlay, QuickRx |
| `src/patient/PatientApp.tsx` | 1656 | Patient shell, all patient screens (Home, Doses, Prescriptions, Profile, Messages) |
| `src/web/WebApp.tsx` | 1782 | Web desktop app — dashboard, patients, schedule, reports |
| `src/core/store.ts` | 798 | Zustand store — all state + actions |
| `src/core/db.ts` | 906 | Supabase CRUD + hydrateAll |
| `src/core/seed.ts` | 392 | Demo seed data |
| `src/core/types.ts` | 238 | All type definitions |
| `src/components/ChatThread.tsx` | 107 | WhatsApp-style chat bubbles (shared by both apps) |
| `src/components/CaseFields.tsx` | ~400 | Case sheet form fields |
| `src/practitioner/TodayGrid.tsx` | ~350 | Today tab grid/list views |
| `src/practitioner/Calendar.tsx` | ~350 | Calendar tab |
| `src/practitioner/MobileCaseSheet.tsx` | ~300 | Case sheet overlay |
| `src/practitioner/MobileFollowUp.tsx` | ~250 | Follow-up review overlay |
| `src/practitioner/PatientSearch.tsx` | ~500 | Patient search, detail, add patient |
| `src/video/VideoConsult.tsx` | ~200 | Jitsi video wrapper |
| `src/design-system/ui.tsx` | ~400 | Shared UI primitives (Avatar, Badge, Card, Chip, etc.) |
| `src/design-system/motion.ts` | 36 | Animation variants (lightweight opacity fades) |

## Design System

### Brand Colors
- Brand green: `#41603C` (practitioner darker), `#5A7C4E` gradient
- Background: `#EFEDE4` (warm cream), `#F8F7F2` (screen)
- Surface: `#FFFFFF`
- Ink: `#1C1917`
- Muted: `#78716C`
- Faint: `#A8A29E`
- Danger: `#DC2626`
- Amber: `#D97706`

### Design Principles
- Reference: Scribe.com, Wispr Flow — premium, minimal, calm
- Font: System font stack (no external fonts in app)
- Border radius: 20px cards, 14px inputs, pill buttons
- Shadows: `shadow-card` (subtle), `shadow-float` (elevated)
- Animations: Lightweight opacity fades only (spring physics removed for performance)
- Tips/warnings: ONLY for irreversible errors. No over-engineering.

## What's Been Completed

All 40 major tasks completed across sessions:
1. Full Supabase database + auth integration
2. Jitsi video consult (web + practitioner)
3. All three surfaces (web, practitioner APK, patient APK)
4. Role-based access, assignment console, permissions
5. Reports/analytics dashboard
6. Capacitor Android builds
7. Case templates (Acute, Pediatric, First Visit)
8. Visit-versioned case notes
9. Billing — consultation fees + payment tracking
10. Scheduling — working hours + slot management
11. Patient self-booking
12. Document upload with Supabase storage
13. New user onboarding flow
14. Patient-doctor messaging (WhatsApp-style UI)
15. Walk-in queue management
16. PDF prescription export
17. Voice recorder
18. 200+ remedy database
19. Daily dose reminder reset

## WhatsApp-Style Messaging (latest change)

### Practitioner App (PractitionerApp.tsx)
- Inbox tab has Chats/Alerts toggle
- Chats view: conversation list grouped by patient, sorted by latest message
- Each row: 50px avatar, name + time, message preview + unread badge
- Tapping a conversation opens `ChatOverlay` — full-screen with green header bar
- Alerts view: notification cards (handoffs, bookings, etc.)

### ChatThread Component (src/components/ChatThread.tsx)
- Patterned background (subtle SVG dots like WhatsApp wallpaper)
- Sent messages: light green `#d9f4d4`, rounded-tr-[2px]
- Received messages: white surface, rounded-tl-[2px]
- Blue double-tick read receipts (`#53bdeb`) using Checks icon
- Rounded pill composer with "Message" placeholder
- Circular green send button (42x42)

### Patient App (PatientApp.tsx)
- Messages screen has WhatsApp-style green header with doctor name + initials avatar

## Performance Fixes Applied
- Tab transitions: changed from spring x-translations to instant opacity crossfade (`duration: 0.15`)
- List animations: removed y-transform, opacity only (`duration: 0.15`)
- File: `src/design-system/motion.ts`

---

## Bug Backlog (reconciled 2026-09-19)

This section used to list 39 "critical bugs" from a one-time early audit and was never updated as fixes landed — it sat stale for long enough that most of it stopped being true. Every item was re-checked directly against the current code (not against its own old description) and this section now reflects reality. Keep it that way: update an item here the same day it's actually fixed, don't let it drift again.

**Fixed — 37 of the original 39.** All 9 Priority-1 "Demo Breaker" bugs, all 12 Priority-2 "High Severity" bugs, and all 12 Priority-3 "Medium Severity" bugs are gone, confirmed by reading the current code, not by assumption. 4 of the original 6 Priority-4 "Low/Design" items are also fixed (dead `TodayScreen` code removed; generic "Welcome back" replaced with a real time-of-day + name greeting; the invisible-button stray-tap issue on the calendar grid resolved; contrast on the `faint` text token fixed this session — see below).

### Still genuinely open

**Type scale defined but unused.** `tailwind.config.js` has a real named scale (`hero`/`h1`/`h2`/`h3`/`paragraph`/`small`/`label`/`micro`), but nothing in `src/` actually uses it — zero hits for `text-hero`, `text-h1`, etc. One-off `text-[Npx]` sizes are used throughout instead. (1.5.0 set a floor — nothing below 11px, read text 12px on the phone — but did not migrate to the named scale.) A real, product-wide pass, not a one-liner.

**Tap targets (done in 1.5.0 for the phone apps).** Measured with a DOM audit that includes the invisible `tap-pad*` ring: the five practitioner tabs, the new profile / prescription editor / calendar, the case sheet, invoice sheet and the patient app tabs have no control under 44px. Shared `Chip`, `Toggle`, `Stepper`, `Button` md now carry the hit area. Inside horizontally-scrolling rows an invisible ring would be clipped, so those controls are physically 44px tall. The web console (desktop) was not part of this pass.

### Fixed this session
- `faint` text color contrast raised from ~2.9:1 to ~4.5:1 against the app's own backgrounds (was failing WCAG AA) — `tailwind.config.js`.

---

## Build Instructions

### Prerequisites
- Node.js 18+, npm
- Java 21 (OpenJDK at `/opt/homebrew/opt/openjdk@21`)
- Android SDK at `~/Library/Android/sdk`
- Gradle (via Android project)

### Development
```bash
cd "/Users/chaitanyavora/Sneham Digital Clinic"
npm install
npm run dev    # starts Vite dev server on port 5178
```

### Production APKs
```bash
npm run android:apks   # builds both patient + practitioner APKs
```

### Environment
`.env` file in project root contains:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_ANTHROPIC_API_KEY` — if needed for any AI features


---

## 1.5.0 — what changed (2026-10-08)

- **Follow-ups recall queue** (`src/practitioner/FollowUpsScreen.tsx`, web: `src/web/FollowUpQueue.tsx`): who is due comes from the prescribed course (`src/core/course.ts`, tested by `scripts/test-course.mjs`), booking is one tap with Undo (`src/core/useFollowUpBooking.ts`). The dashboard "Needs attention", the Patients "Follow-ups due" tab and the phone header all use the same definition (`isDue`).
- **Patient profile** (`src/practitioner/PatientProfile.tsx` + `profile/*`): ring = course progress, one "Next step" card (`core/nextStep.ts`), dock, snapshot, and a Journey grouped by remedy course with a response strip (`core/journey.ts#buildEpisodes`, `profile/EpisodeJourney.tsx`). Bills live only in the Billing tab.
- **Calendar** (`src/practitioner/Calendar.tsx`, `calendar/CalendarCanvas.tsx`, `calendar/Agenda.tsx`, `core/calendarGrid.ts`): week and month are one grid; the bar under each date is visits vs capacity (working hours from `practitionerSettings`, minus blocked time); weekly off-days are hatched.
- **Prescription privacy** ("don't reveal the remedy"): the doctor always records the real remedy; `Prescription.hideRemedy` + `slipLabel` (migration `supabase/migration_v49_prescription_privacy.sql`) decide what the PATIENT gets. One set of rules in `src/core/rxPrivacy.ts` (tested by `scripts/test-rx-privacy.mjs`) is used by the printed ℞ box, the dose line, WhatsApp/e-mail text, the notification, dose reminders and the patient app (`patientSafeRx`, `patientSafeDose`, `currentRemedyForPatient`, `remedyTextForPatient`). Hide is ON by default for every new prescription. The DB columns are only written when hiding, and the app probes for them (`store.rxPrivacySupported`); if they are missing the editor shows "Show" with a note and publishing a hidden Rx throws `RX_PRIVACY_UNAVAILABLE` instead of leaking the name. Old patient-app versions do not know the flag and will still show names until updated (OTA or new APK).
- **Phone prescription editor** is a full-screen overlay (`Overlay.kind === 'rx'`, `src/practitioner/QuickRx.tsx`); the Rx tab is only the patient picker.
- **Cancelling an appointment tells the patient** (`store.cancelAppointment`); Undo withdraws the notice. Reversible actions use Undo toasts; cancel appointment / remove team member use the in-app `confirmDialog` (`design-system/confirm.tsx`) instead of `window.confirm`.
- **Web dashboard**: four tiles + "Needs attention" (follow-ups to book, refill reminders, unread messages, payments due), schedule rows use `design-system/PopoverMenu`.
- **Sign-in / sign-up / reset / first-run** share `src/auth/AuthKit.tsx` (welcome band, inline errors, password strength, no dead buttons; copy follows the app: patient vs practitioner). The sign-up form no longer asks to confirm the password (show/hide eye instead). No pre-selected sex, city stays empty if left empty.
- **Refill reminder day is the doctor's choice** (`src/components/RefillReminder.tsx`, `core/day.ts` `restockDaysOf`/`isRestockDue`, `core/restockChoice.ts`): chips 14/21/30/45 + a stepper, remembers her last number on the device; stored per prescription in `restock_reminder_days` (NULL = the usual 21, only written when custom). Still stays 14 days after its day. Tested by `scripts/test-refill-and-private-visits.mjs`.
- **Private visits** (`src/components/ShowToPatient.tsx`, `core/visitPrivacy.ts`): the "Show to patient" toggle on the phone Book-appointment sheet, the web Add-appointment window and every follow-up picker (`FollowUpSheet`, `FollowUpPresetMenu`). Off = `Appointment.hiddenFromPatient` (`appointments.hidden_from_patient`): no notification, absent from every patient-app list (all four selectors go through `isVisibleToPatient`; slot availability still counts it as taken), doctor screens show a lock + "Only you". An already-shared visit can't be hidden later (toggle locked; cancel instead); a private one can be shared (patient notified on save). Both DB columns come from `supabase/migration_v50_refill_day_and_private_visits.sql`, are probed at hydrate (`store.restockDaysSupported`, `store.privateVisitsSupported`; a confirmed "yes" is cached for the session) and fail closed (`PRIVATE_VISITS_UNAVAILABLE`).
- Profile hero: a long name or address wraps to two lines instead of being cut off.
- Dev only: `window.__clinic` exposes the store in `npm run dev` (compiled out of builds) for browser tests.
