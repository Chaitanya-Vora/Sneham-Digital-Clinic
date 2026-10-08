import type { Appointment, Patient, Prescription } from './types'
import { isOneOffRepetition } from './types'
import { daysSince, toISO, type ISODate } from './day'

// Where a patient is in the course of medicine she last prescribed — the one
// calculation behind "who is due" everywhere: the Follow-ups tab, the web
// dashboard's "Needs attention", and the patient profile's ring and next step.
// Computed live from the prescription (no scheduled job), so the screens can
// never disagree.
//
// Day 1 is the day it was published; a 14-day course covers days 1–14 and ends
// at the close of day 14.
export type CourseState =
  | 'none'     // nothing published yet
  | 'ongoing'  // inside the course, more than a week left
  | 'endsSoon' // last day, or at most 7 days left
  | 'ended'    // the course is over
  | 'open'     // "until settled" or a single dose — there is no end date to be due by

export interface CourseStatus {
  rx: Prescription | null
  state: CourseState
  durationDays: number | null
  dayNumber: number | null // 1-based, never beyond the course length
  daysLeft: number | null  // 0 on the last day, negative once ended
  endedDaysAgo: number | null
  sinceDays: number | null // days since it was published
}

const NONE: CourseStatus = { rx: null, state: 'none', durationDays: null, dayNumber: null, daysLeft: null, endedDaysAgo: null, sinceDays: null }

/** The latest published, not-cancelled prescription for each patient. */
export function latestPublishedByPatient(prescriptions: Prescription[]): Map<string, Prescription> {
  const out = new Map<string, Prescription>()
  for (const rx of prescriptions) {
    if (rx.status !== 'published') continue
    const at = rx.publishedAt ?? rx.createdAt
    const cur = out.get(rx.patientId)
    if (!cur || at > (cur.publishedAt ?? cur.createdAt)) out.set(rx.patientId, rx)
  }
  return out
}

export function courseOf(rx: Prescription | null | undefined, today: Date = new Date()): CourseStatus {
  if (!rx || rx.status !== 'published') return NONE
  const published = rx.publishedAt ?? rx.createdAt
  const elapsed = Math.max(0, daysSince(published, today))
  const duration = rx.durationDays && !isOneOffRepetition(rx.repetition) ? rx.durationDays : null
  if (duration === null) {
    return { rx, state: 'open', durationDays: null, dayNumber: null, daysLeft: null, endedDaysAgo: null, sinceDays: elapsed }
  }
  const daysLeft = duration - 1 - elapsed
  const state: CourseState = daysLeft < 0 ? 'ended' : daysLeft <= 7 ? 'endsSoon' : 'ongoing'
  return {
    rx,
    state,
    durationDays: duration,
    dayNumber: Math.min(elapsed + 1, duration),
    daysLeft,
    endedDaysAgo: daysLeft < 0 ? -daysLeft : null,
    sinceDays: elapsed,
  }
}

/** "9:30 AM" -> minutes after midnight (so 10:00 AM sorts after 9:30 AM). */
function clockMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return 0
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2])
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** A short phrase for a list row: "course ended 20 days ago", "ends in 3 days"… */
export function courseNote(c: CourseStatus): string {
  switch (c.state) {
    case 'ended': return `course ended ${plural(c.endedDaysAgo ?? 0, 'day')} ago`
    case 'endsSoon': return c.daysLeft === 0 ? 'last day today' : c.daysLeft === 1 ? 'ends tomorrow' : `ends in ${c.daysLeft} days`
    case 'ongoing': return `day ${c.dayNumber} of ${c.durationDays}`
    case 'open': return c.sinceDays === 0 ? 'prescribed today' : c.sinceDays === 1 ? 'prescribed yesterday' : `prescribed ${c.sinceDays} days ago`
    default: return 'no prescription yet'
  }
}

// ── The recall queue ─────────────────────────────────────────────────────
export type Bucket = 'overdue' | 'soon' | 'later'
export interface QueueRow {
  patient: Patient
  course: CourseStatus
  nextAppt: Appointment | null
  bucket: Bucket
}

/** A row that is actually waiting on the doctor: the course has ended or ends this week. */
export const isDue = (r: QueueRow) => r.bucket !== 'later'

export const bucketOf = (c: CourseStatus): Bucket => (c.state === 'ended' ? 'overdue' : c.state === 'endsSoon' ? 'soon' : 'later')

/** Patients on a remedy, split into those who still need a follow-up date and
 *  those who already have one. Archived patients are left out. A booking only
 *  counts while it is still ahead of us — an old "Upcoming" nobody closed does not. */
export function followUpQueue(
  patients: Patient[],
  appointments: Appointment[],
  prescriptions: Prescription[],
  today: Date = new Date(),
): { needs: QueueRow[]; booked: QueueRow[] } {
  const todayIso: ISODate = toISO(today)
  const latest = latestPublishedByPatient(prescriptions)
  const upcoming = new Map<string, Appointment>()
  for (const a of appointments) {
    if (a.status !== 'Upcoming' || !a.date || a.date < todayIso) continue
    const cur = upcoming.get(a.patientId)
    if (!cur || a.date < cur.date) upcoming.set(a.patientId, a)
  }
  const needs: QueueRow[] = []
  const booked: QueueRow[] = []
  for (const patient of patients) {
    if (patient.archivedAt || !patient.currentRemedy) continue
    const course = courseOf(latest.get(patient.id), today)
    const nextAppt = upcoming.get(patient.id) ?? null
    const row: QueueRow = { patient, course, nextAppt, bucket: bucketOf(course) }
    ;(nextAppt ? booked : needs).push(row)
  }
  const rank: Record<Bucket, number> = { overdue: 0, soon: 1, later: 2 }
  needs.sort((a, b) => {
    if (a.bucket !== b.bucket) return rank[a.bucket] - rank[b.bucket]
    if (a.bucket === 'overdue') return (b.course.endedDaysAgo ?? 0) - (a.course.endedDaysAgo ?? 0) // longest overdue first
    if (a.bucket === 'soon') return (a.course.daysLeft ?? 0) - (b.course.daysLeft ?? 0)             // ending soonest first
    return (b.course.sinceDays ?? 0) - (a.course.sinceDays ?? 0)                                      // oldest prescription first
  })
  booked.sort((a, b) => a.nextAppt!.date.localeCompare(b.nextAppt!.date) || clockMinutes(a.nextAppt!.time) - clockMinutes(b.nextAppt!.time))
  return { needs, booked }
}

