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
} from '@phosphor-icons/react'
import { todayISO, toISO, formatDayLabel } from '../core/day'
import { useClinic } from '../core/store'
import { useAuth } from '../auth/AuthProvider'
import { useShell, exitToLauncher } from '../core/shell'
import type { Potency, Repetition } from '../core/types'
import { MASTER_REMEDIES } from '../core/remedies'
import { Avatar, Badge, BottomSheet, Card, Chip, Label, Stepper } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, tabVariants, pushVariants, listContainer, listItem } from '../design-system/motion'
import { CountUp } from '../design-system/feedback'
import { PullToRefresh, useHorizontalSwipe, EdgeSwipeBack } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { MobileCaseSheet } from './MobileCaseSheet'
import { MobileFollowUp } from './MobileFollowUp'
import { CalendarScreen } from './Calendar'
import { PatientSearchSheet, PatientDetailScreen, AddPatientSheet } from './PatientSearch'
import { TodayGrid } from './TodayGrid'
import { VideoConsult } from '../video/VideoConsult'
import { ChatThread } from '../components/ChatThread'

// ME is resolved from store inside the component
type Tab = 'today' | 'calendar' | 'followups' | 'rx' | 'inbox'
const TAB_ORDER: Tab[] = ['today', 'calendar', 'followups', 'rx', 'inbox']
type Overlay = { kind: 'case' | 'compare' | 'patient-detail'; patientId: string } | { kind: 'chat'; patientId: string; patientName: string } | { kind: 'video'; appointmentId: string } | null

const POTENCIES: Potency[] = ['6C', '12C', '30C', '200C', '1M', '10M', 'Q']
const REPS: Repetition[] = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed']

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-screen">
      {/* base app */}
      <div className="flex h-full flex-col">
        {/* pinned top bar */}
        <div className="flex items-center gap-3 px-[18px] pb-2 pt-[var(--app-top)]">
          <Pressable as="div" hap="tick" scale={0.94} onClick={() => setSwitchOpen(true)} className="cursor-pointer">
            <Avatar initials={doctor.initials} size={38} />
          </Pressable>
          <div className="flex-1">
            <div className="font-display text-[15px] font-bold text-ink">{doctor.name}</div>
            <div className="text-[11px] text-faint">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · Bandra clinic</div>
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
                  {tab === 'today' && <TodayGrid openCase={(id) => setOverlay({ kind: 'case', patientId: id })} goRx={goToRx} startVideo={(apptId) => setOverlay({ kind: 'video', appointmentId: apptId })} />}
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
              ) : (
                <PatientDetailScreen
                  patientId={overlay.patientId}
                  onBack={() => setOverlay(null)}
                  onOpenCase={(id) => setOverlay({ kind: 'case', patientId: id })}
                  onOpenFollowUp={(id) => setOverlay({ kind: 'compare', patientId: id })}
                  onPrescribe={() => { setOverlay(null); goToRx(overlay.patientId) }}
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
  const patients = useClinic((s) => s.patients)

  const [pickerQuery, setPickerQuery] = useState('')
  const currentPatient = patients.find((p) => p.id === patientId)

  // Nothing pre-selected: a real remedy, patient and dose must be chosen
  // before Publish does anything. This used to arrive pre-filled with a
  // default remedy and an enabled Publish button, so one tap could send an
  // invented prescription to whichever patient was guessed above.
  const [remedy, setRemedy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [potency, setPotency] = useState<Potency>('200C')
  const [dose, setDose] = useState(4)
  const [rep, setRep] = useState<Repetition>('Once daily · night')
  const [prep, setPrep] = useState('')
  const [done, setDone] = useState(false)

  const remedyList = doctor?.remedyList ?? []
  const list = useMemo(() => {
    const q = query.toLowerCase()
    const personal = remedyList.filter((r) => r.toLowerCase().includes(q))
    if (q.length < 2) return personal
    const personalSet = new Set(remedyList.map((r) => r.toLowerCase()))
    const master = MASTER_REMEDIES.filter((r) => r.toLowerCase().includes(q) && !personalSet.has(r.toLowerCase()))
    return [...personal, ...master]
  }, [remedyList, query])

  const canPublish = !!currentPatient && !!remedy

  function resetForm() {
    setRemedy(null)
    setQuery('')
    setPotency('200C')
    setDose(4)
    setRep('Once daily · night')
    setPrep('')
  }

  function onPublish() {
    if (!canPublish || !currentPatient || !remedy) return
    publish({
      patientId: currentPatient.id, practitionerId: ME, remedy, potency, doseGlobules: dose, repetition: rep,
      durationDays: rep === 'As needed' ? null : 14, preparation: prep,
      remindersEnabled: rep !== 'As needed', reminderTimes: rep === 'Twice daily' ? ['8:00 AM', '8:00 PM'] : ['8:00 PM'],
      sharedVia: ['Patient app', 'WhatsApp'], origin: 'practitioner',
    })
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
                <div className="text-[12px] text-muted">{p.age} &middot; #{p.wsCode}</div>
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
          <div className="text-[12px] text-muted">#{currentPatient.wsCode}</div>
        </div>
        <Pressable hap="tick" onClick={() => onPatientPicked(null)} className="text-[12px] font-semibold text-brand">Change</Pressable>
      </Card>

      <div>
        <Label>Remedy</Label>
        <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
          <MagnifyingGlass size={16} className="text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search remedies" className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint" data-selectable="true" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(query ? list : list.slice(0, 8)).map((r) => (
            <Chip key={r} selected={r === remedy} onClick={() => { haptic('select'); setRemedy(r) }}>
              {r === remedy && <Check size={12} weight="bold" className="mr-1 inline" />}{r}
            </Chip>
          ))}
          {!query && list.length > 8 && (
            <button onClick={() => setQuery(' ')} className="rounded-pill border border-dashed border-border-dash px-3 py-1 text-[12px] font-semibold text-muted">
              +{list.length - 8} more
            </button>
          )}
        </div>
      </div>

      <div>
        <Label>Potency</Label>
        <div className="mt-2 flex gap-2">
          {POTENCIES.map((p) => <Chip key={p} selected={p === potency} onClick={() => { haptic('select'); setPotency(p) }} className="flex-1 text-center">{p}</Chip>)}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>Dose</Label>
        <Stepper value={dose} onChange={(v) => { haptic('tick'); setDose(v) }} suffix="globules" />
      </div>

      <div>
        <Label>Repetition</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {REPS.map((r) => <Chip key={r} selected={r === rep} onClick={() => { haptic('select'); setRep(r) }}>{r}</Chip>)}
        </div>
      </div>

      <div>
        <Label>Preparation note</Label>
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
          <div className="mt-1 px-4 text-[13px] text-muted">{remedy} {potency} &middot; {rep} &mdash; sent to {currentPatient.name}{"'"}s app and WhatsApp.</div>
          <div className="mt-5 flex w-full gap-2">
            <Pressable hap="tick" onClick={() => setDone(false)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center font-display text-[14px] font-semibold text-body">Done</Pressable>
            <Pressable hap="tick" onClick={() => { setDone(false); resetForm(); onPatientPicked(null) }} className="flex-1 rounded-pill bg-brand py-2.5 text-center font-display text-[14px] font-semibold text-screen">Next patient</Pressable>
          </div>
        </div>
      </BottomSheet>
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
