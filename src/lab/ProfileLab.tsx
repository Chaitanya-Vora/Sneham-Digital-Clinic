import { useCallback, useMemo, useRef, useState } from 'react'
import { Prescription as RxIcon, NotePencil, ClipboardText, TestTube, CurrencyInr, CalendarPlus, Archive, Export, Users } from '@phosphor-icons/react'
import { BottomSheet } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { FollowUpSheet } from '../practitioner/FollowUpSheet'
import { ProfileHero } from '../practitioner/profile/ProfileHero'
import { ProfileMiniBar } from '../practitioner/profile/ProfileMiniBar'
import { NextStepCard, type NextStepView } from '../practitioner/profile/NextStepCard'
import { ActionDock } from '../practitioner/profile/ActionDock'
import { ClinicalSnapshot } from '../practitioner/profile/ClinicalSnapshot'
import { JourneyTimeline } from '../practitioner/profile/JourneyTimeline'
import { RxList } from '../practitioner/profile/RxList'
import { BillingList } from '../practitioner/profile/BillingList'
import { courseOf, courseNote } from '../core/course'
import { buildJourney } from '../core/journey'
import { nextStepOf } from '../core/nextStep'
import { toISO } from '../core/day'
import type { Appointment, Invoice, Prescription } from '../core/types'
import { Phone, FrameToast, addDays, dayLabel, type FrameToastData } from './kit'

// Profile v2 — built from the real components the app will use, fed with
// sample data. Switch the situation on the right and the hero ring, the
// "Next step" card and the timeline all change together, because they are
// computed from the same few facts (appointments + the prescribed course).
type Scenario = 'needsUrgent' | 'needsNeutral' | 'booked' | 'today' | 'inConsult' | 'noRx'
const SCENARIOS: { id: Scenario; label: string; note: string }[] = [
  { id: 'needsUrgent', label: 'Course ended, nothing booked', note: 'Amber card, Book button, ring full and amber' },
  { id: 'needsNeutral', label: 'Mid-course, nothing booked', note: 'Quiet card; ring still filling' },
  { id: 'booked', label: 'Follow-up booked', note: 'Card shows the date; no button needed' },
  { id: 'today', label: 'Visit today', note: 'Start button right on the card' },
  { id: 'inConsult', label: 'In consult now', note: 'Breathing dot + Continue' },
  { id: 'noRx', label: 'No prescription yet', note: 'Prescribe on the card' },
]

const iso = (d: Date) => d.toISOString()
const NOW = () => new Date()

function sample(sc: Scenario, hide: boolean) {
  const today = NOW()
  const ago = (n: number) => addDays(-n, today)
  const rxOld: Prescription = {
    id: 'rx0', patientId: 'p1', practitionerId: 'd1', remedy: 'Natrum Muriaticum', potency: '30C', doseGlobules: 4, repetition: 'Twice daily', durationDays: 21,
    preparation: '', status: 'published', publishedAt: iso(ago(62)), createdAt: iso(ago(62)), updatedAt: iso(ago(62)), sharedVia: ['Patient app'], remindersEnabled: true, reminderTimes: ['8:00 AM', '8:00 PM'],
  }
  const age = sc === 'needsUrgent' ? 20 : sc === 'needsNeutral' ? 3 : sc === 'booked' ? 5 : 9
  const dur = sc === 'needsNeutral' ? 30 : 14
  const rx: Prescription | null = sc === 'noRx' ? null : {
    id: 'rx1', patientId: 'p1', practitionerId: 'd1', remedy: 'Sulphur', potency: '200C', doseGlobules: 4, repetition: 'Once daily · night', durationDays: dur,
    preparation: '', status: 'published', publishedAt: iso(ago(age)), createdAt: iso(ago(age)), updatedAt: iso(ago(age)), sharedVia: ['WhatsApp', 'Patient app'], remindersEnabled: true, reminderTimes: ['9:00 PM'],
    hideRemedy: hide, slipLabel: hide ? 'Pills No. 1' : undefined,
  }
  const prescriptions = [rxOld, ...(rx ? [rx] : [])]
  const seen = (id: string, n: number, reason: string): Appointment => ({ id, patientId: 'p1', practitionerId: 'd1', time: '10:30 AM', date: toISO(ago(n)), durationMin: 20, type: 'In person', status: 'Seen', reason })
  const appointments: Appointment[] = [seen('a1', 62, 'First visit — migraine'), seen('a2', 34, 'Follow-up'), ...(rx ? [seen('a3', age, 'Follow-up')] : [])]
  if (sc === 'booked') appointments.push({ id: 'a9', patientId: 'p1', practitionerId: 'd1', time: '9:00 AM', date: toISO(addDays(9, today)), durationMin: 20, type: 'In person', status: 'Upcoming', reason: 'Follow-up' })
  if (sc === 'today') appointments.push({ id: 'a9', patientId: 'p1', practitionerId: 'd1', time: '4:30 PM', date: toISO(today), durationMin: 20, type: 'Video', status: 'Upcoming', reason: 'Follow-up' })
  if (sc === 'inConsult') appointments.push({ id: 'a9', patientId: 'p1', practitionerId: 'd1', time: '11:00 AM', date: toISO(today), durationMin: 20, type: 'In person', status: 'In consult', reason: 'Follow-up' })
  const invoices: Invoice[] = [
    { id: 'i1', invoiceNo: 118, patientId: 'p1', practitionerId: 'd1', date: toISO(ago(62)), items: [{ name: 'Consultation', qty: 1, unitPrice: 800 }, { name: 'Medicine', qty: 1, unitPrice: 400 }], paymentMode: 'UPI', amountReceived: 1200, status: 'paid', createdAt: iso(ago(62)), updatedAt: iso(ago(62)) },
    { id: 'i2', invoiceNo: 131, patientId: 'p1', practitionerId: 'd1', date: toISO(ago(34)), items: [{ name: 'Follow-up consultation', qty: 1, unitPrice: 500 }], paymentMode: 'Cash', amountReceived: 200, status: 'partial', createdAt: iso(ago(34)), updatedAt: iso(ago(34)) },
  ]
  const journey = buildJourney({
    appointments, prescriptions, invoices,
    outcomes: [{ id: 'o1', patientId: 'p1', practitionerId: 'd1', date: iso(ago(34)), remedy: 'Natrum Muriaticum 30C', outcome: 'Partial', note: 'Headaches less frequent' }],
    caseVisits: [{ id: 'c1', patientId: 'p1', practitionerId: 'd1', date: iso(ago(62)), template: 'First Visit', sections: {}, remedy: 'Natrum Muriaticum' }],
    investigationOrders: [{ id: 't1', patientId: 'p1', practitionerId: 'd1', tests: ['CBC', 'Vitamin D', 'TSH', 'HbA1c'], notes: '', createdAt: iso(ago(62)) }],
    checkIns: rx ? [{ id: 'k1', patientId: 'p1', prescriptionId: 'rx1', improvementPct: 60, changeChips: ['Sleeping better'], freeText: '', submittedAt: iso(ago(Math.max(1, age - 2))), marked: 'better' }] : [],
  }, today)
  return { today, rx, prescriptions, appointments, invoices, journey }
}

export function ProfileLab() {
  const [sc, setSc] = useState<Scenario>('needsUrgent')
  const [hide, setHide] = useState(false)
  const [tab, setTab] = useState<'journey' | 'rx' | 'bills'>('journey')
  const [sheet, setSheet] = useState(false)
  const [menu, setMenu] = useState(false)
  const [mini, setMini] = useState(false)
  const [toast, setToast] = useState<FrameToastData | null>(null)
  const closeToast = useCallback(() => setToast(null), [])
  const scroller = useRef<HTMLDivElement>(null)

  const d = useMemo(() => sample(sc, hide), [sc, hide])
  const course = useMemo(() => courseOf(d.rx, d.today), [d])
  const step = useMemo(() => nextStepOf(d.appointments, course, d.today), [d, course])

  const say = (title: string, message?: string) => setToast({ id: Date.now(), title, message })
  const view: NextStepView =
    step.kind === 'inConsult' ? { kind: 'inConsult', detail: `${step.appt.type} · started ${step.appt.time}`, onContinue: () => say('Back to the consult') }
    : step.kind === 'today' ? { kind: 'today', title: `Today at ${step.appt.time}`, detail: [step.appt.type, step.appt.reason].filter(Boolean).join(' · '), onStart: () => say('Consult started') }
    : step.kind === 'booked' ? { kind: 'booked', title: `${dayLabel(new Date(step.appt.date + 'T00:00:00'))} · ${step.appt.time}`, detail: `in ${step.inDays} day${step.inDays === 1 ? '' : 's'} · ${step.appt.type}${step.appt.reason ? ` · ${step.appt.reason}` : ''}` }
    : step.kind === 'needs' ? { kind: 'needs', urgent: step.urgent, detail: step.note, onBook: () => setSheet(true) }
    : { kind: 'noRx', onPrescribe: () => say('Opens the prescription editor') }

  const rows = useMemo(() => {
    const sorted = [...d.prescriptions].sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
    return sorted.map((rx, i) => ({ rx, course: i === 0 ? course : null, isLatest: i === 0 }))
  }, [d, course])

  const seenCount = d.appointments.filter((a) => a.status === 'Seen').length
  const lastSeen = (() => {
    const last = [...d.appointments].filter((a) => a.status === 'Seen').sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!last) return '—'
    const n = Math.round((d.today.getTime() - new Date(last.date + 'T00:00:00').getTime()) / 86400000)
    return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`
  })()

  const dock = [
    { key: 'rx', label: 'Prescribe', icon: <RxIcon size={24} weight="fill" />, primary: true, onClick: () => say('Opens the prescription editor') },
    { key: 'case', label: 'Case', icon: <NotePencil size={23} />, onClick: () => say('Opens the case sheet') },
    { key: 'review', label: 'Review', icon: <ClipboardText size={23} />, onClick: () => say('Records how the last prescription worked') },
    { key: 'tests', label: 'Tests', icon: <TestTube size={23} />, onClick: () => say('Opens test orders') },
    { key: 'bill', label: 'Bill', icon: <CurrencyInr size={23} />, onClick: () => say('Opens the bill sheet') },
  ]

  const tabs = [
    { id: 'journey' as const, label: 'Journey', n: d.journey.length },
    { id: 'rx' as const, label: 'Prescriptions', n: d.prescriptions.length },
    { id: 'bills' as const, label: 'Billing', n: d.invoices.length },
  ]

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Patient profile v2" note="Scroll it. Tap Book, the tabs, or ⋯ — all live." height={820}>
        <div ref={scroller} onScroll={(e) => setMini((e.currentTarget.scrollTop) > 230)} className="h-full overflow-y-auto no-scrollbar">
          <ProfileHero
            name="Ananya Rao" initials="AR" meta="34 yrs · Female · Chiplun" idLabel="Patient ID WS-1042" phone="9876543210"
            course={course} visits={seenCount} lastSeen={lastSeen} adherence={course.state === 'none' ? null : 86}
            onBack={() => say('Back to patients')} onMore={() => setMenu(true)} onWhatsApp={() => say('Opens WhatsApp')}
          />
          <div className="px-[18px] pb-10">
            <NextStepCard step={view} />
            <ActionDock items={dock} />
            <ClinicalSnapshot
              complaint="Recurrent migraine with nausea, worse in sunlight"
              allergies="Penicillin, Sulpha drugs"
              medication="Thyronorm 50 mcg"
              care={{ initials: 'NK', line: 'Dr. Neha Kulkarni · primary' }}
              onEdit={() => say('Opens edit details')} onOpenCare={() => say('Opens care team')}
            />
            <div className="mt-6 flex gap-5 border-b border-border">
              {tabs.map((t) => (
                <Pressable key={t.id} hap="tick" onClick={() => setTab(t.id)} className={`relative -mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[14px] font-semibold ${tab === t.id ? 'border-brand text-ink' : 'border-transparent text-faint'}`}>
                  {t.label}<span className={`rounded-pill px-1.5 text-[11px] ${tab === t.id ? 'bg-tint text-brand' : 'bg-screen text-faint'}`}>{t.n}</span>
                </Pressable>
              ))}
            </div>
            <div className="pt-4">
              {tab === 'journey' && <JourneyTimeline events={d.journey} onOpen={(r) => say(r.type === 'case' ? 'Opens that case sheet' : 'Opens that invoice')} limit={8} />}
              {tab === 'rx' && <RxList rows={rows} patientFirstName="Ananya" onCancel={() => say('Cancel prescription?', 'Asks first — then can be undone')} />}
              {tab === 'bills' && <BillingList invoices={d.invoices} onQuickBill={() => say('Opens quick bill')} onEdit={() => say('Opens invoice')} onPrint={() => say('Prints the invoice PDF')} />}
            </div>
          </div>
        </div>
        <ProfileMiniBar show={mini} name="Ananya Rao" subtitle={course.state === 'none' ? 'No prescription yet' : courseNote(course)[0].toUpperCase() + courseNote(course).slice(1)} onBack={() => say('Back to patients')} onMore={() => setMenu(true)} />
        <FrameToast toast={toast} onClose={closeToast} />
        <FollowUpSheet
          open={sheet}
          patientName="Ananya Rao"
          onClose={() => setSheet(false)}
          onSelect={(preset) => {
            setSheet(false)
            const days = Number(preset.match(/\d+/)?.[0] ?? 0)
            if (days) setToast({ id: Date.now(), title: `Booked · ${dayLabel(addDays(days))}`, message: 'Ananya Rao · 9:00 AM', undo: () => undefined })
          }}
        />
        <BottomSheet open={menu} onClose={() => setMenu(false)}>
          <div className="px-4 pb-6">
            <div className="mb-2 font-display text-[16px] font-semibold text-ink">Ananya Rao</div>
            {[
              { icon: <CalendarPlus size={20} />, label: 'Book a follow-up' },
              { icon: <Users size={20} />, label: 'Hand over or share care' },
              { icon: <Export size={20} />, label: 'Export case as PDF' },
              { icon: <Archive size={20} />, label: 'Archive patient', danger: true },
            ].map((m) => (
              <Pressable key={m.label} as="div" hap="tick" scale={0.99} onClick={() => { setMenu(false); if (m.label.startsWith('Book')) setSheet(true); else say(m.label, m.danger ? 'Archives instantly, with Undo' : undefined) }} className={`flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-3.5 text-[15px] font-medium ${m.danger ? 'text-danger' : 'text-ink'}`}>
                <span className={m.danger ? 'text-danger' : 'text-brand'}>{m.icon}</span>{m.label}
              </Pressable>
            ))}
          </div>
        </BottomSheet>
      </Phone>

      <div className="max-w-[360px] pt-10">
        <p className="font-display text-[15px] font-semibold text-ink">Try every situation</p>
        <div className="mt-2 space-y-1.5">
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => { setSc(s.id); scroller.current?.scrollTo({ top: 0 }) }} className={`block w-full rounded-[14px] border px-3.5 py-2.5 text-left ${sc === s.id ? 'border-brand bg-tint' : 'border-border bg-surface'}`}>
              <div className="text-[13.5px] font-semibold text-ink">{s.label}</div>
              <div className="text-[12px] text-muted">{s.note}</div>
            </button>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] font-semibold text-ink">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Remedy hidden from patient
        </label>
        <div className="mt-1.5 px-1 text-[12px] text-muted">The latest prescription is hidden: the doctor's screens still show the real name, with a lock note.</div>
        <p className="mt-6 font-display text-[15px] font-semibold text-ink">What changed, and why</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-body">
          <li><span className="font-semibold text-ink">The ring is the course.</span> The dotted ring around her photo fills as the medicine course goes on and turns amber when it ends — her treatment status at a glance.</li>
          <li><span className="font-semibold text-ink">One "Next step" card</span> replaces the floating follow-up bar and the separate appointment card. It is always true, and it carries the one button that moves things forward.</li>
          <li><span className="font-semibold text-ink">Journey, not History.</span> Visits, prescriptions, outcomes, case notes, tests and bills in one story, with what is still to come above "Today".</li>
          <li><span className="font-semibold text-ink">Allergies are amber and up front</span>, not buried in an edit form.</li>
          <li><span className="font-semibold text-ink">Scroll down:</span> a slim bar keeps her name, back and ⋯ in reach.</li>
        </ul>
      </div>
    </div>
  )
}
