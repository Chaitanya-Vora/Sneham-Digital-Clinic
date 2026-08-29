import type { ISODate } from './day'

// ─────────────────────────────────────────────────────────────
// Sneham Digital Clinic — shared domain model
// One source of truth for all three surfaces (web / practitioner / patient).
// ─────────────────────────────────────────────────────────────

export type Role = 'Owner' | 'Practitioner' | 'Assistant' | 'Receptionist'

export type AssignmentState =
  | 'Mine'
  | 'Unassigned'
  | 'Covering'
  | 'Assigned to me'
  | 'Assigned out'
  | 'Walk-in queue'

export type Potency = '6C' | '12C' | '30C' | '200C' | '1M' | '10M' | 'Q'

export type Repetition =
  | 'Once daily · night'
  | 'Twice daily'
  | 'Alternate day'
  | 'Weekly'
  | 'As needed'

export type ConsultType = 'In person' | 'Video'

export type AppointmentStatus =
  | 'Upcoming'
  | 'In consult'
  | 'Waiting'
  | 'Seen'
  | 'New'
  | 'Unassigned'
  | 'Cancelled'

export type OutcomeKind =
  | 'Clear improvement'
  | 'Partial'
  | 'No change'
  | 'Aggravation'
  | 'Changed remedy'

export interface Practitioner {
  id: string
  authUserId?: string
  name: string
  initials: string
  role: Role
  specialty: string
  qualifications?: string
  registrationNo?: string
  openCases: number
  remedyList: string[] // personal list — the only source for Rx autocomplete
}

export interface Patient {
  id: string
  authUserId?: string
  wsCode: string
  name: string
  initials: string
  age: number
  sex: 'Female' | 'Male' | 'Other'
  location: string
  patientSince: string
  chiefComplaint: string
  currentRemedy: string | null
  lastSeen: string
  owningPractitionerId: string | null
  assignment: AssignmentState
  phone?: string
  allergies: string
  regularMedication: string
  lastOutcome?: string
}

export type PaymentStatus = 'unpaid' | 'paid' | 'waived'
export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank transfer' | 'Other'

export interface Appointment {
  id: string
  patientId: string
  practitionerId: string
  time: string // "10:30 AM"
  date: ISODate // "2026-08-23" — never a human label; see core/day.ts
  durationMin: number
  type: ConsultType
  status: AppointmentStatus
  tag?: string // e.g. "Nux Vomica 200C"
  reason?: string
  isFirstVisit?: boolean
  fee?: number
  paymentStatus?: PaymentStatus
  paymentMode?: PaymentMode
  paidAt?: string
}

export interface Prescription {
  id: string
  patientId: string
  practitionerId: string
  remedy: string
  potency: Potency
  doseGlobules: number
  repetition: Repetition
  durationDays: number | null // null = "until settled"
  preparation: string
  publishedAt: string // ISO
  sharedVia: string[] // WhatsApp / SMS / Email / Patient app
  remindersEnabled: boolean
  reminderTimes: string[] // ["8:00 AM", "8:00 PM"]
}

export interface DoseReminder {
  id: string
  prescriptionId: string
  patientId: string
  remedy: string
  potency: Potency
  time: string // "8:00 AM"
  slot: 'Morning' | 'Evening' | 'As needed'
  loggedToday: boolean
}

export interface CheckIn {
  id: string
  patientId: string
  prescriptionId: string
  improvementPct: number // 0-100
  changeChips: string[]
  freeText: string
  submittedAt: string
  marked: 'better' | 'same' | 'worse'
}

export interface Handoff {
  id: string
  patientId: string
  fromPractitionerId: string
  toPractitionerId: string
  coveringUntil: string
  note: {
    currentRemedy: string
    caseStatus: string
    reason: string
    watchFor: string
  }
  status: 'pending' | 'accepted' | 'declined'
  patientNotified: boolean
}

export interface Outcome {
  id: string
  patientId: string
  practitionerId: string
  date: string
  remedy: string
  outcome: OutcomeKind
  note: string
}

export interface ClinicDocument {
  id: string
  patientId: string
  name: string
  kind: 'Prescription' | 'Report' | 'Invoice'
  format: string
  size: string
  date: string
  uploadedBy: 'patient' | 'practitioner'
  fileUrl?: string
}

export interface CaseVisit {
  id: string
  patientId: string
  practitionerId: string
  appointmentId?: string
  date: string // ISO
  template: string
  sections: Record<string, unknown>
  remedy?: string
  outcome?: string
  editedAt?: string // ISO — set when a past visit's notes are amended after the fact
}

export type MessageSender = 'practitioner' | 'patient'

export interface ChatMessage {
  id: string
  patientId: string
  practitionerId: string
  sender: MessageSender
  text: string
  sentAt: string // ISO
  read: boolean
}

export type NotifKind =
  | 'prescription'
  | 'handoff'
  | 'booking'
  | 'overdue'
  | 'low_stock'
  | 'dose'
  | 'check-in'
  | 'intake'

export type Surface = 'web' | 'practitioner' | 'patient'

export interface AppNotification {
  id: string
  surface: Surface // which app it belongs to
  kind: NotifKind
  title: string
  message: string
  time: string
  read: boolean
  severity: 'info' | 'warn' | 'purple'
  pending?: boolean
  patientId?: string
}

export interface TimeBlock {
  id: string
  practitionerId: string
  date: ISODate
  startHour: number // 0-23
  durationMin: number
  reason: string // 'Lunch', 'Admin', 'Personal', etc.
}

export interface RemedyStock {
  name: string
  potency: Potency
  qty: number
  low: boolean
}
