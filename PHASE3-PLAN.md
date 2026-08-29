# Sneham Digital Clinic — Phase 3 Plan

Priority: **Practitioner App > Practitioner Web > Patient App**

---

## 1. Practitioner's Day (the core use case)

A homeopathy practitioner's typical day at Sneham Digital Clinic:

### Morning (8:30 AM)
- Opens app → sees **today's schedule** at a glance
- Checks **overnight patient check-ins** (patients self-report before follow-ups)
- Reviews any **handoff notes** from covering practitioners
- Sees **3 new, 2 follow-ups, 1 video** on today's list

### During Consult (9:00 AM – 1:00 PM)
- **New patient**: Takes full case — chief complaint → history → modalities → personal → mental → particulars
- **Follow-up patient**: Pulls up comparison (initial vs today), reviews dose adherence + check-in, records outcome
- **Prescribes**: Picks remedy → potency → repetition → duration → preparation → publishes (patient gets it instantly)
- **Schedules next follow-up** before patient leaves
- Between patients: quick glance at who's waiting, mark no-show if needed

### Afternoon (2:00 PM – 5:00 PM)
- More consults (same flow)
- **Video consult**: joins from the app, same case sheet + prescribe flow
- **Assigns a complex case** to senior practitioner with notes
- **Blocks time** for lunch, admin, personal

### End of Day (5:30 PM)
- Reviews **today's numbers** — patients seen, revenue, outcomes
- Checks **overdue follow-ups** — who hasn't come back
- Plans **tomorrow's schedule** — any prep needed for complex cases

---

## 2. What's Built vs What's Missing

### Practitioner App (Mobile) — PRIORITY 1

**Built (working):**
- Today screen with stats (seen/left/due), current consult card, schedule list
- Case sheet (6-section chronic template, field editor, voice recorder, mark done)
- Quick Rx (remedy picker, potency, repetition, duration, dose, publish with cascade)
- Follow-up comparison (initial vs today table, outcome chips, handoff sheet)
- Inbox with handoff accept/decline
- Tab navigation with swipe, haptics, pull-to-refresh
- Block time bottom sheet
- Next patient advance after prescribing

**Missing (critical for "run your practice" quality):**

| Feature | Why it matters | Complexity |
|---------|---------------|------------|
| **Calendar view** (week/month) | Practitioners need to see their full schedule, not just today | Medium |
| **Add new patient** (from phone) | Walk-in arrives, practitioner needs to register on the spot | Medium |
| **Patient search** | "Pull up Kabir Nair's file" — instant access to any patient | Low |
| **Patient detail/history** | Full timeline: past consults, prescriptions, outcomes, documents | Medium |
| **Schedule follow-up** | After prescribing, schedule the next visit (date + time picker) | Medium |
| **Check-in review** | See what patient self-reported before the consult | Low |
| **Start/end consult** | Tap to start timer, auto-calculate consult duration | Low |
| **Mark no-show** | Patient didn't come — record it, offer to reschedule | Low |
| **Reschedule from schedule** | Move an appointment without leaving the schedule view | Low |
| **Patient dose adherence** | See "78% doses taken this cycle" before the consult | Low |
| **Remedy quick-search** | Search the master remedy list during consult | Low |

### Practitioner Web (Desktop) — PRIORITY 2

**Built (working):**
- Full sidebar nav with animated indicator, command palette (Cmd+K)
- Today dashboard with stats, schedule, appointment cards
- Patient list with filter chips (now functional), assignment badges
- Patient detail view with case sheet + prescription writer
- Case sheet with section rail, progress ring, voice recorder
- Follow-up comparison with outcome recording + handoff drawer
- Prescription writer with live preview, remedy/potency/repetition selection, publish
- Reports dashboard (revenue, patients, avg consult, follow-up rate, bar chart)
- Settings (clinic details, notification preferences, team management)
- New patient form (modal with full fields, adds to store)
- Notification panel with handoff accept
- Clinic location switcher
- Screen transitions, toast system

**Missing:**

| Feature | Why it matters | Complexity |
|---------|---------------|------------|
| **Calendar view** (day/week/month) | The web is where practitioners plan their week | High |
| **Patient timeline** | Horizontal timeline of all interactions with a patient | Medium |
| **Prescription templates** | Save and reuse common prescriptions (not just toast) | Medium |
| **Print prescription** | Generate a clean printable prescription layout | Medium |
| **Bulk actions** (real) | Multi-select patients for assignment, follow-up reminders | Medium |
| **Document upload/view** | Attach lab reports, photos to patient record | Medium |

### Patient App (Mobile) — PRIORITY 3

**Built (working):**
- Home with next appointment, quick actions, today's doses
- Prescriptions with full detail cards, PDF/Share buttons, dose toggle
- Dose reminders with progress ring, weekly adherence, snooze/skip
- Appointments with real data, booking flow (practitioner + type + slot)
- Profile with detail screens (personal, medical, notifications, privacy)
- Reschedule bottom sheet
- Notification panel
- Tab navigation with swipe, haptics, pull-to-refresh, push transitions

**Missing:**

| Feature | Why it matters | Complexity |
|---------|---------------|------------|
| **Check-in submission** | Patient fills how-am-I-doing form before follow-up | Medium |
| **Appointment history** | Past visits with outcomes, not just upcoming | Low |
| **Document viewer** | View prescriptions, lab reports as cards | Low |
| **Payment/invoice view** | See charges, payment history | Low-Med |

---

## 3. Phase 3 Implementation Plan

### Loop 1: Practitioner App — Calendar + Patient Management
**Goal:** Practitioner can manage their full schedule and find any patient instantly

1. **Calendar screen** — new tab replacing or supplementing Today
   - Week view: 7-day horizontal strip at top, day's schedule below
   - Month view: calendar grid with dot indicators for busy days
   - Tap any day → see that day's appointments
   - Swipe left/right to move weeks/months
   - Today button to jump back

2. **Patient search** — accessible from top bar
   - Search-as-you-type over patient name, WS code, remedy
   - Recent patients shown by default
   - Tap result → opens patient detail

3. **Patient detail screen** — pushed screen from search or schedule tap
   - Header: name, age, photo placeholder, current remedy badge
   - Tabs: Overview | History | Prescriptions | Documents
   - Overview: current status, dose adherence %, next appointment, last outcome
   - History: timeline of consults with date + outcome badge
   - Prescriptions: list of all prescriptions
   - Documents: uploaded files (placeholder for now)

4. **Add new patient** — FAB or header action
   - Bottom sheet: Name, Age, Sex, Phone, Chief complaint, Location
   - On submit → creates patient in store → opens their case sheet

### Loop 2: Practitioner App — Consult Flow Polish
**Goal:** Seamless flow from schedule → consult → prescribe → schedule follow-up

5. **Start/end consult** — on appointment card
   - "Start consult" button → changes status to "In consult", starts timer
   - Timer shows in header during consult
   - "End consult" → logs duration, prompts to prescribe or schedule follow-up

6. **Schedule follow-up** — after prescribing or from patient detail
   - Bottom sheet: "In 1 week", "In 2 weeks", "In 1 month", "Custom date"
   - Creates new appointment in store
   - Patient gets notification

7. **Check-in review card** — shown at top of follow-up screen
   - Already partially built (amber card with quote)
   - Enhance: show symptom ratings, adherence %, mood

8. **Mark no-show** — swipe action or long-press on schedule card
   - Confirms with bottom sheet
   - Updates appointment status
   - Offers "Reschedule?" option

9. **Dose adherence in consult** — visible in patient detail and follow-up
   - "78% doses taken" badge
   - Mini weekly chart (already built in patient app, reuse)

### Loop 3: Practitioner Web — Calendar + Patient Timeline
**Goal:** Web gets the full planning/management view

10. **Calendar view** — new screen in web sidebar
    - Day view (default): hour grid with appointment blocks
    - Week view: 7 columns, compact appointment blocks
    - Click appointment → opens patient detail
    - Click empty slot → create appointment

11. **Patient timeline** — in patient detail view
    - Horizontal or vertical timeline
    - Events: first visit, prescriptions, follow-ups, outcomes, check-ins
    - Click any event → expand details

12. **Print prescription** — from prescription writer
    - Clean print layout with clinic header, patient details, Rx, instructions
    - Uses window.print() with print-specific CSS

### Loop 4: Patient App — Check-in + History ✅ DONE
**Goal:** Patient can submit how-they're-doing and see their history

13. ✅ **Check-in form** — accessible from Home quick action
    - "How are you feeling?" — 5-option scale (Much better → Much worse) with smiley icons
    - 10 symptom chips (Sleeping better, Less anxious, More energy, etc.)
    - Free-text "Tell Dr. Tripathi how you've been feeling..."
    - Previous check-ins section with date + badge + chips
    - Submit → creates check-in in store → success screen with confirmation
    - Store action: submitCheckIn added

14. ✅ **Appointment history** — enhanced Visits tab
    - UPCOMING section (filters active statuses)
    - Book a visit button
    - PAST VISITS section with 3 historical visits
    - Each with date, time, practitioner, consult type (video icon), outcome badge, remedy

15. ✅ **Document viewer** — pushed screen from Home quick action
    - Lists prescription PDFs, lab reports, invoices
    - Each with kind-specific icon and color-coded badge
    - Document count footer
    - Tap to open (toast placeholder)

---

## 4. Experience Principles (carry through everything)

1. **Every tap must feel alive** — haptic + scale animation + state change
2. **No dead ends** — every screen has a clear next action
3. **Data flows across surfaces** — prescribe on web, patient sees it on phone
4. **Calm aesthetics, instant precision** — Calm warmth in look, Linear speed in feel
5. **Mobile-first for practitioners** — they're on their feet between patients
6. **Progressive disclosure** — simple surface, depth on demand
7. **Real-time feel** — optimistic updates, no loading spinners for local operations

---

## 5. Technical Notes

- All new features use the shared Zustand store — zero UI changes needed when Supabase arrives
- New store actions needed: `startConsult`, `endConsult`, `markNoShow`, `scheduleFollowUp`, `submitCheckIn`, `addPatient` (already exists)
- Calendar data derives from existing `appointments` array — no new data model needed
- Patient search is client-side filter over `patients` array
- Print uses `@media print` CSS — no library needed
- Keep bundle lean: no new dependencies

---

## 6. What's Already Done (reference)

- [x] Phase 1: Architecture, types, seed data, store, design system
- [x] Phase 2: All three surfaces built + experience system retrofit
- [x] PWA manifest + service worker + icons
- [x] 27 dead-end buttons wired (notifications, booking, reschedule, PDF, share, snooze, skip, profile details, reports dashboard, settings, filters, new patient form, block time, read note, next patient)
- [x] Command palette (Cmd+K), animated nav, screen transitions, CountUp stats
- [x] QR code for Android testing at http://10.95.219.232:5178/
