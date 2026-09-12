import type { ISODate } from './day'

// ─────────────────────────────────────────────────────────────
// Sneham Digital Clinic — shared domain model
// One source of truth for all three surfaces (web / practitioner / patient).
// ─────────────────────────────────────────────────────────────

export type Role = 'Owner' | 'Practitioner' | 'Assistant' | 'Receptionist'

// Owner and Practitioner have never been restricted by any of these checks
// anywhere in the app — only Assistant/Receptionist are ever gated — so
// only those two roles have a real, editable row. See migration_v32.
export type EditableRole = 'Assistant' | 'Receptionist'
export interface RolePermissionSet {
  seeCaseNotes: boolean
  assignCases: boolean
  acceptHandoffs: boolean
}

// Saved preferences shown on Settings — none of these currently change app
// behavior (no auto-assign, shared-queue, or out-of-office-delegation
// mechanism exists yet). Persisted so the toggle state survives a reload
// instead of silently resetting; see migration_v33.
export interface AssignmentRules {
  autoAssignBookings: boolean
  walkInsSharedQueue: boolean
  outOfOfficeDelegation: boolean
}

export type AssignmentState =
  | 'Mine'
  | 'Unassigned'
  | 'Covering'
  | 'Assigned to me'
  | 'Assigned out'
  | 'Walk-in queue'

// A handful of common values are offered as quick-select chips (see
// POTENCIES in the prescription screens), but potency is free text — a
// homeopath's own notation (50M, CM, LM1, Q...) is wider than any fixed list.
export type Potency = string

export type Repetition =
  | 'Once daily · night'
  | 'Twice daily'
  | 'Alternate day'
  | 'Weekly'
  | 'As needed'
  | 'Once only today'

// Repetitions with no ongoing daily schedule — a single or occasional dose,
// not a multi-day course. Duration, day-count reminders, and auto-booked
// follow-ups don't apply to these — both are treated identically everywhere
// this used to only check for 'As needed'.
export function isOneOffRepetition(rep: Repetition): boolean {
  return rep === 'As needed' || rep === 'Once only today'
}

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

// 'pending' means signed up but not yet approved by the Owner — RLS denies
// them all patient-data access until they're 'active' (see
// migration_v19_practitioner_approval_gate.sql). The clinic's very first
// signup ever starts 'active' (no one exists yet to approve them);
// everyone after that starts 'pending'. 'inactive' is a practitioner who's
// left the clinic — deliberately a status flip, not a row delete, since
// their patients/appointments/prescriptions/case notes still reference
// them; RLS's own can_access_patient() already checks status === 'active',
// so flipping to 'inactive' removes their clinical access with no
// separate RLS change (see migration_v28_practitioner_inactive_status.sql).
export type PractitionerStatus = 'pending' | 'active' | 'inactive'

export interface Practitioner {
  id: string
  authUserId?: string
  name: string
  initials: string
  role: Role
  status: PractitionerStatus
  specialty: string
  qualifications?: string
  registrationNo?: string
  openCases: number
  remedyList: string[] // personal list — the only source for Rx autocomplete
  rxTemplates: RxTemplate[]
}

// A saved prescription preset — remedy, potency, dose etc. bundled so a
// common one (e.g. a standard cold remedy) publishes in one tap instead of
// re-entering every field each time.
export interface RxTemplate {
  id: string
  label: string
  remedy: string
  potency: string
  doseGlobules: number
  repetition: Repetition
  durationDays: number | null
  preparation: string
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
  // Soft-delete: an archived patient is hidden from active rosters/pickers
  // but never destroyed — mirrors Invoice.cancelledAt. null = active.
  archivedAt: string | null
  // How this patient found the clinic — optional and unset for every
  // patient added before this field existed; feeds the Reports referral chart.
  referralSource?: ReferralSource
}

export type ReferralSource = 'Offline' | 'Instagram' | 'References' | 'Referral'

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
}

// Billing lives entirely on its own — never required an appointment to
// exist (a phone-call quick bill has none), and cancelling one keeps the
// record (status: 'cancelled') rather than deleting it, so history and
// analytics stay auditable.
export type InvoiceStatus = 'unpaid' | 'paid' | 'partial' | 'waived' | 'cancelled'

export interface InvoiceLineItem {
  name: string
  qty: number
  unitPrice: number
}

export interface Invoice {
  id: string
  invoiceNo: number // DB-generated sequential — the real, human-facing number
  patientId: string
  practitionerId: string
  appointmentId?: string // optional — omitted for quick/phone bills
  date: ISODate
  items: InvoiceLineItem[]
  paymentMode: PaymentMode
  amountReceived: number
  status: InvoiceStatus
  notes?: string
  createdAt: string
  updatedAt: string
  cancelledAt?: string
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
  // What actually prints on the prescription slip — freeform, in the
  // doctor's own words/shorthand (homeopaths often avoid writing plain
  // remedy names so patients can't self-medicate). Falls back to the
  // structured fields above when absent, for prescriptions saved before
  // this existed. The structured fields still drive dose reminders and
  // reporting regardless of what's actually printed.
  bodyText?: string
  // A prescription is never hard-deleted — a mistaken one is cancelled
  // instead (status: 'cancelled'), same reasoning as Invoice: history
  // stays intact for the doctor even though it disappears from the
  // patient's own app. A draft exists (attached to the patient's file,
  // editable, re-openable) but hasn't been published yet — publishedAt
  // stays unset until the moment it actually is, and once set, is never
  // cleared again even if later cancelled.
  status: 'draft' | 'published' | 'cancelled'
  publishedAt?: string // ISO — set once, the moment status becomes 'published'
  createdAt: string // ISO — always set, at row creation (draft or immediate-publish)
  updatedAt: string // ISO — bumped on every save/publish/cancel transition
  cancelledAt?: string // ISO — set once, the moment status becomes 'cancelled'
  sharedVia: string[] // WhatsApp / SMS / Email / Patient app
  remindersEnabled: boolean
  reminderTimes: string[] // ["8:00 AM", "8:00 PM"]
}

// A set of investigations (lab tests / scans) the practitioner is asking
// the patient to get done — printed as a requisition slip, not filled by
// the patient in the app.
export interface InvestigationOrder {
  id: string
  patientId: string
  practitionerId: string
  tests: string[] // flat list of test names, e.g. ["CBC", "HbA1c"]
  notes: string // optional clinical note (e.g. "fasting sample required")
  createdAt: string // ISO
}

// A read-only case share with a colleague, with a question attached.
// Ownership of the case never changes — this is a request + response,
// not a handoff (see Handoff below, which does transfer coverage).
export interface SecondOpinion {
  id: string
  patientId: string
  fromPractitionerId: string
  toPractitionerId: string
  question: string
  response?: string
  status: 'pending' | 'answered'
  createdAt: string
  answeredAt?: string
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
  createdAt?: string
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
  | 'second_opinion'
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
