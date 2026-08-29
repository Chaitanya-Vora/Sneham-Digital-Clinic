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

## CRITICAL BUGS TO FIX (audit findings, prioritized)

### Priority 1 — Demo Breakers (9 bugs)

**Bug 1: No realtime sync — messages/prescriptions never reach other phone**
- File: `src/core/store.ts`
- Problem: `hydrate()` is the only read path. Called at login + manual pull-to-refresh. No Supabase realtime subscriptions, no polling.
- Fix: Add Supabase realtime subscription on key tables (messages, prescriptions, appointments) OR add 5-second polling interval in store.ts.

**Bug 2: Patient app picks wrong patient as "me" — it's patients[0]**
- File: `src/patient/PatientApp.tsx` lines 75, 619-620, 1134-1135
- Problem: `useClinic(s => s.patients[0])` — the most recently created patient. Adding a new patient from practitioner app hijacks identity.
- Fix: Match logged-in user's auth ID to patient row. Store a `patientId` mapping in db.ts.

**Bug 3: Patient signup creates a fake practitioner**
- File: `src/core/db.ts` — `ensurePractitioner()` called in `hydrateAll()` line 849
- Problem: Every user (including patients) goes through `ensurePractitioner()` which creates a practitioner record.
- Fix: Gate practitioner creation on surface or role. Only create when `VITE_DEFAULT_SURFACE === 'practitioner'` or `'web'`.

**Bug 4: Cross-surface notifications never delivered**
- File: `src/core/db.ts` and `src/core/store.ts`
- Problem: Notifications are stamped with sender's user_id. `fetchNotifications(userId)` filters by the logged-in user's ID, so patient never sees practitioner's notifications and vice versa.
- Fix: Write notifications under the recipient's user_id, not the sender's.

**Bug 5: "Prescribe" always lands on wrong patient**
- File: `src/practitioner/PractitionerApp.tsx` — QuickRxScreen has no patientId prop
- Problem: Navigating from case sheet → Prescribe loses patient context. The Rx screen doesn't know which patient.
- Fix: Thread `patientId` into QuickRxScreen. Store selected patient in the tab navigation.

**Bug 6: QuickRxScreen pre-filled with invented prescription**
- File: `src/practitioner/PractitionerApp.tsx` — QuickRxScreen component
- Problem: Remedy, potency, dose pre-selected on arrival. Publish button enabled immediately. One tap sends an invented prescription.
- Fix: Start with empty/null fields. Disable Publish until remedy + patient selected.

**Bug 7: Today tab shows ALL appointments, not just today**
- File: `src/practitioner/TodayGrid.tsx`
- Problem: No date filter. Past and future appointments all render.
- Fix: Filter `appointments.filter(a => a.date === todayISO())` before rendering.

**Bug 8: Calendar shows wrong day (UTC date shift)**
- File: `src/practitioner/Calendar.tsx`
- Problem: Date construction uses UTC methods, causing off-by-one when tapping calendar days.
- Fix: Use `toISO()` helper from `src/core/day.ts` consistently for local date construction.

**Bug 9: Empty DB wipes demo data on first pull-to-refresh**
- File: `src/core/seed.ts` and `src/core/store.ts` hydrate action
- Problem: Supabase DB is empty. `hydrate()` pulls empty arrays and overwrites seed data. All demo content vanishes.
- Fix: Either (a) seed Supabase DB with demo data, or (b) merge hydrated data with seed data instead of replacing, or (c) skip overwrite when DB returns empty.

### Priority 2 — High Severity (12 bugs)

**Bug 10: No way to register a patient — AddPatientSheet never opens**
- File: `src/practitioner/PractitionerApp.tsx` — `addPatientOpen` state exists but nothing sets it true
- Fix: Add a "+" button to patient search or today screen.

**Bug 11: Signup dead-ends — email confirmation can't return to APK**
- File: `src/auth/AuthProvider.tsx`
- Fix: Use Capacitor deep links for email confirmation redirect.

**Bug 12: Jitsi joins room TWICE — audio howl**
- File: `src/video/VideoConsult.tsx`
- Fix: Guard against double-mount with a ref or strict-mode-safe cleanup.

**Bug 13: Web "Join call" doesn't set In consult — patient Join stays dead**
- File: `src/web/WebApp.tsx`
- Fix: Call `startConsult(appointmentId)` when joining from web.

**Bug 14: "Switch experience" button visible on patient APK**
- File: `src/patient/PatientApp.tsx`
- Fix: Hide when `Capacitor.isNativePlatform()`.

**Bug 15: All writes are fire-and-forget — failures show success**
- File: `src/core/store.ts`
- Fix: Add try/catch with error toasts on key write paths.

**Bug 16: "Next appointment" on patient home is newest, not soonest**
- File: `src/patient/PatientApp.tsx`
- Fix: Sort by date ascending, filter to future dates.

**Bug 17: Share button broken on Android (Web Share API)**
- File: `src/patient/PatientApp.tsx`
- Fix: Use `@capacitor/share` (already a dependency) instead of `navigator.share`.

**Bug 18: Consult timer frozen after first consult**
- File: `src/practitioner/TodayGrid.tsx`
- Fix: Null the interval ref in stopTimer, add unmount cleanup.

**Bug 19: Grid view tapping patient does nothing**
- File: `src/practitioner/TodayGrid.tsx`
- Fix: Wire `openCase` and `markNoShow` callbacks to grid card onClick.

**Bug 20: Check-in badge hardcodes "better"**
- File: `src/practitioner/MobileFollowUp.tsx` line 66
- Fix: Use `checkIn.marked` instead of the string literal.

**Bug 21: disabled:opacity-40 makes CTAs dead on arrival (3+ screens)**
- File: `src/design-system/ui.tsx` — Button base, also `src/auth/SignupScreen.tsx`, `src/auth/ForgotPasswordScreen.tsx`
- Fix: Remove default disabled state or use a less aggressive opacity.

### Priority 3 — Medium Severity (12 bugs)

**Bug 22:** PDF export shows "failed" on share cancel (`src/patient/PatientApp.tsx`)
**Bug 23:** "Export my data" dead on Android (`src/patient/PatientApp.tsx`)
**Bug 24:** Voice note "Attached" is a lie — recording thrown away (`src/practitioner/MobileCaseSheet.tsx`)
**Bug 25:** Case autosave fails silently (`src/components/CaseFields.tsx`)
**Bug 26:** Section progress hardcoded to 6 (`src/components/CaseFields.tsx`)
**Bug 27:** Check-in CTA disabled + pointer-events-none on arrival (`src/patient/PatientApp.tsx`)
**Bug 28:** Calendar fabricates appointments for non-today dates (`src/practitioner/Calendar.tsx`)
**Bug 29:** Booking uses hardcoded today + fake slots (`src/patient/PatientApp.tsx`)
**Bug 30:** Reschedule options are all no-ops (`src/patient/PatientApp.tsx`)
**Bug 31:** Mood picker invents precise improvement % (`src/patient/PatientApp.tsx`)
**Bug 32:** Register form: empty submit gives no feedback (`src/practitioner/PatientSearch.tsx`)
**Bug 33:** "Custom" follow-up books 1 week without date picker (`src/practitioner/PatientSearch.tsx`)

### Priority 4 — Low / Design (6 bugs)

**Bug 34:** Tap targets under 44px minimum (30+ controls)
**Bug 35:** Low contrast on faint text tokens (2.66:1 vs 4.5:1 AA)
**Bug 36:** 271 lines dead TodayScreen code in PractitionerApp.tsx
**Bug 37:** "Welcome back" generic text still in patient home
**Bug 38:** Grid background is invisible button (stray taps open Block time)
**Bug 39:** No type scale in tailwind.config.js (19 distinct sizes)

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
