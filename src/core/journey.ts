import type { Appointment, CaseVisit, CheckIn, InvestigationOrder, Invoice, Outcome, Prescription } from './types'
import { addDaysISO, toISO, type ISODate } from './day'
import { isHidden, realRemedyLabel } from './rxPrivacy'
import { courseNote, courseOf } from './course'
import { isOneOffRepetition } from './types'

// One patient's story in a single list: visits, prescriptions, outcomes, case
// notes, tests, bills and check-ins, newest first, with what is still to come
// above "now". Built from what the app already holds — no new data.
export type JourneyKind = 'visit' | 'rx' | 'outcome' | 'case' | 'tests' | 'bill' | 'checkin'
export type JourneyTone = 'green' | 'amber' | 'danger' | 'neutral' | 'purple'

export interface JourneyEvent {
  id: string
  kind: JourneyKind
  date: string      // yyyy-mm-dd, for the month heading
  sortKey: string   // yyyy-mm-ddThh:mm — for ordering
  planned: boolean  // still ahead of us (drawn hatched)
  now?: boolean     // happening right now (a consult in progress)
  title: string
  subtitle?: string
  badge?: { label: string; tone: JourneyTone }
  dimmed?: boolean  // cancelled
  hiddenFromPatient?: boolean // the remedy name is not shown to the patient
  ref?: { type: 'case' | 'invoice' | 'outcome'; id: string }
}

function clockKey(time: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return '00:00'
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${m[2]}`
}
const invoiceSum = (items: { qty: number; unitPrice: number }[]) => items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
const isoDate = (iso: string) => toISO(new Date(iso))
const keyOf = (iso: string) => { const d = new Date(iso); return `${toISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export interface JourneyInput {
  appointments: Appointment[]
  prescriptions: Prescription[]
  outcomes: Outcome[]
  caseVisits: CaseVisit[]
  investigationOrders: InvestigationOrder[]
  invoices: Invoice[]
  checkIns: CheckIn[]
}

export function buildJourney(input: JourneyInput, today: Date = new Date()): JourneyEvent[] {
  const todayIso = toISO(today)
  const ev: JourneyEvent[] = []

  for (const a of input.appointments) {
    if (a.status === 'Cancelled' || a.status === 'New' || a.status === 'Unassigned') continue
    const sortKey = `${a.date}T${clockKey(a.time)}`
    if (a.status === 'Seen') {
      ev.push({ id: 'a' + a.id, kind: 'visit', date: a.date, sortKey, planned: false, title: 'Consultation', subtitle: [a.type, a.reason].filter(Boolean).join(' · ') })
    } else if (a.status === 'In consult') {
      ev.push({ id: 'a' + a.id, kind: 'visit', date: a.date, sortKey, planned: false, now: true, title: 'Consultation in progress', subtitle: [a.type, a.reason].filter(Boolean).join(' · ') })
    } else if (a.date >= todayIso) { // Upcoming / Waiting, still ahead
      ev.push({ id: 'a' + a.id, kind: 'visit', date: a.date, sortKey, planned: true, title: a.date === todayIso ? `Today at ${a.time}` : 'Booked visit', subtitle: [a.date === todayIso ? undefined : a.time, a.type, a.reason].filter(Boolean).join(' · ') })
    }
  }

  for (const rx of input.prescriptions) {
    if (rx.status === 'draft') continue
    const at = rx.publishedAt ?? rx.createdAt
    ev.push({
      id: 'r' + rx.id, kind: 'rx', date: isoDate(at), sortKey: keyOf(at), planned: false,
      title: `${rx.remedy} ${rx.potency}`.trim(),
      subtitle: `${rx.repetition} · ${rx.durationDays ? `${rx.durationDays} days` : 'until settled'}`,
      badge: rx.status === 'cancelled' ? { label: 'Cancelled', tone: 'danger' } : undefined,
      dimmed: rx.status === 'cancelled',
      hiddenFromPatient: !!rx.hideRemedy,
    })
  }

  for (const o of input.outcomes) {
    const tone: JourneyTone = o.outcome === 'Clear improvement' ? 'green' : o.outcome === 'Partial' ? 'amber' : o.outcome === 'Aggravation' ? 'danger' : 'neutral'
    ev.push({ id: 'o' + o.id, kind: 'outcome', date: isoDate(o.date), sortKey: keyOf(o.date), planned: false, title: 'Follow-up review', subtitle: [o.remedy, o.note].filter(Boolean).join(' · '), badge: { label: o.outcome, tone }, ref: { type: 'outcome', id: o.id } })
  }

  for (const v of input.caseVisits) {
    ev.push({ id: 'c' + v.id, kind: 'case', date: isoDate(v.date), sortKey: keyOf(v.date), planned: false, title: v.isRetake ? 'Case retaken' : 'Case taken', subtitle: `${v.template} template${v.remedy ? ` · ${v.remedy}` : ''}`, badge: v.isRetake ? { label: 'Retake', tone: 'purple' } : undefined, ref: { type: 'case', id: v.id } })
  }

  for (const t of input.investigationOrders) {
    const shown = t.tests.slice(0, 3).join(', ')
    ev.push({ id: 't' + t.id, kind: 'tests', date: isoDate(t.createdAt), sortKey: keyOf(t.createdAt), planned: false, title: 'Tests ordered', subtitle: t.tests.length > 3 ? `${shown} +${t.tests.length - 3} more` : shown })
  }

  for (const i of input.invoices) {
    const cancelled = i.status === 'cancelled'
    const label = i.status === 'paid' ? 'Paid' : i.status === 'partial' ? 'Part paid' : i.status === 'waived' ? 'Waived' : cancelled ? 'Cancelled' : 'Unpaid'
    const tone: JourneyTone = i.status === 'paid' || i.status === 'waived' ? 'green' : cancelled ? 'danger' : 'amber'
    ev.push({ id: 'i' + i.id, kind: 'bill', date: i.date, sortKey: `${i.date}T12:00`, planned: false, title: `₹${invoiceSum(i.items).toLocaleString('en-IN')}`, subtitle: `#${i.invoiceNo} · ${i.items[0]?.name ?? 'Consultation'}${i.items.length > 1 ? ` +${i.items.length - 1} more` : ''}`, badge: { label, tone }, dimmed: cancelled, ref: { type: 'invoice', id: i.id } })
  }

  for (const c of input.checkIns) {
    const label = c.marked === 'better' ? 'Feeling better' : c.marked === 'worse' ? 'Feeling worse' : 'No change'
    ev.push({ id: 'k' + c.id, kind: 'checkin', date: isoDate(c.submittedAt), sortKey: keyOf(c.submittedAt), planned: false, title: 'Check-in', subtitle: c.freeText || c.changeChips.join(', ') || undefined, badge: { label, tone: c.marked === 'better' ? 'green' : c.marked === 'worse' ? 'amber' : 'neutral' } })
  }

  // Ahead of now (nearest last, so it sits against the "now" line), then the past, newest first.
  const planned = ev.filter((e) => e.planned).sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  const nowEvents = ev.filter((e) => e.now)
  const past = ev.filter((e) => !e.planned && !e.now).sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  return [...planned, ...nowEvents, ...past]
}


// ── The story, grouped by treatment ──────────────────────────────────────
// A homeopathy patient's story is a series of remedies, each followed by reviews. Grouping
// the events under the course they belong to makes the whole history short: the current
// course is open, every earlier one is a single line (remedy, dates, how it went) that
// opens on tap.
export interface Episode {
  id: string                       // the prescription id, or 'intake'
  kind: 'course' | 'intake'
  title: string                    // "Sulphur 200C" / "Intake"
  subtitle: string                 // "Once daily · night · 14 days"
  duration: string                 // "14 days" / "until settled" / "single dose" — for the one-line summary
  startDate: ISODate
  endDate: ISODate | null          // last day of the course, when it has an end
  status: 'current' | 'past' | 'cancelled'
  outcome: { label: string; tone: JourneyTone } | null // the latest review of this remedy
  hiddenFromPatient: boolean
  note: string | null              // where the current course stands: "day 6 of 14", "course ended 3 days ago"
  events: JourneyEvent[]           // newest first; the prescription itself is the header, not an event
}

export interface EpisodeJourney {
  episodes: Episode[]              // newest first (intake last)
  planned: JourneyEvent[]          // still ahead, nearest first
}

interface Course { rx: Prescription; date: ISODate; key: string }

export function buildEpisodes(input: JourneyInput, today: Date = new Date()): EpisodeJourney {
  // Bills have their own tab; keeping them out is what keeps this list short.
  const events = buildJourney({ ...input, invoices: [] }, today)
  const planned = events.filter((e) => e.planned).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const past = events.filter((e) => !e.planned && !e.now && e.kind !== 'rx')

  const courses: Course[] = input.prescriptions
    .filter((rx) => rx.status !== 'draft')
    .map((rx) => { const at = rx.publishedAt ?? rx.createdAt; return { rx, date: isoDate(at), key: keyOf(at) } })
    .sort((a, b) => a.key.localeCompare(b.key))

  const outcomeById = new Map(input.outcomes.map((o) => ['o' + o.id, o]))
  const lastOf = <T,>(list: T[]): T | undefined => list[list.length - 1]

  // A visit or note belongs to the course that was running on its day (the visit that led to a
  // new remedy belongs to that remedy). A review belongs to the remedy it is about.
  const courseFor = (e: JourneyEvent): Course | undefined => {
    const o = e.kind === 'outcome' ? outcomeById.get(e.id) : undefined
    if (o) {
      const when = keyOf(o.date)
      const eligible = courses.filter((c) => c.date <= isoDate(o.date))
      const label = o.remedy.trim().toLowerCase()
      const same = eligible.filter((c) => realRemedyLabel(c.rx).toLowerCase() === label && c.key <= when)
      if (same.length) return lastOf(same)
      const earlier = eligible.filter((c) => c.key < when)
      return lastOf(earlier) ?? lastOf(eligible)
    }
    return lastOf(courses.filter((c) => c.date <= e.date))
  }

  const inside = new Map<string, JourneyEvent[]>()
  const intake: JourneyEvent[] = []
  for (const e of past) {
    const c = courseFor(e)
    if (!c) { intake.push(e); continue }
    const list = inside.get(c.rx.id) ?? []
    list.push(e)
    inside.set(c.rx.id, list)
  }
  const newestFirst = (list: JourneyEvent[]) => [...list].sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  const currentId = lastOf(courses.filter((c) => c.rx.status === 'published'))?.rx.id
  const episodes: Episode[] = courses.map((c) => {
    const evs = newestFirst(inside.get(c.rx.id) ?? [])
    const review = evs.find((e) => e.kind === 'outcome')
    const duration = c.rx.durationDays && !isOneOffRepetition(c.rx.repetition) ? c.rx.durationDays : null
    return {
      id: c.rx.id,
      kind: 'course' as const,
      title: realRemedyLabel(c.rx),
      subtitle: duration ? `${c.rx.repetition} · ${duration} days` : isOneOffRepetition(c.rx.repetition) ? c.rx.repetition : `${c.rx.repetition} · until settled`,
      duration: duration ? `${duration} days` : c.rx.repetition === 'Once only today' ? 'single dose' : c.rx.repetition === 'As needed' ? 'as needed' : 'until settled',
      startDate: c.date,
      endDate: duration ? addDaysISO(c.date, duration - 1) : null,
      status: c.rx.status === 'cancelled' ? 'cancelled' as const : c.rx.id === currentId ? 'current' as const : 'past' as const,
      outcome: review?.badge ?? null,
      hiddenFromPatient: isHidden(c.rx),
      note: c.rx.id === currentId && c.rx.status === 'published' ? courseNote(courseOf(c.rx, today)) : null,
      events: evs,
    }
  }).reverse()

  if (intake.length > 0) {
    const evs = newestFirst(intake)
    episodes.push({
      id: 'intake', kind: 'intake',
      title: courses.length ? 'Intake' : 'First visit',
      subtitle: courses.length ? 'Before the first remedy' : 'No remedy prescribed yet', duration: '',
      startDate: evs[evs.length - 1].date, endDate: null,
      status: courses.length ? 'past' : 'current',
      outcome: null, hiddenFromPatient: false, note: null, events: evs,
    })
  }
  return { episodes, planned }
}
