import { supabase } from './supabase'
import type {
  Appointment,
  AppNotification,
  CaseVisit,
  ChatMessage,
  CheckIn,
  ClinicDocument,
  DoseReminder,
  Handoff,
  InvestigationOrder,
  SecondOpinion,
  Invoice,
  Outcome,
  Patient,
  Practitioner,
  Prescription,
  RemedyStock,
  TimeBlock,
} from './types'
import type { CaseState, CustomCaseTemplate } from './caseTemplate'
import { DEFAULT_PRACTITIONER_REMEDIES } from './remedies'
import { normaliseDayValue } from './day'


let _hydrateErrors = 0
export function resetHydrateErrors() { _hydrateErrors = 0 }
export function getHydrateErrors() { return _hydrateErrors }

export const newId = (): string => {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ── Practitioner ─────────────────────────────────────────────

function toAppPractitioner(r: any): Practitioner {
  return {
    id: r.id,
    authUserId: r.auth_user_id ?? undefined,
    name: r.name,
    initials: r.initials,
    role: r.role,
    status: r.status ?? 'active',
    specialty: r.specialty,
    qualifications: r.qualifications ?? undefined,
    registrationNo: r.registration_no ?? undefined,
    openCases: r.open_cases,
    remedyList: r.remedy_list ?? [],
    rxTemplates: r.rx_templates ?? [],
  }
}

function toDbPractitioner(p: Practitioner, authUserId?: string) {
  return {
    id: p.id,
    name: p.name,
    initials: p.initials,
    role: p.role,
    status: p.status,
    specialty: p.specialty,
    qualifications: p.qualifications ?? null,
    registration_no: p.registrationNo ?? null,
    open_cases: p.openCases,
    remedy_list: p.remedyList,
    rx_templates: p.rxTemplates,
    ...(authUserId ? { auth_user_id: authUserId } : {}),
  }
}

export async function fetchPractitioners(): Promise<Practitioner[]> {
  const { data, error } = await supabase.from('practitioners').select('*')
  if (error) { console.error('fetchPractitioners:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppPractitioner)
}

export async function insertPractitioner(p: Practitioner, authUserId?: string): Promise<boolean> {
  const { error } = await supabase.from('practitioners').insert(toDbPractitioner(p, authUserId))
  if (error) { console.error('insertPractitioner:', error.message); return false }
  return true
}

export async function updatePractitionerDb(id: string, patch: Partial<Practitioner>): Promise<boolean> {
  const db: Record<string, unknown> = {}
  if (patch.name !== undefined) db.name = patch.name
  if (patch.initials !== undefined) db.initials = patch.initials
  if (patch.role !== undefined) db.role = patch.role
  if (patch.status !== undefined) db.status = patch.status
  if (patch.specialty !== undefined) db.specialty = patch.specialty
  if (patch.qualifications !== undefined) db.qualifications = patch.qualifications
  if (patch.registrationNo !== undefined) db.registration_no = patch.registrationNo
  if (patch.openCases !== undefined) db.open_cases = patch.openCases
  if (patch.remedyList !== undefined) db.remedy_list = patch.remedyList
  if (patch.rxTemplates !== undefined) db.rx_templates = patch.rxTemplates
  if (Object.keys(db).length === 0) return true
  const { error } = await supabase.from('practitioners').update(db).eq('id', id)
  if (error) { console.error('updatePractitioner:', error.message); return false }
  return true
}

// Rejecting a pending signup — RLS already blocks them from ever seeing
// patient data while pending, so this is a clean, complete "no" rather than
// a security-critical action: if they ever sign in again, ensurePractitioner
// just creates a fresh pending row and they re-enter the approval queue.
export async function deletePractitionerDb(id: string): Promise<boolean> {
  const { error } = await supabase.from('practitioners').delete().eq('id', id)
  if (error) { console.error('deletePractitioner:', error.message); return false }
  return true
}

export async function ensurePractitioner(userId: string, userName: string): Promise<Practitioner> {
  // Deliberately not .maybeSingle() — that errors out (and this call site
  // used to silently swallow the error, reading it as "no row") the moment
  // more than one row ever matched, which is exactly the condition that
  // once let this function create an ever-growing pile of duplicates: each
  // failed check misread "too many rows" as "none", so it created another.
  // Ordering by created_at and taking the first is a fixed point — however
  // many rows exist, this always converges on the same one and never adds another.
  const { data, error } = await supabase
    .from('practitioners')
    .select('*')
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) console.error('ensurePractitioner lookup:', error.message)
  if (data && data.length > 0) {
    if (data.length > 1) console.warn(`ensurePractitioner: ${data.length} rows matched auth_user_id ${userId}, using the oldest`)
    return toAppPractitioner(data[0])
  }

  const id = newId()
  const cleanName = userName.replace(/^Dr\.?\s*/i, '')
  const words = cleanName.split(' ').filter(Boolean)
  const initials = words.map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'DR'

  // The very first practitioner for a clinic has no one to grant them
  // Owner, so they default to it (and to 'active' — there's no one to
  // approve them either); anyone joining an existing clinic defaults to a
  // regular practitioner, 'pending' until the Owner approves them in
  // Settings — otherwise every new signup would silently become both a
  // second master login AND get instant real patient-data access.
  const { count } = await supabase.from('practitioners').select('id', { count: 'exact', head: true })
  const isFirstEver = !count || count === 0
  const role: Practitioner['role'] = isFirstEver ? 'Owner' : 'Practitioner'
  const status: Practitioner['status'] = isFirstEver ? 'active' : 'pending'

  const practitioner: Practitioner = {
    id,
    name: userName,
    initials,
    role,
    status,
    specialty: 'Homeopathy',
    openCases: 0,
    remedyList: DEFAULT_PRACTITIONER_REMEDIES,
    rxTemplates: [],
  }

  await supabase.from('practitioners').insert(toDbPractitioner(practitioner, userId))
  await supabase.from('profiles').update({ practitioner_id: id }).eq('id', userId)

  return practitioner
}


// ── Patient ──────────────────────────────────────────────────

function toAppPatient(r: any): Patient {
  return {
    id: r.id,
    authUserId: r.auth_user_id ?? undefined,
    wsCode: r.ws_code,
    name: r.name,
    initials: r.initials,
    age: r.age,
    sex: r.sex,
    location: r.location,
    patientSince: r.patient_since,
    chiefComplaint: r.chief_complaint,
    currentRemedy: r.current_remedy,
    lastSeen: r.last_seen,
    owningPractitionerId: r.owning_practitioner_id,
    assignment: r.assignment,
    phone: r.phone ?? undefined,
    allergies: r.allergies,
    regularMedication: r.regular_medication,
    lastOutcome: r.last_outcome ?? undefined,
    archivedAt: r.archived_at ?? null,
  }
}

function toDbPatient(p: Patient) {
  return {
    id: p.id,
    ws_code: p.wsCode,
    name: p.name,
    initials: p.initials,
    age: p.age,
    sex: p.sex,
    location: p.location,
    patient_since: p.patientSince,
    chief_complaint: p.chiefComplaint,
    current_remedy: p.currentRemedy,
    last_seen: p.lastSeen,
    owning_practitioner_id: p.owningPractitionerId,
    assignment: p.assignment,
    phone: p.phone ?? null,
    allergies: p.allergies,
    regular_medication: p.regularMedication,
    last_outcome: p.lastOutcome ?? null,
    archived_at: p.archivedAt,
  }
}

export async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchPatients:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppPatient)
}

export async function insertPatient(p: Patient): Promise<boolean> {
  const { error } = await supabase.from('patients').insert(toDbPatient(p))
  if (error) { console.error('insertPatient:', error.message); return false }
  return true
}

// Goes through a security-definer RPC rather than a raw update — at the
// moment of linking, this patient row isn't yet recognized as "theirs" by
// RLS (that's exactly what this call establishes), so the database function
// checks auth.uid() itself and only ever allows claiming an unclaimed row.
export async function linkPatientAuthUser(patientId: string): Promise<boolean> {
  const { error } = await supabase.rpc('link_patient_auth', { target_patient_id: patientId })
  if (error) { console.error('linkPatientAuthUser:', error.message); return false }
  return true
}

export async function updatePatient(id: string, patch: Partial<Patient>): Promise<boolean> {
  const db: Record<string, unknown> = {}
  if (patch.name !== undefined) db.name = patch.name
  if (patch.currentRemedy !== undefined) db.current_remedy = patch.currentRemedy
  if (patch.lastSeen !== undefined) db.last_seen = patch.lastSeen
  if (patch.assignment !== undefined) db.assignment = patch.assignment
  if (patch.chiefComplaint !== undefined) db.chief_complaint = patch.chiefComplaint
  if (patch.allergies !== undefined) db.allergies = patch.allergies
  if (patch.regularMedication !== undefined) db.regular_medication = patch.regularMedication
  if (patch.lastOutcome !== undefined) db.last_outcome = patch.lastOutcome
  if (patch.owningPractitionerId !== undefined) db.owning_practitioner_id = patch.owningPractitionerId
  if (patch.phone !== undefined) db.phone = patch.phone
  if (patch.age !== undefined) db.age = patch.age
  if (patch.sex !== undefined) db.sex = patch.sex
  if (patch.location !== undefined) db.location = patch.location
  if (patch.archivedAt !== undefined) db.archived_at = patch.archivedAt
  if (Object.keys(db).length === 0) return true
  const { error } = await supabase.from('patients').update(db).eq('id', id)
  if (error) { console.error('updatePatient:', error.message); return false }
  return true
}

// Live, per-table counts for the permanent-delete confirmation UI — plain
// SELECT count queries, no RPC needed since the caller already has read
// access to every one of these via their existing "read accessible X"
// policies.
const DELETION_IMPACT_TABLES = [
  'appointments', 'prescriptions', 'invoices', 'investigation_orders',
  'case_visits', 'documents', 'check_ins', 'handoffs', 'second_opinions', 'outcomes', 'messages',
] as const

export async function fetchPatientDeletionImpact(patientId: string): Promise<Record<string, number>> {
  const counts = await Promise.all(
    DELETION_IMPACT_TABLES.map((t) => supabase.from(t).select('id', { count: 'exact', head: true }).eq('patient_id', patientId)),
  )
  return Object.fromEntries(DELETION_IMPACT_TABLES.map((t, i) => [t, counts[i].count ?? 0]))
}

// Runs server-side as a single atomic operation (see
// supabase/migration_v24_patient_permanent_delete.sql) — deletes the
// patient and every dependent row in one transaction, gated to the clinic
// owner. Unlike every other write in this file, the caller MUST await this
// and only update local state on success — see cancelPrescription-style
// optimistic updates are NOT safe here, this is genuinely irreversible.
export async function permanentlyDeletePatientDb(patientId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('permanently_delete_patient', { target_patient_id: patientId })
  if (error) { console.error('permanentlyDeletePatientDb:', error.message); return { ok: false, error: error.message } }
  return { ok: true }
}


// ── Appointment ──────────────────────────────────────────────

function toAppAppointment(r: any): Appointment {
  return {
    id: r.id,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    time: r.time,
    date: normaliseDayValue(r.day_label),
    durationMin: r.duration_min,
    type: r.type,
    status: r.status,
    tag: r.tag ?? undefined,
    reason: r.reason ?? undefined,
    isFirstVisit: r.is_first_visit ?? undefined,
  }
}

function toDbAppointment(a: Appointment) {
  return {
    id: a.id,
    patient_id: a.patientId,
    practitioner_id: a.practitionerId,
    time: a.time,
    day_label: a.date,
    duration_min: a.durationMin,
    type: a.type,
    status: a.status,
    tag: a.tag ?? null,
    reason: a.reason ?? null,
    is_first_visit: a.isFirstVisit ?? false,
  }
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase.from('appointments').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchAppointments:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppAppointment)
}

export async function insertAppointment(a: Appointment): Promise<boolean> {
  const { error } = await supabase.from('appointments').insert(toDbAppointment(a))
  if (error) { console.error('insertAppointment:', error.message); return false }
  return true
}

export async function updateAppointmentDb(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('appointments').update(patch).eq('id', id)
  if (error) { console.error('updateAppointment:', error.message); return false }
  return true
}


// ── Prescription ─────────────────────────────────────────────

function toAppPrescription(r: any): Prescription {
  return {
    id: r.id,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    remedy: r.remedy,
    potency: r.potency,
    doseGlobules: r.dose_globules,
    repetition: r.repetition,
    durationDays: r.duration_days,
    preparation: r.preparation,
    bodyText: r.body_text ?? undefined,
    status: r.status,
    publishedAt: r.published_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cancelledAt: r.cancelled_at ?? undefined,
    sharedVia: r.shared_via ?? [],
    remindersEnabled: r.reminders_enabled,
    reminderTimes: r.reminder_times ?? [],
  }
}

function toDbPrescription(p: Prescription) {
  return {
    id: p.id,
    patient_id: p.patientId,
    practitioner_id: p.practitionerId,
    remedy: p.remedy,
    potency: p.potency,
    dose_globules: p.doseGlobules,
    repetition: p.repetition,
    duration_days: p.durationDays,
    preparation: p.preparation,
    body_text: p.bodyText ?? null,
    status: p.status,
    published_at: p.publishedAt ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    cancelled_at: p.cancelledAt ?? null,
    shared_via: p.sharedVia,
    reminders_enabled: p.remindersEnabled,
    reminder_times: p.reminderTimes,
  }
}

export async function fetchPrescriptions(): Promise<Prescription[]> {
  // Ordered by created_at, not published_at — once published_at can be
  // null (a draft), Postgres's default NULLS FIRST for DESC would sort
  // every draft to the very top of the initial hydrate. created_at is
  // always populated (backfilled for every pre-existing row too).
  const { data, error } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchPrescriptions:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppPrescription)
}

export async function insertPrescription(p: Prescription): Promise<boolean> {
  const { error } = await supabase.from('prescriptions').insert(toDbPrescription(p))
  if (error) { console.error('insertPrescription:', error.message); return false }
  return true
}

export async function updatePrescriptionDb(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('prescriptions').update(patch).eq('id', id)
  if (error) { console.error('updatePrescription:', error.message); return false }
  return true
}

// A cancelled prescription's dose reminders must stop nagging the patient
// — they never expire on their own (durationDays is display-only).
export async function deleteDoseRemindersForPrescription(prescriptionId: string): Promise<boolean> {
  const { error } = await supabase.from('dose_reminders').delete().eq('prescription_id', prescriptionId)
  if (error) { console.error('deleteDoseRemindersForPrescription:', error.message); return false }
  return true
}


// ── Investigation Order ──────────────────────────────────────

function toAppInvestigationOrder(r: any): InvestigationOrder {
  return {
    id: r.id,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    tests: r.tests ?? [],
    notes: r.notes ?? '',
    createdAt: r.created_at,
  }
}

function toDbInvestigationOrder(o: InvestigationOrder) {
  return {
    id: o.id,
    patient_id: o.patientId,
    practitioner_id: o.practitionerId,
    tests: o.tests,
    notes: o.notes,
    created_at: o.createdAt,
  }
}

export async function fetchInvestigationOrders(): Promise<InvestigationOrder[]> {
  const { data, error } = await supabase.from('investigation_orders').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchInvestigationOrders:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppInvestigationOrder)
}

export async function insertInvestigationOrder(o: InvestigationOrder): Promise<boolean> {
  const { error } = await supabase.from('investigation_orders').insert(toDbInvestigationOrder(o))
  if (error) { console.error('insertInvestigationOrder:', error.message); return false }
  return true
}

function toAppSecondOpinion(r: any): SecondOpinion {
  return {
    id: r.id,
    patientId: r.patient_id,
    fromPractitionerId: r.from_practitioner_id,
    toPractitionerId: r.to_practitioner_id,
    question: r.question ?? '',
    response: r.response ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    answeredAt: r.answered_at ?? undefined,
  }
}

function toDbSecondOpinion(o: SecondOpinion) {
  return {
    id: o.id,
    patient_id: o.patientId,
    from_practitioner_id: o.fromPractitionerId,
    to_practitioner_id: o.toPractitionerId,
    question: o.question,
    response: o.response ?? null,
    status: o.status,
    created_at: o.createdAt,
    answered_at: o.answeredAt ?? null,
  }
}

export async function fetchSecondOpinions(): Promise<SecondOpinion[]> {
  const { data, error } = await supabase.from('second_opinions').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchSecondOpinions:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppSecondOpinion)
}

export async function insertSecondOpinion(o: SecondOpinion): Promise<boolean> {
  const { error } = await supabase.from('second_opinions').insert(toDbSecondOpinion(o))
  if (error) { console.error('insertSecondOpinion:', error.message); return false }
  return true
}

export async function answerSecondOpinionDb(id: string, response: string, answeredAt: string): Promise<boolean> {
  const { error } = await supabase.from('second_opinions').update({ response, status: 'answered', answered_at: answeredAt }).eq('id', id)
  if (error) { console.error('answerSecondOpinionDb:', error.message); return false }
  return true
}


// ── Invoice ───────────────────────────────────────────────────

function toAppInvoice(r: any): Invoice {
  return {
    id: r.id,
    invoiceNo: r.invoice_no,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    appointmentId: r.appointment_id ?? undefined,
    date: r.date,
    items: r.items ?? [],
    paymentMode: r.payment_mode,
    amountReceived: Number(r.amount_received),
    status: r.status,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cancelledAt: r.cancelled_at ?? undefined,
  }
}

// invoice_no is intentionally never written — it's a DB-generated identity
// column, the one genuinely sequential, collision-proof number in the app
// (replacing today's mobile bug where two unbilled quick-bills for the same
// patient print an identical "invoice number" derived from an id).
function toDbInvoice(inv: Invoice) {
  return {
    id: inv.id,
    patient_id: inv.patientId,
    practitioner_id: inv.practitionerId,
    appointment_id: inv.appointmentId ?? null,
    date: inv.date,
    items: inv.items,
    payment_mode: inv.paymentMode,
    amount_received: inv.amountReceived,
    status: inv.status,
    notes: inv.notes ?? '',
    created_at: inv.createdAt,
    updated_at: inv.updatedAt,
    cancelled_at: inv.cancelledAt ?? null,
  }
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchInvoices:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppInvoice)
}

// Returns the DB-assigned invoiceNo, or null on failure — the caller can't
// know this number ahead of time, so creating an invoice is the one billing
// write that must be awaited before it's shown as saved.
export async function insertInvoice(inv: Invoice): Promise<number | null> {
  const { data, error } = await supabase.from('invoices').insert(toDbInvoice(inv)).select('invoice_no').single()
  if (error) { console.error('insertInvoice:', error.message); return null }
  return data.invoice_no
}

export async function updateInvoiceDb(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('invoices').update(patch).eq('id', id)
  if (error) { console.error('updateInvoiceDb:', error.message); return false }
  return true
}


// ── Dose Reminder ────────────────────────────────────────────

function toAppDoseReminder(r: any): DoseReminder {
  return {
    id: r.id,
    prescriptionId: r.prescription_id,
    patientId: r.patient_id,
    remedy: r.remedy,
    potency: r.potency,
    time: r.time,
    slot: r.slot,
    loggedToday: r.logged_today,
  }
}

function toDbDoseReminder(d: DoseReminder) {
  return {
    id: d.id,
    prescription_id: d.prescriptionId,
    patient_id: d.patientId,
    remedy: d.remedy,
    potency: d.potency,
    time: d.time,
    slot: d.slot,
    logged_today: d.loggedToday,
  }
}

export async function fetchDoseReminders(): Promise<DoseReminder[]> {
  const { data, error } = await supabase.from('dose_reminders').select('*')
  if (error) { console.error('fetchDoseReminders:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppDoseReminder)
}

export async function insertDoseReminder(d: DoseReminder): Promise<boolean> {
  const { error } = await supabase.from('dose_reminders').insert(toDbDoseReminder(d))
  if (error) { console.error('insertDoseReminder:', error.message); return false }
  return true
}

export async function updateDoseReminderDb(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('dose_reminders').update(patch).eq('id', id)
  if (error) { console.error('updateDoseReminder:', error.message); return false }
  return true
}


// ── Check-in ─────────────────────────────────────────────────

function toAppCheckIn(r: any): CheckIn {
  return {
    id: r.id,
    patientId: r.patient_id,
    prescriptionId: r.prescription_id,
    improvementPct: r.improvement_pct,
    changeChips: r.change_chips ?? [],
    freeText: r.free_text,
    submittedAt: r.submitted_at,
    marked: r.marked,
  }
}

function toDbCheckIn(c: CheckIn) {
  return {
    id: c.id,
    patient_id: c.patientId,
    prescription_id: c.prescriptionId,
    improvement_pct: c.improvementPct,
    change_chips: c.changeChips,
    free_text: c.freeText,
    submitted_at: c.submittedAt,
    marked: c.marked,
  }
}

export async function fetchCheckIns(): Promise<CheckIn[]> {
  const { data, error } = await supabase.from('check_ins').select('*').order('submitted_at', { ascending: false })
  if (error) { console.error('fetchCheckIns:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppCheckIn)
}

export async function insertCheckIn(c: CheckIn): Promise<boolean> {
  const { error } = await supabase.from('check_ins').insert(toDbCheckIn(c))
  if (error) { console.error('insertCheckIn:', error.message); return false }
  return true
}


// ── Handoff ──────────────────────────────────────────────────

function toAppHandoff(r: any): Handoff {
  return {
    id: r.id,
    patientId: r.patient_id,
    fromPractitionerId: r.from_practitioner_id,
    toPractitionerId: r.to_practitioner_id,
    coveringUntil: r.covering_until,
    note: r.note ?? {},
    status: r.status,
    patientNotified: r.patient_notified,
    createdAt: r.created_at ?? undefined,
  }
}

function toDbHandoff(h: Handoff) {
  return {
    id: h.id,
    patient_id: h.patientId,
    from_practitioner_id: h.fromPractitionerId,
    to_practitioner_id: h.toPractitionerId,
    covering_until: h.coveringUntil,
    note: h.note,
    status: h.status,
    patient_notified: h.patientNotified,
  }
}

export async function fetchHandoffs(): Promise<Handoff[]> {
  const { data, error } = await supabase.from('handoffs').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchHandoffs:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppHandoff)
}

export async function insertHandoff(h: Handoff): Promise<boolean> {
  const { error } = await supabase.from('handoffs').insert(toDbHandoff(h))
  if (error) { console.error('insertHandoff:', error.message); return false }
  return true
}

export async function updateHandoffDb(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('handoffs').update(patch).eq('id', id)
  if (error) { console.error('updateHandoff:', error.message); return false }
  return true
}


// ── Outcome ──────────────────────────────────────────────────

function toAppOutcome(r: any): Outcome {
  return {
    id: r.id,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    date: r.date,
    remedy: r.remedy,
    outcome: r.outcome,
    note: r.note,
  }
}

function toDbOutcome(o: Outcome) {
  return {
    id: o.id,
    patient_id: o.patientId,
    practitioner_id: o.practitionerId,
    date: o.date,
    remedy: o.remedy,
    outcome: o.outcome,
    note: o.note,
  }
}

export async function fetchOutcomes(): Promise<Outcome[]> {
  const { data, error } = await supabase.from('outcomes').select('*').order('date', { ascending: false })
  if (error) { console.error('fetchOutcomes:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppOutcome)
}

export async function insertOutcome(o: Outcome): Promise<boolean> {
  const { error } = await supabase.from('outcomes').insert(toDbOutcome(o))
  if (error) { console.error('insertOutcome:', error.message); return false }
  return true
}


// ── Document ─────────────────────────────────────────────────

function toAppDocument(r: any): ClinicDocument {
  return {
    id: r.id,
    patientId: r.patient_id,
    name: r.name,
    kind: r.kind,
    format: r.format,
    size: r.size,
    date: r.date,
    uploadedBy: r.uploaded_by,
    fileUrl: r.file_url ?? undefined,
  }
}

export async function fetchDocuments(): Promise<ClinicDocument[]> {
  const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
  if (error) { console.error('fetchDocuments:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppDocument)
}

export async function uploadDocument(file: File, patientId: string): Promise<ClinicDocument | null> {
  const id = newId()
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${patientId}/${id}.${ext}`

  const { error: uploadErr } = await supabase.storage.from('clinic-documents').upload(path, file)
  if (uploadErr) { console.error('uploadDocument storage:', uploadErr.message); return null }

  // clinic-documents is a private bucket — getPublicUrl() would happily
  // build a URL that Storage then refuses to serve. Store the storage path
  // itself; getDocumentUrl() below mints a short-lived signed URL from it
  // at the moment someone actually opens the document.
  const fileUrl = path

  const sizeStr = file.size < 1024 * 1024
    ? `${Math.round(file.size / 1024)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

  const doc: ClinicDocument = {
    id,
    patientId,
    name: file.name,
    kind: 'Report',
    format: ext.toUpperCase(),
    size: sizeStr,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    uploadedBy: 'practitioner',
    fileUrl,
  }

  const { error: insertErr } = await supabase.from('documents').insert({
    id: doc.id,
    patient_id: doc.patientId,
    name: doc.name,
    kind: doc.kind,
    format: doc.format,
    size: doc.size,
    date: doc.date,
    uploaded_by: doc.uploadedBy,
    file_url: fileUrl,
  })
  if (insertErr) { console.error('insertDocument:', insertErr.message); return null }

  return doc
}

export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('clinic-documents').createSignedUrl(path, 300)
  if (error) { console.error('getDocumentUrl:', error.message); return null }
  return data?.signedUrl ?? null
}


// ── Notification ─────────────────────────────────────────────

function toAppNotification(r: any): AppNotification {
  return {
    id: r.id,
    surface: r.surface,
    kind: r.kind,
    title: r.title,
    message: r.message,
    time: r.time,
    read: r.read,
    severity: r.severity,
    pending: r.pending ?? undefined,
  }
}

function toDbNotification(n: AppNotification, userId: string | null) {
  return {
    id: n.id,
    surface: n.surface,
    kind: n.kind,
    title: n.title,
    message: n.message,
    time: n.time,
    read: n.read,
    severity: n.severity,
    pending: n.pending ?? null,
    user_id: userId,
  }
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) { console.error('fetchNotifications:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppNotification)
}

export async function insertNotification(n: AppNotification, userId: string | null): Promise<boolean> {
  const { error } = await supabase.from('notifications').insert(toDbNotification(n, userId))
  if (error) { console.error('insertNotification:', error.message); return false }
  return true
}

export async function updateNotificationDb(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('notifications').update(patch).eq('id', id)
  if (error) { console.error('updateNotification:', error.message); return false }
  return true
}

export async function deleteNotificationDb(id: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) { console.error('deleteNotification:', error.message); return false }
  return true
}

export async function markAllNotificationsRead(surface: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('surface', surface)
    .eq('read', false)
  if (error) { console.error('markAllNotificationsRead:', error.message); return false }
  return true
}


// ── Time Block ───────────────────────────────────────────────

function toAppTimeBlock(r: any): TimeBlock {
  return {
    id: r.id,
    practitionerId: r.practitioner_id,
    date: normaliseDayValue(r.day_label),
    startHour: r.start_hour,
    durationMin: r.duration_min,
    reason: r.reason,
  }
}

function toDbTimeBlock(t: TimeBlock) {
  return {
    id: t.id,
    practitioner_id: t.practitionerId,
    day_label: t.date,
    start_hour: t.startHour,
    duration_min: t.durationMin,
    reason: t.reason,
  }
}

export async function fetchTimeBlocks(): Promise<TimeBlock[]> {
  const { data, error } = await supabase.from('time_blocks').select('*')
  if (error) { console.error('fetchTimeBlocks:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppTimeBlock)
}

export async function insertTimeBlock(t: TimeBlock): Promise<boolean> {
  const { error } = await supabase.from('time_blocks').insert(toDbTimeBlock(t))
  if (error) { console.error('insertTimeBlock:', error.message); return false }
  return true
}

export async function deleteTimeBlockDb(id: string): Promise<boolean> {
  const { error } = await supabase.from('time_blocks').delete().eq('id', id)
  if (error) { console.error('deleteTimeBlock:', error.message); return false }
  return true
}


// ── Remedy Stock ─────────────────────────────────────────────

function toAppRemedyStock(r: any): RemedyStock {
  return { name: r.name, potency: r.potency, qty: r.qty, low: r.low }
}

export async function fetchRemedyStock(): Promise<RemedyStock[]> {
  const { data, error } = await supabase.from('remedy_stock').select('*')
  if (error) { console.error('fetchRemedyStock:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppRemedyStock)
}


// ── Case Data ────────────────────────────────────────────────

export async function fetchAllCaseData(): Promise<Record<string, CaseState>> {
  const { data, error } = await supabase.from('case_data').select('*')
  if (error) { console.error('fetchCaseData:', error.message); _hydrateErrors++; return {} }
  const result: Record<string, CaseState> = {}
  for (const row of data ?? []) {
    result[row.patient_id] = row.sections as CaseState
  }
  return result
}

export async function upsertCaseData(patientId: string, sections: CaseState): Promise<boolean> {
  const { error } = await supabase
    .from('case_data')
    .upsert({ patient_id: patientId, sections, updated_at: new Date().toISOString() })
  if (error) { console.error('upsertCaseData:', error.message); return false }
  return true
}


// ── Chat Message ────────────────────────────────────────────

function toAppMessage(r: any): ChatMessage {
  return {
    id: r.id,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    sender: r.sender,
    text: r.text,
    sentAt: r.sent_at,
    read: r.read,
  }
}

function toDbMessage(m: ChatMessage) {
  return {
    id: m.id,
    patient_id: m.patientId,
    practitioner_id: m.practitionerId,
    sender: m.sender,
    text: m.text,
    sent_at: m.sentAt,
    read: m.read,
  }
}

export async function fetchMessages(): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from('messages').select('*').order('sent_at', { ascending: true })
  if (error) { console.error('fetchMessages:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppMessage)
}

export async function insertMessage(m: ChatMessage): Promise<boolean> {
  const { error } = await supabase.from('messages').insert(toDbMessage(m))
  if (error) { console.error('insertMessage:', error.message); return false }
  return true
}

export async function markMessagesRead(patientId: string, sender: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('patient_id', patientId)
    .eq('sender', sender)
    .eq('read', false)
  if (error) { console.error('markMessagesRead:', error.message); return false }
  return true
}


// ── Case Visit ──────────────────────────────────────────────

function toAppCaseVisit(r: any): CaseVisit {
  return {
    id: r.id,
    patientId: r.patient_id,
    practitionerId: r.practitioner_id,
    appointmentId: r.appointment_id ?? undefined,
    date: r.date,
    template: r.template,
    sections: r.sections ?? {},
    remedy: r.remedy ?? undefined,
    outcome: r.outcome ?? undefined,
    editedAt: r.edited_at ?? undefined,
  }
}

function toDbCaseVisit(v: CaseVisit) {
  return {
    id: v.id,
    patient_id: v.patientId,
    practitioner_id: v.practitionerId,
    appointment_id: v.appointmentId ?? null,
    date: v.date,
    template: v.template,
    sections: v.sections,
    remedy: v.remedy ?? null,
    outcome: v.outcome ?? null,
  }
}

export async function fetchCaseVisits(): Promise<CaseVisit[]> {
  const { data, error } = await supabase.from('case_visits').select('*').order('date', { ascending: false })
  if (error) { console.error('fetchCaseVisits:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppCaseVisit)
}

export async function insertCaseVisit(v: CaseVisit): Promise<boolean> {
  const { error } = await supabase.from('case_visits').insert(toDbCaseVisit(v))
  if (error) { console.error('insertCaseVisit:', error.message); return false }
  return true
}

export async function updateCaseVisitDb(id: string, patch: { sections?: Record<string, unknown>; remedy?: string; outcome?: string; editedAt: string }): Promise<boolean> {
  const db: Record<string, unknown> = { edited_at: patch.editedAt }
  if (patch.sections !== undefined) db.sections = patch.sections
  if (patch.remedy !== undefined) db.remedy = patch.remedy
  if (patch.outcome !== undefined) db.outcome = patch.outcome
  const { error } = await supabase.from('case_visits').update(db).eq('id', id)
  if (error) { console.error('updateCaseVisitDb:', error.message); return false }
  return true
}


// ── Case Template (custom) ──────────────────────────────────

function toAppCaseTemplate(r: any): CustomCaseTemplate {
  return {
    id: r.id,
    label: r.label,
    description: r.description ?? '',
    sections: r.sections ?? [],
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
  }
}

export async function fetchCaseTemplates(): Promise<CustomCaseTemplate[]> {
  const { data, error } = await supabase.from('case_templates').select('*').order('created_at', { ascending: true })
  if (error) { console.error('fetchCaseTemplates:', error.message); _hydrateErrors++; return [] }
  return (data ?? []).map(toAppCaseTemplate)
}

export async function insertCaseTemplate(t: CustomCaseTemplate): Promise<boolean> {
  const { error } = await supabase.from('case_templates').insert({
    id: t.id,
    label: t.label,
    description: t.description || null,
    sections: t.sections,
    created_by: t.createdBy,
  })
  if (error) { console.error('insertCaseTemplate:', error.message); return false }
  return true
}

export async function updateCaseTemplateDb(id: string, patch: Partial<Pick<CustomCaseTemplate, 'label' | 'description' | 'sections'>>): Promise<boolean> {
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) db.label = patch.label
  if (patch.description !== undefined) db.description = patch.description || null
  if (patch.sections !== undefined) db.sections = patch.sections
  const { error } = await supabase.from('case_templates').update(db).eq('id', id)
  if (error) { console.error('updateCaseTemplateDb:', error.message); return false }
  return true
}

export async function deleteCaseTemplateDb(id: string): Promise<boolean> {
  const { error } = await supabase.from('case_templates').delete().eq('id', id)
  if (error) { console.error('deleteCaseTemplateDb:', error.message); return false }
  return true
}


// ── Profile ──────────────────────────────────────────────────

export interface DbProfile {
  id: string
  full_name: string
  role: string
  practitioner_id: string | null
  avatar_url: string | null
}

export async function fetchProfile(userId: string): Promise<DbProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) { console.error('fetchProfile:', error.message); return null }
  return data
}

export async function updateProfile(userId: string, patch: Partial<DbProfile>): Promise<boolean> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) { console.error('updateProfile:', error.message); return false }
  return true
}


// ── Hydrate All ──────────────────────────────────────────────

export interface HydratedData {
  practitioners: Practitioner[]
  patients: Patient[]
  appointments: Appointment[]
  prescriptions: Prescription[]
  investigationOrders: InvestigationOrder[]
  invoices: Invoice[]
  doseReminders: DoseReminder[]
  checkIns: CheckIn[]
  handoffs: Handoff[]
  documents: ClinicDocument[]
  remedyStock: RemedyStock[]
  notifications: AppNotification[]
  caseData: Record<string, CaseState>
  outcomes: Outcome[]
  timeBlocks: TimeBlock[]
  caseVisits: CaseVisit[]
  messages: ChatMessage[]
  caseTemplates: CustomCaseTemplate[]
  secondOpinions: SecondOpinion[]
  currentPractitionerId: string
}

export async function hydrateAll(userId: string, userName: string, isPatientSurface: boolean): Promise<HydratedData> {
  // The patient app must never auto-create a practitioner profile for
  // whoever logs in — that's how a patient's own sign-up ended up showing
  // up in the doctor's team list. Only non-patient builds (practitioner
  // app, web console) get one.
  const practitioner = isPatientSurface ? null : await ensurePractitioner(userId, userName)

  const [
    allPractitioners,
    patients,
    appointments,
    prescriptions,
    investigationOrders,
    invoices,
    doseReminders,
    checkIns,
    handoffs,
    documents,
    remedyStock,
    notifications,
    caseData,
    outcomes,
    timeBlocks,
    caseVisits,
    messages,
    caseTemplates,
    secondOpinions,
  ] = await Promise.all([
    fetchPractitioners(),
    fetchPatients(),
    fetchAppointments(),
    fetchPrescriptions(),
    fetchInvestigationOrders(),
    fetchInvoices(),
    fetchDoseReminders(),
    fetchCheckIns(),
    fetchHandoffs(),
    fetchDocuments(),
    fetchRemedyStock(),
    fetchNotifications(userId),
    fetchAllCaseData(),
    fetchOutcomes(),
    fetchTimeBlocks(),
    fetchCaseVisits(),
    fetchMessages(),
    fetchCaseTemplates(),
    fetchSecondOpinions(),
  ])

  const hasSelf = practitioner ? allPractitioners.some(p => p.id === practitioner.id) : true
  const practitioners = practitioner && !hasSelf ? [practitioner, ...allPractitioners] : allPractitioners

  return {
    practitioners,
    patients,
    appointments,
    prescriptions,
    investigationOrders,
    invoices,
    doseReminders,
    checkIns,
    handoffs,
    documents,
    remedyStock,
    notifications,
    caseData,
    outcomes,
    timeBlocks,
    caseVisits,
    messages,
    caseTemplates,
    secondOpinions,
    currentPractitionerId: practitioner?.id ?? '',
  }
}
