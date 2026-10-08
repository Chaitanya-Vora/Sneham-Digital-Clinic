import type { Appointment, CaseVisit, CheckIn, InvestigationOrder, Invoice, Outcome, Prescription } from './types'
import { toISO } from './day'

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
  ref?: { type: 'case' | 'invoice'; id: string }
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
    ev.push({ id: 'o' + o.id, kind: 'outcome', date: isoDate(o.date), sortKey: keyOf(o.date), planned: false, title: 'Follow-up review', subtitle: [o.remedy, o.note].filter(Boolean).join(' · '), badge: { label: o.outcome, tone } })
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
