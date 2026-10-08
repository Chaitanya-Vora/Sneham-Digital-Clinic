import type { Appointment } from './types'
import type { CourseStatus } from './course'
import { courseNote } from './course'
import { toISO, type ISODate } from './day'

// What the doctor should do next for this patient — one answer, derived from
// the bookings and the prescribed course, shown on the profile as the "Next
// step" card.
export type NextStep =
  | { kind: 'inConsult'; appt: Appointment }
  | { kind: 'today'; appt: Appointment }
  | { kind: 'booked'; appt: Appointment; inDays: number }
  | { kind: 'needs'; urgent: boolean; note: string }
  | { kind: 'noRx' }

function minutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return 0
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2])
}
const earliest = (list: Appointment[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || minutes(a.time) - minutes(b.time))[0]
const dayDiff = (a: ISODate, b: ISODate) => Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000)

export function nextStepOf(appointments: Appointment[], course: CourseStatus, today: Date = new Date()): NextStep {
  const todayIso = toISO(today)
  const mine = appointments.filter((a) => a.status !== 'Cancelled')
  const inConsult = mine.find((a) => a.status === 'In consult')
  if (inConsult) return { kind: 'inConsult', appt: inConsult }
  const waiting = mine.filter((a) => (a.status === 'Upcoming' || a.status === 'Waiting') && a.date === todayIso)
  if (waiting.length) return { kind: 'today', appt: earliest(waiting) }
  const ahead = mine.filter((a) => (a.status === 'Upcoming' || a.status === 'Waiting') && a.date > todayIso)
  if (ahead.length) { const appt = earliest(ahead); return { kind: 'booked', appt, inDays: dayDiff(appt.date, todayIso) } }
  if (course.state === 'none') return { kind: 'noRx' }
  return { kind: 'needs', urgent: course.state === 'ended' || course.state === 'endsSoon', note: courseNote(course) }
}
