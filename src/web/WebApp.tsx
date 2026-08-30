import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  SunHorizon,
  UsersThree,
  Notebook,
  Prescription as RxIcon,
  ArrowsClockwise,
  ChartLineUp,
  GearSix,
  MagnifyingGlass,
  Bell,
  CloudCheck,
  Lock,
  Check,
  CaretRight,
  Plus,
  WhatsappLogo,
  DeviceMobile,
  X,
  Handshake,
  CalendarCheck,
  CalendarBlank,
  Warning,
  CurrencyInr,
  Clock,
  UsersFour,
  TrendUp,
  ToggleRight,
  ToggleLeft,
  Printer,
  PencilSimple,
  Stethoscope,
  Pill,
  Smiley,
  SmileyMeh,
  SmileySad,
  Sparkle,
  UserCircle,
  IdentificationCard,
  GraduationCap,
  MapPin,
  SignOut,
  EnvelopeSimple,
} from '@phosphor-icons/react'
import { todayISO, formatDayLabel, addDaysISO } from '../core/day'
import { getSections } from '../core/caseTemplate'
import { useClinic } from '../core/store'
import { useAuth } from '../auth/AuthProvider'
import type { Appointment, Patient, Potency, Repetition, RxTemplate } from '../core/types'
import { MASTER_REMEDIES } from '../core/remedies'
import { uploadDocument } from '../core/db'
import { Avatar, Badge, Button, Card, Chip, Label, Stepper, PatientNotFound } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { SnehamLockup } from '../design-system/Logo'
import { ToastHost, useToast } from '../design-system/toast'
import { CountUp } from '../design-system/feedback'
import { easeCalm, listContainer, listItem } from '../design-system/motion'
import { CaseSheet } from './CaseSheet'
import { FollowUp } from './FollowUp'
import { CommandPalette, type Command } from './CommandPalette'
import { WebCalendar } from './WebCalendar'
import { VideoConsult } from '../video/VideoConsult'
import { ChatThread } from '../components/ChatThread'
import { exportPrescriptionPdf, exportInvoicePdf } from '../core/pdfExport'

type Screen = 'today' | 'calendar' | 'patients' | 'patient' | 'prescription' | 'casesheet' | 'followup' | 'reports' | 'settings' | 'restricted' | 'prescriptions-all' | 'casenotes-all' | 'followups-all'
const POTENCIES: Potency[] = ['6C', '12C', '30C', '200C', '1M', '10M', 'Q']
const REPS: Repetition[] = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed']

const NAV = [
  { id: 'today', icon: SunHorizon, label: 'Today' },
  { id: 'calendar', icon: CalendarBlank, label: 'Calendar' },
  { id: 'patients', icon: UsersThree, label: 'Patients' },
  { id: 'casenotes', icon: Notebook, label: 'Case notes', locked: true },
  { id: 'prescriptions', icon: RxIcon, label: 'Prescriptions', locked: true },
  { id: 'followups', icon: ArrowsClockwise, label: 'Follow-ups', locked: true },
  { id: 'reports', icon: ChartLineUp, label: 'Reports' },
  { id: 'settings', icon: GearSix, label: 'Settings' },
] as const

export function WebApp() {
  const { signOut } = useAuth()
  const [screen, setScreen] = useState<Screen>('today')
  const [patientId, setPatientId] = useState('pt-ananya')
  const [notifOpen, setNotifOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [clinicOpen, setClinicOpen] = useState(false)
  const [selectedClinic, setSelectedClinic] = useState('Bandra clinic')
  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [videoApptId, setVideoApptId] = useState<string | null>(null)
  const clinicRef = useRef<HTMLDivElement>(null)

  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const role = useClinic((s) => s.role)
  const offline = useClinic((s) => s.offline)
  const dbError = useClinic((s) => s.dbError)
  const pendingCount = useClinic((s) => s.pendingWrites.length)
  const patients = useClinic((s) => s.patients)
  const unread = useClinic((s) => s.notifications.filter((n) => n.surface === 'web' && !n.read).length)
  const todayAppts = useClinic((s) => s.appointments.filter((a) => a.date === todayISO()))
  const toast = useToast()

  if (!doctor) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
      </div>
    )
  }

  const openPatient = (id: string) => {
    setPatientId(id)
    setScreen('patient')
  }
  const openCaseSheet = (id: string) => { setPatientId(id); setScreen('casesheet') }
  const openPrescription = (id: string) => { setPatientId(id); setScreen('prescription') }
  const openFollowUp = (id: string) => { setPatientId(id); setScreen('followup') }

  // ⌘K / Ctrl-K command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-refresh every 15s, same as the practitioner and patient apps —
  // without this, the web console only ever loaded data once at login and
  // needed a manual page reload to see anything new.
  useEffect(() => {
    const t = setInterval(() => {
      const s = useClinic.getState()
      if (s.userId && !s.hydrating) s.hydrate(s.userId, '')
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const commands: Command[] = [
    { id: 'go-today', label: 'Today', group: 'Go to', icon: SunHorizon, run: () => setScreen('today') },
    { id: 'go-calendar', label: 'Calendar', group: 'Go to', icon: CalendarBlank, run: () => setScreen('calendar') },
    { id: 'go-patients', label: 'Patients', group: 'Go to', icon: UsersThree, run: () => setScreen('patients') },
    { id: 'go-reports', label: 'Reports', group: 'Go to', icon: ChartLineUp, run: () => setScreen('reports') },
    { id: 'go-settings', label: 'Settings', group: 'Go to', icon: GearSix, run: () => setScreen('settings') },
    { id: 'act-newpatient', label: 'Add a new patient', group: 'Actions', icon: Plus, run: () => setScreen('patients') },
    { id: 'act-rx', label: 'Write a prescription', group: 'Actions', icon: RxIcon, run: () => navTo('prescriptions') },
    ...patients.map((p) => ({
      id: `p-${p.id}`,
      label: p.name,
      hint: p.chiefComplaint,
      group: 'Patients',
      icon: UsersThree,
      run: () => openPatient(p.id),
    })),
  ]

  function navTo(id: string, locked?: boolean) {
    if (locked && role === 'Assistant') {
      setScreen('restricted')
      return
    }
    if (id === 'today' || id === 'calendar' || id === 'patients' || id === 'reports' || id === 'settings') { setScreen(id as Screen); return }
    if (id === 'prescriptions') { setScreen('prescriptions-all'); return }
    if (id === 'casenotes') { setScreen('casenotes-all'); return }
    if (id === 'followups') { setScreen('followups-all'); return }
    setScreen('today')
  }

  const navActive =
    screen === 'patient' ? 'patients'
      : screen === 'prescription' || screen === 'prescriptions-all' ? 'prescriptions'
      : screen === 'casesheet' || screen === 'casenotes-all' ? 'casenotes'
      : screen === 'followup' || screen === 'followups-all' ? 'followups'
      : screen

  return (
    <div className="relative flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-[236px] shrink-0 flex-col border-r border-border bg-raised px-3 py-4">
        <div className="px-2">
          <SnehamLockup />
        </div>
        <div className="relative mt-4" ref={clinicRef}>
          <button
            onClick={() => setClinicOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-[12px] border border-border bg-surface px-3 py-2 text-left"
          >
            <div>
              <div className="text-[13px] font-semibold text-ink">{selectedClinic}</div>
              <div className="text-[11px] text-faint">2 other locations</div>
            </div>
            <CaretRight size={14} className={`text-faint transition ${clinicOpen ? 'rotate-90' : ''}`} />
          </button>
          <AnimatePresence>
            {clinicOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[12px] border border-border bg-surface shadow-modal"
              >
                {['Bandra clinic', 'Andheri clinic', 'Thane clinic'].map((c) => (
                  <button
                    key={c}
                    onClick={() => { setSelectedClinic(c); setClinicOpen(false) }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition hover:bg-surface-hover ${c === selectedClinic ? 'font-semibold text-brand' : 'text-body'}`}
                  >
                    {c === selectedClinic && <Check size={13} weight="bold" className="text-brand" />}
                    {c !== selectedClinic && <span className="w-[13px]" />}
                    {c}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="mt-4 space-y-1">
          {NAV.map((n) => {
            const active = navActive === n.id
            const locked = (n as any).locked && role === 'Assistant'
            return (
              <button
                key={n.id}
                onClick={() => navTo(n.id, (n as any).locked)}
                className={`relative flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] font-medium transition ${
                  active ? 'text-brand' : 'text-body hover:bg-surface/60'
                }`}
              >
                {active && <motion.span layoutId="web-nav" className="absolute inset-0 rounded-[12px] bg-surface shadow-card" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative flex flex-1 items-center gap-3">
                  <n.icon size={19} weight={active ? 'fill' : 'regular'} />
                  <span className="flex-1 text-left">{n.label}</span>
                  {locked && <Lock size={13} className="text-faint" />}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2.5 rounded-[14px] border border-border bg-surface px-3 py-2.5">
          <Avatar initials={doctor.initials} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-ink">{doctor.name}</div>
            <div className="text-[11px] text-faint">{role}</div>
          </div>
          <button onClick={signOut} title="Sign out" className="shrink-0 text-faint transition hover:text-danger">
            <SignOut size={16} weight="bold" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col bg-screen">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-border bg-screen/90 px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <div className="font-display text-[17px] font-bold text-ink">{(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()}, {doctor.name.split(' ').slice(0, 2).join(' ')}</div>
            <div className="text-[12px] text-faint">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {todayAppts.length} appointments</div>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2 text-left transition hover:bg-surface-hover md:flex"
            >
              <MagnifyingGlass size={15} className="text-faint" />
              <span className="w-[200px] text-[13px] text-faint">Search patients, cases, invoices</span>
              <kbd className="rounded-[6px] border border-border bg-screen px-1.5 py-0.5 text-[11px] font-semibold text-faint">⌘K</kbd>
            </button>
            <Badge tone={offline || dbError ? 'amber' : 'green'}>
              <CloudCheck size={13} weight="fill" />
              {offline ? (pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline') : dbError ? 'Partial sync' : 'Synced'}
            </Badge>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
            >
              <Bell size={17} className="text-body" />
              {unread > 0 && (
                <span className="notif-pulse absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen === 'patient' ? `patient-${patientId}` : screen}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: easeCalm }}
            >
              {screen === 'today' && <TodayView onOpenPatient={openPatient} onStartVideo={setVideoApptId} />}
              {screen === 'calendar' && <WebCalendar onOpenPatient={openPatient} />}
              {screen === 'patients' && <PatientsView onOpenPatient={openPatient} onNewPatient={() => setNewPatientOpen(true)} />}
              {screen === 'patient' && (
                <PatientDetail
                  patientId={patientId}
                  onPrescribe={() => setScreen('prescription')}
                  onCaseSheet={() => setScreen('casesheet')}
                  onFollowUp={() => setScreen('followup')}
                  onBack={() => setScreen('patients')}
                />
              )}
              {screen === 'prescription' && <PrescriptionWriter patientId={patientId} onDone={() => setScreen('patient')} />}
              {screen === 'casesheet' && (
                <CaseSheet patientId={patientId} onPrescribe={() => setScreen('prescription')} onBack={() => setScreen('patient')} />
              )}
              {screen === 'followup' && <FollowUp patientId={patientId} onBack={() => setScreen('patient')} />}
              {screen === 'prescriptions-all' && <PrescriptionsOverview onOpenPatient={openPatient} onWriteFor={openPrescription} />}
              {screen === 'casenotes-all' && <CaseNotesOverview onOpenCaseSheet={openCaseSheet} />}
              {screen === 'followups-all' && <FollowUpsOverview onOpenFollowUp={openFollowUp} />}
              {screen === 'reports' && <ReportsView onGoToPatients={() => setScreen('patients')} />}
              {screen === 'settings' && <SettingsView />}
              {screen === 'restricted' && <Restricted onBack={() => setScreen('today')} />}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>{notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}</AnimatePresence>
        </div>
      </div>

      <ToastHost />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
      <AnimatePresence>
        {newPatientOpen && <NewPatientModal onClose={() => setNewPatientOpen(false)} />}
      </AnimatePresence>

      {videoApptId && createPortal(
        <div className="fixed inset-0 z-[200] bg-[#1a1a1a]">
          <VideoConsult
            patientName={(() => {
              const appt = useClinic.getState().appointments.find((a) => a.id === videoApptId)
              const pt = useClinic.getState().patients.find((p) => p.id === appt?.patientId)
              return pt?.name ?? 'Patient'
            })()}
            practitionerName={doctor.name}
            appointmentId={videoApptId}
            onEnd={() => { useClinic.getState().endConsult(videoApptId); setVideoApptId(null) }}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── TODAY ──
function TodayView({ onOpenPatient, onStartVideo }: { onOpenPatient: (id: string) => void; onStartVideo: (apptId: string) => void }) {
  const allAppts = useClinic((s) => s.appointments)
  const patients = useClinic((s) => s.patients)
  const role = useClinic((s) => s.role)
  const myId = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const toast = useToast()
  const [billingApptId, setBillingApptId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'mine' | 'everyone'>('mine')
  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
  const fmt = (n: number) => String(Math.round(n))
  // Today's own schedule is always scoped to the logged-in practitioner —
  // an Owner's Today is her own calendar first, not the whole clinic's
  // appointments merged into one list. The team rollup below covers the rest.
  const appts = allAppts.filter((a) => a.practitionerId === myId)
  const todayAppts = appts.filter((a) => a.date === todayISO())
  const seenToday = todayAppts.filter((a) => a.status === 'Seen' || a.status === 'In consult').length
  const remainingToday = todayAppts.filter((a) => a.status === 'Upcoming' || a.status === 'Waiting' || a.status === 'New').length
  const newToday = todayAppts.filter((a) => a.isFirstVisit).length
  const followUpsDue = appts.filter((a) => a.reason?.toLowerCase().includes('follow')).length
  const CONSULT_FEE = 1500
  const revenueToday = todayAppts.reduce((sum, a) => sum + (a.paymentStatus === 'paid' ? (a.fee ?? CONSULT_FEE) : 0), 0)
  const paidCount = todayAppts.filter((a) => a.paymentStatus === 'paid').length
  const avgValue = paidCount > 0 ? Math.round(revenueToday / paidCount) : 0
  const team = practitioners.filter((p) => p.id !== myId)
  const teamToday = allAppts.filter((a) => a.date === todayISO() && a.practitionerId !== myId)
  // "Everyone" is Owner-only — a non-Owner's own fetched data is already
  // scoped to just their own caseload, so there's no wider view to switch to.
  const scheduleAppts = role === 'Owner' && viewMode === 'everyone'
    ? allAppts.filter((a) => a.date === todayISO())
    : todayAppts
  const stats = [
    { label: "Today's appointments", num: todayAppts.length, format: fmt, sub: `${remainingToday} remaining` },
    { label: 'Patients seen', num: seenToday, format: fmt, sub: newToday > 0 ? `${newToday} new` : 'today' },
    { label: 'Follow-ups due', num: followUpsDue, format: fmt, sub: followUpsDue > 0 ? 'this week' : 'none pending', tone: followUpsDue > 2 ? 'amber' as const : undefined },
    { label: 'Revenue today', num: revenueToday, format: inr, sub: paidCount > 0 ? `${paidCount} paid` : 'no payments yet' },
    { label: 'Avg consult value', num: avgValue, format: inr, sub: seenToday > 0 ? 'per visit' : 'no consults yet', tone: seenToday > 0 ? 'green' as const : undefined },
  ]
  return (
    <div className="space-y-5">
      <motion.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        variants={listContainer}
        initial="hidden"
        animate="show"
      >
        {stats.map((s, i) => (
          <motion.div key={s.label} variants={listItem}>
            <Card className="px-4 py-3.5 transition-shadow hover:shadow-float">
              <Label>{s.label}</Label>
              <CountUp value={s.num} format={s.format} duration={1.2} className="mt-1 block font-display text-[24px] font-bold leading-none text-ink" />
              <div className={`mt-1.5 text-[12px] ${s.tone === 'amber' ? 'text-amber-text' : s.tone === 'green' ? 'text-success' : 'text-faint'}`}>
                {s.sub}
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[16px] font-bold text-ink">Today's schedule</h2>
          <div className="flex items-center gap-2">
            <WalkInButton />
            {role === 'Owner' && (
              <div className="inline-flex rounded-pill bg-screen p-0.5">
                {(['mine', 'everyone'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`rounded-pill px-3 py-1.5 text-[12px] font-semibold transition ${viewMode === m ? 'bg-brand text-screen' : 'text-muted hover:text-body'}`}
                  >
                    {m === 'mine' ? 'Mine' : 'Everyone'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <motion.div
          className="space-y-2"
          variants={listContainer}
          initial="hidden"
          animate="show"
        >
          {scheduleAppts.length === 0 && (
            <p className="py-6 text-center text-[13px] text-faint">No appointments {viewMode === 'everyone' ? 'for anyone' : ''} today.</p>
          )}
          {scheduleAppts.map((a) => {
            const p = patients.find((x) => x.id === a.patientId)
            return (
              <motion.button
                key={a.id}
                variants={listItem}
                onClick={() => onOpenPatient(a.patientId)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="flex w-full items-center gap-4 rounded-[14px] border border-border bg-surface px-4 py-3 text-left transition hover:bg-surface-hover hover:shadow-card"
              >
                <div className="w-16 font-display text-[13px] font-semibold text-body">{a.time}</div>
                <Avatar initials={p?.initials ?? '?'} size={38} />
                <div className="flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">{p?.name ?? 'Patient'}</div>
                  <div className="text-[12px] text-muted">{a.reason}</div>
                </div>
                {a.type === 'Video' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); useClinic.getState().startConsult(a.id); onStartVideo(a.id) }}
                    className="flex items-center gap-1.5 rounded-pill bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-accent-deep"
                  >
                    Join call
                  </button>
                )}
                {a.status === 'Seen' && a.paymentStatus !== 'paid' && a.paymentStatus !== 'waived' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setBillingApptId(a.id) }}
                    className="flex items-center gap-1 rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-accent hover:text-white"
                  >
                    ₹ Collect
                  </button>
                )}
                {a.paymentStatus === 'paid' && <Badge tone="green">₹{a.fee ?? CONSULT_FEE}</Badge>}
                <Badge tone={a.type === 'Video' ? 'amber' : 'green'}>{a.type}</Badge>
                <Badge tone={a.status === 'In consult' ? 'green' : 'neutral'}>{a.status}</Badge>
              </motion.button>
            )
          })}
        </motion.div>
      </Card>

      {role === 'Owner' && team.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-bold text-ink">Your team today</h2>
            <Badge tone="neutral">{teamToday.length} appointment{teamToday.length !== 1 ? 's' : ''}</Badge>
          </div>
          <div className="space-y-4">
            {team.map((p) => {
              const rows = teamToday.filter((a) => a.practitionerId === p.id)
              return (
                <div key={p.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Avatar initials={p.initials} size={22} />
                    <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                    <span className="text-[12px] text-faint">{rows.length} today</span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="pl-8 text-[12.5px] text-faint">Nothing scheduled today.</p>
                  ) : (
                    <div className="space-y-1.5 pl-8">
                      {rows.map((a) => {
                        const pt = patients.find((x) => x.id === a.patientId)
                        return (
                          <button
                            key={a.id}
                            onClick={() => onOpenPatient(a.patientId)}
                            className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-surface-hover"
                          >
                            <span className="w-14 text-[12.5px] font-semibold text-body">{a.time}</span>
                            <span className="flex-1 truncate text-[12.5px] text-ink">{pt?.name ?? 'Patient'}</span>
                            <span className="truncate text-[11.5px] text-faint">{a.reason}</span>
                            <Badge tone={a.status === 'In consult' ? 'green' : 'neutral'}>{a.status}</Badge>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <BillingModal apptId={billingApptId} onClose={() => setBillingApptId(null)} />
    </div>
  )
}

// ── BILLING ──
// Used to be a single hardcoded ₹1500-Cash button with no way to enter the
// real fee or payment mode. Now a real editable form, and can print/share an
// invoice with the clinic's letterhead.
function BillingModal({ apptId, onClose }: { apptId: string | null; onClose: () => void }) {
  const appt = useClinic((s) => s.appointments.find((a) => a.id === apptId))
  const patient = useClinic((s) => s.patients.find((p) => p.id === appt?.patientId))
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const recordPayment = useClinic((s) => s.recordPayment)
  const toast = useToast()
  const [fee, setFee] = useState(1500)
  const [mode, setMode] = useState<NonNullable<Appointment['paymentMode']>>('Cash')

  useEffect(() => {
    if (appt) setFee(appt.fee ?? 1500)
  }, [appt?.id])

  if (!apptId || !appt || !patient) return null

  const modes: NonNullable<Appointment['paymentMode']>[] = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other']

  const printInvoice = async (status: 'paid' | 'unpaid') => {
    const credentials = [doctor?.qualifications, doctor?.registrationNo].filter(Boolean).join(' · ')
    await exportInvoicePdf({
      id: appt.id,
      patientName: patient.name,
      patientCode: patient.wsCode,
      doctorName: doctor?.name ?? 'Doctor',
      doctorCredentials: credentials || undefined,
      date: new Date().toISOString(),
      reason: appt.reason,
      fee,
      paymentMode: mode,
      paymentStatus: status,
    }).catch(() => {})
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-[400px] rounded-3xl border border-border bg-surface p-6 shadow-modal animate-pop"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-body">
          <X size={18} />
        </button>
        <h2 className="font-display text-[18px] font-bold text-ink">Collect payment</h2>
        <p className="mt-0.5 text-[13px] text-muted">{patient.name} · {appt.reason ?? 'Consultation'}</p>

        <Label className="mt-4">Fee amount</Label>
        <div className="mt-1.5 flex items-center gap-2 rounded-[12px] border border-border bg-canvas px-3.5 py-2.5">
          <span className="text-[15px] font-semibold text-muted">₹</span>
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(Number(e.target.value) || 0)}
            className="w-full bg-transparent text-[15px] font-semibold text-ink outline-none"
          />
        </div>

        <Label className="mt-4">Payment mode</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${
                mode === m ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => printInvoice('paid')}>
            <Printer size={16} /> PDF
          </Button>
          <Button
            variant="accent"
            className="flex-1"
            onClick={() => {
              recordPayment(appt.id, fee, mode, 'paid')
              toast({ title: 'Payment recorded', message: `₹${fee.toLocaleString('en-IN')} — ${mode}` })
              onClose()
            }}
          >
            <CurrencyInr size={16} weight="bold" /> Record payment
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function WalkInButton() {
  const patients = useClinic((s) => s.patients)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const currentPractitionerId = useClinic((s) => s.currentPractitionerId)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)

  const addWalkIn = (patientId: string) => {
    const now = new Date()
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    scheduleFollowUp({ patientId, practitionerId: currentPractitionerId, time, date: todayISO(), type: 'In person', reason: 'Walk-in' })
    setOpen(false)
    setSearch('')
    const p = patients.find((pt) => pt.id === patientId)
    toast({ title: 'Walk-in added', message: `${p?.name ?? 'Patient'} added to today's queue` })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-accent hover:text-white"
      >
        <Plus size={13} weight="bold" /> Walk-in
      </button>
      {open && (
        <Card className="absolute right-0 top-full z-20 mt-1 w-64 p-3 shadow-float">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient..."
            autoFocus
            className="w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-body placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <div className="mt-2 max-h-[200px] space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addWalkIn(p.id)} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[13px] text-body transition hover:bg-tint">
                <Avatar initials={p.initials} size={28} />
                <span className="font-medium">{p.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="py-3 text-center text-[12px] text-faint">No patients found</div>}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── PATIENTS ──
function PatientsView({ onOpenPatient, onNewPatient }: { onOpenPatient: (id: string) => void; onNewPatient: () => void }) {
  const patients = useClinic((s) => s.patients)
  const practitioners = useClinic((s) => s.practitioners)
  const assignPatient = useClinic((s) => s.assignPatient)
  const toast = useToast()
  const [active, setActive] = useState('My cases')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)

  const filterChips = [
    { label: 'Active cases', predicate: (p: Patient) => p.assignment === 'Mine' || p.assignment === 'Assigned to me' },
    { label: 'Closed', predicate: (p: Patient) => p.lastOutcome === 'Clear improvement' },
    { label: 'New this month', predicate: (p: Patient) => p.lastSeen === 'Today' || p.lastSeen === 'Yesterday' || p.lastSeen === '2 days ago' },
    { label: 'Has follow-up due', predicate: (p: Patient) => p.assignment === 'Mine' && p.currentRemedy !== null },
  ] as const

  const unassignedCount = patients.filter((p) => p.assignment === 'Unassigned').length
  const assignedToMe = patients.filter((p) => p.assignment === 'Assigned to me').length
  const assignedOut = patients.filter((p) => p.assignment === 'Assigned out').length
  const followUpDue = patients.filter((p) => p.assignment === 'Mine' && p.currentRemedy !== null).length

  const tabFilters = [
    ['My cases', patients.length] as const,
    ['Assigned to me', assignedToMe] as const,
    ['Assigned by me', assignedOut] as const,
    ['Unassigned', unassignedCount] as const,
    ['Overdue follow-ups', followUpDue] as const,
  ]

  const tabPredicate = (p: Patient): boolean => {
    switch (active) {
      case 'Assigned to me': return p.assignment === 'Assigned to me'
      case 'Assigned by me': return p.assignment === 'Assigned out'
      case 'Unassigned': return p.assignment === 'Unassigned'
      case 'Overdue follow-ups': return p.assignment === 'Mine' && p.currentRemedy !== null
      default: return true
    }
  }

  const toggleFilter = (label: string) =>
    setActiveFilters((fs) => fs.includes(label) ? fs.filter((f) => f !== label) : [...fs, label])

  const filtered = patients.filter((p) => {
    if (!tabPredicate(p)) return false
    if (activeFilters.length === 0) return true
    return activeFilters.every((label) => {
      const fc = filterChips.find((c) => c.label === label)
      return fc ? fc.predicate(p) : true
    })
  })

  const toggleSelect = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((p) => p.id)))
  }

  const doBulkAssign = (practitionerId: string) => {
    selected.forEach((pid) => assignPatient(pid, practitionerId))
    const pr = practitioners.find((p) => p.id === practitionerId)
    toast({ title: `${selected.size} patients reassigned`, message: `Now assigned to ${pr?.name ?? 'practitioner'}.` })
    setSelected(new Set())
    setSelecting(false)
    setBulkAssignOpen(false)
  }

  const toneFor = (a: string) =>
    a === 'Mine' ? 'green' : a === 'Unassigned' ? 'amber' : a === 'Covering' ? 'purple' : 'neutral'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[20px] font-bold text-ink">Patients</h1>
          <div className="text-[12.5px] text-faint">{patients.length.toLocaleString()} records · {filtered.length} showing</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFiltersOpen((v) => !v)}>Filters</Button>
          {selecting ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setSelecting(false); setSelected(new Set()) }}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setBulkAssignOpen(true)}
                className={selected.size === 0 ? 'opacity-50' : ''}
              >
                <Handshake size={15} weight="fill" /> Assign {selected.size > 0 && `(${selected.size})`}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setSelecting(true)}>
              <Handshake size={15} /> Bulk assign
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onNewPatient}><Plus size={15} weight="bold" /> New patient</Button>
        </div>
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 pb-1">
              {filterChips.map((fc) => (
                <Chip key={fc.label} selected={activeFilters.includes(fc.label)} onClick={() => toggleFilter(fc.label)}>
                  {activeFilters.includes(fc.label) && <Check size={12} weight="bold" className="mr-1 inline" />}
                  {fc.label}
                </Chip>
              ))}
              {activeFilters.length > 0 && (
                <button onClick={() => setActiveFilters([])} className="text-[12px] font-semibold text-brand">Clear all</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selecting && (
        <div className="flex items-center gap-3 rounded-[14px] border border-brand/20 bg-tint px-4 py-2.5">
          <button onClick={selectAll} className="text-[13px] font-semibold text-brand">
            {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-[12px] text-muted">{selected.size} of {filtered.length} selected</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabFilters.map(([label, count]) => (
          <Chip key={label} selected={active === label} onClick={() => setActive(label as string)}>
            {label} <span className="ml-1 opacity-60">{count}</span>
          </Chip>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className={`grid gap-4 border-b border-border bg-raised px-5 py-3 ${selecting ? 'grid-cols-[32px_1.6fr_1.4fr_1.2fr_0.8fr_1fr]' : 'grid-cols-[1.6fr_1.4fr_1.2fr_0.8fr_1fr]'}`}>
          {selecting && <Label>{' '}</Label>}
          {['Patient', 'Chief complaint', 'Current remedy', 'Last seen', 'Assignment'].map((h) => (
            <Label key={h}>{h}</Label>
          ))}
        </div>
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => selecting ? toggleSelect(p.id) : onOpenPatient(p.id)}
            className={`grid w-full items-center gap-4 border-b border-border px-5 py-3.5 text-left transition last:border-0 hover:bg-surface-hover ${selecting ? 'grid-cols-[32px_1.6fr_1.4fr_1.2fr_0.8fr_1fr]' : 'grid-cols-[1.6fr_1.4fr_1.2fr_0.8fr_1fr]'} ${selected.has(p.id) ? 'bg-tint/40' : ''}`}
          >
            {selecting && (
              <div className={`flex h-5 w-5 items-center justify-center rounded-[6px] border-2 transition ${selected.has(p.id) ? 'border-brand bg-brand' : 'border-border'}`}>
                {selected.has(p.id) && <Check size={12} weight="bold" className="text-white" />}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Avatar initials={p.initials} size={36} />
              <div>
                <div className="font-display text-[14px] font-semibold text-ink">{p.name}</div>
                <div className="text-[11.5px] text-faint">{p.age} {p.sex[0]} · {p.wsCode}</div>
              </div>
            </div>
            <div className="text-[13px] text-body">{p.chiefComplaint}</div>
            <div className="text-[13px] text-body">{p.currentRemedy ?? '—'}</div>
            <div className="text-[13px] text-muted">{p.lastSeen}</div>
            <div><Badge tone={toneFor(p.assignment) as any}>{p.assignment}</Badge></div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-[13px] text-muted">No patients match these filters.</div>
        )}
      </Card>

      {bulkAssignOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setBulkAssignOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[380px] rounded-[20px] border border-border bg-surface p-6 shadow-modal"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[17px] font-bold text-ink">Assign {selected.size} patients</h2>
              <button onClick={() => setBulkAssignOpen(false)} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
            </div>
            <p className="mb-4 text-[13px] text-muted">Choose a practitioner to assign the selected patients to.</p>
            <div className="space-y-1.5">
              {practitioners.map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => doBulkAssign(pr.id)}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 text-left transition hover:bg-surface-hover"
                >
                  <Avatar initials={pr.initials} size={36} />
                  <div className="flex-1">
                    <div className="font-display text-[14px] font-semibold text-ink">{pr.name}</div>
                    <div className="text-[12px] text-muted">{pr.specialty} · {pr.openCases} open cases</div>
                  </div>
                  <CaretRight size={14} className="text-faint" />
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── PRESCRIPTIONS (all) ──
function PrescriptionsOverview({ onOpenPatient, onWriteFor }: { onOpenPatient: (id: string) => void; onWriteFor: (id: string) => void }) {
  const prescriptions = useClinic((s) => s.prescriptions)
  const patients = useClinic((s) => s.patients)
  const [search, setSearch] = useState('')
  const sorted = [...prescriptions].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const q = search.trim().toLowerCase()
  const filtered = q
    ? sorted.filter((r) => {
        const pt = patients.find((p) => p.id === r.patientId)
        return r.remedy.toLowerCase().includes(q) || pt?.name.toLowerCase().includes(q)
      })
    : sorted

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[20px] font-bold text-ink">Prescriptions</h1>
          <div className="text-[12.5px] text-faint">{prescriptions.length.toLocaleString('en-IN')} published</div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or remedy"
          className="w-[240px] rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RxIcon size={32} className="text-border-dash" />
            <p className="mt-3 text-[13.5px] font-medium text-muted">{q ? 'No matches' : 'No prescriptions published yet'}</p>
          </div>
        ) : (
          filtered.map((r) => {
            const pt = patients.find((p) => p.id === r.patientId)
            return (
              <Pressable
                key={r.id}
                as="div"
                onClick={() => (pt ? onOpenPatient(pt.id) : undefined)}
                className="flex w-full items-center gap-4 border-b border-border px-5 py-3.5 text-left transition last:border-0 hover:bg-surface-hover"
              >
                <Avatar initials={pt?.initials ?? '?'} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">{pt?.name ?? 'Unknown patient'}</div>
                  <div className="text-[12px] text-muted">{new Date(r.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className="text-[13.5px] font-semibold text-ink">{r.remedy} {r.potency}</div>
                <div className="w-[150px] text-[12px] text-muted">{r.repetition}</div>
                <div className="flex flex-wrap justify-end gap-1">
                  {r.sharedVia.map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}
                </div>
                {pt && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onWriteFor(pt.id) }}
                    className="shrink-0 rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-accent hover:text-white"
                  >
                    Write again
                  </button>
                )}
              </Pressable>
            )
          })
        )}
      </Card>
    </div>
  )
}

// ── CASE NOTES (all) ──
function CaseNotesOverview({ onOpenCaseSheet }: { onOpenCaseSheet: (id: string) => void }) {
  const patients = useClinic((s) => s.patients)
  const caseData = useClinic((s) => s.caseData)
  const caseVisits = useClinic((s) => s.caseVisits)
  const customTemplates = useClinic((s) => s.caseTemplates)
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const rows = patients
    .map((p) => {
      const cs = caseData[p.id]
      const sections = getSections('chronic', customTemplates)
      const done = cs ? sections.filter((s) => cs[s.id]?.done).length : 0
      const lastVisit = [...caseVisits].filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0]
      return { patient: p, done, total: sections.length, lastVisitDate: lastVisit?.date }
    })
    .filter((r) => !q || r.patient.name.toLowerCase().includes(q))
    .sort((a, b) => (b.lastVisitDate ?? '').localeCompare(a.lastVisitDate ?? ''))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[20px] font-bold text-ink">Case notes</h1>
          <div className="text-[12.5px] text-faint">{patients.length.toLocaleString('en-IN')} patients</div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients"
          className="w-[240px] rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Notebook size={32} className="text-border-dash" />
            <p className="mt-3 text-[13.5px] font-medium text-muted">No matches</p>
          </div>
        ) : (
          rows.map(({ patient, done, total, lastVisitDate }) => (
            <button
              key={patient.id}
              onClick={() => onOpenCaseSheet(patient.id)}
              className="flex w-full items-center gap-4 border-b border-border px-5 py-3.5 text-left transition last:border-0 hover:bg-surface-hover"
            >
              <Avatar initials={patient.initials} size={36} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[14px] font-semibold text-ink">{patient.name}</div>
                <div className="text-[12px] text-muted">{patient.chiefComplaint}</div>
              </div>
              <div className="w-[160px]">
                <div className="h-1.5 overflow-hidden rounded-pill bg-tint-pale">
                  <div className="h-full rounded-pill bg-accent" style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-faint">{done}/{total} sections</div>
              </div>
              <div className="w-[110px] text-right text-[12px] text-faint">
                {lastVisitDate ? new Date(lastVisitDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No visits yet'}
              </div>
            </button>
          ))
        )}
      </Card>
    </div>
  )
}

// ── FOLLOW-UPS (all) ──
function FollowUpsOverview({ onOpenFollowUp }: { onOpenFollowUp: (id: string) => void }) {
  const appts = useClinic((s) => s.appointments)
  const patients = useClinic((s) => s.patients)
  const followUps = appts
    .filter((a) => a.reason?.toLowerCase().includes('follow') && a.status !== 'Seen' && a.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
  const today = todayISO()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[20px] font-bold text-ink">Follow-ups</h1>
        <div className="text-[12.5px] text-faint">{followUps.length.toLocaleString('en-IN')} upcoming</div>
      </div>

      <Card className="overflow-hidden p-0">
        {followUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowsClockwise size={32} className="text-border-dash" />
            <p className="mt-3 text-[13.5px] font-medium text-muted">No follow-ups scheduled</p>
          </div>
        ) : (
          followUps.map((a) => {
            const pt = patients.find((p) => p.id === a.patientId)
            const overdue = a.date < today
            return (
              <button
                key={a.id}
                onClick={() => onOpenFollowUp(a.patientId)}
                className="flex w-full items-center gap-4 border-b border-border px-5 py-3.5 text-left transition last:border-0 hover:bg-surface-hover"
              >
                <Avatar initials={pt?.initials ?? '?'} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">{pt?.name ?? 'Patient'}</div>
                  <div className="text-[12px] text-muted">{pt?.currentRemedy ?? '—'}</div>
                </div>
                <div className="text-[13px] text-body">{formatDayLabel(a.date)} · {a.time}</div>
                <Badge tone={overdue ? 'amber' : 'neutral'}>{overdue ? 'Overdue' : 'Upcoming'}</Badge>
              </button>
            )
          })
        )}
      </Card>
    </div>
  )
}

// ── PATIENT DETAIL ──
function PatientDetail({ patientId, onPrescribe, onCaseSheet, onFollowUp, onBack }: { patientId: string; onPrescribe: () => void; onCaseSheet: () => void; onFollowUp: () => void; onBack: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const rx = useClinic((s) => s.prescriptions.filter((r) => r.patientId === patientId))
  const docs = useClinic((s) => s.documents.filter((d) => d.patientId === patientId))
  const outcomes = useClinic((s) => s.outcomes.filter((o) => o.patientId === patientId))
  const checkIns = useClinic((s) => s.checkIns.filter((c) => c.patientId === patientId))
  const handoffs = useClinic((s) => s.handoffs.filter((h) => h.patientId === patientId))
  const appointments = useClinic((s) => s.appointments.filter((a) => a.patientId === patientId))
  const practitioners = useClinic((s) => s.practitioners)
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const assignPatient = useClinic((s) => s.assignPatient)
  const addDocument = useClinic((s) => s.addDocument)
  const toast = useToast()
  const [assignOpen, setAssignOpen] = useState(false)
  const [billingApptId, setBillingApptId] = useState<string | null>(null)
  const [assignPos, setAssignPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const assignRef = useRef<HTMLDivElement>(null)
  const assignDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assignOpen) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (assignRef.current?.contains(t) || assignDropRef.current?.contains(t)) return
      setAssignOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [assignOpen])

  if (!patient) return <PatientNotFound onBack={onBack} />

  const openAssignDropdown = () => {
    if (assignRef.current) {
      const rect = assignRef.current.getBoundingClientRect()
      setAssignPos({ top: rect.bottom + 4, left: rect.left })
    }
    setAssignOpen((v) => !v)
  }

  const summary = [
    ['Chief complaint', patient.chiefComplaint],
    ['Current remedy', patient.currentRemedy ?? 'None yet'],
    ['Last outcome', patient.lastOutcome ?? '—'],
    ['Next follow-up', (() => { const fa = appointments.filter(a => a.patientId === patient.id && a.status === 'Upcoming').sort((a, b) => a.time.localeCompare(b.time))[0]; return fa ? `${formatDayLabel(fa.date)} · ${fa.time}` : 'Not scheduled' })()],
  ]

  // Invoice history — every appointment that's had a fee entered, most
  // recent first. Separate from the "record payment" target below, which
  // is whichever appointment most likely still needs a bill.
  const invoices = appointments
    .filter((a) => a.fee != null)
    .sort((a, b) => b.date.localeCompare(a.date))
  const billableAppt =
    appointments.filter((a) => a.status === 'Seen' && a.paymentStatus !== 'paid' && a.paymentStatus !== 'waived').sort((a, b) => b.date.localeCompare(a.date))[0]
    ?? appointments.filter((a) => a.status === 'Seen' || a.status === 'In consult').sort((a, b) => b.date.localeCompare(a.date))[0]

  const reprintInvoice = (a: Appointment) => {
    const credentials = [doctor?.qualifications, doctor?.registrationNo].filter(Boolean).join(' · ')
    exportInvoicePdf({
      id: a.id,
      patientName: patient.name,
      patientCode: patient.wsCode,
      doctorName: doctor?.name ?? 'Doctor',
      doctorCredentials: credentials || undefined,
      date: a.paidAt ?? a.date,
      reason: a.reason,
      fee: a.fee ?? 0,
      paymentMode: a.paymentMode ?? 'Cash',
      paymentStatus: a.paymentStatus ?? 'unpaid',
    }).catch(() => {})
  }

  type TimelineEvent = { id: string; date: string; kind: 'visit' | 'prescription' | 'check-in' | 'outcome' | 'handoff'; title: string; detail: string; tone: 'green' | 'amber' | 'neutral' }
  const timeline: TimelineEvent[] = [
    ...rx.map((r) => ({ id: r.id, date: r.publishedAt, kind: 'prescription' as const, title: `${r.remedy} ${r.potency}`, detail: `${r.repetition} · ${r.durationDays ? `${r.durationDays} days` : 'until settled'}`, tone: 'green' as const })),
    ...outcomes.map((o) => ({ id: o.id, date: o.date, kind: 'outcome' as const, title: o.outcome, detail: o.note || o.remedy, tone: o.outcome === 'Clear improvement' ? 'green' as const : o.outcome === 'Partial' ? 'amber' as const : 'neutral' as const })),
    ...checkIns.map((c) => ({ id: c.id, date: c.submittedAt, kind: 'check-in' as const, title: c.marked === 'better' ? 'Feeling better' : c.marked === 'worse' ? 'Feeling worse' : 'No change', detail: c.freeText || `${c.improvementPct}% improvement`, tone: c.marked === 'better' ? 'green' as const : c.marked === 'worse' ? 'amber' as const : 'neutral' as const })),
    // Every transfer belongs on the record — who, when and why — same as
    // the spec's own rule for handoffs, not just visible in an inbox somewhere.
    ...handoffs.map((h) => {
      const from = practitioners.find((p) => p.id === h.fromPractitionerId)?.name ?? 'Unknown'
      const to = practitioners.find((p) => p.id === h.toPractitionerId)?.name ?? 'Unknown'
      return {
        id: h.id,
        date: h.createdAt ?? new Date().toISOString(),
        kind: 'handoff' as const,
        title: `Handed off: ${from} → ${to}`,
        detail: h.note.reason || 'No reason given',
        tone: h.status === 'declined' ? 'amber' as const : 'neutral' as const,
      }
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const kindIcon = (k: TimelineEvent['kind']) => k === 'prescription' ? RxIcon : k === 'outcome' ? ChartLineUp : k === 'check-in' ? CalendarCheck : k === 'handoff' ? Handshake : Clock
  const kindLabel = (k: TimelineEvent['kind']) => k === 'prescription' ? 'Prescription' : k === 'outcome' ? 'Outcome' : k === 'check-in' ? 'Check-in' : k === 'handoff' ? 'Handoff' : 'Visit'

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-[13px] font-semibold text-brand">← All patients</button>

      <Card className="flex items-center gap-4 p-5">
        <Avatar initials={patient.initials} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[20px] font-bold text-ink">{patient.name}</h1>
            <div ref={assignRef}>
              <button
                onClick={openAssignDropdown}
                className="group flex items-center gap-1"
              >
                <Badge tone={patient.assignment === 'Unassigned' ? 'amber' : patient.assignment === 'Mine' ? 'green' : 'neutral'}>
                  {patient.assignment}
                </Badge>
                <PencilSimple size={12} weight="bold" className="text-faint opacity-0 transition group-hover:opacity-100" />
              </button>
            </div>
          </div>
          <div className="text-[13px] text-muted">
            {patient.age} · {patient.sex} · {patient.wsCode} · {patient.location} · patient since {patient.patientSince}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onFollowUp}><ArrowsClockwise size={15} /> Follow-up</Button>
        <Button variant="ghost" size="sm" onClick={onCaseSheet}><Notebook size={15} /> Open case sheet</Button>
        <Button variant="primary" size="sm" onClick={onPrescribe}><RxIcon size={15} weight="fill" /> Write prescription</Button>
      </Card>

      {assignOpen && createPortal(
        <div
          ref={assignDropRef}
          style={{ position: 'fixed', top: assignPos.top, left: assignPos.left, zIndex: 200 }}
          className="w-[240px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-modal"
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Assign to</div>
          {practitioners.map((pr) => (
            <button
              key={pr.id}
              onClick={() => {
                assignPatient(patient.id, pr.id)
                setAssignOpen(false)
                toast({ title: 'Patient reassigned', message: `${patient.name} is now assigned to ${pr.name}.` })
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition hover:bg-surface-hover ${patient.owningPractitionerId === pr.id ? 'font-semibold text-brand' : 'text-body'}`}
            >
              <Avatar initials={pr.initials} size={28} />
              <div className="flex-1">
                <div className="text-[13px]">{pr.name}</div>
                <div className="text-[11px] text-faint">{pr.specialty}</div>
              </div>
              {patient.owningPractitionerId === pr.id && <Check size={14} weight="bold" className="text-brand" />}
            </button>
          ))}
        </div>,
        document.body,
      )}

      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {summary.map(([l, v]) => (
              <Card key={l} className="px-4 py-3">
                <Label>{l}</Label>
                <div className="mt-1 text-[13.5px] font-semibold text-ink">{v}</div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Prescription history</h2>
            <div className="space-y-2.5">
              {rx.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                    <RxIcon size={17} weight="fill" />
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-[14px] font-semibold text-ink">{r.remedy} {r.potency}</div>
                    <div className="text-[12px] text-muted">{r.repetition} · {r.doseGlobules} globules{r.durationDays ? ` · ${r.durationDays} days` : ''}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {r.sharedVia.map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-bold text-ink">Billing</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={!billableAppt}
                onClick={() => billableAppt && setBillingApptId(billableAppt.id)}
                title={billableAppt ? undefined : 'No consult ready to bill yet'}
              >
                <CurrencyInr size={14} weight="bold" /> Record payment
              </Button>
            </div>
            {invoices.length === 0 ? (
              <p className="py-3 text-center text-[12.5px] text-faint">No invoices yet.</p>
            ) : (
              <div className="space-y-2.5">
                {invoices.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                      <CurrencyInr size={17} weight="bold" />
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-[14px] font-semibold text-ink">₹{(a.fee ?? 0).toLocaleString('en-IN')}</div>
                      <div className="text-[12px] text-muted">{formatDayLabel(a.date)} · {a.reason ?? 'Consultation'}{a.paymentMode ? ` · ${a.paymentMode}` : ''}</div>
                    </div>
                    <Badge tone={a.paymentStatus === 'paid' ? 'green' : a.paymentStatus === 'waived' ? 'neutral' : 'amber'}>
                      {a.paymentStatus === 'paid' ? 'Paid' : a.paymentStatus === 'waived' ? 'Waived' : 'Unpaid'}
                    </Badge>
                    <button onClick={() => reprintInvoice(a)} title="Print / save PDF" className="text-faint hover:text-body">
                      <Printer size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* patient timeline */}
          {timeline.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Timeline</h2>
              <div className="relative ml-4 border-l-2 border-border pl-5">
                {timeline.map((ev, i) => {
                  const Icon = kindIcon(ev.kind)
                  return (
                    <div key={ev.id} className="relative mb-4 last:mb-0">
                      <div className="absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-surface">
                        <Icon size={12} weight="fill" className="text-brand" />
                      </div>
                      <div className="text-[10px] font-semibold text-faint">{new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {kindLabel(ev.kind)}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">{ev.title}</span>
                        <Badge tone={ev.tone}>{kindLabel(ev.kind)}</Badge>
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">{ev.detail}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <Label>Progress · self-reported</Label>
            <div className="mt-1 flex items-end gap-2">
              <span className="font-display text-[30px] font-bold text-success">+65%</span>
              <span className="mb-1.5 text-[12px] text-faint">12 Jun → today</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-pill bg-tint-pale">
              <div className="h-full rounded-pill bg-accent" style={{ width: '65%' }} />
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <Label>Documents</Label>
              <label className="flex cursor-pointer items-center gap-1 rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-accent hover:text-white">
                <Plus size={13} weight="bold" /> Upload
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const doc = await uploadDocument(file, patientId)
                  if (doc) { addDocument(doc); toast({ title: 'Uploaded', message: doc.name }) }
                  else toast({ title: 'Upload failed', message: 'Check your connection' })
                  e.target.value = ''
                }} />
              </label>
            </div>
            <div className="mt-2 space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-body">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{d.format}</Badge>
                    <span className="text-faint">{d.size}</span>
                  </div>
                </div>
              ))}
              {docs.length === 0 && <div className="py-3 text-center text-[12px] text-faint">No documents yet</div>}
            </div>
          </Card>
          <Card className="flex h-[420px] flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border px-5 py-3">
              <h3 className="font-display text-[14px] font-bold text-ink">Messages</h3>
            </div>
            <div className="min-h-0 flex-1">
              <ChatThread patientId={patientId} viewAs="practitioner" compact />
            </div>
          </Card>
        </div>
      </div>
      <BillingModal apptId={billingApptId} onClose={() => setBillingApptId(null)} />
    </div>
  )
}

// ── PRESCRIPTION WRITER ──
function PrescriptionWriter({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const publish = useClinic((s) => s.publishPrescription)
  const updatePractitioner = useClinic((s) => s.updatePractitioner)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const toast = useToast()

  // The remedy field is the actual value — typing always works, chips below
  // are just a fast-select that fill the same field. It used to only accept
  // a click on a chip; there was no way to type a remedy that wasn't
  // already on the list.
  const [remedy, setRemedy] = useState('')
  const [potency, setPotency] = useState<Potency>('200C')
  const [dose, setDose] = useState(4)
  const [duration, setDuration] = useState(14)
  const [rep, setRep] = useState<Repetition>('Once daily · night')
  const [prep, setPrep] = useState("Dissolve under the tongue at night, 15 minutes away from food, drink or mint. Tip into the cap — don't touch the globules.")
  const [channels, setChannels] = useState<string[]>(['WhatsApp'])
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateLabel, setTemplateLabel] = useState('')

  const applyTemplate = (t: RxTemplate) => {
    setRemedy(t.remedy)
    setPotency(t.potency)
    setDose(t.doseGlobules)
    setRep(t.repetition)
    if (t.durationDays) setDuration(t.durationDays)
    setPrep(t.preparation)
    setTemplatesOpen(false)
    toast({ title: `"${t.label}" loaded`, message: 'Review the details, then publish.' })
  }

  const saveCurrentAsTemplate = () => {
    if (!doctor || !templateLabel.trim() || !remedy.trim()) return
    const t: RxTemplate = {
      id: crypto.randomUUID(),
      label: templateLabel.trim(),
      remedy: remedy.trim(),
      potency,
      doseGlobules: dose,
      repetition: rep,
      durationDays: rep === 'As needed' ? null : duration,
      preparation: prep,
    }
    updatePractitioner(doctor.id, { rxTemplates: [...(doctor.rxTemplates ?? []), t] })
    toast({ title: 'Template saved', message: `"${t.label}" is ready to reuse.` })
    setSavingTemplate(false)
    setTemplateLabel('')
    setTemplatesOpen(false)
  }

  const list = useMemo(() => {
    const q = remedy.toLowerCase()
    const personal = (doctor?.remedyList ?? []).filter((r) => r.toLowerCase().includes(q))
    if (q.length < 2) return personal
    const personalSet = new Set((doctor?.remedyList ?? []).map((r) => r.toLowerCase()))
    const master = MASTER_REMEDIES.filter((r) => r.toLowerCase().includes(q) && !personalSet.has(r.toLowerCase()))
    return [...personal, ...master]
  }, [doctor?.remedyList, remedy])
  const isNewRemedy = remedy.trim().length > 1 && !(doctor?.remedyList ?? []).some((r) => r.toLowerCase() === remedy.trim().toLowerCase())
  const toggleChannel = (c: string) =>
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))

  if (!patient) return <PatientNotFound onBack={onDone} />

  function onPublish() {
    if (!patient) return
    if (!remedy.trim()) { toast({ title: 'Enter a remedy first' }); return }
    publish({
      patientId,
      practitionerId: doctor?.id ?? '',
      remedy: remedy.trim(),
      potency,
      doseGlobules: dose,
      repetition: rep,
      durationDays: rep === 'As needed' ? null : duration,
      preparation: prep,
      remindersEnabled: rep !== 'As needed',
      reminderTimes: rep === 'Twice daily' ? ['8:00 AM', '8:00 PM'] : ['8:00 PM'],
      sharedVia: ['Patient app', ...channels],
      origin: 'web',
    })

    // Publishing books the review too — a course that ends without anyone
    // checking back on it is the exact gap a follow-up reminder exists to
    // close. "As needed" has no natural end date, so it's skipped.
    let followUpNote = ''
    if (rep !== 'As needed' && duration > 0) {
      const followUpDate = addDaysISO(todayISO(), duration)
      scheduleFollowUp({
        patientId,
        practitionerId: doctor?.id ?? '',
        time: '10:00 AM',
        date: followUpDate,
        type: 'In person',
        reason: 'Follow-up',
      })
      followUpNote = ` Follow-up auto-booked for ${formatDayLabel(followUpDate)} — reschedule any time from Follow-ups.`
    }

    toast({
      title: 'Prescription published',
      message: `${remedy} ${potency} sent to ${patient.name}'s app${channels.length ? ` and ${channels.join(', ')}` : ''}.${followUpNote}`,
      action: { label: 'Back to patient', onClick: onDone },
    })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[20px] font-bold text-ink">Prescription · {patient.name}</h1>
          <div className="text-[12.5px] text-faint">From your saved remedy list · publishes to her app instantly</div>
        </div>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setTemplatesOpen((v) => !v)}>Saved templates</Button>
          {templatesOpen && (
            <Card className="absolute right-0 top-full z-20 mt-1 w-[280px] p-2 shadow-float">
              {(doctor?.rxTemplates ?? []).length === 0 && !savingTemplate && (
                <p className="px-2 py-3 text-center text-[12px] text-faint">No saved templates yet.</p>
              )}
              {(doctor?.rxTemplates ?? []).map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="flex w-full flex-col rounded-[8px] px-3 py-2 text-left transition hover:bg-tint"
                >
                  <span className="text-[13px] font-semibold text-ink">{t.label}</span>
                  <span className="text-[11.5px] text-muted">{t.remedy} {t.potency} · {t.repetition}</span>
                </button>
              ))}
              <div className="mt-1 border-t border-border pt-1">
                {savingTemplate ? (
                  <div className="space-y-1.5 p-1.5">
                    <input
                      autoFocus
                      value={templateLabel}
                      onChange={(e) => setTemplateLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentAsTemplate() }}
                      placeholder="e.g. Standard cold remedy"
                      className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-green-border"
                    />
                    <Button variant="primary" size="sm" className="w-full" disabled={!templateLabel.trim() || !remedy.trim()} onClick={saveCurrentAsTemplate}>Save</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => (remedy.trim() ? setSavingTemplate(true) : toast({ title: 'Enter a remedy first' }))}
                    className="flex w-full items-center gap-1.5 rounded-[8px] px-3 py-2 text-left text-[12.5px] font-semibold text-brand hover:bg-tint"
                  >
                    <Plus size={13} weight="bold" /> Save current as template
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-4">
        {/* form */}
        <Card className="space-y-5 p-5">
          <div>
            <Label>Remedy</Label>
            <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
              <MagnifyingGlass size={15} className="text-faint" />
              <input
                value={remedy}
                onChange={(e) => setRemedy(e.target.value)}
                placeholder="Type or select a remedy"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {list.map((r) => (
                <Chip key={r} selected={r === remedy} onClick={() => setRemedy(r)}>
                  {r === remedy && <Check size={12} weight="bold" className="mr-1 inline" />}{r}
                </Chip>
              ))}
              {isNewRemedy && (
                <Chip
                  className="border-dashed"
                  onClick={() => {
                    if (!doctor) return
                    updatePractitioner(doctor.id, { remedyList: [...doctor.remedyList, remedy.trim()] })
                    toast({ title: `${remedy.trim()} added to your list` })
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
            <div className="mt-2 flex flex-wrap gap-2">
              {POTENCIES.map((p) => (
                <Chip key={p} selected={p === potency} onClick={() => setPotency(p)} className="min-w-[64px] text-center">{p}</Chip>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <div>
              <Label>Dose</Label>
              <div className="mt-2"><Stepper value={dose} onChange={setDose} suffix="glob." /></div>
            </div>
            <div>
              <Label>Duration</Label>
              <div className="mt-2"><Stepper value={duration} min={1} max={90} onChange={setDuration} suffix="days" /></div>
            </div>
          </div>

          <div>
            <Label>Repetition</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {REPS.map((r) => <Chip key={r} selected={r === rep} onClick={() => setRep(r)}>{r}</Chip>)}
            </div>
          </div>

          <div>
            <Label>Preparation · in plain language for the patient</Label>
            <textarea
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none focus:border-green-border"
            />
          </div>
        </Card>

        {/* live preview */}
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2.5 border-b border-border bg-raised px-5 py-3">
              <SnehamLockup dense />
            </div>
            <div className="space-y-3 p-5">
              <div className="text-[12px] text-muted">{patient.name} · {patient.age} {patient.sex[0]} · {patient.wsCode} · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div className="font-display text-[22px] font-bold text-ink">{remedy}</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="amber">{potency}</Badge>
                <Badge tone="green">{dose} globules</Badge>
                <Badge tone="neutral">{rep}</Badge>
                {rep !== 'As needed' && <Badge tone="neutral">{duration} days</Badge>}
              </div>
              <div>
                <Label>Preparation</Label>
                <p className="mt-1 text-[13px] leading-relaxed text-body">{prep}</p>
              </div>
              <div className="border-t border-border pt-3 text-[12px] text-faint">
                Prescribed by {doctor?.name ?? 'Doctor'}{doctor?.qualifications ? ` · ${doctor.qualifications}` : ''}{doctor?.registrationNo ? ` · ${doctor.registrationNo}` : ''}
              </div>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <Label>Publish &amp; share</Label>
            <div className="flex gap-2">
              {[
                ['WhatsApp', WhatsappLogo],
                ['SMS', DeviceMobile],
                ['Email', EnvelopeSimple],
              ].map(([c, Icon]: any) => (
                <button
                  key={c}
                  onClick={() => toggleChannel(c)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill border px-3 py-2 text-[13px] font-semibold transition ${
                    channels.includes(c) ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'
                  }`}
                >
                  <Icon size={16} weight="fill" /> {c}
                </button>
              ))}
            </div>
            <Button variant="accent" className="w-full" onClick={onPublish}>
              <RxIcon size={17} weight="fill" /> Publish to patient app
            </Button>
            <div className="flex justify-center">
              <button onClick={async () => {
                if (!remedy.trim()) { toast({ title: 'Enter a remedy first' }); return }
                const rx = { id: crypto.randomUUID(), patientId: patient.id, practitionerId: doctor?.id ?? '', remedy: remedy.trim(), potency: potency as any, doseGlobules: dose, repetition: rep as any, durationDays: duration, preparation: prep, publishedAt: new Date().toISOString(), sharedVia: [], remindersEnabled: false, reminderTimes: [] }
                const credentials = [doctor?.qualifications, doctor?.registrationNo].filter(Boolean).join(' · ')
                await exportPrescriptionPdf(rx, patient.name, doctor?.name ?? 'Doctor', undefined, credentials || undefined).catch(() => {})
              }} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-body"><Printer size={14} /> Print / save as PDF</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── NOTIFICATIONS PANEL ──
function NotifPanel({ onClose }: { onClose: () => void }) {
  const notifs = useClinic((s) => s.notifications.filter((n) => n.surface === 'web'))
  const handoffs = useClinic((s) => s.handoffs)
  const patients = useClinic((s) => s.patients)
  const accept = useClinic((s) => s.acceptHandoff)
  const markAll = useClinic((s) => s.markAllRead)
  const toast = useToast()
  const iconFor = (k: string) => (k === 'handoff' ? Handshake : k === 'booking' ? CalendarCheck : k === 'low_stock' ? Warning : Bell)
  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute right-6 top-2 z-[75] w-[360px] rounded-[18px] border border-border bg-surface shadow-modal"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="font-display text-[14px] font-bold text-ink">Notifications</div>
          <button onClick={() => markAll('web')} className="text-[12px] font-semibold text-brand">Mark all read</button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifs.map((n) => {
            const Icon = iconFor(n.kind)
            return (
              <div key={n.id} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0">
                <div className={`flex h-8 w-8 items-center justify-center rounded-[9px] ${n.severity === 'purple' ? 'bg-purple-tint text-purple' : n.severity === 'warn' ? 'bg-amber-tint text-amber-text' : 'bg-tint-pale text-brand'}`}>
                  <Icon size={16} weight="fill" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-ink">{n.title}</div>
                  <div className="text-[12px] leading-snug text-muted">{n.message}</div>
                  <div className="mt-0.5 text-[11px] text-faint">{n.time}</div>
                  {n.pending && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => { const ho = handoffs.find((h) => h.status === 'pending'); if (ho) accept(ho.id) }}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const ho = handoffs.find((h) => h.status === 'pending')
                        if (ho) {
                          const pt = patients.find((p) => p.id === ho.patientId)
                          toast({
                            title: `Handoff note — ${pt?.name ?? 'Patient'}`,
                            message: `${ho.note.reason}. Current remedy: ${ho.note.currentRemedy}. Status: ${ho.note.caseStatus}. Watch for: ${ho.note.watchFor}`,
                          })
                        }
                      }}>Read note</Button>
                    </div>
                  )}
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-amber" />}
              </div>
            )
          })}
        </div>
      </motion.div>
    </>
  )
}

// ── REPORTS ──
function ReportsView({ onGoToPatients }: { onGoToPatients: () => void }) {
  const patients = useClinic((s) => s.patients)
  const appointments = useClinic((s) => s.appointments)
  const prescriptions = useClinic((s) => s.prescriptions)
  const outcomes = useClinic((s) => s.outcomes)
  const checkIns = useClinic((s) => s.checkIns)
  const practitioners = useClinic((s) => s.practitioners)

  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  const CONSULT_FEE = 1500
  const seenCount = appointments.filter((a) => a.status === 'Seen' || a.status === 'In consult').length
  const totalAppts = appointments.length
  const followUpRate = totalAppts > 0 ? Math.round((appointments.filter((a) => a.reason).length / totalAppts) * 100) : 0
  const paidAppts = appointments.filter((a) => a.paymentStatus === 'paid')
  const totalRevenue = paidAppts.reduce((sum, a) => sum + (a.fee ?? CONSULT_FEE), 0)
  const newPatientsThisMonth = (() => {
    const thisMonth = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    return patients.filter((p) => p.patientSince === thisMonth).length
  })()

  const stats = [
    { label: 'Total patients', num: patients.length, format: (n: number) => String(Math.round(n)), icon: UsersFour, tone: 'brand' as const },
    { label: 'New this month', num: newPatientsThisMonth, format: (n: number) => String(Math.round(n)), icon: Plus, tone: 'brand' as const },
    { label: 'Consultations done', num: seenCount, format: (n: number) => String(Math.round(n)), icon: Stethoscope, tone: 'green' as const },
    { label: 'Prescriptions issued', num: prescriptions.length, format: (n: number) => String(Math.round(n)), icon: Pill, tone: 'amber' as const },
    { label: 'Revenue collected', num: totalRevenue, format: inr, icon: CurrencyInr, tone: 'green' as const },
  ]

  const outcomeMap = useMemo(() => {
    const map: Record<string, number> = {}
    outcomes.forEach((o) => { map[o.outcome] = (map[o.outcome] || 0) + 1 })
    return map
  }, [outcomes])

  const outcomeBars = [
    { label: 'Clear improvement', count: outcomeMap['Clear improvement'] || 0, color: 'bg-success', icon: Smiley },
    { label: 'Partial', count: outcomeMap['Partial'] || 0, color: 'bg-accent', icon: SmileyMeh },
    { label: 'No change', count: outcomeMap['No change'] || 0, color: 'bg-[#94a3b8]', icon: SmileyMeh },
    { label: 'Aggravation', count: outcomeMap['Aggravation'] || 0, color: 'bg-danger', icon: SmileySad },
    { label: 'Changed remedy', count: outcomeMap['Changed remedy'] || 0, color: 'bg-[#a78bfa]', icon: Sparkle },
  ]
  const maxOutcome = Math.max(...outcomeBars.map((o) => o.count), 1)

  const remedyCount = useMemo(() => {
    const map: Record<string, number> = {}
    prescriptions.forEach((r) => { map[r.remedy] = (map[r.remedy] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [prescriptions])
  const maxRemedy = Math.max(...remedyCount.map(([, c]) => c), 1)

  const practitionerLoad = practitioners.map((p) => ({
    name: p.name.replace('Dr. ', ''),
    cases: p.openCases,
    patients: patients.filter((pt) => pt.owningPractitionerId === p.id).length,
  }))

  const weeklyRevenue = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const counts = new Array(7).fill(0)
    const today = new Date()
    appointments.forEach((a) => {
      if (a.status !== 'Seen' && a.status !== 'In consult') return
      if (!a.date) return
      const apptDate = new Date(a.date + 'T00:00:00')
      counts[apptDate.getDay()]++
    })
    prescriptions.forEach((p) => {
      if (!p.publishedAt) return
      const d = new Date(p.publishedAt)
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
      if (diff >= 0 && diff < 7) counts[d.getDay()]++
    })
    return days.map((day, i) => ({ day, value: counts[i] * CONSULT_FEE }))
  }, [appointments, prescriptions])
  const maxRev = Math.max(...weeklyRevenue.map((d) => d.value), 1)

  const checkInImprovement = useMemo(() => {
    if (checkIns.length === 0) return 0
    return Math.round(checkIns.reduce((sum, c) => sum + c.improvementPct, 0) / checkIns.length)
  }, [checkIns])

  // Visits by month, new vs. returning — the last 6 months, oldest first.
  const visitsByMonth = useMemo(() => {
    const months: { key: string; label: string; new: number; returning: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), new: 0, returning: 0 })
    }
    const byKey = new Map(months.map((m) => [m.key, m]))
    appointments.forEach((a) => {
      if (a.status !== 'Seen' && a.status !== 'In consult') return
      if (!a.date) return
      const d = new Date(a.date + 'T00:00:00')
      const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (!m) return
      if (a.isFirstVisit) m.new++
      else m.returning++
    })
    return months
  }, [appointments])
  const maxMonthly = Math.max(...visitsByMonth.map((m) => m.new + m.returning), 1)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[20px] font-bold text-ink">Reports</h1>
        <div className="text-[12.5px] text-faint">Practice analytics · live data from your clinic</div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${s.tone === 'green' ? 'bg-tint text-success' : s.tone === 'amber' ? 'bg-amber-tint text-amber-text' : 'bg-tint-pale text-brand'}`}>
                <s.icon size={18} weight="fill" />
              </div>
              <Label>{s.label}</Label>
            </div>
            <CountUp value={s.num} format={s.format} duration={1.4} className="mt-2 block font-display text-[26px] font-bold leading-none text-ink" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">Outcome distribution</h2>
          {outcomes.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-faint">No outcomes recorded yet</p>
          ) : (
            <div className="space-y-3">
              {outcomeBars.map((o) => (
                <div key={o.label} className="flex items-center gap-3">
                  <div className="w-[130px] flex items-center gap-2 text-[12.5px] text-body">
                    <o.icon size={16} weight="fill" className="shrink-0 text-muted" />
                    <span className="truncate">{o.label}</span>
                  </div>
                  <div className="flex-1 h-[22px] rounded-[6px] bg-screen overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(o.count / maxOutcome) * 100}%` }}
                      transition={{ duration: 0.8, ease: easeCalm }}
                      className={`h-full rounded-[6px] ${o.color}`}
                    />
                  </div>
                  <span className="w-6 text-right font-display text-[13px] font-bold text-ink">{o.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">Top remedies prescribed</h2>
          {remedyCount.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-faint">No prescriptions issued yet</p>
          ) : (
            <div className="space-y-3">
              {remedyCount.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 text-right font-display text-[12px] font-bold text-faint">{i + 1}</span>
                  <div className="w-[110px] truncate text-[12.5px] font-medium text-body">{name}</div>
                  <div className="flex-1 h-[22px] rounded-[6px] bg-screen overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxRemedy) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06, ease: easeCalm }}
                      className="h-full rounded-[6px] bg-accent"
                    />
                  </div>
                  <span className="w-6 text-right font-display text-[13px] font-bold text-ink">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Patient visits</h2>
          <div className="flex items-center gap-3 text-[11.5px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand" />New</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />Returning</span>
          </div>
        </div>
        <div className="flex items-end gap-4" style={{ height: 160 }}>
          {visitsByMonth.map((m, i) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="text-[11px] font-semibold text-faint">{m.new + m.returning || ''}</div>
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-[8px]" style={{ height: 120 }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.returning / maxMonthly) * 120}px` }}
                  transition={{ duration: 0.7, delay: i * 0.05, ease: easeCalm }}
                  className="w-full bg-accent"
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.new / maxMonthly) * 120}px` }}
                  transition={{ duration: 0.7, delay: i * 0.05, ease: easeCalm }}
                  className="w-full rounded-t-[8px] bg-brand"
                />
              </div>
              <div className="text-[12px] font-medium text-muted">{m.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">Weekly revenue</h2>
          <div className="flex items-end gap-3" style={{ height: 180 }}>
            {weeklyRevenue.map((d, i) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="text-[11px] font-semibold text-faint">{inr(d.value)}</div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.value / maxRev) * 140}px` }}
                  transition={{ duration: 0.8, delay: i * 0.05, ease: easeCalm }}
                  className="w-full rounded-t-[8px] bg-accent"
                />
                <div className="text-[12px] font-medium text-muted">{d.day}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">Quick stats</h2>
          <div className="space-y-4">
            <div>
              <Label>Avg patient improvement</Label>
              <div className="mt-1 flex items-end gap-1">
                <span className="font-display text-[28px] font-bold leading-none text-ink">{checkInImprovement}</span>
                <span className="mb-0.5 text-[13px] text-faint">%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-screen">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${checkInImprovement}%` }}
                  transition={{ duration: 1, ease: easeCalm }}
                  className="h-full rounded-full bg-success"
                />
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <Label>Check-ins received</Label>
              <CountUp value={checkIns.length} format={(n) => String(Math.round(n))} duration={1} className="mt-1 block font-display text-[22px] font-bold leading-none text-ink" />
            </div>
            <div className="border-t border-border pt-3">
              <Label>Follow-up rate</Label>
              <CountUp value={followUpRate} format={(n) => `${Math.round(n)}%`} duration={1} className="mt-1 block font-display text-[22px] font-bold leading-none text-ink" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Practitioner workload</h2>
          <Button variant="ghost" size="sm" onClick={onGoToPatients}>
            <UsersThree size={14} /> Rebalance gently
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {practitionerLoad.map((p) => (
            <div key={p.name} className="rounded-[14px] border border-border bg-surface px-4 py-3.5">
              <div className="font-display text-[14px] font-semibold text-ink">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-[22px] font-bold text-ink">{p.cases}</span>
                <span className="text-[12px] text-faint">open cases</span>
              </div>
              <div className="mt-1 text-[12px] text-muted">{p.patients} patients assigned</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── SETTINGS ──
function SettingsView() {
  const practitioners = useClinic((s) => s.practitioners)
  const currentId = useClinic((s) => s.currentPractitionerId)
  const updatePractitioner = useClinic((s) => s.updatePractitioner)
  const me = practitioners.find((p) => p.id === currentId)
  const [clinicName, setClinicName] = useState('Sneham Digital Clinic')
  const [consultDuration, setConsultDuration] = useState('20')
  const [notifPrefs, setNotifPrefs] = useState({ newBooking: true, followUpDue: true, lowStock: false, patientCheckIn: true })
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: me?.name ?? '',
    specialty: me?.specialty ?? '',
    qualifications: me?.qualifications || '',
    registrationNo: me?.registrationNo || '',
  })
  const toast = useToast()

  if (!me) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
      </div>
    )
  }

  const togglePref = (key: keyof typeof notifPrefs) =>
    setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))

  const prefs = [
    { key: 'newBooking' as const, label: 'New booking alerts' },
    { key: 'followUpDue' as const, label: 'Follow-up due reminders' },
    { key: 'lowStock' as const, label: 'Low stock warnings' },
    { key: 'patientCheckIn' as const, label: 'Patient check-in notifications' },
  ]

  const saveProfile = () => {
    updatePractitioner(currentId, {
      name: profileForm.name.trim(),
      specialty: profileForm.specialty.trim(),
      qualifications: profileForm.qualifications.trim() || undefined,
      registrationNo: profileForm.registrationNo.trim() || undefined,
    })
    setEditingProfile(false)
    toast({ title: 'Profile updated', message: 'Your changes have been saved.' })
  }

  const setField = (key: keyof typeof profileForm, value: string) =>
    setProfileForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[20px] font-bold text-ink">Settings</h1>
        <div className="text-[12.5px] text-faint">Profile, clinic configuration and team management</div>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Your profile</h2>
          {!editingProfile && (
            <button onClick={() => setEditingProfile(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
              <PencilSimple size={13} weight="bold" /> Edit
            </button>
          )}
        </div>

        {editingProfile ? (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label>Full name</Label>
              <input
                value={profileForm.name}
                onChange={(e) => setField('name', e.target.value)}
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
              />
            </div>
            <div>
              <Label>Specialty</Label>
              <input
                value={profileForm.specialty}
                onChange={(e) => setField('specialty', e.target.value)}
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
              />
            </div>
            <div>
              <Label>Qualifications</Label>
              <input
                value={profileForm.qualifications}
                onChange={(e) => setField('qualifications', e.target.value)}
                placeholder="e.g. BHMS, MD (Hom)"
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
            </div>
            <div>
              <Label>Registration no.</Label>
              <input
                value={profileForm.registrationNo}
                onChange={(e) => setField('registrationNo', e.target.value)}
                placeholder="e.g. Reg. 41982"
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => {
                setEditingProfile(false)
                setProfileForm({ name: me.name, specialty: me.specialty, qualifications: me.qualifications || '', registrationNo: me.registrationNo || '' })
              }}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={saveProfile} className={!profileForm.name.trim() ? 'opacity-50' : ''}>Save profile</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-5">
            <Avatar initials={me.initials} size={56} />
            <div className="space-y-1">
              <div className="font-display text-[17px] font-bold text-ink">{me.name}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="flex items-center gap-1"><Stethoscope size={14} weight="fill" /> {me.specialty}</span>
                {me.qualifications && <span className="flex items-center gap-1"><GraduationCap size={14} weight="fill" /> {me.qualifications}</span>}
                {me.registrationNo && <span className="flex items-center gap-1"><IdentificationCard size={14} weight="fill" /> {me.registrationNo}</span>}
              </div>
              <Badge tone={me.role === 'Owner' ? 'green' : 'neutral'}>{me.role}</Badge>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="space-y-5 p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Clinic details</h2>
          <div>
            <Label>Clinic name</Label>
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
            />
          </div>
          <div>
            <Label>Default consult duration</Label>
            <select
              value={consultDuration}
              onChange={(e) => setConsultDuration(e.target.value)}
              className="mt-1.5 w-full appearance-none rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
            >
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
          <Button variant="primary" size="sm" onClick={() => toast({ title: 'Settings saved', message: `Clinic: ${clinicName}, duration: ${consultDuration} min` })}>
            Save changes
          </Button>
        </Card>

        <Card className="space-y-5 p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Notification preferences</h2>
          {prefs.map((pref) => (
            <button
              key={pref.key}
              onClick={() => togglePref(pref.key)}
              className="flex w-full items-center justify-between"
            >
              <span className="text-[13px] text-body">{pref.label}</span>
              {notifPrefs[pref.key]
                ? <ToggleRight size={28} weight="fill" className="text-accent" />
                : <ToggleLeft size={28} weight="fill" className="text-faint" />}
            </button>
          ))}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Manage team</h2>
        <div className="space-y-2">
          {practitioners.map((pr) => (
            <div key={pr.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3">
              <Avatar initials={pr.initials} size={38} />
              <div className="flex-1">
                <div className="font-display text-[14px] font-semibold text-ink">{pr.name}</div>
                <div className="text-[12px] text-muted">
                  {pr.specialty}
                  {pr.qualifications && ` · ${pr.qualifications}`}
                </div>
              </div>
              <Badge tone={pr.role === 'Owner' ? 'green' : 'neutral'}>{pr.role}</Badge>
              <div className="text-[12px] text-faint">{pr.openCases} open cases</div>
            </div>
          ))}
        </div>
      </Card>

      <ScheduleSettings practitionerId={currentId} consultDuration={parseInt(consultDuration)} />
    </div>
  )
}

function ScheduleSettings({ practitionerId, consultDuration }: { practitionerId: string; consultDuration: number }) {
  const timeBlocks = useClinic((s) => s.timeBlocks.filter((t) => t.practitionerId === practitionerId))
  const addTimeBlock = useClinic((s) => s.addTimeBlock)
  const removeTimeBlock = useClinic((s) => s.removeTimeBlock)
  const toast = useToast()

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const [workingDays, setWorkingDays] = useState<Set<string>>(new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']))
  const [morningStart, setMorningStart] = useState('09:00')
  const [morningEnd, setMorningEnd] = useState('13:00')
  const [eveningStart, setEveningStart] = useState('16:00')
  const [eveningEnd, setEveningEnd] = useState('19:00')

  const toggleDay = (day: string) => {
    setWorkingDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day); else next.add(day)
      return next
    })
  }

  const slotsPerSession = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    return Math.max(0, Math.floor(mins / consultDuration))
  }

  const totalSlots = workingDays.size * (slotsPerSession(morningStart, morningEnd) + slotsPerSession(eveningStart, eveningEnd))

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15px] font-bold text-ink">Working hours</h2>
        <Badge tone="neutral">{totalSlots} slots/week</Badge>
      </div>

      <div>
        <Label>Working days</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${workingDays.has(day) ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted'}`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Morning session</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-body" />
            <span className="text-faint">to</span>
            <input type="time" value={morningEnd} onChange={(e) => setMorningEnd(e.target.value)} className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-body" />
          </div>
          <div className="mt-1 text-[11px] text-faint">{slotsPerSession(morningStart, morningEnd)} slots</div>
        </div>
        <div>
          <Label>Evening session</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="time" value={eveningStart} onChange={(e) => setEveningStart(e.target.value)} className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-body" />
            <span className="text-faint">to</span>
            <input type="time" value={eveningEnd} onChange={(e) => setEveningEnd(e.target.value)} className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-body" />
          </div>
          <div className="mt-1 text-[11px] text-faint">{slotsPerSession(eveningStart, eveningEnd)} slots</div>
        </div>
      </div>

      {timeBlocks.length > 0 && (
        <div>
          <Label>Blocked time</Label>
          <div className="mt-2 space-y-1.5">
            {timeBlocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-[10px] border border-border bg-surface px-3.5 py-2">
                <span className="text-[13px] text-body">{formatDayLabel(b.date)} · {b.startHour}:00 · {b.durationMin}m — {b.reason}</span>
                <button onClick={() => removeTimeBlock(b.id)} className="text-[12px] font-semibold text-danger hover:underline">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="primary" size="sm" onClick={() => toast({ title: 'Schedule saved', message: `${workingDays.size} working days, ${totalSlots} weekly slots` })}>
        Save schedule
      </Button>
    </Card>
  )
}

// ── NEW PATIENT MODAL ──
function NewPatientModal({ onClose }: { onClose: () => void }) {
  const addPatient = useClinic((s) => s.addPatient)
  const toast = useToast()
  const [form, setForm] = useState({ name: '', age: '', sex: 'Female' as Patient['sex'], phone: '', chiefComplaint: '', location: '' })
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = () => {
    if (!form.name.trim() || !form.chiefComplaint.trim()) return
    const p = addPatient({
      name: form.name.trim(),
      age: parseInt(form.age) || 0,
      sex: form.sex,
      location: form.location.trim() || 'Mumbai',
      chiefComplaint: form.chiefComplaint.trim(),
      phone: form.phone.trim(),
    })
    toast({ title: 'Patient added', message: `${p.name} (${p.wsCode}) is now in your roster.` })
    onClose()
  }

  const fields = [
    { key: 'name', label: 'Full name', placeholder: 'e.g. Priya Sharma', required: true },
    { key: 'age', label: 'Age', placeholder: 'e.g. 34', type: 'number' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
    { key: 'chiefComplaint', label: 'Chief complaint', placeholder: 'e.g. Chronic migraine', required: true },
    { key: 'location', label: 'Location', placeholder: 'e.g. Andheri West' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] rounded-[20px] border border-border bg-surface p-6 shadow-modal"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-bold text-ink">New patient</h2>
          <button onClick={onClose} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
        </div>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}{f.required ? ' *' : ''}</Label>
              <input
                type={f.type ?? 'text'}
                value={(form as any)[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
            </div>
          ))}
          <div>
            <Label>Gender</Label>
            <div className="mt-1.5 flex gap-2">
              {(['Female', 'Male', 'Other'] as const).map((s) => (
                <Chip key={s} selected={form.sex === s} onClick={() => set('sex', s)}>{s}</Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onSubmit} className={!form.name.trim() || !form.chiefComplaint.trim() ? 'opacity-50' : ''}>
            <Plus size={15} weight="bold" /> Add patient
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── helpers ──
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tint-pale text-brand">
        <ChartLineUp size={26} weight="fill" />
      </div>
      <h2 className="mt-4 font-display text-[18px] font-bold text-ink">{title}</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted">This module is next on the roadmap. The data model and design system are already in place for it.</p>
    </div>
  )
}

function Restricted({ onBack }: { onBack: () => void }) {
  const toast = useToast()
  const owner = useClinic((s) => s.practitioners.find((p) => p.role === 'Owner'))
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-tint text-amber-text">
        <Lock size={24} weight="fill" />
      </div>
      <h2 className="mt-4 font-display text-[18px] font-bold text-ink">This area needs practitioner access</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted">Assistants see the schedule, contacts, billing and reminders. Case notes and prescriptions stay with practitioners.</p>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="sm" onClick={onBack}>Back to today</Button>
        <Button variant="ghost" size="sm" onClick={() => toast({ title: `Access request sent to ${owner?.name ?? 'the practice owner'}`, message: 'You will be notified when your role is updated.' })}>Request access</Button>
      </div>
    </div>
  )
}
