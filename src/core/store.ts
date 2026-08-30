import { create } from 'zustand'
import { todayISO, formatDayLabel } from './day'
import { persist } from 'zustand/middleware'
import type {
  Appointment,
  CaseVisit,
  ChatMessage,
  CheckIn,
  ClinicDocument,
  DoseReminder,
  Handoff,
  AppNotification,
  MessageSender,
  Outcome,
  OutcomeKind,
  Patient,
  Potency,
  Practitioner,
  Prescription,
  RemedyStock,
  Repetition,
  Role,
  Surface,
  TimeBlock,
} from './types'
import { type CaseState, type CaseSectionDef, type CustomCaseTemplate, emptyCase } from './caseTemplate'
import { useToasts } from '../design-system/toast'
import {
  newId,
  hydrateAll,
  resetHydrateErrors,
  getHydrateErrors,
  insertPatient,
  updatePatient,
  linkPatientAuthUser,
  insertAppointment,
  updateAppointmentDb,
  insertPrescription,
  updatePrescriptionDb,
  insertDoseReminder,
  updateDoseReminderDb,
  insertCheckIn,
  insertHandoff,
  updateHandoffDb,
  insertOutcome,
  insertNotification,
  updateNotificationDb,
  deleteNotificationDb,
  markAllNotificationsRead,
  insertTimeBlock,
  deleteTimeBlockDb,
  updatePractitionerDb,
  upsertCaseData,
  insertCaseVisit,
  updateCaseVisitDb,
  insertMessage,
  markMessagesRead,
  insertCaseTemplate,
  updateCaseTemplateDb,
  deleteCaseTemplateDb,
} from './db'

const caseTimers = new Map<string, ReturnType<typeof setTimeout>>()
const caseVisitTimers = new Map<string, ReturnType<typeof setTimeout>>()

// A write that couldn't reach the database while offline, kept around to
// retry on reconnect. Deliberately just these two kinds — case notes and
// prescriptions are the two the offline guarantee is actually about; other
// writes still fire-and-report-error as before rather than growing this into
// a generic everything-queue.
export type PendingWrite =
  | { id: string; kind: 'caseData'; patientId: string; queuedAt: string }
  | { id: string; kind: 'prescription'; rx: Prescription; queuedAt: string }

export interface PublishRxInput {
  patientId: string
  practitionerId: string
  remedy: string
  potency: Potency
  doseGlobules: number
  repetition: Repetition
  durationDays: number | null
  preparation: string
  bodyText?: string
  remindersEnabled: boolean
  reminderTimes: string[]
  sharedVia: string[]
  origin: Surface
}

interface ClinicState {
  practitioners: Practitioner[]
  patients: Patient[]
  appointments: Appointment[]
  prescriptions: Prescription[]
  doseReminders: DoseReminder[]
  checkIns: CheckIn[]
  handoffs: Handoff[]
  documents: ClinicDocument[]
  remedyStock: RemedyStock[]
  notifications: AppNotification[]
  caseData: Record<string, CaseState>
  caseSaveStatus: Record<string, 'saving' | 'saved' | 'error' | 'queued'>
  outcomes: Outcome[]
  timeBlocks: TimeBlock[]
  caseVisits: CaseVisit[]
  messages: ChatMessage[]
  caseTemplates: CustomCaseTemplate[]
  pendingWrites: PendingWrite[]

  currentPractitionerId: string
  role: Role
  offline: boolean
  dbError: boolean
  hydrated: boolean
  hydrating: boolean
  userId: string | null
  lastDoseResetDate: string

  hydrate: (userId: string, userName: string) => Promise<void>
  setRole: (r: Role) => void
  setOffline: (v: boolean) => void
  retryPendingWrites: () => Promise<void>
  publishPrescription: (input: PublishRxInput) => Prescription
  toggleDoseLogged: (id: string) => void
  setRemindersEnabled: (prescriptionId: string, enabled: boolean) => void
  pushNotification: (n: Omit<AppNotification, 'id' | 'read'>) => void
  markNotificationRead: (id: string) => void
  dismissNotification: (id: string) => void
  markAllRead: (surface: Surface) => void
  acceptHandoff: (id: string) => void
  declineHandoff: (id: string) => void
  ensureCase: (patientId: string) => void
  setCaseField: (patientId: string, sectionId: string, key: string, value: string) => void
  toggleCaseChip: (patientId: string, sectionId: string, key: string, value: string, multi: boolean) => void
  markSectionDone: (patientId: string, sectionId: string, done: boolean) => void
  saveOutcome: (input: { patientId: string; practitionerId: string; remedy: string; outcome: OutcomeKind; note: string }) => void
  createHandoff: (input: { patientId: string; fromId: string; toId: string; coveringUntil: string; note: Handoff['note'] }) => void
  addPatient: (input: { name: string; age: number; sex: Patient['sex']; location: string; chiefComplaint: string; phone: string }) => Patient
  linkPatientIdentity: (patientId: string, userId: string) => void
  startConsult: (appointmentId: string) => void
  endConsult: (appointmentId: string) => void
  markNoShow: (appointmentId: string) => void
  scheduleFollowUp: (input: { patientId: string; practitionerId: string; time: string; date: string; type: 'In person' | 'Video'; reason: string }) => void
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void
  rescheduleAppointment: (id: string, time: string, date?: string) => void
  addTimeBlock: (input: Omit<TimeBlock, 'id'>) => void
  removeTimeBlock: (id: string) => void
  submitCheckIn: (input: { patientId: string; prescriptionId: string; marked: CheckIn['marked']; improvementPct: number; changeChips: string[]; freeText: string }) => void
  updatePractitioner: (id: string, patch: Partial<Practitioner>) => void
  assignPatient: (patientId: string, practitionerId: string) => void
  recordPayment: (appointmentId: string, fee: number, mode: Appointment['paymentMode'], status: Appointment['paymentStatus']) => void
  addDocument: (doc: ClinicDocument) => void
  snapshotCaseVisit: (patientId: string, appointmentId?: string, template?: string) => void
  updateCaseVisit: (id: string, patch: { sections?: Record<string, unknown>; remedy?: string; outcome?: string }) => void
  sendMessage: (patientId: string, text: string, sender: MessageSender) => void
  markConvoRead: (patientId: string, sender: MessageSender) => void
  createCaseTemplate: (input: { label: string; description: string; sections: CaseSectionDef[] }) => CustomCaseTemplate
  updateCaseTemplate: (id: string, patch: { label?: string; description?: string; sections?: CaseSectionDef[] }) => void
  deleteCaseTemplate: (id: string) => void
  resetDailyDoses: () => void
  resetDemo: () => void
}

const fmtSlot = (time: string): DoseReminder['slot'] => {
  const upper = time.toUpperCase()
  if (upper.includes('AM')) return 'Morning'
  if (upper.includes('PM')) return 'Evening'
  return 'As needed'
}

// Resolves who should actually receive a notification, by looking up the
// specific target patient's or practitioner's linked auth account — instead
// of guessing with whichever account happens to be performing the action.
// Returns null (best-effort broadcast) when the target hasn't linked an
// account yet, same safe fallback the app already used everywhere.
const resolveNotificationOwner = (
  patients: Patient[],
  practitioners: Practitioner[],
  target: { patientId?: string; practitionerId?: string | null },
): string | null => {
  if (target.patientId) {
    const p = patients.find((x) => x.id === target.patientId)
    if (p?.authUserId) return p.authUserId
  }
  if (target.practitionerId) {
    const pr = practitioners.find((x) => x.id === target.practitionerId)
    if (pr?.authUserId) return pr.authUserId
  }
  return null
}

// Every write below updates the UI instantly (optimistic) and saves in the
// background — but a failed save used to vanish silently, so a lost network
// connection looked identical to a successful one. This surfaces it as a
// toast without blocking the UI on the write. useToasts is itself a Zustand
// store, so it's reachable from here with no React plumbing needed.
function writeThrough(promise: Promise<boolean>, failureMessage: string) {
  void promise.then((ok) => {
    if (!ok) useToasts.getState().show({ title: 'Could not save', message: failureMessage })
  })
}

const emptyState = () => ({
  practitioners: [] as Practitioner[],
  patients: [] as Patient[],
  appointments: [] as Appointment[],
  prescriptions: [] as Prescription[],
  doseReminders: [] as DoseReminder[],
  checkIns: [] as CheckIn[],
  handoffs: [] as Handoff[],
  documents: [] as ClinicDocument[],
  remedyStock: [] as RemedyStock[],
  notifications: [] as AppNotification[],
  caseData: {} as Record<string, CaseState>,
  caseSaveStatus: {} as Record<string, 'saving' | 'saved' | 'error'>,
  outcomes: [] as Outcome[],
  timeBlocks: [] as TimeBlock[],
  caseVisits: [] as CaseVisit[],
  messages: [] as ChatMessage[],
  caseTemplates: [] as CustomCaseTemplate[],
  pendingWrites: [] as PendingWrite[],
  currentPractitionerId: '',
  role: 'Owner' as Role,
  offline: typeof navigator !== 'undefined' && 'onLine' in navigator ? !navigator.onLine : false,
  dbError: false,
  hydrated: false,
  hydrating: false,
  userId: null as string | null,
  lastDoseResetDate: '',
})

export const useClinic = create<ClinicState>()(
  persist(
    (set, get) => ({
      ...emptyState(),

      hydrate: async (userId, userName) => {
        if (get().hydrating) return
        set({ hydrating: true })
        try {
          resetHydrateErrors()
          const isPatientSurface = (import.meta.env.VITE_DEFAULT_SURFACE as string | undefined) === 'patient'
          const data = await hydrateAll(userId, userName, isPatientSurface)
          const fetchErrors = getHydrateErrors()

          if (fetchErrors > 0) {
            // One or more tables failed to load — keep whatever is already
            // in the store rather than replacing real clinic data with a
            // partial or empty fetch. Just surface the warning banner.
            set({ hydrated: true, hydrating: false, userId, dbError: true })
            return
          }

          const today = new Date().toDateString()
          const needsReset = get().lastDoseResetDate !== today
          set({
            ...data,
            doseReminders: needsReset
              ? data.doseReminders.map((d) => ({ ...d, loggedToday: false }))
              : data.doseReminders,
            hydrated: true,
            hydrating: false,
            userId,
            // Every login used to be treated as Owner regardless of who
            // actually signed in — the real per-practitioner role from the
            // database was fetched but never read.
            role: data.practitioners.find((p) => p.id === data.currentPractitionerId)?.role ?? 'Owner',
            offline: false,
            dbError: false,
            lastDoseResetDate: today,
          })
          if (needsReset) {
            for (const d of data.doseReminders.filter((r) => r.loggedToday)) {
              void updateDoseReminderDb(d.id, { logged_today: false })
            }
          }
          // A hydrate can only succeed with real connectivity — the moment
          // it does, flush anything queued from a previous offline session
          // (not just a live 'online' event, which a plain app reopen never fires).
          if (get().pendingWrites.length > 0) void get().retryPendingWrites()
        } catch (e) {
          console.error('Hydration failed:', e)
          set({
            hydrating: false,
            hydrated: true,
            offline: true,
          })
        }
      },

      setRole: (role) => set({ role }),
      setOffline: (offline) => set({ offline }),

      // Replays every queued write in order, dropping each one only once it
      // actually reaches the database. Safe to call repeatedly — an empty
      // queue is a no-op, and a write still offline just stays queued.
      retryPendingWrites: async () => {
        for (const w of get().pendingWrites) {
          if (w.kind === 'caseData') {
            const cs = get().caseData[w.patientId]
            if (!cs) { set((s) => ({ pendingWrites: s.pendingWrites.filter((p) => p.id !== w.id) })); continue }
            const ok = await upsertCaseData(w.patientId, cs)
            if (ok) {
              set((s) => ({
                pendingWrites: s.pendingWrites.filter((p) => p.id !== w.id),
                caseSaveStatus: { ...s.caseSaveStatus, [w.patientId]: 'saved' },
              }))
            }
          } else {
            const ok = await insertPrescription(w.rx)
            if (ok) set((s) => ({ pendingWrites: s.pendingWrites.filter((p) => p.id !== w.id) }))
          }
        }
      },

      publishPrescription: (input) => {
        const rxId = newId()
        const publishedAt = new Date().toISOString()
        const rx: Prescription = {
          id: rxId,
          patientId: input.patientId,
          practitionerId: input.practitionerId,
          remedy: input.remedy,
          potency: input.potency,
          doseGlobules: input.doseGlobules,
          repetition: input.repetition,
          durationDays: input.durationDays,
          preparation: input.preparation,
          bodyText: input.bodyText,
          publishedAt,
          sharedVia: input.sharedVia,
          remindersEnabled: input.remindersEnabled,
          reminderTimes: input.reminderTimes,
        }

        const newReminders: DoseReminder[] = input.remindersEnabled
          ? input.reminderTimes.map((time) => ({
              id: newId(),
              prescriptionId: rxId,
              patientId: input.patientId,
              remedy: input.remedy,
              potency: input.potency,
              time,
              slot: fmtSlot(time),
              loggedToday: false,
            }))
          : []

        const doctor = get().practitioners.find((p) => p.id === input.practitionerId)
        const remedyLabel = `${input.remedy} ${input.potency}`

        const notif: AppNotification = {
          id: newId(),
          surface: 'patient' as Surface,
          kind: 'prescription' as const,
          title: 'New prescription',
          message: `${doctor?.name ?? 'Your practitioner'} prescribed ${remedyLabel}. ${
            input.remindersEnabled ? 'Dose reminders are on.' : ''
          }`.trim(),
          time: 'Just now',
          read: false,
          severity: 'info' as const,
        }

        set((s) => ({
          prescriptions: [rx, ...s.prescriptions],
          doseReminders: [...newReminders, ...s.doseReminders],
          patients: s.patients.map((p) =>
            p.id === input.patientId ? { ...p, currentRemedy: remedyLabel } : p,
          ),
          notifications: [notif, ...s.notifications],
        }))

        if (get().offline) {
          set((s) => ({ pendingWrites: [...s.pendingWrites, { id: newId(), kind: 'prescription', rx, queuedAt: new Date().toISOString() }] }))
          useToasts.getState().show({ title: 'Saved — will send once back online', message: `${remedyLabel} is queued and will publish automatically as soon as you're reconnected.` })
        } else {
          writeThrough(insertPrescription(rx), 'Your prescription may not have saved.')
        }
        for (const dr of newReminders) void insertDoseReminder(dr)
        void updatePatient(input.patientId, { currentRemedy: remedyLabel })
        void insertNotification(notif, resolveNotificationOwner(get().patients, get().practitioners, { patientId: input.patientId }))

        return rx
      },

      toggleDoseLogged: (id) => {
        const dr = get().doseReminders.find((d) => d.id === id)
        if (!dr) return
        const next = !dr.loggedToday
        set((s) => ({
          doseReminders: s.doseReminders.map((d) =>
            d.id === id ? { ...d, loggedToday: next } : d,
          ),
        }))
        writeThrough(updateDoseReminderDb(id, { logged_today: next }), 'Dose log may not have saved.')
      },

      setRemindersEnabled: (prescriptionId, enabled) => {
        set((s) => ({
          prescriptions: s.prescriptions.map((r) =>
            r.id === prescriptionId ? { ...r, remindersEnabled: enabled } : r,
          ),
        }))
        writeThrough(updatePrescriptionDb(prescriptionId, { reminders_enabled: enabled }), 'Reminder setting may not have saved.')
      },

      pushNotification: (n) => {
        const notif: AppNotification = { ...n, id: newId(), read: false }
        set((s) => ({ notifications: [notif, ...s.notifications] }))
        void insertNotification(notif, resolveNotificationOwner(get().patients, get().practitioners, { patientId: notif.patientId }))
      },

      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }))
        void updateNotificationDb(id, { read: true })
      },

      dismissNotification: (id) => {
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
        void deleteNotificationDb(id)
      },

      markAllRead: (surface) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.surface === surface ? { ...n, read: true } : n,
          ),
        }))
        void markAllNotificationsRead(surface)
      },

      acceptHandoff: (id) => {
        set((s) => ({
          handoffs: s.handoffs.map((h) => (h.id === id ? { ...h, status: 'accepted' } : h)),
          notifications: s.notifications.map((n) =>
            n.kind === 'handoff' && n.pending ? { ...n, pending: false, read: true } : n,
          ),
        }))
        writeThrough(updateHandoffDb(id, { status: 'accepted' }), 'Your response may not have saved.')
      },

      declineHandoff: (id) => {
        set((s) => ({
          handoffs: s.handoffs.map((h) => (h.id === id ? { ...h, status: 'declined' } : h)),
        }))
        writeThrough(updateHandoffDb(id, { status: 'declined' }), 'Your response may not have saved.')
      },

      ensureCase: (patientId) =>
        set((s) => (s.caseData[patientId] ? s : { caseData: { ...s.caseData, [patientId]: emptyCase() } })),

      setCaseField: (patientId, sectionId, key, value) => {
        set((s) => {
          const c = s.caseData[patientId] ?? emptyCase()
          const sec = c[sectionId] ?? { fields: {}, chips: {}, done: false }
          return {
            caseData: {
              ...s.caseData,
              [patientId]: { ...c, [sectionId]: { ...sec, fields: { ...sec.fields, [key]: value } } },
            },
            caseSaveStatus: { ...s.caseSaveStatus, [patientId]: 'saving' },
          }
        })
        const timer = caseTimers.get(patientId)
        if (timer) clearTimeout(timer)
        caseTimers.set(patientId, setTimeout(() => {
          const cs = get().caseData[patientId]
          if (cs) {
            if (get().offline) {
              set((s) => ({
                caseSaveStatus: { ...s.caseSaveStatus, [patientId]: 'queued' },
                pendingWrites: s.pendingWrites.some((w) => w.kind === 'caseData' && w.patientId === patientId)
                  ? s.pendingWrites
                  : [...s.pendingWrites, { id: newId(), kind: 'caseData', patientId, queuedAt: new Date().toISOString() }],
              }))
            } else {
              void upsertCaseData(patientId, cs).then((ok) => {
                set((s) => ({ caseSaveStatus: { ...s.caseSaveStatus, [patientId]: ok ? 'saved' : 'error' } }))
              })
            }
          }
          caseTimers.delete(patientId)
        }, 1000))
      },

      toggleCaseChip: (patientId, sectionId, key, value, multi) => {
        set((s) => {
          const c = s.caseData[patientId] ?? emptyCase()
          const sec = c[sectionId] ?? { fields: {}, chips: {}, done: false }
          const cur = sec.chips[key] ?? []
          const next = multi
            ? cur.includes(value)
              ? cur.filter((v) => v !== value)
              : [...cur, value]
            : cur.includes(value)
              ? []
              : [value]
          return {
            caseData: {
              ...s.caseData,
              [patientId]: { ...c, [sectionId]: { ...sec, chips: { ...sec.chips, [key]: next } } },
            },
            caseSaveStatus: { ...s.caseSaveStatus, [patientId]: 'saving' },
          }
        })
        const timer = caseTimers.get(patientId)
        if (timer) clearTimeout(timer)
        caseTimers.set(patientId, setTimeout(() => {
          const cs = get().caseData[patientId]
          if (cs) {
            if (get().offline) {
              set((s) => ({
                caseSaveStatus: { ...s.caseSaveStatus, [patientId]: 'queued' },
                pendingWrites: s.pendingWrites.some((w) => w.kind === 'caseData' && w.patientId === patientId)
                  ? s.pendingWrites
                  : [...s.pendingWrites, { id: newId(), kind: 'caseData', patientId, queuedAt: new Date().toISOString() }],
              }))
            } else {
              void upsertCaseData(patientId, cs).then((ok) => {
                set((s) => ({ caseSaveStatus: { ...s.caseSaveStatus, [patientId]: ok ? 'saved' : 'error' } }))
              })
            }
          }
          caseTimers.delete(patientId)
        }, 1000))
      },

      markSectionDone: (patientId, sectionId, done) => {
        set((s) => {
          const c = s.caseData[patientId] ?? emptyCase()
          const sec = c[sectionId] ?? { fields: {}, chips: {}, done: false }
          return {
            caseData: { ...s.caseData, [patientId]: { ...c, [sectionId]: { ...sec, done } } },
            caseSaveStatus: { ...s.caseSaveStatus, [patientId]: 'saving' },
          }
        })
        const cs = get().caseData[patientId]
        if (cs) {
          void upsertCaseData(patientId, cs).then((ok) => {
            set((s) => ({ caseSaveStatus: { ...s.caseSaveStatus, [patientId]: ok ? 'saved' : 'error' } }))
          })
        }
      },

      saveOutcome: (input) => {
        const outcome: Outcome = {
          id: newId(),
          patientId: input.patientId,
          practitionerId: input.practitionerId,
          date: new Date().toISOString(),
          remedy: input.remedy,
          outcome: input.outcome,
          note: input.note,
        }
        set((s) => ({
          outcomes: [outcome, ...s.outcomes],
          patients: s.patients.map((p) =>
            p.id === input.patientId ? { ...p, lastOutcome: input.outcome } : p,
          ),
        }))
        writeThrough(insertOutcome(outcome), 'Outcome may not have saved.')
        void updatePatient(input.patientId, { lastOutcome: input.outcome })
      },

      createHandoff: (input) => {
        const to = get().practitioners.find((p) => p.id === input.toId)
        const patient = get().patients.find((p) => p.id === input.patientId)
        const handoff: Handoff = {
          id: newId(),
          patientId: input.patientId,
          fromPractitionerId: input.fromId,
          toPractitionerId: input.toId,
          coveringUntil: input.coveringUntil,
          note: input.note,
          status: 'pending',
          patientNotified: true,
        }
        const webNotif: AppNotification = {
          id: newId(),
          surface: 'web' as Surface,
          kind: 'handoff' as const,
          title: `Handoff sent — ${patient?.name ?? 'patient'}`,
          message: `${to?.name ?? 'A colleague'} is covering until ${input.coveringUntil}.`,
          time: 'Just now',
          read: false,
          severity: 'purple' as const,
          patientId: input.patientId,
        }
        const patientNotif: AppNotification = {
          id: newId(),
          surface: 'patient' as Surface,
          kind: 'handoff' as const,
          title: 'A colleague is covering your next visit',
          message: `${to?.name ?? 'Another practitioner'} will see you — they have your full case.`,
          time: 'Just now',
          read: false,
          severity: 'purple' as const,
        }
        set((s) => ({
          handoffs: [handoff, ...s.handoffs],
          patients: s.patients.map((p) =>
            p.id === input.patientId ? { ...p, assignment: 'Assigned out' } : p,
          ),
          notifications: [webNotif, patientNotif, ...s.notifications],
        }))
        writeThrough(insertHandoff(handoff), 'Handoff may not have sent.')
        void updatePatient(input.patientId, { assignment: 'Assigned out' })
        const uid = get().userId
        if (uid) void insertNotification(webNotif, uid)
        void insertNotification(patientNotif, resolveNotificationOwner(get().patients, get().practitioners, { patientId: input.patientId }))
      },

      addPatient: (input) => {
        const id = newId()
        const initials = input.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        const wsCode = `#WS-${String(Math.floor(1000 + Math.random() * 9000))}`
        const patient: Patient = {
          id,
          wsCode,
          name: input.name,
          initials,
          age: input.age,
          sex: input.sex,
          location: input.location,
          patientSince: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
          chiefComplaint: input.chiefComplaint,
          currentRemedy: null,
          lastSeen: 'Today',
          phone: input.phone || undefined,
          owningPractitionerId: get().currentPractitionerId || null,
          assignment: 'Mine',
          allergies: '',
          regularMedication: '',
        }
        set((s) => ({ patients: [patient, ...s.patients] }))
        writeThrough(insertPatient(patient), 'Patient may not have saved — check your connection.')
        return patient
      },

      linkPatientIdentity: (patientId, userId) => {
        set((s) => ({
          patients: s.patients.map((p) => (p.id === patientId ? { ...p, authUserId: userId } : p)),
        }))
        writeThrough(linkPatientAuthUser(patientId), 'Could not link your account — try again.')
      },

      startConsult: (appointmentId) => {
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === appointmentId ? { ...a, status: 'In consult' as const } : a,
          ),
        }))
        writeThrough(updateAppointmentDb(appointmentId, { status: 'In consult' }), 'Consult status may not have saved.')
      },

      endConsult: (appointmentId) => {
        const appt = get().appointments.find((a) => a.id === appointmentId)
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === appointmentId ? { ...a, status: 'Seen' as const } : a,
          ),
        }))
        writeThrough(updateAppointmentDb(appointmentId, { status: 'Seen' }), 'Consult status may not have saved.')
        if (appt) get().snapshotCaseVisit(appt.patientId, appointmentId)
      },

      markNoShow: (appointmentId) => {
        const appt = get().appointments.find((a) => a.id === appointmentId)
        const notif: AppNotification = {
          id: newId(),
          surface: 'web' as Surface,
          kind: 'booking' as const,
          title: 'No-show recorded',
          message: `${get().patients.find((p) => p.id === appt?.patientId)?.name ?? 'Patient'} did not attend their ${appt?.time ?? ''} appointment.`,
          time: 'Just now',
          read: false,
          severity: 'warn' as const,
          patientId: appt?.patientId,
        }
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === appointmentId ? { ...a, status: 'Seen' as const } : a,
          ),
          notifications: appt ? [notif, ...s.notifications] : s.notifications,
        }))
        writeThrough(updateAppointmentDb(appointmentId, { status: 'Seen' }), 'No-show may not have saved.')
        if (appt) {
          const uid = get().userId
          if (uid) void insertNotification(notif, uid)
        }
      },

      scheduleFollowUp: (input) => {
        const appt: Appointment = {
          id: newId(),
          patientId: input.patientId,
          practitionerId: input.practitionerId,
          time: input.time,
          date: input.date,
          durationMin: 30,
          type: input.type,
          status: 'Upcoming',
          reason: input.reason,
        }
        const notif: AppNotification = {
          id: newId(),
          surface: 'patient' as Surface,
          kind: 'booking' as const,
          title: 'Follow-up scheduled',
          message: `Your next visit is ${formatDayLabel(input.date)} at ${input.time} with ${get().practitioners.find((p) => p.id === input.practitionerId)?.name ?? 'your practitioner'}.`,
          time: 'Just now',
          read: false,
          severity: 'info' as const,
        }
        set((s) => ({
          appointments: [appt, ...s.appointments],
          notifications: [notif, ...s.notifications],
        }))
        writeThrough(insertAppointment(appt), 'Appointment may not have saved.')
        void insertNotification(notif, resolveNotificationOwner(get().patients, get().practitioners, { patientId: input.patientId }))
      },

      updateAppointmentStatus: (id, status) => {
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)),
        }))
        writeThrough(updateAppointmentDb(id, { status }), 'Status change may not have saved.')
      },

      rescheduleAppointment: (id, time, date) => {
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, time, ...(date ? { date } : {}) } : a)),
        }))
        writeThrough(updateAppointmentDb(id, { time, ...(date ? { day_label: date } : {}) }), 'Reschedule may not have saved.')
      },

      addTimeBlock: (input) => {
        const block: TimeBlock = { ...input, id: newId() }
        set((s) => ({ timeBlocks: [...s.timeBlocks, block] }))
        writeThrough(insertTimeBlock(block), 'Blocked time may not have saved.')
      },

      removeTimeBlock: (id) => {
        set((s) => ({ timeBlocks: s.timeBlocks.filter((b) => b.id !== id) }))
        writeThrough(deleteTimeBlockDb(id), 'Removing the block may not have saved.')
      },

      submitCheckIn: (input) => {
        const checkIn: CheckIn = {
          id: newId(),
          patientId: input.patientId,
          prescriptionId: input.prescriptionId,
          improvementPct: input.improvementPct,
          changeChips: input.changeChips,
          freeText: input.freeText,
          submittedAt: new Date().toISOString(),
          marked: input.marked,
        }
        const patient = get().patients.find((p) => p.id === input.patientId)
        const label = input.marked === 'better' ? 'feeling better' : input.marked === 'worse' ? 'feeling worse' : 'no change'
        const notif: AppNotification = {
          id: newId(),
          surface: 'web' as Surface,
          kind: 'check-in' as const,
          title: `Check-in: ${patient?.name ?? 'Patient'}`,
          message: `${patient?.name ?? 'A patient'} reported ${label}.${input.freeText ? ` "${input.freeText}"` : ''}`,
          time: 'Just now',
          read: false,
          severity: input.marked === 'worse' ? 'warn' as const : 'info' as const,
          patientId: input.patientId,
        }
        const practNotif: AppNotification = {
          id: newId(),
          surface: 'practitioner' as Surface,
          kind: 'check-in' as const,
          title: `${patient?.name ?? 'Patient'} checked in`,
          message: `Reported ${label}`,
          time: 'Just now',
          read: false,
          severity: input.marked === 'worse' ? 'warn' as const : 'info' as const,
          patientId: input.patientId,
        }
        set((s) => ({
          checkIns: [...s.checkIns, checkIn],
          notifications: [notif, practNotif, ...s.notifications],
        }))
        writeThrough(insertCheckIn(checkIn), 'Check-in may not have saved.')
        const owner = resolveNotificationOwner(get().patients, get().practitioners, { practitionerId: patient?.owningPractitionerId })
        void insertNotification(notif, owner)
        void insertNotification(practNotif, owner)
      },

      updatePractitioner: (id, patch) => {
        set((s) => ({
          practitioners: s.practitioners.map((p) => {
            if (p.id !== id) return p
            const updated = { ...p, ...patch }
            if (patch.name) {
              const words = patch.name.replace(/^Dr\.?\s*/i, '').split(' ').filter(Boolean)
              updated.initials = words.map(w => w[0]).join('').toUpperCase().slice(0, 2)
            }
            return updated
          }),
        }))
        writeThrough(updatePractitionerDb(id, patch), 'Profile changes may not have saved.')
      },

      assignPatient: (patientId, practitionerId) => {
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId ? { ...p, owningPractitionerId: practitionerId, assignment: 'Assigned to me' as const } : p,
          ),
        }))
        writeThrough(updatePatient(patientId, { owningPractitionerId: practitionerId, assignment: 'Assigned to me' }), 'Assignment may not have saved.')
      },

      addDocument: (doc) => {
        set((s) => ({ documents: [doc, ...s.documents] }))
      },

      snapshotCaseVisit: (patientId, appointmentId, template) => {
        const cs = get().caseData[patientId]
        if (!cs) return
        const hasContent = Object.values(cs).some(
          (sec) => Object.values(sec.fields).some((v) => v?.trim()) || Object.values(sec.chips).some((arr) => arr.length),
        )
        if (!hasContent) return
        const patient = get().patients.find((p) => p.id === patientId)
        const visit: CaseVisit = {
          id: newId(),
          patientId,
          practitionerId: get().currentPractitionerId,
          appointmentId,
          date: new Date().toISOString(),
          template: template ?? 'chronic',
          sections: JSON.parse(JSON.stringify(cs)),
          remedy: patient?.currentRemedy ?? undefined,
        }
        set((s) => ({ caseVisits: [visit, ...s.caseVisits] }))
        writeThrough(insertCaseVisit(visit), 'Visit snapshot may not have saved.')
      },

      updateCaseVisit: (id, patch) => {
        const editedAt = new Date().toISOString()
        set((s) => ({
          caseVisits: s.caseVisits.map((v) => (v.id === id ? { ...v, ...patch, editedAt } : v)),
        }))
        const timer = caseVisitTimers.get(id)
        if (timer) clearTimeout(timer)
        caseVisitTimers.set(id, setTimeout(() => {
          const visit = get().caseVisits.find((v) => v.id === id)
          if (visit) writeThrough(updateCaseVisitDb(id, { sections: visit.sections, remedy: visit.remedy, outcome: visit.outcome, editedAt: visit.editedAt! }), 'Changes to this past visit may not have saved.')
          caseVisitTimers.delete(id)
        }, 1000))
      },

      sendMessage: (patientId, text, sender) => {
        const msg: ChatMessage = {
          id: newId(),
          patientId,
          practitionerId: get().currentPractitionerId,
          sender,
          text,
          sentAt: new Date().toISOString(),
          read: false,
        }
        set((s) => ({ messages: [...s.messages, msg] }))
        writeThrough(insertMessage(msg), 'Message may not have sent.')
      },

      markConvoRead: (patientId, sender) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.patientId === patientId && m.sender === sender && !m.read ? { ...m, read: true } : m,
          ),
        }))
        void markMessagesRead(patientId, sender)
      },

      createCaseTemplate: (input) => {
        const t: CustomCaseTemplate = {
          id: newId(),
          label: input.label,
          description: input.description,
          sections: input.sections,
          createdBy: get().currentPractitionerId || null,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ caseTemplates: [...s.caseTemplates, t] }))
        writeThrough(insertCaseTemplate(t), 'Template may not have saved.')
        return t
      },

      updateCaseTemplate: (id, patch) => {
        set((s) => ({
          caseTemplates: s.caseTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }))
        writeThrough(updateCaseTemplateDb(id, patch), 'Template changes may not have saved.')
      },

      deleteCaseTemplate: (id) => {
        set((s) => ({ caseTemplates: s.caseTemplates.filter((t) => t.id !== id) }))
        writeThrough(deleteCaseTemplateDb(id), 'Template deletion may not have saved.')
      },

      recordPayment: (appointmentId, fee, mode, status) => {
        const paidAt = status === 'paid' ? new Date().toISOString() : undefined
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === appointmentId ? { ...a, fee, paymentMode: mode, paymentStatus: status, paidAt } : a,
          ),
        }))
        writeThrough(
          updateAppointmentDb(appointmentId, { fee, payment_mode: mode, payment_status: status, paid_at: paidAt ?? null }),
          'Payment record may not have saved.',
        )
      },

      resetDailyDoses: () => {
        const today = new Date().toDateString()
        if (get().lastDoseResetDate === today) return
        const toReset = get().doseReminders.filter((d) => d.loggedToday)
        set((s) => ({
          doseReminders: s.doseReminders.map((d) => ({ ...d, loggedToday: false })),
          lastDoseResetDate: today,
        }))
        for (const d of toReset) {
          void updateDoseReminderDb(d.id, { logged_today: false })
        }
      },

      resetDemo: () => set({ ...emptyState(), hydrated: false }),
    }),
    {
      name: 'sneham-clinic-v1',
      version: 4,
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { hydrating, caseSaveStatus, ...rest } = state
        return rest
      },
      migrate: (_persisted: unknown, from: number) => (from < 4 ? emptyState() : _persisted) as ClinicState,
    },
  ),
)

// Real connectivity, not just "did the last hydrate succeed" — reconnecting
// also drains anything queued while offline (case notes, prescriptions).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useClinic.getState().setOffline(false)
    void useClinic.getState().retryPendingWrites()
  })
  window.addEventListener('offline', () => useClinic.getState().setOffline(true))
}

// ── selectors ──
export const selPatient = (id: string) => (s: ClinicState) =>
  s.patients.find((p) => p.id === id)

export const selPrescriptionsFor = (patientId: string) => (s: ClinicState) =>
  s.prescriptions.filter((r) => r.patientId === patientId)

export const selDosesFor = (patientId: string) => (s: ClinicState) =>
  s.doseReminders.filter((d) => d.patientId === patientId)

export const selNotifications = (surface: Surface) => (s: ClinicState) =>
  s.notifications.filter((n) => n.surface === surface)
