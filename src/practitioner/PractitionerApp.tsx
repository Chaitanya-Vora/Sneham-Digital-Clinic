import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  SunHorizon,
  ArrowsClockwise,
  Prescription as RxIcon,
  Tray,
  Bell,
  MagnifyingGlass,
  Check,
  NotePencil,
  Handshake,
  CalendarBlank,
  CalendarCheck,
  CalendarPlus,
  Warning,
  SquaresFour,
  Monitor,
  User as UserIcon,
  Play,
  Stop,
  Timer,
  XCircle,
  VideoCamera,
  Clock,
  SignOut,
  Stethoscope,
  Users,
  ChartBar,
  Certificate,
  ChatText,
  CaretLeft,
  Printer,
  CurrencyInr,
  TestTube,
  X,
  WhatsappLogo,
  DeviceMobile,
  EnvelopeSimple,
  Copy,
} from '@phosphor-icons/react'
import { todayISO, toISO, formatDayLabel, addDaysISO } from '../core/day'
import { useClinic } from '../core/store'
import { useAuth } from '../auth/AuthProvider'
import { useShell, exitToLauncher } from '../core/shell'
import type { Potency, Repetition } from '../core/types'
import { isOneOffRepetition } from '../core/types'
import { MASTER_REMEDIES } from '../core/remedies'
import { INVESTIGATION_CATALOG, ALL_INVESTIGATIONS, wordsOf, matchesAllWords } from '../core/investigations'
import { Avatar, Badge, BottomSheet, Card, Chip, Label, Stepper } from '../design-system/ui'
import { PendingApproval } from '../design-system/PendingApproval'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, tabVariants, pushVariants, listContainer, listItem } from '../design-system/motion'
import { CountUp } from '../design-system/feedback'
import { PullToRefresh, useHorizontalSwipe, EdgeSwipeBack } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { shareViaWhatsApp, shareViaSms, shareViaEmail, shareTextViaWhatsApp } from '../core/share'
import { STANDARD_MEDICINE_INSTRUCTIONS } from '../core/rxInstructions'
import { exportPrescriptionPdf, exportInvoicePdf, exportInvestigationOrderPdf } from '../core/pdfExport'
import { newId } from '../core/db'
import { MobileCaseSheet } from './MobileCaseSheet'
import { MobileFollowUp } from './MobileFollowUp'
import { CalendarScreen } from './Calendar'
import { PatientSearchSheet, PatientDetailScreen, AddPatientSheet, InvoiceSheet } from './PatientSearch'
import { TodayGrid } from './TodayGrid'
import { VideoConsult } from '../video/VideoConsult'
import { ChatThread } from '../components/ChatThread'

// ME is resolved from store inside the component
type Tab = 'today' | 'calendar' | 'followups' | 'rx' | 'inbox'
const TAB_ORDER: Tab[] = ['today', 'calendar', 'followups', 'rx', 'inbox']
type Overlay = { kind: 'case' | 'compare' | 'patient-detail' | 'investigations'; patientId: string } | { kind: 'chat'; patientId: string; patientName: string } | { kind: 'video'; appointmentId: string } | null

const POTENCIES: Potency[] = ['6C', '12C', '30C', '200C', '1M', '10M', '50M', 'CM', 'LM', 'Q']
const REPS: Repetition[] = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed', 'Once only today']

const refresh = async () => {
  const s = useClinic.getState()
  if (s.userId) await s.hydrate(s.userId, '')
}

export function PractitionerApp() {
  const [tab, setTab] = useState<Tab>('today')
  const [dir, setDir] = useState(1)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [addPatientOpen, setAddPatientOpen] = useState(false)
  const [rxPatientId, setRxPatientId] = useState<string | null>(null)
  const [billSearchOpen, setBillSearchOpen] = useState(false)
  const [billPatientId, setBillPatientId] = useState<string | null>(null)
  const [instantMeetingOpen, setInstantMeetingOpen] = useState(false)
  const [guestMeeting, setGuestMeeting] = useState<{ id: string; guestName: string } | null>(null)

  const ME = useClinic((s) => s.currentPractitionerId)
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const unread = useClinic((s) => s.notifications.filter((n) => (n.surface === 'web' || n.surface === 'practitioner') && !n.read).length)

  const goTab = (next: Tab) => {
    if (next === tab) return
    setDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 1 : -1)
    setTab(next)
  }
  // Every entry point into the Rx tab must say which patient it's for —
  // Quick Rx used to guess (today's first appointment, or just the first
  // patient in the list) and could publish a real prescription to the
  // wrong person. null means "no patient chosen yet", which forces the
  // screen to ask instead of guessing.
  const goToRx = (patientId: string | null) => {
    setRxPatientId(patientId)
    goTab('rx')
  }
  const tabIdx = TAB_ORDER.indexOf(tab)
  const swipe = useHorizontalSwipe({
    onNext: () => { if (tabIdx < TAB_ORDER.length - 1) goTab(TAB_ORDER[tabIdx + 1]) },
    onPrev: () => { if (tabIdx > 0) goTab(TAB_ORDER[tabIdx - 1]) },
    count: TAB_ORDER.length,
    index: tabIdx,
  })

  const hydrated = useClinic((s) => s.hydrated)
  const hydrating = useClinic((s) => s.hydrating)

  useEffect(() => {
    const t = setInterval(() => {
      const s = useClinic.getState()
      if (s.userId && !s.hydrating) s.hydrate(s.userId, '')
    }, 15000)
    return () => clearInterval(t)
  }, [])

  if (!doctor) {
    if (!hydrated || hydrating) {
      return (
        <div className="flex h-full items-center justify-center bg-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
        </div>
      )
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-screen px-6">
        <div className="text-center">
          <div className="font-display text-[18px] font-bold text-ink">No practitioner profile</div>
          <div className="mt-1 text-[13px] text-muted">Complete onboarding or check your connection.</div>
        </div>
        <button onClick={() => { const s = useClinic.getState(); if (s.userId) s.hydrate(s.userId, '') }} className="rounded-[12px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white">Retry</button>
      </div>
    )
  }

  if (doctor.status === 'pending') {
    return <PendingApproval name={doctor.name} />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-screen">
      {/* base app */}
      <div className="flex h-full flex-col">
        {/* pinned top bar */}
        <div className="flex items-center gap-3 px-[18px] pb-2 pt-[var(--app-top)]">
          <Pressable as="div" hap="tick" scale={0.94} onClick={() => setSwitchOpen(true)} className="cursor-pointer">
            <Avatar initials={doctor.initials} size={38} />
          </Pressable>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[15px] font-bold text-ink">{doctor.name.split(' ').slice(0, 2).join(' ')}</div>
            <div className="truncate text-[11px] text-faint">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · Chiplun clinic</div>
          </div>
          <Pressable ariaLabel="search patients" hap="tick" onClick={() => setSearchOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <MagnifyingGlass size={17} className="text-body" />
          </Pressable>
          <Pressable ariaLabel="notifications" hap="tick" onClick={() => goTab('inbox')} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <Bell size={18} className="text-body" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>
            )}
          </Pressable>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence custom={dir} initial={false}>
            <motion.div key={tab} className="absolute inset-0" custom={dir} variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.15 }} {...swipe}>
              {tab === 'calendar' ? (
                <CalendarScreen onOpenPatient={(id) => setOverlay({ kind: 'patient-detail', patientId: id })} />
              ) : (
                <PullToRefresh onRefresh={refresh} className="h-full px-[18px] pb-[120px] pt-2">
                  {tab === 'today' && <TodayGrid openCase={(id) => setOverlay({ kind: 'case', patientId: id })} goRx={goToRx} startVideo={(apptId) => setOverlay({ kind: 'video', appointmentId: apptId })} onQuickBill={() => setBillSearchOpen(true)} onInstantMeeting={() => setInstantMeetingOpen(true)} />}
                  {tab === 'followups' && <FollowupsScreen openCompare={(id) => setOverlay({ kind: 'compare', patientId: id })} />}
                  {tab === 'rx' && <QuickRxScreen patientId={rxPatientId} onPatientPicked={setRxPatientId} />}
                  {tab === 'inbox' && <InboxScreen onOpenPatient={(id) => setOverlay({ kind: 'patient-detail', patientId: id })} onOpenChat={(id, name) => setOverlay({ kind: 'chat', patientId: id, patientName: name })} />}
                </PullToRefresh>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <TabBar tab={tab} onChange={(t) => (t === 'rx' ? goToRx(null) : goTab(t))} />

      {/* overlays: case sheet / compare / video */}
      <AnimatePresence custom={1}>
        {overlay && (
          <motion.div key={overlay.kind + ('patientId' in overlay ? overlay.patientId : overlay.appointmentId)} className="absolute inset-0 z-40 bg-screen" custom={1} variants={pushVariants} initial="enter" animate="center" exit="exit" transition={spring}>
            <EdgeSwipeBack onBack={() => setOverlay(null)}>
              {overlay.kind === 'video' ? (
                <VideoConsultOverlay appointmentId={overlay.appointmentId} onClose={() => setOverlay(null)} />
              ) : overlay.kind === 'case' ? (
                <MobileCaseSheet patientId={overlay.patientId} onBack={() => setOverlay(null)} onPrescribe={() => { setOverlay(null); goToRx(overlay.patientId) }} />
              ) : overlay.kind === 'compare' ? (
                <MobileFollowUp patientId={overlay.patientId} onBack={() => setOverlay(null)} onDone={() => setOverlay(null)} />
              ) : overlay.kind === 'chat' ? (
                <ChatOverlay patientId={overlay.patientId} patientName={overlay.patientName} onBack={() => setOverlay(null)} />
              ) : overlay.kind === 'investigations' ? (
                <QuickInvestigationScreen patientId={overlay.patientId} onBack={() => setOverlay(null)} />
              ) : (
                <PatientDetailScreen
                  patientId={overlay.patientId}
                  onBack={() => setOverlay(null)}
                  onOpenCase={(id) => setOverlay({ kind: 'case', patientId: id })}
                  onOpenFollowUp={(id) => setOverlay({ kind: 'compare', patientId: id })}
                  onPrescribe={() => { setOverlay(null); goToRx(overlay.patientId) }}
                  onOrderInvestigations={() => setOverlay({ kind: 'investigations', patientId: overlay.patientId })}
                />
              )}
            </EdgeSwipeBack>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileSheet open={switchOpen} onClose={() => setSwitchOpen(false)} />
      <PatientSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(id) => { setSearchOpen(false); setOverlay({ kind: 'patient-detail', patientId: id }) }}
        onAddPatient={() => { setSearchOpen(false); setAddPatientOpen(true) }}
      />
      <AddPatientSheet
        open={addPatientOpen}
        onClose={() => setAddPatientOpen(false)}
        onAdded={(id) => { setAddPatientOpen(false); setOverlay({ kind: 'case', patientId: id }) }}
      />
      <PatientSearchSheet
        open={billSearchOpen}
        onClose={() => setBillSearchOpen(false)}
        onSelect={(id) => { setBillSearchOpen(false); setBillPatientId(id) }}
        onAddPatient={() => { setBillSearchOpen(false); setAddPatientOpen(true) }}
      />
      <InvoiceSheet
        patientId={billPatientId}
        open={billPatientId !== null}
        onClose={() => setBillPatientId(null)}
      />
      <InstantMeetingSheet
        open={instantMeetingOpen}
        onClose={() => setInstantMeetingOpen(false)}
        onStart={(id, guestName) => { setGuestMeeting({ id, guestName }); setInstantMeetingOpen(false) }}
      />
      {guestMeeting && (
        <div className="absolute inset-0 z-50 bg-[#1a1a1a]">
          <VideoConsult
            patientName={guestMeeting.guestName || 'Guest'}
            practitionerName={doctor?.name ?? 'Doctor'}
            appointmentId={guestMeeting.id}
            onEnd={() => setGuestMeeting(null)}
          />
        </div>
      )}
    </div>
  )
}

// ── doctor profile sheet ──
function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const patientCount = useClinic((s) => s.patients.length)
  const totalAppts = useClinic((s) => s.appointments.length)
  const outcomeCount = useClinic((s) => s.outcomes.length)
  const rxCount = useClinic((s) => s.prescriptions.length)
  const { signOut } = useAuth()

  if (!doctor) return null

  const stats = [
    { icon: Users, label: 'Patients', value: patientCount },
    { icon: CalendarCheck, label: 'Appointments', value: totalAppts },
    { icon: RxIcon, label: 'Prescriptions', value: rxCount },
    { icon: ChartBar, label: 'Outcomes', value: outcomeCount },
  ]

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center gap-3.5">
        <Avatar initials={doctor.initials} size={52} />
        <div className="flex-1">
          <div className="font-display text-[18px] font-bold text-ink">{doctor.name}</div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <Stethoscope size={14} weight="fill" className="text-brand" />
            {doctor.specialty}
          </div>
          {doctor.qualifications && (
            <div className="flex items-center gap-1.5 text-[12px] text-faint">
              <Certificate size={13} />
              {doctor.qualifications}
            </div>
          )}
          {doctor.registrationNo && (
            <div className="text-[11px] text-faint">Reg. {doctor.registrationNo}</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] border border-border bg-surface px-2 py-3 text-center">
            <s.icon size={18} weight="fill" className="mx-auto text-brand" />
            <div className="mt-1 font-display text-[16px] font-bold text-ink">{s.value}</div>
            <div className="text-[10px] text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <div className="rounded-[14px] border border-border bg-surface px-4 py-3">
          <div className="text-[12px] font-semibold uppercase tracking-label text-muted">Remedy list</div>
          <div className="mt-1 text-[13px] text-body">{doctor.remedyList.length} remedies configured</div>
        </div>
      </div>

      <Pressable
        as="div"
        hap="impact"
        scale={0.98}
        onClick={async () => { onClose(); await signOut() }}
        className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-danger/20 bg-danger/5 px-4 py-3"
      >
        <SignOut size={18} weight="bold" className="text-danger" />
        <span className="text-[14px] font-semibold text-danger">Sign out</span>
      </Pressable>
    </BottomSheet>
  )
}

// ── FOLLOW-UPS ──
function FollowupsScreen({ openCompare }: { openCompare: (id: string) => void }) {
  const patients = useClinic((s) => s.patients)
  const appointments = useClinic((s) => s.appointments)
  const rows = useMemo(() => {
    return patients
      .filter((p) => p.currentRemedy)
      .map((p) => {
        const nextAppt = appointments.find((a) => a.patientId === p.id && a.status === 'Upcoming')
        return {
          id: p.id,
          name: p.name,
          when: nextAppt ? `Due ${formatDayLabel(nextAppt.date)} · ${nextAppt.time}` : `Last seen ${p.lastSeen}`,
          remedy: p.currentRemedy!,
          overdue: !nextAppt,
          i: p.initials,
        }
      })
      .sort((a, b) => (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1))
  }, [patients, appointments])
  const overdueCount = rows.filter((r) => r.overdue).length
  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[20px] font-bold text-ink">Follow-ups due</div>
        <div className="text-[13px] text-muted">{rows.length} {rows.length === 1 ? 'patient' : 'patients'}{overdueCount > 0 ? ` · ${overdueCount} need scheduling` : ''}</div>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint">
            <ArrowsClockwise size={24} className="text-faint" />
          </div>
          <div className="mt-4 font-display text-[16px] font-semibold text-ink">No follow-ups pending</div>
          <div className="mt-1 text-[13px] text-muted">Patients with active remedies will appear here<br/>when they need a check-in.</div>
        </div>
      ) : (
      <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
        {rows.map((r) => (
          <motion.div key={r.id} variants={listItem}>
            <Pressable as="div" hap="tick" scale={0.99} onClick={() => openCompare(r.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] border border-border bg-surface px-3.5 py-3 shadow-card">
              <Avatar initials={r.i} size={40} />
              <div className="flex-1">
                <div className="font-display text-[14px] font-semibold text-ink">{r.name}</div>
                <div className="text-[12px] text-muted">{r.remedy}</div>
              </div>
              <div className="text-right">
                <div className={`text-[12px] font-semibold ${r.overdue ? 'text-danger' : 'text-body'}`}>{r.when}</div>
                <div className="text-[12px] font-semibold text-brand">Compare →</div>
              </div>
            </Pressable>
          </motion.div>
        ))}
      </motion.div>
      )}
    </div>
  )
}

// ── QUICK RX ──
function QuickRxScreen({ patientId, onPatientPicked }: { patientId: string | null; onPatientPicked: (id: string | null) => void }) {
  const ME = useClinic((s) => s.currentPractitionerId)
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const publish = useClinic((s) => s.publishPrescription)
  const updatePractitioner = useClinic((s) => s.updatePractitioner)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const markPrescriptionShared = useClinic((s) => s.markPrescriptionShared)
  const patients = useClinic((s) => s.patients)
  const toast = useToast()

  const [pickerQuery, setPickerQuery] = useState('')
  const [publishedRxId, setPublishedRxId] = useState<string | null>(null)
  const publishedRx = useClinic((s) => s.prescriptions.find((r) => r.id === publishedRxId))
  const currentPatient = patients.find((p) => p.id === patientId)

  // Nothing pre-selected: a real remedy, patient and dose must be chosen
  // before Publish does anything. This used to arrive pre-filled with a
  // default remedy and an enabled Publish button, so one tap could send an
  // invented prescription to whichever patient was guessed above.
  // The remedy field is the actual value — typing always works, chips below
  // are just a fast-select that fill the same field. It used to only accept
  // a click on a chip; there was no way to type a remedy that wasn't
  // already on the personal or master list.
  const [remedy, setRemedy] = useState('')
  const [showAllRemedies, setShowAllRemedies] = useState(false)
  const [potency, setPotency] = useState<Potency>('200C')
  const [dose, setDose] = useState(4)
  const [duration, setDuration] = useState(14)
  const [rep, setRep] = useState<Repetition>('Once daily · night')
  const [prep, setPrep] = useState('')
  const [done, setDone] = useState(false)

  // What actually prints on the slip — in the doctor's own words/shorthand,
  // same pattern as the web console's prescription writer. Auto-fills from
  // the structured fields until she edits it directly, then her words win.
  const [bodyText, setBodyText] = useState('')
  const [bodyTouched, setBodyTouched] = useState(false)
  useEffect(() => {
    if (bodyTouched) return
    if (!remedy.trim()) { setBodyText(''); return }
    const doseLine = isOneOffRepetition(rep)
      ? `${remedy} ${potency} — ${dose} globules, ${rep.toLowerCase()}`
      : `${remedy} ${potency} — ${dose} globules, ${rep}${duration ? `, ${duration} days` : ''}`
    setBodyText(doseLine)
  }, [remedy, potency, dose, rep, duration, bodyTouched])

  const remedyList = doctor?.remedyList ?? []
  const list = useMemo(() => {
    const q = remedy.toLowerCase()
    const personal = remedyList.filter((r) => r.toLowerCase().includes(q))
    if (q.length < 2) return personal
    const personalSet = new Set(remedyList.map((r) => r.toLowerCase()))
    const master = MASTER_REMEDIES.filter((r) => r.toLowerCase().includes(q) && !personalSet.has(r.toLowerCase()))
    return [...personal, ...master]
  }, [remedyList, remedy])
  const isNewRemedy = remedy.trim().length > 1 && !remedyList.some((r) => r.toLowerCase() === remedy.trim().toLowerCase())

  const canPublish = !!currentPatient && !!remedy.trim()

  function resetForm() {
    setRemedy('')
    setShowAllRemedies(false)
    setPotency('200C')
    setDose(4)
    setDuration(14)
    setRep('Once daily · night')
    setPrep('')
    setBodyText('')
    setBodyTouched(false)
    setPublishedRxId(null)
  }

  // Fires the real external share for the just-published prescription and
  // only then marks the channel shared — same "no fake success" rule as the
  // web console's chips. WhatsApp/SMS need a phone on file; Email always
  // opens (blank-recipient compose is still useful — she picks the recipient).
  function shareRx(channel: 'WhatsApp' | 'SMS' | 'Email') {
    if (!publishedRxId || !currentPatient) return
    const message = `Prescription from ${doctor?.name ?? 'your doctor'} for ${currentPatient.name}:\n${bodyText.trim() || `${remedy} ${potency}`}${prep.trim() ? `\nPreparation: ${prep.trim()}` : ''}`
    let sent = true
    if (channel === 'WhatsApp') sent = shareViaWhatsApp(currentPatient.phone, message)
    else if (channel === 'SMS') sent = shareViaSms(currentPatient.phone, message)
    else shareViaEmail(undefined, `Prescription for ${currentPatient.name}`, message)
    if (!sent) { toast({ title: 'No phone number on file', message: `Add a phone number for ${currentPatient.name} first.` }); return }
    haptic('success')
    markPrescriptionShared(publishedRxId, channel)
  }

  function onPublish() {
    if (!canPublish || !currentPatient || !remedy.trim()) return
    const rx = publish({
      patientId: currentPatient.id, practitionerId: ME, remedy: remedy.trim(), potency, doseGlobules: dose, repetition: rep,
      durationDays: isOneOffRepetition(rep) ? null : duration, preparation: prep, bodyText: bodyText.trim() || undefined,
      remindersEnabled: !isOneOffRepetition(rep), reminderTimes: rep === 'Twice daily' ? ['8:00 AM', '8:00 PM'] : ['8:00 PM'],
      sharedVia: ['Patient app'], origin: 'practitioner',
    })
    setPublishedRxId(rx.id)
    // Publishing books the review too, same as the web console — a course
    // that ends without anyone checking back is exactly what this closes.
    if (!isOneOffRepetition(rep) && duration > 0) {
      scheduleFollowUp({
        patientId: currentPatient.id,
        practitionerId: ME,
        time: '10:00 AM',
        date: addDaysISO(todayISO(), duration),
        type: 'In person',
        reason: 'Follow-up',
      })
    }
    haptic('success')
    setDone(true)
  }

  // No patient chosen yet (direct tab tap, or "Change" below) — ask instead
  // of guessing from today's appointments.
  if (!currentPatient) {
    const q = pickerQuery.trim().toLowerCase()
    const matches = q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients
    return (
      <div className="space-y-4">
        <div>
          <div className="font-display text-[20px] font-bold text-ink">Quick prescription</div>
          <div className="text-[13px] text-muted">Choose who you're prescribing for.</div>
        </div>
        <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
          <MagnifyingGlass size={16} className="text-faint" />
          <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Search patients" className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint" data-selectable="true" />
        </div>
        <div className="space-y-2">
          {matches.map((p) => (
            <Pressable key={p.id} as="div" hap="tick" scale={0.99} onClick={() => onPatientPicked(p.id)} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-3.5 py-3">
              <Avatar initials={p.initials} size={38} />
              <div className="flex-1">
                <div className="font-display text-[14px] font-semibold text-ink">{p.name}</div>
                <div className="text-[12px] text-muted">{p.age} &middot; {p.wsCode}</div>
              </div>
            </Pressable>
          ))}
          {matches.length === 0 && (
            <div className="py-10 text-center text-[13px] text-muted">No patients found</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[20px] font-bold text-ink">Quick prescription</div>
        <div className="text-[13px] text-muted">From your remedy list · publishes to the patient app.</div>
      </div>

      <Card className="flex items-center gap-3 px-4 py-3">
        <Avatar initials={currentPatient.initials} size={40} />
        <div className="flex-1">
          <div className="font-display text-[14px] font-semibold text-ink">{currentPatient.name} · {currentPatient.age}</div>
          <div className="text-[12px] text-muted">{currentPatient.wsCode}</div>
        </div>
        <Pressable hap="tick" onClick={() => onPatientPicked(null)} className="text-[12px] font-semibold text-brand">Change</Pressable>
      </Card>

      <div>
        <Label>Remedy</Label>
        <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
          <MagnifyingGlass size={16} className="text-faint" />
          <input value={remedy} onChange={(e) => setRemedy(e.target.value)} placeholder="Type or select a remedy" className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint" data-selectable="true" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(remedy || showAllRemedies ? list : list.slice(0, 8)).map((r) => (
            <Chip key={r} selected={r === remedy} onClick={() => { haptic('select'); setRemedy(r) }}>
              {r === remedy && <Check size={12} weight="bold" className="mr-1 inline" />}{r}
            </Chip>
          ))}
          {!remedy && !showAllRemedies && list.length > 8 && (
            <button onClick={() => setShowAllRemedies(true)} className="rounded-pill border border-dashed border-border-dash px-3 py-1 text-[12px] font-semibold text-muted">
              +{list.length - 8} more
            </button>
          )}
          {isNewRemedy && (
            <Chip
              className="border-dashed"
              onClick={() => {
                if (!doctor) return
                haptic('success')
                updatePractitioner(doctor.id, { remedyList: [...doctor.remedyList, remedy.trim()] })
              }}
            >
              + Add "{remedy.trim()}" to my list
            </Chip>
          )}
        </div>
      </div>

      <div>
        <Label>Potency</Label>
        <input
          value={potency}
          onChange={(e) => setPotency(e.target.value)}
          placeholder="e.g. 200C, 50M, LM1"
          className="mt-2 w-full rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-green-border"
        />
        <div className="mt-2 flex gap-2">
          {POTENCIES.map((p) => <Chip key={p} selected={p === potency} onClick={() => { haptic('select'); setPotency(p) }} className="flex-1 text-center">{p}</Chip>)}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>Dose</Label>
        <Stepper value={dose} onChange={(v) => { haptic('tick'); setDose(v) }} suffix="globules" />
      </div>

      <div className="flex items-center justify-between">
        <Label>Duration</Label>
        <Stepper value={duration} min={1} max={90} onChange={(v) => { haptic('tick'); setDuration(v) }} suffix="days" />
      </div>

      <div>
        <Label>Repetition</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {REPS.map((r) => <Chip key={r} selected={r === rep} onClick={() => { haptic('select'); setRep(r) }}>{r}</Chip>)}
        </div>
      </div>

      <div>
        <Label>Prescription · exactly as it will print</Label>
        <textarea
          value={bodyText}
          onChange={(e) => { setBodyText(e.target.value); setBodyTouched(true) }}
          rows={3}
          placeholder="Write it exactly as it should appear on the printed slip — your own shorthand is fine (e.g. Px 200C, 1 dose)"
          data-selectable="true"
          className="mt-2 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none placeholder:text-faint focus:border-green-border"
        />
        <p className="mt-1.5 text-[11.5px] text-faint">
          This is the only thing that prints. The fields above are just a quick way to fill it in and still drive dose reminders — write over them freely.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Preparation note</Label>
          <Pressable hap="tick" onClick={() => setPrep(STANDARD_MEDICINE_INSTRUCTIONS)} className="text-[11.5px] font-semibold text-brand">
            Insert standard instructions
          </Pressable>
        </div>
        <textarea value={prep} onChange={(e) => setPrep(e.target.value)} rows={3} placeholder="e.g. Dissolve under the tongue at night, 15 minutes away from food or drink." data-selectable="true" className="mt-2 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none focus:border-green-border" />
      </div>

      <Pressable
        hap="none"
        onClick={onPublish}
        className={`flex w-full items-center justify-center gap-2 rounded-pill py-3 font-display text-[15px] font-semibold text-white shadow-float transition ${
          canPublish ? 'bg-accent' : 'bg-accent/40 pointer-events-none'
        }`}
      >
        <RxIcon size={18} weight="fill" /> Publish &amp; share
      </Pressable>

      <BottomSheet open={done} onClose={() => setDone(false)}>
        <div className="flex flex-col items-center py-3 text-center">
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-tint text-accent">
            <Check size={32} weight="bold" />
          </motion.div>
          <div className="mt-3 font-display text-[19px] font-bold text-ink">Prescription published</div>
          <div className="mt-1 px-4 text-[13px] text-muted">
            {remedy} {potency} &middot; {rep} &mdash; sent to {currentPatient.name}{"'"}s app.
            {!isOneOffRepetition(rep) && <> Follow-up auto-booked for {formatDayLabel(addDaysISO(todayISO(), duration))}.</>}
          </div>

          <div className="mt-4 flex w-full gap-2">
            {([['WhatsApp', WhatsappLogo], ['SMS', DeviceMobile], ['Email', EnvelopeSimple]] as const).map(([c, Icon]) => (
              <Pressable
                key={c}
                hap="tick"
                onClick={() => shareRx(c)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-[14px] border px-2 py-2.5 text-[11.5px] font-semibold ${
                  publishedRx?.sharedVia.includes(c) ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'
                }`}
              >
                <Icon size={17} weight="fill" />
                {c}
              </Pressable>
            ))}
          </div>

          <Pressable
            hap="tick"
            onClick={async () => {
              if (!publishedRx) return
              await exportPrescriptionPdf(publishedRx, currentPatient).catch(() => {})
            }}
            className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-body"
          >
            <Printer size={14} /> Print / save as PDF
          </Pressable>
          <div className="mt-4 flex w-full gap-2">
            <Pressable hap="tick" onClick={() => setDone(false)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center font-display text-[14px] font-semibold text-body">Done</Pressable>
            <Pressable hap="tick" onClick={() => { setDone(false); resetForm(); onPatientPicked(null) }} className="flex-1 rounded-pill bg-brand py-2.5 text-center font-display text-[14px] font-semibold text-screen">Next patient</Pressable>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

// ── QUICK INVESTIGATION ORDER (lab tests / scans) ──
// Same real letterhead as prescriptions, same search-only picker as the web
// console's InvestigationWriter — matching logic lives in
// core/investigations.ts so both stay in sync.
function QuickInvestigationScreen({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const ME = useClinic((s) => s.currentPractitionerId)
  const createOrder = useClinic((s) => s.createInvestigationOrder)
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const matches = useMemo(() => {
    const queryWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (queryWords.length === 0) return []
    const selectedSet = new Set(selected)
    const fromCategory = INVESTIGATION_CATALOG
      .filter((c) => matchesAllWords(queryWords, wordsOf(c.category)))
      .flatMap((c) => c.tests.map((test) => ({ test, category: c.category })))
    const fromTest = ALL_INVESTIGATIONS.filter(({ test }) => matchesAllWords(queryWords, wordsOf(test)))
    const seen = new Set<string>()
    return [...fromCategory, ...fromTest]
      .filter(({ test }) => !seen.has(test) && !selectedSet.has(test) && (seen.add(test), true))
      .slice(0, 12)
  }, [query, selected])

  const toggleTest = (test: string) => {
    haptic('select')
    setSelected((s) => (s.includes(test) ? s.filter((t) => t !== test) : [...s, test]))
  }

  if (!patient) return (
    <div className="flex h-full items-center justify-center bg-screen">
      <div className="text-center">
        <div className="text-[14px] text-muted">Patient not found</div>
        <button onClick={onBack} className="mt-3 text-[13px] font-semibold text-brand">Go back</button>
      </div>
    </div>
  )

  async function handleGenerate() {
    if (!patient) return
    if (selected.length === 0) return
    const order = createOrder({ patientId, practitionerId: ME, tests: selected, notes: notes.trim() })
    haptic('success')
    await exportInvestigationOrderPdf(order, patient).catch(() => {
      toast({ title: 'PDF export failed', message: 'Please try again.' })
    })
    toast({ title: 'Investigation slip generated', message: `${selected.length} test${selected.length === 1 ? '' : 's'} for ${patient.name}.` })
    onBack()
  }

  return (
    <div className="flex h-full flex-col bg-screen">
      <div className="px-[18px] pb-2 pt-[var(--app-top)]">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-brand">
          <CaretLeft size={15} weight="bold" /> Back
        </button>
        <div className="mt-1 font-display text-[18px] font-bold text-ink">Investigations</div>
        <div className="text-[12px] text-faint">{patient.name} · same letterhead as prescriptions</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-[18px] pb-[120px] pt-2">
        <div>
          <Label>Add investigation</Label>
          <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
            <MagnifyingGlass size={16} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing — CBC, thyroid, vitamin d…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              data-selectable="true"
            />
          </div>
          {matches.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {matches.map(({ test, category }) => (
                <Pressable
                  key={test}
                  hap="none"
                  onClick={() => { toggleTest(test); setQuery('') }}
                  className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-left"
                >
                  <span className="text-[13px] font-semibold text-ink">{test}</span>
                  <span className="shrink-0 text-[11px] text-faint">{category}</span>
                </Pressable>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>Selected{selected.length > 0 ? ` (${selected.length})` : ''}</Label>
          {selected.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-faint">Nothing added yet — search above to add tests.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.map((test) => (
                <span key={test} className="flex items-center gap-1.5 rounded-pill border border-border bg-tint px-3 py-1.5 text-[12.5px] font-semibold text-ink-deep">
                  {test}
                  <button onClick={() => toggleTest(test)} className="text-faint">
                    <X size={12} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>What&apos;s this for? (prints as &quot;Diagnosis&quot; on the slip)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — leave blank to use the patient's chief complaint"
            rows={2}
            data-selectable="true"
            className="mt-2 w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none placeholder:text-faint focus:border-green-border"
          />
        </div>

        <Pressable
          hap="none"
          onClick={handleGenerate}
          className={`flex w-full items-center justify-center gap-2 rounded-pill py-3 font-display text-[15px] font-semibold text-white shadow-float transition ${
            selected.length > 0 ? 'bg-accent' : 'bg-accent/40 pointer-events-none'
          }`}
        >
          <TestTube size={18} weight="fill" /> Generate &amp; save PDF
        </Pressable>
      </div>
    </div>
  )
}

// ── CHAT OVERLAY (full-screen WhatsApp-style chat) ──
function ChatOverlay({ patientId, patientName, onBack }: { patientId: string; patientName: string; onBack: () => void }) {
  const initials = patientName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-full flex-col bg-screen">
      {/* WhatsApp-style green header */}
      <div className="flex items-center gap-3 bg-brand px-3 pb-3 pt-[var(--app-top)]">
        <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="flex h-9 w-9 items-center justify-center">
          <CaretLeft size={20} weight="bold" className="text-white" />
        </Pressable>
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 font-display text-[14px] font-semibold text-white">
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-display text-[16px] font-semibold text-white">{patientName}</div>
          <div className="text-[11px] text-white/70">Patient</div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ChatThread patientId={patientId} viewAs="practitioner" />
      </div>
    </div>
  )
}

// ── INBOX (WhatsApp-style conversations + alerts) ──
function InboxScreen({ onOpenPatient, onOpenChat }: { onOpenPatient: (id: string) => void; onOpenChat: (id: string, name: string) => void }) {
  const messages = useClinic((s) => s.messages)
  const patients = useClinic((s) => s.patients)
  const notifs = useClinic((s) => s.notifications.filter((n) => n.surface === 'web' || n.surface === 'practitioner'))
  const accept = useClinic((s) => s.acceptHandoff)
  const markRead = useClinic((s) => s.markNotificationRead)
  const handoffs = useClinic((s) => s.handoffs)
  const practitioners = useClinic((s) => s.practitioners)
  const [noteSheet, setNoteSheet] = useState<string | null>(null)
  const [view, setView] = useState<'chats' | 'alerts'>('chats')
  const iconFor = (k: string) => (k === 'handoff' ? Handshake : k === 'booking' ? CalendarCheck : k === 'low_stock' ? Warning : Bell)

  const conversations = useMemo(() => {
    const byPatient = new Map<string, { patientId: string; lastMsg: typeof messages[0]; unread: number }>()
    for (const m of messages) {
      const existing = byPatient.get(m.patientId)
      if (!existing || m.sentAt > existing.lastMsg.sentAt) {
        byPatient.set(m.patientId, {
          patientId: m.patientId,
          lastMsg: m,
          unread: (existing?.unread ?? 0) + (m.sender === 'patient' && !m.read ? 1 : 0),
        })
      } else if (m.sender === 'patient' && !m.read) {
        existing.unread++
      }
    }
    return [...byPatient.values()].sort((a, b) => b.lastMsg.sentAt.localeCompare(a.lastMsg.sentAt))
  }, [messages])

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)
  const unreadNotifs = notifs.filter((n) => !n.read).length

  const activeHandoff = noteSheet ? handoffs.find((h) => h.status === 'pending') : null
  const fromDoc = activeHandoff ? practitioners.find((p) => p.id === activeHandoff.fromPractitionerId) : null
  const handoffPatient = activeHandoff ? patients.find((p) => p.id === activeHandoff.patientId) : null

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[20px] font-bold text-ink">Inbox</div>
        <div className="text-[13px] text-muted">Messages and clinic alerts.</div>
      </div>

      {/* Chats / Alerts toggle */}
      <div className="flex gap-2">
        <Pressable hap="tick" onClick={() => setView('chats')} className={`flex-1 rounded-pill py-2.5 text-center text-[13px] font-semibold transition ${view === 'chats' ? 'bg-brand text-screen' : 'border border-border bg-surface text-body'}`}>
          Chats{totalUnread > 0 ? ` (${totalUnread})` : ''}
        </Pressable>
        <Pressable hap="tick" onClick={() => setView('alerts')} className={`flex-1 rounded-pill py-2.5 text-center text-[13px] font-semibold transition ${view === 'alerts' ? 'bg-brand text-screen' : 'border border-border bg-surface text-body'}`}>
          Alerts{unreadNotifs > 0 ? ` (${unreadNotifs})` : ''}
        </Pressable>
      </div>

      {view === 'chats' ? (
        conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint">
              <ChatText size={24} className="text-faint" />
            </div>
            <div className="mt-4 font-display text-[16px] font-semibold text-ink">No conversations</div>
            <div className="mt-1 text-[13px] text-muted">Messages from patients will<br/>appear here.</div>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-[16px] bg-surface">
            {conversations.map((c) => {
              const patient = patients.find((p) => p.id === c.patientId)
              const name = patient?.name ?? 'Unknown'
              const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              const preview = c.lastMsg.text.length > 55 ? c.lastMsg.text.slice(0, 55) + '...' : c.lastMsg.text
              const time = new Date(c.lastMsg.sentAt)
              const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const isToday = new Date().toDateString() === time.toDateString()
              const dateStr = isToday ? timeStr : time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              return (
                <Pressable key={c.patientId} hap="tick" onClick={() => onOpenChat(c.patientId, name)}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar initials={initials} size={50} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className={`truncate font-display text-[15px] font-semibold ${c.unread > 0 ? 'text-ink' : 'text-body'}`}>{name}</div>
                        <span className={`shrink-0 text-[11.5px] ${c.unread > 0 ? 'font-semibold text-brand' : 'text-faint'}`}>{dateStr}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className={`truncate text-[13px] ${c.unread > 0 ? 'font-medium text-body' : 'text-muted'}`}>
                          {c.lastMsg.sender === 'practitioner' && <span className="text-faint">You: </span>}
                          {preview}
                        </div>
                        {c.unread > 0 && (
                          <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{c.unread}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Pressable>
              )
            })}
          </div>
        )
      ) : (
        notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint">
              <Tray size={24} className="text-faint" />
            </div>
            <div className="mt-4 font-display text-[16px] font-semibold text-ink">All caught up</div>
            <div className="mt-1 text-[13px] text-muted">New handoffs, bookings and alerts<br/>will appear here.</div>
          </div>
        ) : (
          <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
            {notifs.map((n) => {
              const Icon = iconFor(n.kind)
              return (
                <motion.div key={n.id} variants={listItem}>
                  <Pressable
                    hap="tick"
                    onClick={() => {
                      if (!n.read) markRead(n.id)
                      if (n.patientId) onOpenPatient(n.patientId)
                    }}
                  >
                    <Card className={`px-4 py-3 transition ${!n.read ? 'border-brand/20 bg-tint-pale' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${n.severity === 'purple' ? 'bg-purple-tint text-purple' : n.severity === 'warn' ? 'bg-amber-tint text-amber-text' : 'bg-tint-pale text-brand'}`}>
                          <Icon size={18} weight="fill" />
                        </div>
                        <div className="flex-1">
                          <div className={`font-display text-[14px] font-semibold ${!n.read ? 'text-ink' : 'text-body'}`}>{n.title}</div>
                          <div className="text-[12px] leading-snug text-muted" data-selectable="true">{n.message}</div>
                          <div className="mt-1 text-[11px] text-faint">{n.time}</div>
                          {n.pending && (
                            <div className="mt-2 flex gap-2">
                              <Pressable hap="success" onClick={(e) => { e?.stopPropagation(); const ho = handoffs.find((h) => h.status === 'pending'); if (ho) accept(ho.id) }} className="rounded-pill bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-screen">Accept</Pressable>
                              <Pressable hap="tick" onClick={(e) => { e?.stopPropagation(); haptic('tick'); setNoteSheet(n.id) }} className="rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-body">Read note</Pressable>
                            </div>
                          )}
                        </div>
                        {!n.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand" />}
                      </div>
                    </Card>
                  </Pressable>
                </motion.div>
              )
            })}
          </motion.div>
        )
      )}

      <BottomSheet open={noteSheet !== null} onClose={() => setNoteSheet(null)}>
        {activeHandoff && (
          <div className="space-y-3">
            <div className="font-display text-[17px] font-bold text-ink">Handoff note</div>
            <Card className="space-y-2.5 px-4 py-3">
              <div className="flex items-center justify-between">
                <Label>From</Label>
                <div className="text-[13px] font-semibold text-ink">{fromDoc?.name ?? 'Unknown'}</div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Patient</Label>
                <div className="text-[13px] font-semibold text-ink">{handoffPatient?.name ?? 'Unknown'}</div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Current remedy</Label>
                <Badge tone="green">{activeHandoff.note.currentRemedy}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <Label>Case status</Label>
                <Badge tone="amber">Partial improvement</Badge>
              </div>
              <div className="border-t border-border pt-2.5">
                <Label>Reason</Label>
                <div className="mt-1 text-[13px] text-body">{activeHandoff.note.reason}</div>
              </div>
              <div className="border-t border-border pt-2.5">
                <Label>Watch for</Label>
                <div className="mt-1 text-[13px] text-body">{activeHandoff.note.watchFor}</div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <Label>Covering until</Label>
                <Badge tone="neutral">{activeHandoff.coveringUntil}</Badge>
              </div>
            </Card>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

// ── VIDEO CONSULT OVERLAY ──
function VideoConsultOverlay({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
  const appt = useClinic((s) => s.appointments.find((a) => a.id === appointmentId))
  const patient = useClinic((s) => s.patients.find((p) => p.id === appt?.patientId))
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const endConsult = useClinic((s) => s.endConsult)
  const toast = useToast()

  return (
    <VideoConsult
      patientName={patient?.name ?? 'Patient'}
      practitionerName={doctor?.name ?? 'Doctor'}
      appointmentId={appointmentId}
      onEnd={({ duration }) => {
        endConsult(appointmentId)
        haptic('success')
        const mins = Math.floor(duration / 60)
        toast({ title: `Video consult ended · ${mins > 0 ? `${mins}m` : `${duration}s`}` })
        onClose()
      }}
    />
  )
}

// ── INSTANT MEETING ──
// A video call for someone who isn't a registered patient (a referral
// consult, a prospective patient) — no appointment required. The room id
// is generated once, on open, so the link shown and the room actually
// joined are always the same one.
function InstantMeetingSheet({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (id: string, guestName: string) => void }) {
  const [id, setId] = useState(() => newId())
  const [guestName, setGuestName] = useState('')
  const [copied, setCopied] = useState(false)

  // A fresh room id each time the sheet opens (not while it's closed/idle).
  useEffect(() => { if (open) { setId(newId()); setGuestName(''); setCopied(false) } }, [open])

  const roomName = `sneham-consult-${id.replace(/[^a-zA-Z0-9]/g, '')}`
  const link = `https://meet.jit.si/${roomName}`
  const shareMessage = `Join our video consultation${guestName.trim() ? ` (${guestName.trim()})` : ''}: ${link}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be blocked — link is still visible/selectable below.
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Instant meeting</div>
      <p className="mt-1 text-[12.5px] text-muted">
        For anyone not in your patient roster — share the link however you like; whoever opens it joins this same call.
      </p>

      <div className="mt-4">
        <Label>Who is this with? (optional)</Label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="e.g. Dr. Mehta (referral)"
          className="mt-1.5 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
          data-selectable="true"
        />
      </div>

      <div className="mt-3">
        <Label>Meeting link</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            readOnly
            value={link}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full flex-1 rounded-[14px] border border-border bg-screen px-3.5 py-2.5 text-[12px] text-muted outline-none"
          />
          <Pressable hap="tick" onClick={copyLink} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-2.5 text-[12.5px] font-semibold text-body">
            <Copy size={14} weight="bold" /> {copied ? 'Copied' : 'Copy'}
          </Pressable>
        </div>
      </div>

      <Pressable
        hap="tick"
        onClick={() => shareTextViaWhatsApp(shareMessage)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-[13.5px] font-semibold text-body"
      >
        <WhatsappLogo size={16} weight="fill" className="text-success" /> Share via WhatsApp
      </Pressable>

      <Pressable
        hap="impact"
        onClick={() => onStart(id, guestName.trim())}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-pill bg-accent py-3 font-display text-[15px] font-semibold text-white shadow-float"
      >
        <VideoCamera size={18} weight="fill" /> Join now
      </Pressable>
    </BottomSheet>
  )
}

// ── TAB BAR (animated indicator) ──
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: any; label: string }[] = [
    { id: 'today', icon: SunHorizon, label: 'Today' },
    { id: 'calendar', icon: CalendarBlank, label: 'Schedule' },
    { id: 'followups', icon: ArrowsClockwise, label: 'Follow-ups' },
    { id: 'rx', icon: RxIcon, label: 'Rx' },
    { id: 'inbox', icon: Tray, label: 'Inbox' },
  ]
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/85 px-3 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'var(--app-bottom)' }}>
      {items.map((it) => {
        const on = tab === it.id
        return (
          <Pressable key={it.id} as="div" hap="tick" scale={0.9} onClick={() => onChange(it.id)} className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-1">
            <span className="relative flex h-9 w-14 items-center justify-center">
              {on && <motion.span layoutId="prac-tab" className="absolute inset-0 rounded-pill bg-tint-pale" transition={spring} />}
              <span className={`relative ${on ? 'text-brand' : 'text-faint'}`}><it.icon size={21} weight={on ? 'fill' : 'regular'} /></span>
            </span>
            <span className={`text-[10px] font-medium ${on ? 'text-brand' : 'text-faint'}`}>{it.label}</span>
          </Pressable>
        )
      })}
    </div>
  )
}
