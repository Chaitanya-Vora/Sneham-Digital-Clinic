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
  TrendUp,
  ToggleRight,
  ToggleLeft,
  Printer,
  PencilSimple,
  Prohibit,
  Stethoscope,
  UserCircle,
  IdentificationCard,
  GraduationCap,
  MapPin,
  SignOut,
  EnvelopeSimple,
  TestTube,
  ChatText,
  DownloadSimple,
  FileCsv,
  Paperclip,
  PaperPlaneRight,
  FileText,
  FilePdf,
  DotsThreeVertical,
  Eye,
  Archive,
  ArrowCounterClockwise,
  VideoCamera,
  Copy,
} from '@phosphor-icons/react'
import { todayISO, formatDayLabel, addDaysISO } from '../core/day'
import { getSections, CASE_TEMPLATES } from '../core/caseTemplate'
import { useClinic, type PublishRxInput } from '../core/store'
import { useAuth } from '../auth/AuthProvider'
import type { Appointment, Patient, Potency, Repetition, RxTemplate, Invoice, InvoiceLineItem, PaymentMode, ChatMessage, ReferralSource, Role, EditableRole, RolePermissionSet, AssignmentRules, PractitionerSettings } from '../core/types'
import { isOneOffRepetition } from '../core/types'
import { MASTER_REMEDIES } from '../core/remedies'
import { INVESTIGATION_CATALOG, ALL_INVESTIGATIONS, wordsOf, matchesAllWords } from '../core/investigations'
import { DEFAULT_CONSULT_FEE, invoiceTotal, invoiceBalance } from '../core/billing'
import { toCsv, downloadCsv } from '../core/csvExport'
import { STANDARD_MEDICINE_INSTRUCTIONS } from '../core/rxInstructions'
import { shareViaWhatsApp, shareViaSms, shareViaEmail, shareTextViaWhatsApp } from '../core/share'
import { uploadDocument, getDocumentUrl, fetchPatientDeletionImpact, newId } from '../core/db'
import { Avatar, Badge, Button, Card, Chip, Label, Stepper, PatientNotFound } from '../design-system/ui'
import { PendingApproval } from '../design-system/PendingApproval'
import { Pressable } from '../design-system/Pressable'
import { CLINIC_DETAILS } from '../core/letterheadAssets'
import { SnehamLockup } from '../design-system/Logo'
import { ToastHost, useToast } from '../design-system/toast'
import { CountUp } from '../design-system/feedback'
import { easeCalm, listContainer, listItem } from '../design-system/motion'
import { CaseSheet } from './CaseSheet'
import { FollowUp } from './FollowUp'
import { CommandPalette, type Command } from './CommandPalette'
import { WebCalendar } from './WebCalendar'
import { AppointmentModal, type AppointmentModalRequest } from './AppointmentModal'
import { VideoConsult } from '../video/VideoConsult'
import { exportPrescriptionPdf, exportInvoicePdf, exportInvestigationOrderPdf, exportPatientHistoryPdf } from '../core/pdfExport'

type Screen = 'today' | 'calendar' | 'patients' | 'patient' | 'prescription' | 'investigations' | 'casesheet' | 'followup' | 'reports' | 'settings' | 'restricted' | 'prescriptions-all' | 'casenotes-all' | 'followups-all' | 'messages'
const POTENCIES: Potency[] = ['6C', '12C', '30C', '200C', '1M', '10M', '50M', 'CM', 'LM', 'Q']
const REPS: Repetition[] = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed', 'Once only today']
const CLINIC_LOCATIONS = ['Chiplun clinic', 'Pune clinic']
const REFERRAL_SOURCES: ReferralSource[] = ['Offline', 'Instagram', 'References', 'Referral']

// Owner and Practitioner have never been restricted by any of these
// checks — only Assistant/Receptionist have a real, editable row (see
// migration_v32) — so anyone else always passes.
function hasRolePermission(role: Role, rolePermissions: Record<EditableRole, RolePermissionSet>, key: keyof RolePermissionSet): boolean {
  return role === 'Assistant' || role === 'Receptionist' ? rolePermissions[role][key] : true
}

const NAV = [
  { id: 'today', icon: SunHorizon, label: 'Today' },
  { id: 'calendar', icon: CalendarBlank, label: 'Calendar' },
  { id: 'patients', icon: UsersThree, label: 'Patients' },
  { id: 'messages', icon: ChatText, label: 'Messages' },
  { id: 'casenotes', icon: Notebook, label: 'Case notes', locked: true },
  { id: 'prescriptions', icon: RxIcon, label: 'Prescriptions', locked: true },
  { id: 'followups', icon: ArrowsClockwise, label: 'Follow-ups', locked: true },
  { id: 'reports', icon: ChartLineUp, label: 'Reports' },
  { id: 'settings', icon: GearSix, label: 'Settings' },
] as const

// The command palette shortcut itself already listens for either key
// (metaKey OR ctrlKey, below) — this is purely the visible hint, which
// was previously hardcoded to the Mac symbol even on Windows/Linux,
// showing the wrong key entirely for most of the world's desktop users.
const CMD_KEY_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  ? '⌘K'
  : 'Ctrl+K'

export function WebApp() {
  const { signOut } = useAuth()
  const [screen, setScreen] = useState<Screen>('today')
  const [patientId, setPatientId] = useState('pt-ananya')
  const [notifOpen, setNotifOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [clinicOpen, setClinicOpen] = useState(false)
  const [selectedClinic, setSelectedClinic] = useState('Chiplun clinic')
  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [videoApptId, setVideoApptId] = useState<string | null>(null)
  const [guestMeeting, setGuestMeeting] = useState<{ id: string; guestName: string } | null>(null)
  const [instantMeetingOpen, setInstantMeetingOpen] = useState(false)
  const [messagesPatientId, setMessagesPatientId] = useState<string | null>(null)
  const [calendarFocusPractitionerId, setCalendarFocusPractitionerId] = useState<string | null>(null)
  const [rxDraftId, setRxDraftId] = useState<string | null>(null)
  const clinicRef = useRef<HTMLDivElement>(null)

  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const role = useClinic((s) => s.role)
  const rolePermissions = useClinic((s) => s.rolePermissions)
  const offline = useClinic((s) => s.offline)
  const dbError = useClinic((s) => s.dbError)
  const pendingCount = useClinic((s) => s.pendingWrites.length)
  const patients = useClinic((s) => s.patients)
  const unread = useClinic((s) => s.notifications.filter((n) => n.surface === 'web' && !n.read).length)
  const unreadMessages = useClinic((s) => s.messages.filter((m) => m.sender === 'patient' && !m.read).length)
  const todayAppts = useClinic((s) => s.appointments.filter((a) => a.date === todayISO()))
  const toast = useToast()

  // Every hook in this component must run unconditionally, before any early
  // return below — React error #310 ("more hooks than the previous render")
  // is exactly what happens when a hook is declared after a conditional
  // return, since the render that takes the early return skips it entirely
  // while a later render (once `doctor` loads) doesn't. This was the actual
  // cause of the repeating "Something went wrong" crash.
  //
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

  if (!doctor) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
      </div>
    )
  }

  if (doctor.status === 'pending') {
    return <PendingApproval name={doctor.name} />
  }

  const openPatient = (id: string) => {
    setPatientId(id)
    setScreen('patient')
  }
  const openCaseSheet = (id: string) => { setPatientId(id); setScreen('casesheet') }
  const openPrescription = (id: string) => { setPatientId(id); setRxDraftId(null); setScreen('prescription') }
  const openFollowUp = (id: string) => { setPatientId(id); setScreen('followup') }
  const openMessages = (id: string) => { setMessagesPatientId(id); setScreen('messages') }
  const openCalendarForPractitioner = (practitionerId: string) => { setCalendarFocusPractitionerId(practitionerId); setScreen('calendar') }

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
    if (locked && !hasRolePermission(role, rolePermissions, 'seeCaseNotes')) {
      setScreen('restricted')
      return
    }
    if (id === 'today' || id === 'calendar' || id === 'patients' || id === 'reports' || id === 'settings') { setScreen(id as Screen); return }
    if (id === 'messages') { setScreen('messages'); return }
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
              <div className="text-[11px] text-faint">{CLINIC_LOCATIONS.length - 1} other location{CLINIC_LOCATIONS.length - 1 === 1 ? '' : 's'}</div>
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
                {CLINIC_LOCATIONS.map((c) => (
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
            const locked = (n as any).locked && !hasRolePermission(role, rolePermissions, 'seeCaseNotes')
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
                  {n.id === 'messages' && unreadMessages > 0 && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unreadMessages}</span>
                  )}
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
              <kbd className="rounded-[6px] border border-border bg-screen px-1.5 py-0.5 text-[11px] font-semibold text-faint">{CMD_KEY_LABEL}</kbd>
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
              {screen === 'today' && <TodayView onOpenPatient={openPatient} onStartVideo={setVideoApptId} onOpenCalendarForPractitioner={openCalendarForPractitioner} onOpenInstantMeeting={() => setInstantMeetingOpen(true)} />}
              {screen === 'calendar' && <WebCalendar onOpenPatient={openPatient} focusPractitionerId={calendarFocusPractitionerId} />}
              {screen === 'patients' && <PatientsView onOpenPatient={openPatient} onNewPatient={() => setNewPatientOpen(true)} />}
              {screen === 'messages' && <MessagesView initialPatientId={messagesPatientId} onOpenPatient={openPatient} />}
              {screen === 'patient' && (
                <PatientDetail
                  patientId={patientId}
                  onPrescribe={(draftId) => { setRxDraftId(draftId ?? null); setScreen('prescription') }}
                  onOrderInvestigations={() => setScreen('investigations')}
                  onCaseSheet={() => setScreen('casesheet')}
                  onFollowUp={() => setScreen('followup')}
                  onOpenMessages={() => openMessages(patientId)}
                  onBack={() => setScreen('patients')}
                />
              )}
              {screen === 'prescription' && <PrescriptionWriter patientId={patientId} draftId={rxDraftId} onDone={() => { setRxDraftId(null); setScreen('patient') }} />}
              {screen === 'investigations' && <InvestigationWriter patientId={patientId} onDone={() => setScreen('patient')} />}
              {screen === 'casesheet' && (
                <CaseSheet patientId={patientId} onPrescribe={() => { setRxDraftId(null); setScreen('prescription') }} onBack={() => setScreen('patient')} />
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
        {instantMeetingOpen && (
          <InstantMeetingModal
            onClose={() => setInstantMeetingOpen(false)}
            onStart={(id, guestName) => { setGuestMeeting({ id, guestName }); setInstantMeetingOpen(false) }}
          />
        )}
      </AnimatePresence>

      {guestMeeting && createPortal(
        <div className="fixed inset-0 z-[200] bg-[#1a1a1a]">
          <VideoConsult
            patientName={guestMeeting.guestName || 'Guest'}
            practitionerName={doctor.name}
            appointmentId={guestMeeting.id}
            onEnd={() => setGuestMeeting(null)}
          />
        </div>,
        document.body,
      )}

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
function TodayView({ onOpenPatient, onStartVideo, onOpenCalendarForPractitioner, onOpenInstantMeeting }: { onOpenPatient: (id: string) => void; onStartVideo: (apptId: string) => void; onOpenCalendarForPractitioner: (practitionerId: string) => void; onOpenInstantMeeting: () => void }) {
  // Cancelled appointments stay in the database (never deleted — an
  // accidental walk-in can now be cancelled instead of being permanently
  // stuck with no way to edit or remove it), just excluded from every
  // stat and list here, same as a cancelled invoice is excluded from revenue.
  const allAppts = useClinic((s) => s.appointments.filter((a) => a.status !== 'Cancelled'))
  const invoices = useClinic((s) => s.invoices)
  const patients = useClinic((s) => s.patients)
  const role = useClinic((s) => s.role)
  const myId = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners.filter((p) => p.status === 'active'))
  const toast = useToast()
  // null = modal closed. patientId: null = show the patient picker first
  // (top-level "Quick bill"); a real id = already scoped to that patient
  // (opened from a specific appointment's "₹ Collect").
  const [billing, setBilling] = useState<{ patientId: string | null; appointmentId?: string } | null>(null)
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
  // Revenue is billing, not appointments — sourced from invoices (what was
  // actually received, excluding cancelled bills), same practitioner/today
  // scope as the rest of this view.
  const myInvoicesToday = invoices.filter((i) => i.practitionerId === myId && i.date === todayISO() && i.status !== 'cancelled')
  const revenueToday = myInvoicesToday.reduce((sum, i) => sum + i.amountReceived, 0)
  const paidCount = myInvoicesToday.filter((i) => i.amountReceived > 0).length
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
            <button
              onClick={() => setBilling({ patientId: null })}
              className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-body transition hover:border-green-border hover:text-brand"
            >
              <CurrencyInr size={14} weight="bold" /> Quick bill
            </button>
            <button
              onClick={onOpenInstantMeeting}
              className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-body transition hover:border-green-border hover:text-brand"
            >
              <VideoCamera size={14} weight="bold" /> Instant meeting
            </button>
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
            const apptInvoice = invoices.find((i) => i.appointmentId === a.id && i.status !== 'cancelled')
            return (
              <motion.div
                key={a.id}
                variants={listItem}
                role="button"
                tabIndex={0}
                onClick={() => onOpenPatient(a.patientId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPatient(a.patientId) } }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                className={`flex w-full cursor-pointer items-center gap-4 rounded-[14px] border border-l-[3px] bg-surface px-4 py-3 text-left transition hover:bg-surface-hover hover:shadow-card ${a.type === 'Video' ? 'border-border border-l-amber' : 'border-border border-l-green-border'}`}
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
                {a.status === 'Seen' && !apptInvoice && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setBilling({ patientId: a.patientId, appointmentId: a.id }) }}
                    className="flex items-center gap-1 rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-accent hover:text-white"
                  >
                    ₹ Collect
                  </button>
                )}
                {apptInvoice && apptInvoice.amountReceived > 0 && <Badge tone="green">₹{apptInvoice.amountReceived.toLocaleString('en-IN')}</Badge>}
                <Badge tone={a.type === 'Video' ? 'amber' : 'green'}>{a.type}</Badge>
                <Badge tone={a.status === 'In consult' ? 'green' : 'neutral'}>{a.status}</Badge>
                {a.status !== 'Seen' && a.status !== 'In consult' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!window.confirm(`Cancel ${p?.name ?? 'this'}'s ${a.time} appointment?`)) return
                      useClinic.getState().updateAppointmentStatus(a.id, 'Cancelled')
                      toast({ title: 'Appointment cancelled', message: `${p?.name ?? 'Patient'}'s ${a.time} slot is now free.` })
                    }}
                    className="rounded-full p-1.5 text-faint transition hover:bg-danger/10 hover:text-danger"
                    title="Cancel appointment"
                  >
                    <X size={15} />
                  </button>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </Card>

      {role === 'Owner' && viewMode === 'everyone' && team.length > 0 && (
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
                  <button
                    onClick={() => onOpenCalendarForPractitioner(p.id)}
                    className="mb-1.5 flex items-center gap-2 rounded-[8px] transition hover:text-brand"
                    title={`View ${p.name}'s calendar`}
                  >
                    <Avatar initials={p.initials} size={22} />
                    <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                    <span className="text-[12px] text-faint">{rows.length} today</span>
                  </button>
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

      <InvoiceModal
        open={billing !== null}
        patientId={billing?.patientId ?? null}
        appointmentId={billing?.appointmentId}
        onClose={() => setBilling(null)}
      />
    </div>
  )
}

// ── BILLING ──
// A real itemized invoice — line items, partial payment, edit and cancel
// (never delete — analytics need the history) — decoupled from needing an
// appointment at all, so a phone-call quick bill takes just a few taps:
// pick a patient (or arrives already scoped to one), adjust the one
// pre-filled "Consultation" line if needed, Save & print.
const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other']
const INVOICE_STATUS_TONE = { paid: 'green', partial: 'amber', unpaid: 'amber', waived: 'neutral', cancelled: 'danger' } as const
const INVOICE_STATUS_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', waived: 'Waived', cancelled: 'Cancelled' } as const

function InvoiceModal({
  open,
  patientId,
  appointmentId,
  existingInvoice,
  onClose,
}: {
  open: boolean
  patientId: string | null
  appointmentId?: string
  existingInvoice?: Invoice
  onClose: () => void
}) {
  const patients = useClinic((s) => s.patients)
  const ME = useClinic((s) => s.currentPractitionerId)
  const createInvoice = useClinic((s) => s.createInvoice)
  const updateInvoice = useClinic((s) => s.updateInvoice)
  const cancelInvoice = useClinic((s) => s.cancelInvoice)
  const toast = useToast()

  const [pickedPatientId, setPickedPatientId] = useState<string | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [items, setItems] = useState<InvoiceLineItem[]>([{ name: 'Consultation', qty: 1, unitPrice: DEFAULT_CONSULT_FEE }])
  const [amountReceived, setAmountReceived] = useState(DEFAULT_CONSULT_FEE)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash')
  const [waived, setWaived] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset to the right starting state whenever the modal opens — editing an
  // existing invoice always initializes from ITS values, never a fresh
  // default (the exact bug class this billing code had twice before).
  useEffect(() => {
    if (!open) return
    setPickedPatientId(null)
    setPickerQuery('')
    if (existingInvoice) {
      setItems(existingInvoice.items)
      setAmountReceived(existingInvoice.amountReceived)
      setPaymentMode(existingInvoice.paymentMode)
      setWaived(existingInvoice.status === 'waived')
    } else {
      const total = DEFAULT_CONSULT_FEE
      setItems([{ name: 'Consultation', qty: 1, unitPrice: DEFAULT_CONSULT_FEE }])
      setAmountReceived(total)
      setPaymentMode('Cash')
      setWaived(false)
    }
  }, [open, existingInvoice])

  const resolvedPatientId = patientId ?? pickedPatientId
  const patient = patients.find((p) => p.id === resolvedPatientId)
  const total = invoiceTotal(items)

  // Keep "amount received" following the total when it was already fully
  // paid (the common instant-payment case) — but never fight the doctor
  // once she's deliberately typed a different amount.
  const receivedTouched = useRef(false)
  useEffect(() => {
    if (!receivedTouched.current) setAmountReceived(total)
  }, [total])

  if (!open) return null

  const updateItem = (i: number, patch: Partial<InvoiceLineItem>) =>
    setItems((its) => its.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((its) => [...its, { name: '', qty: 1, unitPrice: 0 }])
  const removeItem = (i: number) => setItems((its) => (its.length > 1 ? its.filter((_, idx) => idx !== i) : its))

  const patientPickerResults = pickerQuery.trim()
    ? patients.filter((p) => p.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
    : patients.slice(0, 6)

  async function handleSaveAndPrint() {
    if (!patient) return
    if (items.some((it) => !it.name.trim())) { toast({ title: 'Every item needs a name' }); return }
    setSaving(true)
    const status = waived ? 'waived' : amountReceived <= 0 ? 'unpaid' : amountReceived >= total ? 'paid' : 'partial'
    let invoice: Invoice | null
    if (existingInvoice) {
      updateInvoice(existingInvoice.id, { items, amountReceived: waived ? 0 : amountReceived, paymentMode, status })
      invoice = { ...existingInvoice, items, amountReceived: waived ? 0 : amountReceived, paymentMode, status }
    } else {
      invoice = await createInvoice({
        patientId: patient.id,
        practitionerId: ME,
        appointmentId,
        date: todayISO(),
        items,
        paymentMode,
        amountReceived: waived ? 0 : amountReceived,
        status,
      })
    }
    setSaving(false)
    if (!invoice) return
    toast({ title: existingInvoice ? 'Bill updated' : 'Bill saved', message: `₹${total.toLocaleString('en-IN')} · ${patient.name}` })
    await exportInvoicePdf(invoice, patient).catch((e) => {
      console.error('Invoice PDF failed', e)
      toast({ title: 'Saved, but the PDF failed', message: 'You can reprint it from the invoice list.' })
    })
    onClose()
  }

  function handleCancel() {
    if (!existingInvoice) return
    cancelInvoice(existingInvoice.id)
    toast({ title: 'Bill cancelled', message: `Invoice #${existingInvoice.invoiceNo} won’t count toward revenue anymore.` })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 max-h-[88vh] w-full max-w-[460px] overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-modal animate-pop"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-body">
          <X size={18} />
        </button>
        <h2 className="font-display text-[18px] font-bold text-ink">{existingInvoice ? `Edit invoice #${existingInvoice.invoiceNo}` : 'Quick bill'}</h2>

        {!resolvedPatientId ? (
          <>
            <p className="mt-0.5 text-[13px] text-muted">Who is this for?</p>
            <div className="mt-3 flex items-center gap-2 rounded-pill border border-border bg-canvas px-3.5 py-2">
              <MagnifyingGlass size={15} className="text-faint" />
              <input
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search patients"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
            <div className="mt-2 max-h-[280px] space-y-1.5 overflow-y-auto">
              {patientPickerResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPickedPatientId(p.id)}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-3 py-2.5 text-left transition hover:bg-surface-hover"
                >
                  <Avatar initials={p.initials} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{p.name}</div>
                    <div className="truncate text-[11.5px] text-muted">{p.age}y · {p.chiefComplaint}</div>
                  </div>
                </button>
              ))}
              {patientPickerResults.length === 0 && <p className="py-6 text-center text-[13px] text-faint">No patients found.</p>}
            </div>
          </>
        ) : (
          <>
            <p className="mt-0.5 text-[13px] text-muted">{patient?.name}</p>

            <Label className="mt-4">Items</Label>
            <div className="mt-1.5 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                    placeholder="e.g. Consultation, Medicine"
                    className="min-w-0 flex-1 rounded-[10px] border border-border bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none focus:border-green-border"
                  />
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-12 rounded-[10px] border border-border bg-canvas px-1.5 py-2 text-center text-[13px] text-ink outline-none focus:border-green-border"
                    title="Quantity"
                  />
                  <div className="flex w-24 items-center gap-1 rounded-[10px] border border-border bg-canvas px-2 py-2">
                    <span className="text-[12px] text-muted">₹</span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                      className="w-full bg-transparent text-[13px] text-ink outline-none"
                      title="Price per unit"
                    />
                  </div>
                  <button onClick={() => removeItem(i)} disabled={items.length === 1} className="p-1 text-faint hover:text-danger disabled:opacity-30">
                    <X size={14} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-brand">
              <Plus size={13} weight="bold" /> Add item
            </button>

            <div className="mt-3 flex items-center justify-between rounded-[12px] bg-tint px-3.5 py-2.5">
              <span className="text-[13px] font-semibold text-ink-deep">Total</span>
              <span className="text-[15px] font-bold text-ink-deep">₹{total.toLocaleString('en-IN')}</span>
            </div>

            <Label className="mt-4">Amount received</Label>
            <div className="mt-1.5 flex items-center gap-2 rounded-[12px] border border-border bg-canvas px-3.5 py-2.5">
              <span className="text-[15px] font-semibold text-muted">₹</span>
              <input
                type="number"
                value={waived ? 0 : amountReceived}
                disabled={waived}
                onChange={(e) => { receivedTouched.current = true; setAmountReceived(Number(e.target.value) || 0) }}
                className="w-full bg-transparent text-[15px] font-semibold text-ink outline-none disabled:opacity-50"
              />
              {!waived && amountReceived !== total && (
                <button onClick={() => { receivedTouched.current = true; setAmountReceived(total) }} className="shrink-0 text-[11.5px] font-semibold text-brand">Paid in full</button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[12px] text-muted">
                <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="accent-brand" />
                Waive this bill (no charge)
              </label>
              {!waived && amountReceived < total && <span className="text-[12px] font-semibold text-amber-text">Balance ₹{(total - amountReceived).toLocaleString('en-IN')}</span>}
            </div>

            <Label className="mt-4">Payment mode</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMode(m)}
                  className={`rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${
                    paymentMode === m ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              {existingInvoice && (
                <Button variant="ghost" className="!text-danger" onClick={handleCancel}>Cancel bill</Button>
              )}
              <Button variant="accent" className="flex-1" disabled={saving} onClick={handleSaveAndPrint}>
                <CurrencyInr size={16} weight="bold" /> {saving ? 'Saving…' : 'Save & print'}
              </Button>
            </div>
          </>
        )}
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
  const allPatients = useClinic((s) => s.patients)
  const archivePatient = useClinic((s) => s.archivePatient)
  const restorePatient = useClinic((s) => s.restorePatient)
  const patients = useMemo(() => allPatients.filter((p) => !p.archivedAt), [allPatients])
  const archivedPatients = useMemo(() => allPatients.filter((p) => p.archivedAt), [allPatients])
  const practitioners = useClinic((s) => s.practitioners.filter((p) => p.status === 'active'))
  const assignPatient = useClinic((s) => s.assignPatient)
  const role = useClinic((s) => s.role)
  const rolePermissions = useClinic((s) => s.rolePermissions)
  const canAssign = hasRolePermission(role, rolePermissions, 'assignCases')
  const toast = useToast()
  const [active, setActive] = useState('My cases')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuFor])

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
    ['Archived', archivedPatients.length] as const,
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

  const filtered = (active === 'Archived' ? archivedPatients : patients).filter((p) => {
    if (active === 'Archived') return true
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
          {canAssign && (selecting ? (
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
          ))}
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
        <div className={`grid gap-4 border-b border-border bg-raised px-5 py-3 ${selecting ? 'grid-cols-[32px_1.6fr_1.4fr_1.2fr_0.8fr_1fr_28px]' : 'grid-cols-[1.6fr_1.4fr_1.2fr_0.8fr_1fr_28px]'}`}>
          {selecting && <Label>{' '}</Label>}
          {['Patient', 'Chief complaint', 'Current remedy', 'Last seen', 'Assignment'].map((h) => (
            <Label key={h}>{h}</Label>
          ))}
          <span />
        </div>
        {filtered.map((p) => (
          <Pressable
            key={p.id}
            as="div"
            hap="tick"
            onClick={() => selecting ? toggleSelect(p.id) : onOpenPatient(p.id)}
            className={`grid w-full cursor-pointer items-center gap-4 border-b border-border px-5 py-3.5 text-left transition last:border-0 hover:bg-surface-hover ${selecting ? 'grid-cols-[32px_1.6fr_1.4fr_1.2fr_0.8fr_1fr_28px]' : 'grid-cols-[1.6fr_1.4fr_1.2fr_0.8fr_1fr_28px]'} ${selected.has(p.id) ? 'bg-tint/40' : ''}`}
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
            {canAssign && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  // Flip the menu upward when there isn't room below — a
                  // row near the bottom of the list would otherwise open a
                  // menu that renders past the bottom of the window with
                  // no way to scroll it into view (it's position: fixed).
                  const estimatedHeight = 40 + practitioners.length * 44
                  const opensUpward = rect.bottom + 4 + estimatedHeight > window.innerHeight
                  setMenuPos(opensUpward
                    ? { top: rect.top - estimatedHeight - 4, left: rect.right - 200 }
                    : { top: rect.bottom + 4, left: rect.right - 200 })
                  setMenuFor(menuFor === p.id ? null : p.id)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-faint transition hover:bg-tint hover:text-brand"
              >
                <DotsThreeVertical size={17} weight="bold" />
              </button>
            )}
          </Pressable>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-[13px] text-muted">No patients match these filters.</div>
        )}
      </Card>

      {menuFor && createPortal(
        <div
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 200 }}
          className="w-[200px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-modal"
        >
          {active === 'Archived' ? (
            <button
              onClick={() => {
                const p = allPatients.find((x) => x.id === menuFor)
                restorePatient(menuFor)
                setMenuFor(null)
                toast({ title: 'Patient restored', message: `${p?.name ?? 'Patient'} is back in the active roster.` })
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold text-brand transition hover:bg-surface-hover"
            >
              <ArrowCounterClockwise size={15} /> Restore patient
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  const p = allPatients.find((x) => x.id === menuFor)
                  if (!window.confirm(`Archive ${p?.name ?? 'this patient'}? They'll be hidden from your active roster but nothing is deleted.`)) return
                  archivePatient(menuFor)
                  setMenuFor(null)
                  toast({ title: 'Patient archived', message: `${p?.name ?? 'Patient'} is hidden from your active roster. Restore any time from the Archived tab.` })
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold text-body transition hover:bg-surface-hover"
              >
                <Archive size={15} /> Archive patient
              </button>
              <div className="border-t border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Reassign to</div>
              {practitioners.map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => {
                    const p = allPatients.find((x) => x.id === menuFor)
                    assignPatient(menuFor, pr.id)
                    setMenuFor(null)
                    toast({ title: 'Patient reassigned', message: `${p?.name ?? 'Patient'} is now assigned to ${pr.name}.` })
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-body transition hover:bg-surface-hover"
                >
                  <Avatar initials={pr.initials} size={22} />
                  {pr.name}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body,
      )}

      {bulkAssignOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setBulkAssignOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-[380px] overflow-y-auto rounded-[20px] border border-border bg-surface p-6 shadow-modal"
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
  const sorted = [...prescriptions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
          <div className="text-[12.5px] text-faint">{prescriptions.filter((r) => r.status === 'published').length.toLocaleString('en-IN')} published</div>
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
                  <div className="text-[12px] text-muted">{new Date(r.publishedAt ?? r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className={`text-[13.5px] font-semibold ${r.status === 'cancelled' ? 'text-faint line-through' : 'text-ink'}`}>{r.remedy} {r.potency}</div>
                <div className="w-[150px] text-[12px] text-muted">{r.repetition}</div>
                {r.status === 'draft' && <Badge tone="amber">Draft</Badge>}
                {r.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
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
  const toast = useToast()
  const [modalRequest, setModalRequest] = useState<AppointmentModalRequest | null>(null)
  const followUps = appts
    .filter((a) => a.reason?.toLowerCase().includes('follow') && a.status !== 'Seen' && a.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
  const today = todayISO()
  const canModify = (a: Appointment) => a.status !== 'Seen' && a.status !== 'In consult' && a.status !== 'Cancelled'

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
              <Pressable
                as="div"
                key={a.id}
                onClick={() => onOpenFollowUp(a.patientId)}
                className="flex w-full cursor-pointer items-center gap-4 border-b border-border px-5 py-3.5 text-left transition last:border-0 hover:bg-surface-hover"
              >
                <Avatar initials={pt?.initials ?? '?'} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[14px] font-semibold text-ink">{pt?.name ?? 'Patient'}</div>
                  <div className="truncate text-[12px] text-muted">{pt?.currentRemedy ?? '—'}</div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-[13px] text-body">{formatDayLabel(a.date)} · {a.time}</div>
                <div className="shrink-0"><Badge tone={overdue ? 'amber' : 'neutral'}>{overdue ? 'Overdue' : 'Upcoming'}</Badge></div>
                {canModify(a) && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalRequest({ mode: 'edit', appointment: a }) }}
                      className="rounded-full p-1.5 text-faint transition hover:bg-tint hover:text-brand"
                      title="Edit appointment"
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!window.confirm(`Cancel ${pt?.name ?? 'this'}'s ${formatDayLabel(a.date)} follow-up?`)) return
                        useClinic.getState().updateAppointmentStatus(a.id, 'Cancelled')
                        toast({ title: 'Follow-up cancelled', message: `${pt?.name ?? 'Patient'}'s follow-up has been cancelled.` })
                      }}
                      className="rounded-full p-1.5 text-faint transition hover:bg-danger/10 hover:text-danger"
                      title="Cancel follow-up"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </Pressable>
            )
          })
        )}
      </Card>

      <AnimatePresence>
        {modalRequest && <AppointmentModal request={modalRequest} onClose={() => setModalRequest(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ── MESSAGES ──
// A real two-pane inbox (conversation list + open thread) — matching the
// practitioner mobile app's Inbox tab, adapted to the desktop console's
// extra width instead of squeezing the same chat widget into a narrow
// sidebar card on the patient page (which just showed a lightweight
// preview + "open" link — see PatientDetail's Messages card).
function MessagesView({ initialPatientId, onOpenPatient }: { initialPatientId: string | null; onOpenPatient: (id: string) => void }) {
  const messages = useClinic((s) => s.messages)
  const patients = useClinic((s) => s.patients)
  const [selected, setSelected] = useState<string | null>(initialPatientId)

  const conversations = useMemo(() => {
    const byPatient = new Map<string, { patientId: string; lastMsg: ChatMessage; unread: number }>()
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

  const selectedPatient = patients.find((p) => p.id === selected)

  return (
    <div className="flex h-[calc(100vh-150px)] gap-4">
      <Card className="flex w-[320px] shrink-0 flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-border px-5 py-3.5">
          <h2 className="font-display text-[16px] font-bold text-ink">Messages</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <ChatText size={28} className="text-faint" />
              <p className="mt-3 text-[13px] text-muted">No conversations yet.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const p = patients.find((x) => x.id === c.patientId)
              const name = p?.name ?? 'Unknown'
              const preview = c.lastMsg.text.length > 48 ? c.lastMsg.text.slice(0, 48) + '…' : c.lastMsg.text
              const time = new Date(c.lastMsg.sentAt)
              const isToday = new Date().toDateString() === time.toDateString()
              const timeStr = isToday
                ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              const active = c.patientId === selected
              return (
                <button
                  key={c.patientId}
                  onClick={() => setSelected(c.patientId)}
                  className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition ${active ? 'bg-tint' : 'hover:bg-surface-hover'}`}
                >
                  <Avatar initials={p?.initials ?? '?'} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[13.5px] font-semibold ${c.unread > 0 ? 'text-ink' : 'text-body'}`}>{name}</span>
                      <span className={`shrink-0 text-[11px] ${c.unread > 0 ? 'font-semibold text-brand' : 'text-faint'}`}>{timeStr}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-[12.5px] ${c.unread > 0 ? 'font-medium text-body' : 'text-muted'}`}>
                        {c.lastMsg.sender === 'practitioner' && <span className="text-faint">You: </span>}
                        {preview}
                      </span>
                      {c.unread > 0 && (
                        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{c.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </Card>

      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        {selectedPatient ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
              <Avatar initials={selectedPatient.initials} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[14.5px] font-semibold text-ink">{selectedPatient.name}</div>
                <div className="truncate text-[11.5px] text-faint">{selectedPatient.age}y · {selectedPatient.chiefComplaint}</div>
              </div>
              <button
                onClick={() => onOpenPatient(selectedPatient.id)}
                className="shrink-0 rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-body transition hover:bg-surface-hover"
              >
                View case
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <WebChatThread patientId={selectedPatient.id} />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <ChatText size={32} className="text-faint" />
            <p className="text-[13px] text-muted">Select a conversation to view it here.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

// Web's own thread rendering — same data/behaviour as the shared ChatThread
// (used by the practitioner/patient apps, which keep their WhatsApp look on
// purpose), but styled to match the rest of the desktop console rather than
// a chat app: no wallpaper texture, solid brand-green sent bubbles, no
// read-receipt ticks, timestamps below each bubble, date dividers.
function WebChatThread({ patientId }: { patientId: string }) {
  const messages = useClinic((s) => s.messages.filter((m) => m.patientId === patientId))
  const sendMessage = useClinic((s) => s.sendMessage)
  const markConvoRead = useClinic((s) => s.markConvoRead)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    [messages],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sorted.length])

  useEffect(() => {
    const unread = messages.some((m) => m.sender === 'patient' && !m.read)
    if (unread) markConvoRead(patientId, 'patient')
  }, [patientId, messages, markConvoRead])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    sendMessage(patientId, text, 'practitioner')
    setDraft('')
  }

  const dayLabel = (d: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  let lastDay = ''

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-screen px-5 py-4">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[13px] text-faint">No messages yet. Say hello.</p>
          </div>
        )}
        <div className="space-y-3">
          {sorted.map((msg) => {
            const mine = msg.sender === 'practitioner'
            const d = new Date(msg.sentAt)
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const thisDay = dayLabel(d)
            const showDivider = thisDay !== lastDay
            lastDay = thisDay
            return (
              <div key={msg.id}>
                {showDivider && (
                  <div className="mb-3 flex items-center justify-center">
                    <span className="rounded-pill bg-surface px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">{thisDay}</span>
                  </div>
                )}
                <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-[14px] px-3.5 py-2.5 shadow-sm ${
                      mine ? 'bg-brand text-white' : 'border border-border bg-surface text-body'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[13.5px] leading-[1.4]">{msg.text}</p>
                  </div>
                  <span className="mt-1 text-[11px] text-faint">{time}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div ref={endRef} />
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-border px-4 py-3">
        <div className="flex-1 rounded-pill border border-border bg-surface px-4 py-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Write a reply..."
            rows={1}
            className="max-h-[100px] w-full resize-none bg-transparent text-[13.5px] text-body outline-none placeholder:text-faint"
          />
        </div>
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-pill bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent-deep disabled:opacity-40"
        >
          Send <PaperPlaneRight size={15} weight="fill" />
        </button>
      </div>
    </div>
  )
}

// Small self-reported-wellbeing trend line — real check-in history, not a
// fabricated multi-week curve. A patient with one check-in gets one dot,
// not an invented trend; the line only appears once there's something to
// connect.
function ProgressChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length === 0) {
    return <p className="mt-3 text-[12.5px] text-faint">No check-ins yet.</p>
  }

  const W = 280
  const H = 72
  const PAD = 6
  const n = points.length
  const x = (i: number) => (n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2))
  const y = (v: number) => H - PAD - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ')
  const areaPath = `${linePath} L ${x(n - 1)} ${H} L ${x(0)} ${H} Z`
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {n > 1 && <path d={areaPath} fill="#E9EEE1" />}
        {n > 1 && <path d={linePath} fill="none" stroke="#5E8A57" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={x(i)}
            cy={y(p.value)}
            r={i === n - 1 ? 4 : 2.5}
            fill={i === n - 1 ? '#5E8A57' : '#FCFBF6'}
            stroke="#5E8A57"
            strokeWidth={i === n - 1 ? 0 : 2}
          />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10.5px] text-faint">
        <span>{shortDate(points[0].date)}</span>
        {n > 1 && <span>{shortDate(points[n - 1].date)}</span>}
      </div>
    </div>
  )
}

// A ring built from stacked stroke-dasharray arcs, one per segment — reused
// for the referral-source breakdown on Reports. Segments with value 0 are
// skipped so a thin sliver of a zero-count category never renders.
function DonutChart({ segments, size = 120, strokeWidth = 18 }: { segments: { label: string; value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDEBE0" strokeWidth={strokeWidth} />
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c
          const dash = `${len} ${c - len}`
          const dashOffset = -offset
          offset += len
          return (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              strokeLinecap={segments.filter((x) => x.value > 0).length > 1 ? 'butt' : 'round'}
            />
          )
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-body">{s.label}</span>
            <span className="font-display font-bold text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PATIENT DETAIL ──
function PatientDetail({ patientId, onPrescribe, onOrderInvestigations, onCaseSheet, onFollowUp, onOpenMessages, onBack }: { patientId: string; onPrescribe: (draftId?: string) => void; onOrderInvestigations: () => void; onCaseSheet: () => void; onFollowUp: () => void; onOpenMessages: () => void; onBack: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const rx = useClinic((s) => s.prescriptions.filter((r) => r.patientId === patientId))
  const docs = useClinic((s) => s.documents.filter((d) => d.patientId === patientId))
  const outcomes = useClinic((s) => s.outcomes.filter((o) => o.patientId === patientId))
  const investigationOrders = useClinic((s) => s.investigationOrders.filter((o) => o.patientId === patientId))
  const checkIns = useClinic((s) => s.checkIns.filter((c) => c.patientId === patientId))
  const handoffs = useClinic((s) => s.handoffs.filter((h) => h.patientId === patientId))
  const secondOpinions = useClinic((s) => s.secondOpinions.filter((o) => o.patientId === patientId))
  const requestSecondOpinion = useClinic((s) => s.requestSecondOpinion)
  const answerSecondOpinion = useClinic((s) => s.answerSecondOpinion)
  const appointments = useClinic((s) => s.appointments.filter((a) => a.patientId === patientId))
  const invoices = useClinic((s) => s.invoices.filter((i) => i.patientId === patientId))
  const patientMessages = useClinic((s) => s.messages.filter((m) => m.patientId === patientId))
  // Kept unfiltered — historical handoff entries below need to resolve a
  // since-removed practitioner's real name, not show "Unknown". The
  // assignment dropdown further down uses its own active-only list instead.
  const practitioners = useClinic((s) => s.practitioners)
  const activePractitioners = useMemo(() => practitioners.filter((p) => p.status === 'active'), [practitioners])
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const assignPatient = useClinic((s) => s.assignPatient)
  const addDocument = useClinic((s) => s.addDocument)
  const cancelPrescription = useClinic((s) => s.cancelPrescription)
  const role = useClinic((s) => s.role)
  const rolePermissions = useClinic((s) => s.rolePermissions)
  const toast = useToast()
  const [assignOpen, setAssignOpen] = useState(false)
  const [billing, setBilling] = useState<{ patientId: string; appointmentId?: string; existingInvoice?: Invoice } | null>(null)
  const [assignPos, setAssignPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const assignRef = useRef<HTMLDivElement>(null)
  const assignDropRef = useRef<HTMLDivElement>(null)
  const [requestingOpinion, setRequestingOpinion] = useState(false)
  const [opinionTo, setOpinionTo] = useState<string | null>(null)
  const [opinionQuestion, setOpinionQuestion] = useState('')
  const [opinionReplyDraft, setOpinionReplyDraft] = useState<Record<string, string>>({})
  const [patientMenuOpen, setPatientMenuOpen] = useState(false)
  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [deletePatientOpen, setDeletePatientOpen] = useState(false)
  const archivePatient = useClinic((s) => s.archivePatient)
  const restorePatient = useClinic((s) => s.restorePatient)
  const patientMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!patientMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (patientMenuRef.current?.contains(e.target as Node)) return
      setPatientMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [patientMenuOpen])

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

  const progressPoints = useMemo(
    () => [...checkIns].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map((c) => ({ date: c.submittedAt, value: c.improvementPct })),
    [checkIns],
  )

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

  // Invoice history — real invoices for this patient, most recent first.
  // Cancelled invoices stay in this list (never deleted) so history and
  // analytics stay auditable, just excluded from revenue sums elsewhere.
  const sortedInvoices = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNo - a.invoiceNo)

  const printInvoice = (inv: Invoice) => {
    if (!patient) return
    exportInvoicePdf(inv, patient).catch(() => {})
  }

  // Just a preview — the real conversation now lives in its own Messages
  // section (a proper two-pane inbox, not a chat widget squeezed into this
  // sidebar). Reading it here never marks anything read; only actually
  // opening the conversation does that.
  const lastMessage = [...patientMessages].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]
  const unreadMessageCount = patientMessages.filter((m) => m.sender === 'patient' && !m.read).length

  type TimelineEvent = { id: string; date: string; kind: 'visit' | 'prescription' | 'check-in' | 'outcome' | 'handoff'; title: string; detail: string; tone: 'green' | 'amber' | 'neutral' }
  const timeline: TimelineEvent[] = [
    // Drafts aren't a real clinical event yet — they're excluded here, not
    // just given a fallback date. A cancelled one stays (its publishedAt is
    // preserved, and a doctor's own audit timeline should still show a
    // retracted prescription as something that happened).
    ...rx.filter((r) => r.status !== 'draft').map((r) => ({ id: r.id, date: r.publishedAt ?? r.createdAt, kind: 'prescription' as const, title: `${r.remedy} ${r.potency}`, detail: `${r.repetition} · ${r.durationDays ? `${r.durationDays} days` : 'until settled'}`, tone: 'green' as const })),
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
              {!hasRolePermission(role, rolePermissions, 'assignCases') ? (
                <Badge tone={patient.assignment === 'Unassigned' ? 'amber' : patient.assignment === 'Mine' ? 'green' : 'neutral'}>
                  {patient.assignment}
                </Badge>
              ) : (
                <button
                  onClick={openAssignDropdown}
                  className="group flex items-center gap-1"
                >
                  <Badge tone={patient.assignment === 'Unassigned' ? 'amber' : patient.assignment === 'Mine' ? 'green' : 'neutral'}>
                    {patient.assignment}
                  </Badge>
                  <PencilSimple size={12} weight="bold" className="text-faint opacity-0 transition group-hover:opacity-100" />
                </button>
              )}
            </div>
          </div>
          <div className="text-[13px] text-muted">
            {[
              `${patient.age} · ${patient.sex}`,
              patient.wsCode,
              patient.location,
              patient.phone,
              `patient since ${patient.patientSince}`,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onFollowUp}><ArrowsClockwise size={15} /> Follow-up</Button>
        <Button variant="ghost" size="sm" onClick={onCaseSheet}><Notebook size={15} /> Open case sheet</Button>
        <Button variant="ghost" size="sm" onClick={onOrderInvestigations}><TestTube size={15} /> Order investigations</Button>
        <Button variant="primary" size="sm" onClick={() => onPrescribe()}><RxIcon size={15} weight="fill" /> Write prescription</Button>
        <div ref={patientMenuRef} className="relative">
          <button
            onClick={() => setPatientMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition hover:bg-tint hover:text-brand"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
          {patientMenuOpen && (
            <div className="absolute right-0 top-9 z-[100] w-[220px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-modal">
              <button
                onClick={() => { setEditPatientOpen(true); setPatientMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-body transition hover:bg-surface-hover"
              >
                <PencilSimple size={15} /> Edit patient details
              </button>
              <button
                onClick={async () => {
                  setPatientMenuOpen(false)
                  await exportPatientHistoryPdf(patient, rx, investigationOrders, outcomes).catch((e) => {
                    console.error('Patient history PDF export failed', e)
                    toast({ title: 'Export failed', message: e instanceof Error ? e.message : 'Please try again.' })
                  })
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-body transition hover:bg-surface-hover"
              >
                <DownloadSimple size={15} /> Export patient summary (PDF)
              </button>
              {hasRolePermission(role, rolePermissions, 'assignCases') && (
                patient.archivedAt ? (
                  <button
                    onClick={() => {
                      restorePatient(patient.id)
                      setPatientMenuOpen(false)
                      toast({ title: 'Patient restored', message: `${patient.name} is back in the active roster.` })
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold text-brand transition hover:bg-surface-hover"
                  >
                    <ArrowCounterClockwise size={15} /> Restore patient
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!window.confirm(`Archive ${patient.name}? They'll be hidden from your active roster but nothing is deleted.`)) return
                      archivePatient(patient.id)
                      setPatientMenuOpen(false)
                      toast({ title: 'Patient archived', message: `${patient.name} is hidden from your active roster. Restore any time from the Archived tab.` })
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-body transition hover:bg-surface-hover"
                  >
                    <Archive size={15} /> Archive patient
                  </button>
                )
              )}
              {role === 'Owner' && (
                <>
                  <div className="border-t border-border" />
                  <button
                    onClick={() => { setDeletePatientOpen(true); setPatientMenuOpen(false) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold text-danger transition hover:bg-danger/10"
                  >
                    <X size={15} /> Permanently delete patient…
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {editPatientOpen && <EditPatientModal patient={patient} onClose={() => setEditPatientOpen(false)} />}
      {deletePatientOpen && <PermanentDeleteModal patient={patient} onClose={() => setDeletePatientOpen(false)} onDeleted={onBack} />}

      {assignOpen && createPortal(
        <div
          ref={assignDropRef}
          style={{ position: 'fixed', top: assignPos.top, left: assignPos.left, zIndex: 200 }}
          className="w-[240px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-modal"
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Assign to</div>
          {activePractitioners.map((pr) => (
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
              {rx.map((r) => {
                const isDraft = r.status === 'draft'
                const isCancelled = r.status === 'cancelled'
                return (
                  <div key={r.id} className={`flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 ${isCancelled ? 'opacity-60' : ''}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                      <RxIcon size={17} weight="fill" />
                    </div>
                    <div className="flex-1">
                      <div className={`font-display text-[14px] font-semibold text-ink ${isCancelled ? 'line-through' : ''}`}>{r.remedy} {r.potency}</div>
                      <div className="text-[12px] text-muted">{r.repetition} · {r.doseGlobules} globules{r.durationDays ? ` · ${r.durationDays} days` : ''}</div>
                    </div>
                    {isDraft && <Badge tone="amber">Draft</Badge>}
                    {isCancelled && <Badge tone="danger">Cancelled</Badge>}
                    <div className="flex flex-wrap justify-end gap-1">
                      {r.sharedVia.map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}
                    </div>
                    {isDraft && (
                      <button onClick={() => onPrescribe(r.id)} title="Continue editing" className="text-faint hover:text-body">
                        <PencilSimple size={16} />
                      </button>
                    )}
                    {!isCancelled && (
                      <button
                        onClick={() => cancelPrescription(r.id)}
                        title={isDraft ? 'Discard draft' : 'Cancel prescription'}
                        className="text-faint hover:text-danger"
                      >
                        <Prohibit size={16} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-bold text-ink">Billing</h2>
              <Button variant="ghost" size="sm" onClick={() => setBilling({ patientId })}>
                <CurrencyInr size={14} weight="bold" /> Quick bill
              </Button>
            </div>
            {sortedInvoices.length === 0 ? (
              <p className="py-3 text-center text-[12.5px] text-faint">No invoices yet.</p>
            ) : (
              <div className="space-y-2.5">
                {sortedInvoices.map((inv) => {
                  const total = invoiceTotal(inv.items)
                  const cancelled = inv.status === 'cancelled'
                  return (
                    <div key={inv.id} className={`flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 ${cancelled ? 'opacity-60' : ''}`}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                        <CurrencyInr size={17} weight="bold" />
                      </div>
                      <div className="flex-1">
                        <div className={`font-display text-[14px] font-semibold text-ink ${cancelled ? 'line-through' : ''}`}>
                          ₹{total.toLocaleString('en-IN')} <span className="font-body text-[11.5px] font-normal text-faint">#{inv.invoiceNo}</span>
                        </div>
                        <div className="text-[12px] text-muted">{formatDayLabel(inv.date)} · {inv.items[0]?.name ?? 'Consultation'}{inv.items.length > 1 ? ` +${inv.items.length - 1} more` : ''} · {inv.paymentMode}</div>
                      </div>
                      <Badge tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                      {!cancelled && (
                        <button onClick={() => setBilling({ patientId, appointmentId: inv.appointmentId, existingInvoice: inv })} title="Edit invoice" className="text-faint hover:text-body">
                          <PencilSimple size={16} />
                        </button>
                      )}
                      <button onClick={() => printInvoice(inv)} title="Print / save PDF" className="text-faint hover:text-body">
                        <Printer size={16} />
                      </button>
                    </div>
                  )
                })}
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
            <div className="flex items-center justify-between">
              <Label>Progress · self-reported</Label>
              {progressPoints.length > 0 && (
                <Badge tone="green">+{progressPoints[progressPoints.length - 1].value}%</Badge>
              )}
            </div>
            <ProgressChart points={progressPoints} />
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
            <div className="mt-2 space-y-1.5">
              {docs.map((d) => {
                const open = async () => {
                  if (!d.fileUrl) { toast({ title: 'Not available', message: 'This document has no file attached.' }); return }
                  const url = await getDocumentUrl(d.fileUrl)
                  if (!url) { toast({ title: 'Could not open document', message: 'Check your connection and try again.' }); return }
                  window.open(url, '_blank', 'noopener,noreferrer')
                }
                const Icon = d.kind === 'Prescription' ? RxIcon : d.kind === 'Report' ? FileText : FilePdf
                const iconTone = d.kind === 'Prescription' ? 'text-brand' : d.kind === 'Report' ? 'text-amber' : 'text-muted'
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-[12px] px-1.5 py-1.5 transition hover:bg-surface-hover">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tint-pale">
                      <Icon size={18} weight="fill" className={iconTone} />
                    </div>
                    <button onClick={open} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[13px] font-medium text-body">{d.name}</div>
                      <div className="mt-0.5 text-[11.5px] text-faint">{d.format} · {d.size} · {d.uploadedBy === 'patient' ? 'uploaded by patient' : 'uploaded by you'} · {d.date}</div>
                    </button>
                    <button onClick={open} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-tint hover:text-brand" title="Download">
                      <DownloadSimple size={16} weight="bold" />
                    </button>
                  </div>
                )
              })}
              {docs.length === 0 && <div className="py-3 text-center text-[12px] text-faint">No documents yet</div>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Eye size={16} weight="bold" className="text-brand" />
              <h3 className="font-display text-[14px] font-bold text-ink">Second opinion</h3>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">Share read-only access with a colleague and attach a question. Ownership stays with you.</p>

            {secondOpinions.length > 0 && (
              <div className="mt-3 space-y-2.5">
                {secondOpinions.map((o) => {
                  const isMine = o.fromPractitionerId === doctor?.id
                  const isToMe = o.toPractitionerId === doctor?.id
                  const other = practitioners.find((p) => p.id === (isMine ? o.toPractitionerId : o.fromPractitionerId))
                  return (
                    <div key={o.id} className="rounded-[12px] border border-border bg-canvas p-3">
                      <div className="text-[12px] font-semibold text-ink">{isMine ? `Asked ${other?.name ?? 'a colleague'}` : `${other?.name ?? 'A colleague'} asked you`}</div>
                      {o.question && <p className="mt-1 text-[12.5px] text-body">&ldquo;{o.question}&rdquo;</p>}
                      {o.status === 'answered' ? (
                        <div className="mt-2 rounded-[8px] bg-tint px-2.5 py-2 text-[12.5px] text-body">{o.response}</div>
                      ) : isToMe ? (
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            value={opinionReplyDraft[o.id] ?? ''}
                            onChange={(e) => setOpinionReplyDraft((d) => ({ ...d, [o.id]: e.target.value }))}
                            placeholder="Write your response..."
                            rows={2}
                            className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-2 text-[12.5px] text-body outline-none focus:border-green-border"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!(opinionReplyDraft[o.id] ?? '').trim()}
                            onClick={() => {
                              answerSecondOpinion(o.id, (opinionReplyDraft[o.id] ?? '').trim())
                              toast({ title: 'Response sent' })
                            }}
                          >
                            Send response
                          </Button>
                        </div>
                      ) : (
                        <Badge tone="amber">Waiting on {other?.name ?? 'colleague'}</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {requestingOpinion ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {practitioners.filter((p) => p.id !== doctor?.id).map((p) => (
                    <Chip key={p.id} selected={opinionTo === p.id} onClick={() => setOpinionTo(p.id)}>{p.name}</Chip>
                  ))}
                </div>
                <textarea
                  value={opinionQuestion}
                  onChange={(e) => setOpinionQuestion(e.target.value)}
                  placeholder="What would you like their opinion on?"
                  rows={2}
                  className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-2 text-[12.5px] text-body outline-none focus:border-green-border"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setRequestingOpinion(false); setOpinionTo(null); setOpinionQuestion('') }}>Cancel</Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!opinionTo || !doctor}
                    onClick={() => {
                      if (!opinionTo || !doctor) return
                      requestSecondOpinion({ patientId, fromPractitionerId: doctor.id, toPractitionerId: opinionTo, question: opinionQuestion.trim() })
                      toast({ title: 'Second opinion requested' })
                      setRequestingOpinion(false)
                      setOpinionTo(null)
                      setOpinionQuestion('')
                    }}
                  >
                    Send request
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setRequestingOpinion(true)}>Request a note</Button>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-[14px] font-bold text-ink">Messages</h3>
              {unreadMessageCount > 0 && <Badge tone="green">{unreadMessageCount} new</Badge>}
            </div>
            <button
              onClick={onOpenMessages}
              className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 text-left transition hover:border-green-border hover:bg-surface-hover"
            >
              {lastMessage ? (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-body">
                    {lastMessage.sender === 'practitioner' && <span className="text-faint">You: </span>}
                    {lastMessage.text}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {new Date(lastMessage.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {new Date(lastMessage.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ) : (
                <span className="flex-1 text-[13px] text-muted">Start a conversation</span>
              )}
              <CaretRight size={16} className="shrink-0 text-faint" />
            </button>
          </Card>
        </div>
      </div>
      <InvoiceModal
        open={billing !== null}
        patientId={billing?.patientId ?? null}
        appointmentId={billing?.appointmentId}
        existingInvoice={billing?.existingInvoice}
        onClose={() => setBilling(null)}
      />
    </div>
  )
}

// ── PRESCRIPTION WRITER ──
function PrescriptionWriter({ patientId, draftId, onDone }: { patientId: string; draftId?: string | null; onDone: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const publish = useClinic((s) => s.publishPrescription)
  const draft = useClinic((s) => (draftId ? s.prescriptions.find((r) => r.id === draftId) : undefined))
  const saveDraft = useClinic((s) => s.saveDraftPrescription)
  const updateDraft = useClinic((s) => s.updateDraftPrescription)
  const publishDraft = useClinic((s) => s.publishDraftPrescription)
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
  // Starts empty — a channel only ever gets marked "shared" (see the chip
  // handler below) once the real external share for it actually fired, never
  // as a pre-selected default with nothing sent yet.
  const [channels, setChannels] = useState<string[]>([])

  // What actually prints on the slip — in the doctor's own words/shorthand,
  // not necessarily the plain remedy name (many homeopaths deliberately
  // avoid writing that, so patients can't self-medicate). The fields above
  // (remedy/potency/dose/repetition) still drive dose reminders and
  // reporting either way; this is just what gets typed on the page. Starts
  // pre-filled from those fields as a convenience, but once she edits it
  // directly it stops auto-updating — her words win.
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

  // Pre-fill from an existing draft when opening one for continued editing
  // — mirrors applyTemplate's bulk-field-set above.
  useEffect(() => {
    if (!draft) return
    setRemedy(draft.remedy)
    setPotency(draft.potency)
    setDose(draft.doseGlobules)
    if (draft.durationDays) setDuration(draft.durationDays)
    setRep(draft.repetition)
    setPrep(draft.preparation)
    setBodyText(draft.bodyText ?? '')
    setBodyTouched(!!draft.bodyText)
    setChannels(draft.sharedVia.filter((c) => c !== 'Patient app'))
  }, [draft?.id])

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
    setBodyTouched(false)
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
      durationDays: isOneOffRepetition(rep) ? null : duration,
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

  // Tapping an on chip is just a tracking correction — there's no "unsend".
  // Tapping an off chip actually fires the external share right now, built
  // from the current form state (same as the Print button below), and only
  // marks the channel as shared once that share genuinely went out.
  function shareChannel(c: string) {
    if (channels.includes(c)) { toggleChannel(c); return }
    if (!patient) return
    if (!remedy.trim()) { toast({ title: 'Enter a remedy first' }); return }
    const message = `Prescription from ${CLINIC_DETAILS.doctorName} for ${patient.name}:\n${bodyText.trim() || `${remedy} ${potency}`}${prep.trim() ? `\nPreparation: ${prep.trim()}` : ''}`
    let sent = true
    if (c === 'WhatsApp') sent = shareViaWhatsApp(patient.phone, message)
    else if (c === 'SMS') sent = shareViaSms(patient.phone, message)
    else if (c === 'Email') shareViaEmail(undefined, `Prescription for ${patient.name}`, message)
    if (!sent) { toast({ title: 'No phone number on file', message: `Add a phone number for ${patient.name} first.` }); return }
    toggleChannel(c)
  }

  if (!patient) return <PatientNotFound onBack={onDone} />

  function onPublish() {
    if (!patient) return
    if (!remedy.trim()) { toast({ title: 'Enter a remedy first' }); return }
    const payload: PublishRxInput = {
      patientId,
      practitionerId: doctor?.id ?? '',
      remedy: remedy.trim(),
      potency,
      doseGlobules: dose,
      repetition: rep,
      durationDays: isOneOffRepetition(rep) ? null : duration,
      preparation: prep,
      bodyText: bodyText.trim() || undefined,
      remindersEnabled: !isOneOffRepetition(rep),
      reminderTimes: rep === 'Twice daily' ? ['8:00 AM', '8:00 PM'] : ['8:00 PM'],
      sharedVia: ['Patient app', ...channels],
      origin: 'web',
    }
    const rx = draftId ? publishDraft(draftId, payload) : publish(payload)
    if (!rx) return // draft vanished from under us (e.g. cancelled elsewhere) — bail quietly

    // Publishing books the review too — a course that ends without anyone
    // checking back on it is the exact gap a follow-up reminder exists to
    // close. "As needed" has no natural end date, so it's skipped.
    let followUpNote = ''
    if (!isOneOffRepetition(rep) && duration > 0) {
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

  function onSave() {
    if (!remedy.trim()) { toast({ title: 'Enter a remedy first' }); return }
    const payload: PublishRxInput = {
      patientId,
      practitionerId: doctor?.id ?? '',
      remedy: remedy.trim(),
      potency,
      doseGlobules: dose,
      repetition: rep,
      durationDays: isOneOffRepetition(rep) ? null : duration,
      preparation: prep,
      bodyText: bodyText.trim() || undefined,
      remindersEnabled: !isOneOffRepetition(rep),
      reminderTimes: rep === 'Twice daily' ? ['8:00 AM', '8:00 PM'] : ['8:00 PM'],
      sharedVia: channels, // no 'Patient app' — nothing has been sent yet
      origin: 'web',
    }
    if (draftId) updateDraft(draftId, payload)
    else saveDraft(payload)
    toast({ title: draftId ? 'Draft updated' : 'Draft saved', message: `${remedy} ${potency} is saved with ${patient?.name}'s file — not sent yet.` })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[20px] font-bold text-ink">Prescription · {patient.name}</h1>
          <div className="text-[12.5px] text-faint">
            {draftId ? 'Editing a saved draft — nothing has been sent to her app yet' : 'From your saved remedy list · publishes to her app instantly'}
          </div>
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
            <div className="flex items-center justify-between">
              <Label>Prescription · exactly as it will print</Label>
              {bodyTouched && (
                <button
                  onClick={() => setBodyTouched(false)}
                  className="text-[11px] font-semibold text-brand"
                >
                  Reset to auto-filled
                </button>
              )}
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => { setBodyText(e.target.value); setBodyTouched(true) }}
              rows={3}
              placeholder="Write it exactly as it should appear on the printed slip — your own shorthand is fine (e.g. Px 200C, 1 dose)"
              className="mt-2 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none placeholder:text-faint focus:border-green-border"
            />
            <p className="mt-1.5 text-[11.5px] text-faint">
              This is the only thing that prints. The fields above are just a quick way to fill it in and still drive dose reminders — write over them freely.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Preparation · in plain language for the patient</Label>
              <button type="button" onClick={() => setPrep(STANDARD_MEDICINE_INSTRUCTIONS)} className="text-[11.5px] font-semibold text-brand hover:text-accent-deep">
                Insert standard instructions
              </button>
            </div>
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
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{bodyText || 'Start typing the prescription, or fill in a remedy below to auto-fill it.'}</p>
              <div>
                <Label>Preparation</Label>
                <p className="mt-1 text-[13px] leading-relaxed text-body">{prep}</p>
              </div>
              <div className="border-t border-border pt-3 text-[12px] text-faint">
                Prescribed by {CLINIC_DETAILS.doctorName} · {CLINIC_DETAILS.credentials}, {CLINIC_DETAILS.registrationNo}
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
                  onClick={() => shareChannel(c)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill border px-3 py-2 text-[13px] font-semibold transition ${
                    channels.includes(c) ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'
                  }`}
                >
                  <Icon size={16} weight="fill" /> {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onSave}>Save — don't send yet</Button>
              <Button variant="accent" className="flex-1" onClick={onPublish}>
                <RxIcon size={17} weight="fill" /> Publish to patient app
              </Button>
            </div>
            <div className="flex justify-center">
              <button onClick={async () => {
                if (!remedy.trim()) { toast({ title: 'Enter a remedy first' }); return }
                const nowIso = new Date().toISOString()
                const rx = { id: crypto.randomUUID(), patientId: patient.id, practitionerId: doctor?.id ?? '', remedy: remedy.trim(), potency: potency as any, doseGlobules: dose, repetition: rep as any, durationDays: duration, preparation: prep, bodyText: bodyText.trim() || undefined, status: 'published' as const, publishedAt: nowIso, createdAt: nowIso, updatedAt: nowIso, sharedVia: [], remindersEnabled: false, reminderTimes: [] }
                await exportPrescriptionPdf(rx, patient).catch((e) => {
                  console.error('PDF export failed', e)
                  toast({ title: 'PDF export failed', message: e instanceof Error ? e.message : 'Please try again.' })
                })
              }} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-body"><Printer size={14} /> Print / save as PDF</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── INVESTIGATION ORDER (lab tests / scans) ──
// Same real letterhead as prescriptions (the practice has no separate
// format for this) — a search-only picker, not a category checklist, per
// the client's explicit instruction: type the start of a word and matching
// tests surface to add, no browse/select-all UI.
function InvestigationWriter({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const createOrder = useClinic((s) => s.createInvestigationOrder)
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!searchOpen) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (searchRef.current?.contains(t) || searchDropRef.current?.contains(t)) return
      setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [searchOpen])

  // Deliberately prefix-of-word matching (see `matchesAllWords` in
  // core/investigations.ts — shared with the practitioner-app picker so a
  // fix like multi-word queries never needs to be made twice).
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

  const toggleTest = (test: string) =>
    setSelected((s) => (s.includes(test) ? s.filter((t) => t !== test) : [...s, test]))

  if (!patient) return <PatientNotFound onBack={onDone} />

  async function handleGenerate() {
    if (!patient) return
    if (selected.length === 0) { toast({ title: 'Add at least one investigation' }); return }
    const order = createOrder({ patientId, practitionerId: doctor?.id ?? '', tests: selected, notes: notes.trim() })
    await exportInvestigationOrderPdf(order, patient).catch((e) => {
      console.error('PDF export failed', e)
      toast({ title: 'PDF export failed', message: e instanceof Error ? e.message : 'Please try again.' })
    })
    toast({
      title: 'Investigation slip generated',
      message: `${selected.length} test${selected.length === 1 ? '' : 's'} for ${patient.name}.`,
      action: { label: 'Back to patient', onClick: onDone },
    })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[20px] font-bold text-ink">Investigations · {patient.name}</h1>
        <div className="text-[12.5px] text-faint">Same letterhead as prescriptions · prints as a requisition slip</div>
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-4">
        <Card className="space-y-5 p-5">
          <div className="relative" ref={searchRef}>
            <Label>Add investigation</Label>
            <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
              <MagnifyingGlass size={15} className="text-faint" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Start typing — CBC, thyroid, vitamin d…"
                className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-faint"
              />
            </div>
            {searchOpen && matches.length > 0 && (
              <div ref={searchDropRef} className="absolute left-0 right-0 top-full z-20 mt-1">
                <Card className="max-h-[280px] overflow-y-auto p-1.5 shadow-float">
                  {matches.map(({ test, category }) => (
                    <button
                      key={test}
                      onClick={() => { toggleTest(test); setQuery('') }}
                      className="flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left transition hover:bg-tint"
                    >
                      <span className="text-[13px] font-semibold text-ink">{test}</span>
                      <span className="shrink-0 text-[11px] text-faint">{category}</span>
                    </button>
                  ))}
                </Card>
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
                    <button onClick={() => toggleTest(test)} className="text-faint hover:text-danger">
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
              className="mt-2 w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] outline-none focus:border-green-border"
            />
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <Label>Ready to print</Label>
          <p className="text-[12.5px] text-muted">
            Generates a requisition slip on the real letterhead with the selected test{selected.length === 1 ? '' : 's'}, grouped by category, under {patient.name}&apos;s details.
          </p>
          <Button variant="primary" className="w-full" disabled={selected.length === 0} onClick={handleGenerate}>
            <Printer size={16} /> Generate &amp; save PDF
          </Button>
        </Card>
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
  const role = useClinic((s) => s.role)
  const rolePermissions = useClinic((s) => s.rolePermissions)
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
                      {hasRolePermission(role, rolePermissions, 'acceptHandoffs') && (
                        <Button size="sm" variant="primary" onClick={() => { const ho = handoffs.find((h) => h.status === 'pending'); if (ho) accept(ho.id) }}>Accept</Button>
                      )}
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
  // Kept unfiltered — CSV exports below need to resolve a since-removed
  // practitioner's real name against historical rows, not show blank.
  const practitioners = useClinic((s) => s.practitioners)
  const activePractitioners = useMemo(() => practitioners.filter((p) => p.status === 'active'), [practitioners])
  const invoices = useClinic((s) => s.invoices)
  const [period, setPeriod] = useState<'month' | 'year'>('year')
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const onClick = (e: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [exportOpen])

  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  // "Month" = this calendar month to date. "Year" = year-to-date (Jan 1 →
  // today), matching the design spec's own "Jan – Jul 2026" example — never
  // a fabricated full-year projection. The prior-period window is the SAME
  // number of elapsed days at the start of the prior month/year, so a
  // still-in-progress current period is compared fairly, not against a full
  // completed one.
  const now = new Date()
  const startOfThisPeriod = period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), 0, 1)
  const startOfPriorPeriod = period === 'month' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear() - 1, 0, 1)
  const daysElapsed = Math.floor((now.getTime() - startOfThisPeriod.getTime()) / 86400000) + 1
  const endOfPriorPeriod = new Date(startOfPriorPeriod.getTime() + daysElapsed * 86400000)
  const periodLabel = period === 'month'
    ? now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : `Jan – ${now.toLocaleDateString('en-IN', { month: 'short' })} ${now.getFullYear()}`

  const inRange = (dateStr: string | undefined | null, start: Date, end: Date) => {
    if (!dateStr) return false
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
    return d >= start && d < end
  }

  // Omits the badge entirely rather than show a fabricated/infinite swing
  // when the prior period has no real baseline (e.g. a brand-new clinic) —
  // same "honest omission" rule already used for follow-up adherence below.
  function periodDelta(current: number, prior: number, opts?: { points?: boolean }): { text: string; positive: boolean } | null {
    if (prior <= 0) return null
    if (opts?.points) {
      const diff = Math.round(current - prior)
      if (diff === 0) return null
      return { text: `${diff > 0 ? '+' : ''}${diff} point${Math.abs(diff) === 1 ? '' : 's'}`, positive: diff > 0 }
    }
    const pct = Math.round(((current - prior) / prior) * 100)
    if (pct === 0) return null
    return { text: `${pct > 0 ? '+' : ''}${pct}% vs last ${period === 'month' ? 'month' : 'year'}`, positive: pct > 0 }
  }

  const seenAppts = appointments.filter((a) => a.status === 'Seen' || a.status === 'In consult')
  const seenCount = seenAppts.filter((a) => inRange(a.date, startOfThisPeriod, now)).length
  const priorSeenCount = seenAppts.filter((a) => inRange(a.date, startOfPriorPeriod, endOfPriorPeriod)).length

  // Revenue is billing, not appointments — sourced from invoices (what was
  // actually received, excluding cancelled bills), scoped to the selected period.
  const activeInvoices = invoices.filter((i) => i.status !== 'cancelled')
  const totalRevenue = activeInvoices.filter((i) => inRange(i.date, startOfThisPeriod, now)).reduce((sum, i) => sum + i.amountReceived, 0)
  const priorRevenue = activeInvoices.filter((i) => inRange(i.date, startOfPriorPeriod, endOfPriorPeriod)).reduce((sum, i) => sum + i.amountReceived, 0)

  // Adherence = of follow-ups that have actually come due (seen or cancelled —
  // not still upcoming), what fraction were kept vs. missed. Null rather than
  // a fake 0%/100% when nothing has resolved yet.
  const resolvedFollowUps = appointments.filter((a) => a.reason === 'Follow-up' && (a.status === 'Seen' || a.status === 'Cancelled'))
  const periodResolvedFollowUps = resolvedFollowUps.filter((a) => inRange(a.date, startOfThisPeriod, now))
  const followUpAdherence = periodResolvedFollowUps.length > 0
    ? Math.round((periodResolvedFollowUps.filter((a) => a.status === 'Seen').length / periodResolvedFollowUps.length) * 100)
    : null
  const priorResolvedFollowUps = resolvedFollowUps.filter((a) => inRange(a.date, startOfPriorPeriod, endOfPriorPeriod))
  const priorFollowUpAdherence = priorResolvedFollowUps.length > 0
    ? Math.round((priorResolvedFollowUps.filter((a) => a.status === 'Seen').length / priorResolvedFollowUps.length) * 100)
    : null

  const newPatientsInWindow = patients.filter((p) => inRange(p.patientSince, startOfThisPeriod, now)).length
  const priorNewPatients = patients.filter((p) => inRange(p.patientSince, startOfPriorPeriod, endOfPriorPeriod)).length

  const statsBefore = [
    { label: 'Total visits', num: seenCount, format: (n: number) => String(Math.round(n)), icon: Stethoscope, tone: 'green' as const, delta: periodDelta(seenCount, priorSeenCount) },
    { label: 'New patients', num: newPatientsInWindow, format: (n: number) => String(Math.round(n)), icon: Plus, tone: 'brand' as const, delta: periodDelta(newPatientsInWindow, priorNewPatients) },
  ]
  const revenueStat = { label: 'Revenue', num: totalRevenue, format: inr, icon: CurrencyInr, tone: 'green' as const, delta: periodDelta(totalRevenue, priorRevenue) }
  const adherenceDelta = followUpAdherence !== null && priorFollowUpAdherence !== null ? periodDelta(followUpAdherence, priorFollowUpAdherence, { points: true }) : null

  // Scoped to the selected period, unlike Caseload by practitioner below
  // (a live snapshot of open cases right now — a period doesn't apply to it).
  const periodPrescriptions = prescriptions.filter((r) => inRange(r.publishedAt, startOfThisPeriod, now))
  const remedyCount = (() => {
    const map: Record<string, number> = {}
    periodPrescriptions.forEach((r) => { map[r.remedy] = (map[r.remedy] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  })()
  const maxRemedy = Math.max(...remedyCount.map(([, c]) => c), 1)

  const practitionerLoad = activePractitioners.map((p) => ({
    name: p.name.replace('Dr. ', ''),
    cases: p.openCases,
    patients: patients.filter((pt) => pt.owningPractitionerId === p.id).length,
  }))
  const maxCases = Math.max(...practitionerLoad.map((p) => p.cases), 1)

  // Real, back-of-the-clinic data — plain CSV, opens in Excel/Sheets/Numbers.
  // Her own ask: a way to back up patient data if something happens to the
  // database. Same location the design spec always called for an Export here.
  const exportPatients = () => {
    const rows = patients.map((p) => ({
      code: p.wsCode, name: p.name, age: p.age, sex: p.sex, phone: p.phone ?? '', location: p.location,
      chiefComplaint: p.chiefComplaint, currentRemedy: p.currentRemedy ?? '', patientSince: p.patientSince,
      lastSeen: p.lastSeen, assignment: p.assignment, allergies: p.allergies, regularMedication: p.regularMedication,
    }))
    downloadCsv(`sneham-patients-${todayISO()}.csv`, toCsv(rows, [
      { key: 'code', label: 'Patient Code' }, { key: 'name', label: 'Name' }, { key: 'age', label: 'Age' },
      { key: 'sex', label: 'Sex' }, { key: 'phone', label: 'Phone' }, { key: 'location', label: 'Location' },
      { key: 'chiefComplaint', label: 'Chief Complaint' }, { key: 'currentRemedy', label: 'Current Remedy' },
      { key: 'patientSince', label: 'Patient Since' }, { key: 'lastSeen', label: 'Last Seen' },
      { key: 'assignment', label: 'Assignment' }, { key: 'allergies', label: 'Allergies' }, { key: 'regularMedication', label: 'Regular Medication' },
    ]))
  }
  const exportAppointments = () => {
    const rows = appointments.map((a) => ({
      date: a.date, time: a.time, patient: patients.find((p) => p.id === a.patientId)?.name ?? '',
      practitioner: practitioners.find((p) => p.id === a.practitionerId)?.name ?? '', type: a.type,
      status: a.status, reason: a.reason ?? '', firstVisit: a.isFirstVisit ? 'Yes' : 'No',
    }))
    downloadCsv(`sneham-appointments-${todayISO()}.csv`, toCsv(rows, [
      { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'patient', label: 'Patient' },
      { key: 'practitioner', label: 'Practitioner' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' },
      { key: 'reason', label: 'Reason' }, { key: 'firstVisit', label: 'First Visit' },
    ]))
  }
  const exportPrescriptions = () => {
    const rows = prescriptions.map((r) => ({
      date: (r.publishedAt ?? r.createdAt).slice(0, 10), patient: patients.find((p) => p.id === r.patientId)?.name ?? '',
      practitioner: practitioners.find((p) => p.id === r.practitionerId)?.name ?? '', remedy: r.remedy,
      potency: r.potency, dose: r.doseGlobules, repetition: r.repetition, duration: r.durationDays ?? 'Until settled',
    }))
    downloadCsv(`sneham-prescriptions-${todayISO()}.csv`, toCsv(rows, [
      { key: 'date', label: 'Date' }, { key: 'patient', label: 'Patient' }, { key: 'practitioner', label: 'Practitioner' },
      { key: 'remedy', label: 'Remedy' }, { key: 'potency', label: 'Potency' }, { key: 'dose', label: 'Dose (globules)' },
      { key: 'repetition', label: 'Repetition' }, { key: 'duration', label: 'Duration (days)' },
    ]))
  }
  const exportInvoices = () => {
    const rows = invoices.map((inv) => ({
      invoiceNo: inv.invoiceNo, date: inv.date, patient: patients.find((p) => p.id === inv.patientId)?.name ?? '',
      items: inv.items.map((it) => `${it.name} x${it.qty}`).join('; '), total: invoiceTotal(inv.items),
      received: inv.amountReceived, paymentMode: inv.paymentMode, status: inv.status,
    }))
    downloadCsv(`sneham-invoices-${todayISO()}.csv`, toCsv(rows, [
      { key: 'invoiceNo', label: 'Invoice No' }, { key: 'date', label: 'Date' }, { key: 'patient', label: 'Patient' },
      { key: 'items', label: 'Items' }, { key: 'total', label: 'Total' }, { key: 'received', label: 'Received' },
      { key: 'paymentMode', label: 'Payment Mode' }, { key: 'status', label: 'Status' },
    ]))
  }
  const exportOptions = [
    { label: 'Patients (CSV)', run: exportPatients },
    { label: 'Appointments (CSV)', run: exportAppointments },
    { label: 'Prescriptions (CSV)', run: exportPrescriptions },
    { label: 'Invoices (CSV)', run: exportInvoices },
  ]

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
  const totalVisitsInWindow = visitsByMonth.reduce((sum, m) => sum + m.new + m.returning, 0)

  // Where patients come from — her own idea for filling the empty space
  // below the visits chart. Every patient added before this field existed
  // shows up honestly as "Not recorded" rather than being silently dropped
  // or guessed at.
  const REFERRAL_COLORS: Record<string, string> = {
    Offline: '#41603C', Instagram: '#7A9B66', References: '#D8A24A', Referral: '#5C4A66', 'Not recorded': '#D6D9C8',
  }
  const referralBreakdown = useMemo(() => {
    const counts: Record<string, number> = { Offline: 0, Instagram: 0, References: 0, Referral: 0, 'Not recorded': 0 }
    patients.forEach((p) => { counts[p.referralSource ?? 'Not recorded']++ })
    return Object.entries(counts).map(([label, value]) => ({ label, value, color: REFERRAL_COLORS[label] }))
  }, [patients])

  // Age bands — real data every patient already has, so (unlike referral
  // source) this is fully populated from day one. Bands chosen for clinical
  // relevance in a homeopathy practice (paediatric/adult/senior caseload
  // mix), not just even statistical buckets.
  const AGE_BANDS = [
    { label: 'Child (0–12)', test: (a: number) => a <= 12 },
    { label: 'Teen (13–19)', test: (a: number) => a >= 13 && a <= 19 },
    { label: 'Adult (20–59)', test: (a: number) => a >= 20 && a <= 59 },
    { label: 'Senior (60+)', test: (a: number) => a >= 60 },
  ]
  const ageBreakdown = useMemo(
    () => AGE_BANDS.map((band) => ({ label: band.label, count: patients.filter((p) => band.test(p.age)).length })),
    [patients],
  )
  const maxAgeBand = Math.max(...ageBreakdown.map((b) => b.count), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-bold text-ink">Reports</h1>
          <div className="text-[12.5px] text-faint">{periodLabel} · Practice analytics</div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-pill border border-border bg-surface p-0.5">
            {(['month', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold capitalize transition ${period === p ? 'bg-brand text-screen' : 'text-muted hover:text-body'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-body transition hover:border-green-border hover:text-brand"
            >
              <DownloadSimple size={15} weight="bold" /> Export
            </button>
            <AnimatePresence>
              {exportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full z-50 mt-1.5 w-[220px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-modal"
                >
                  {exportOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { opt.run(); setExportOpen(false) }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-body transition hover:bg-surface-hover"
                    >
                      <FileCsv size={16} className="text-brand" /> {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {statsBefore.map((s) => (
          <Card key={s.label} className="px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${s.tone === 'green' ? 'bg-tint text-success' : 'bg-tint-pale text-brand'}`}>
                <s.icon size={18} weight="fill" />
              </div>
              <Label>{s.label}</Label>
            </div>
            <CountUp value={s.num} format={s.format} duration={1.4} className="mt-2 block font-display text-[26px] font-bold leading-none text-ink" />
            {s.delta && (
              <div className={`mt-1 text-[11.5px] font-semibold ${s.delta.positive ? 'text-success' : 'text-danger'}`}>
                {s.delta.positive ? '↗' : '↘'} {s.delta.text}
              </div>
            )}
          </Card>
        ))}
        <Card className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint-pale text-brand">
              <ArrowsClockwise size={18} weight="fill" />
            </div>
            <Label>Follow-up adherence</Label>
          </div>
          {followUpAdherence === null ? (
            <span className="mt-2 block font-display text-[26px] font-bold leading-none text-faint">—</span>
          ) : (
            <CountUp value={followUpAdherence} format={(n) => `${Math.round(n)}%`} duration={1.4} className="mt-2 block font-display text-[26px] font-bold leading-none text-ink" />
          )}
          {adherenceDelta && (
            <div className={`mt-1 text-[11.5px] font-semibold ${adherenceDelta.positive ? 'text-success' : 'text-danger'}`}>
              {adherenceDelta.positive ? '↗' : '↘'} {adherenceDelta.text}
            </div>
          )}
        </Card>
        <Card className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-success">
              <revenueStat.icon size={18} weight="fill" />
            </div>
            <Label>{revenueStat.label}</Label>
          </div>
          <CountUp value={revenueStat.num} format={revenueStat.format} duration={1.4} className="mt-2 block font-display text-[26px] font-bold leading-none text-ink" />
          {revenueStat.delta && (
            <div className={`mt-1 text-[11.5px] font-semibold ${revenueStat.delta.positive ? 'text-success' : 'text-danger'}`}>
              {revenueStat.delta.positive ? '↗' : '↘'} {revenueStat.delta.text}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">Patient visits</h2>
            <div className="flex items-center gap-3 text-[11.5px] text-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand" />New</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />Returning</span>
            </div>
          </div>
          {totalVisitsInWindow === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center" style={{ height: 160 }}>
              <ChartLineUp size={28} className="text-border-dash" />
              <p className="mt-3 text-[13px] font-medium text-muted">No patient visits in this window yet</p>
              <p className="mt-1 text-[12px] text-faint">This fills in as you see patients — nothing to worry about.</p>
            </div>
          ) : (
          <div className="flex items-end gap-4" style={{ height: 160 }}>
            {visitsByMonth.map((m, i) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="text-[11px] font-semibold text-faint">{m.new + m.returning || ''}</div>
                <div className="flex flex-col justify-end overflow-hidden rounded-t-[8px] bg-screen" style={{ height: 120, width: 28 }}>
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
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Most prescribed</h2>
          <div className="mb-4 text-[11.5px] text-faint">From your own remedy list</div>
          {remedyCount.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-faint">No prescriptions issued yet</p>
          ) : (
            <div className="space-y-3">
              {remedyCount.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 text-right font-display text-[12px] font-bold text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-body">{name}</div>
                  <div className="w-[60px] h-[22px] rounded-[6px] bg-screen overflow-hidden">
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

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Where patients come from</h2>
          <div className="mb-4 text-[11.5px] text-faint">Referral source, whole roster</div>
          <DonutChart segments={referralBreakdown} />
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Age mix</h2>
          <div className="mb-4 text-[11.5px] text-faint">Whole roster, by age band</div>
          <div className="space-y-3">
            {ageBreakdown.map((b, i) => (
              <div key={b.label} className="flex items-center gap-3">
                <div className="w-[110px] shrink-0 text-[12.5px] font-medium text-body">{b.label}</div>
                <div className="h-[22px] flex-1 overflow-hidden rounded-[6px] bg-screen">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(b.count / maxAgeBand) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.06, ease: easeCalm }}
                    className="h-full rounded-[6px] bg-brand"
                  />
                </div>
                <span className="w-6 text-right font-display text-[13px] font-bold text-ink">{b.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Caseload by practitioner</h2>
          <div className="mb-4 text-[11.5px] text-faint">A scheduling aid, not a scoreboard</div>
          <div className="space-y-3">
            {practitionerLoad.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-[70px] truncate text-[12.5px] font-medium text-body">{p.name}</div>
                <div className="flex-1 h-[22px] rounded-[6px] bg-screen overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.cases / maxCases) * 100}%` }}
                    transition={{ duration: 0.8, ease: easeCalm }}
                    className="h-full rounded-[6px] bg-accent"
                  />
                </div>
                <span className="w-14 text-right text-[12px] text-faint">{p.cases} open</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onGoToPatients}>
            <UsersThree size={14} /> Rebalance gently
          </Button>
        </Card>
      </div>
    </div>
  )
}

// ── SETTINGS ──
function SettingsView() {
  const practitioners = useClinic((s) => s.practitioners)
  const patients = useClinic((s) => s.patients)
  const currentId = useClinic((s) => s.currentPractitionerId)
  const role = useClinic((s) => s.role)
  const updatePractitioner = useClinic((s) => s.updatePractitioner)
  const rejectPractitioner = useClinic((s) => s.rejectPractitioner)
  const assignPatient = useClinic((s) => s.assignPatient)
  const rolePermissions = useClinic((s) => s.rolePermissions)
  const updateRolePermission = useClinic((s) => s.updateRolePermission)
  const assignmentRules = useClinic((s) => s.assignmentRules)
  const updateAssignmentRules = useClinic((s) => s.updateAssignmentRules)
  const clinicSettings = useClinic((s) => s.clinicSettings)
  const updateClinicSettings = useClinic((s) => s.updateClinicSettings)
  const practitionerSettings = useClinic((s) => s.practitionerSettings)
  const updatePractitionerSettings = useClinic((s) => s.updatePractitionerSettings)
  const customCaseTemplates = useClinic((s) => s.caseTemplates)
  const deleteCaseTemplate = useClinic((s) => s.deleteCaseTemplate)
  const me = practitioners.find((p) => p.id === currentId)
  const pending = practitioners.filter((p) => p.status === 'pending')
  const active = practitioners.filter((p) => p.status === 'active')
  const inactive = practitioners.filter((p) => p.status === 'inactive')
  const [clinicName, setClinicName] = useState(clinicSettings.clinicName)
  const [consultDuration, setConsultDuration] = useState(String(clinicSettings.consultDurationMin))
  useEffect(() => {
    setClinicName(clinicSettings.clinicName)
    setConsultDuration(String(clinicSettings.consultDurationMin))
  }, [clinicSettings])
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: me?.name ?? '',
    specialty: me?.specialty ?? '',
    qualifications: me?.qualifications || '',
    registrationNo: me?.registrationNo || '',
  })
  const [addingRemedy, setAddingRemedy] = useState(false)
  const [remedyQuery, setRemedyQuery] = useState('')
  const toast = useToast()

  if (!me) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
      </div>
    )
  }

  const togglePref = (key: keyof Pick<PractitionerSettings, 'notifNewBooking' | 'notifFollowUpDue' | 'notifLowStock' | 'notifPatientCheckin'>) =>
    updatePractitionerSettings({ [key]: !practitionerSettings[key] })

  const prefs = [
    { key: 'notifNewBooking' as const, label: 'New booking alerts' },
    { key: 'notifFollowUpDue' as const, label: 'Follow-up due reminders' },
    { key: 'notifLowStock' as const, label: 'Low stock warnings' },
    { key: 'notifPatientCheckin' as const, label: 'Patient check-in notifications' },
  ]

  const toggleRule = (key: keyof AssignmentRules) =>
    updateAssignmentRules({ [key]: !assignmentRules[key] })

  const removeRemedy = (remedy: string) =>
    updatePractitioner(currentId, { remedyList: me.remedyList.filter((r) => r !== remedy) })

  const addRemedy = (remedy: string) => {
    if (!me.remedyList.includes(remedy)) updatePractitioner(currentId, { remedyList: [...me.remedyList, remedy] })
    setAddingRemedy(false)
    setRemedyQuery('')
  }

  const removeRxTemplate = (id: string) =>
    updatePractitioner(currentId, { rxTemplates: me.rxTemplates.filter((t) => t.id !== id) })

  const remedyMatches = remedyQuery.trim()
    ? MASTER_REMEDIES.filter((r) => !me.remedyList.includes(r) && r.toLowerCase().includes(remedyQuery.trim().toLowerCase())).slice(0, 6)
    : []

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
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">My remedy list</h2>
            <Badge tone="neutral">{me.remedyList.length} remedies</Badge>
          </div>
          <p className="mt-1 text-[12.5px] text-muted">The only source for prescription autocomplete. Yours to curate.</p>
          <div className="relative mt-3 flex flex-wrap gap-2">
            {me.remedyList.map((r) => (
              <span key={r} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[13px] text-body">
                {r}
                <button onClick={() => removeRemedy(r)} className="text-faint hover:text-danger"><X size={11} weight="bold" /></button>
              </span>
            ))}
            <div>
              <button
                onClick={() => setAddingRemedy((v) => !v)}
                className="rounded-pill border border-dashed border-border-dash px-3 py-1.5 text-[13px] font-medium text-muted transition hover:border-green-border hover:text-brand"
              >
                + Add remedy
              </button>
              {addingRemedy && (
                <div className="absolute z-20 mt-1.5 w-[220px] rounded-[12px] border border-border bg-surface p-2 shadow-modal">
                  <input
                    value={remedyQuery}
                    onChange={(e) => setRemedyQuery(e.target.value)}
                    placeholder="Search remedies..."
                    autoFocus
                    className="w-full rounded-[8px] border border-border bg-canvas px-2.5 py-1.5 text-[12.5px] text-body outline-none focus:border-green-border"
                  />
                  {remedyQuery.trim() && (
                    <div className="mt-1 max-h-[180px] overflow-y-auto">
                      {remedyMatches.map((r) => (
                        <button key={r} onClick={() => addRemedy(r)} className="block w-full rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-body hover:bg-tint">{r}</button>
                      ))}
                      {remedyMatches.length === 0 && <div className="px-2 py-1.5 text-[12px] text-faint">No matches</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Templates</h2>
          <p className="mt-1 text-[12.5px] text-muted">Case-taking and prescription templates you build and reuse.</p>
          <div className="mt-3 space-y-1.5">
            {CASE_TEMPLATES.map((t) => (
              <div key={t.name} className="flex items-center justify-between rounded-[10px] px-2 py-1.5">
                <div>
                  <div className="text-[13px] font-medium text-body">{t.label}</div>
                  <div className="text-[11.5px] text-faint">{t.sections.length} sections</div>
                </div>
                <Badge tone="neutral">Case</Badge>
              </div>
            ))}
            {customCaseTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-[10px] px-2 py-1.5">
                <div>
                  <div className="text-[13px] font-medium text-body">{t.label}</div>
                  <div className="text-[11.5px] text-faint">{t.sections.length} sections</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">Case</Badge>
                  <button onClick={() => deleteCaseTemplate(t.id)} className="text-faint hover:text-danger"><X size={13} weight="bold" /></button>
                </div>
              </div>
            ))}
            {me.rxTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-[10px] px-2 py-1.5">
                <div>
                  <div className="text-[13px] font-medium text-body">{t.label}</div>
                  <div className="text-[11.5px] text-faint">{t.durationDays ? `${t.durationDays} days` : t.repetition} · {t.potency}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="amber">Rx</Badge>
                  <button onClick={() => removeRxTemplate(t.id)} className="text-faint hover:text-danger"><X size={13} weight="bold" /></button>
                </div>
              </div>
            ))}
            {customCaseTemplates.length === 0 && me.rxTemplates.length === 0 && (
              <p className="px-2 py-1 text-[12px] text-faint">Built-in case templates only — save a prescription as a template from Quick Rx to see it here.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="space-y-5 p-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Clinic details</h2>
          {role !== 'Owner' && <p className="text-[12px] text-faint">Only the Owner can change these.</p>}
          <div>
            <Label>Clinic name</Label>
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              disabled={role !== 'Owner'}
              className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border disabled:opacity-60"
            />
          </div>
          <div>
            <Label>Default consult duration</Label>
            <select
              value={consultDuration}
              onChange={(e) => setConsultDuration(e.target.value)}
              disabled={role !== 'Owner'}
              className="mt-1.5 w-full appearance-none rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border disabled:opacity-60"
            >
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
          {role === 'Owner' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                updateClinicSettings({ clinicName, consultDurationMin: parseInt(consultDuration) })
                toast({ title: 'Settings saved', message: `Clinic: ${clinicName}, duration: ${consultDuration} min` })
              }}
            >
              Save changes
            </Button>
          )}
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
              {practitionerSettings[pref.key]
                ? <ToggleRight size={28} weight="fill" className="text-accent" />
                : <ToggleLeft size={28} weight="fill" className="text-faint" />}
            </button>
          ))}
        </Card>
      </div>

      {role === 'Owner' && pending.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">Pending approval</h2>
            <Badge tone="amber">{pending.length} waiting</Badge>
          </div>
          {/* Anyone who completes signup lands here first with zero patient-data
              access (enforced by RLS, not just hidden UI) until approved — see
              migration_v19_practitioner_approval_gate.sql. */}
          <div className="space-y-2">
            {pending.map((pr) => (
              <div key={pr.id} className="flex items-center gap-3 rounded-[14px] border border-amber/30 bg-amber-tint/20 px-4 py-3">
                <Avatar initials={pr.initials} size={38} />
                <div className="flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">{pr.name}</div>
                  <div className="text-[12px] text-muted">{pr.specialty}{pr.qualifications && ` · ${pr.qualifications}`}</div>
                </div>
                <Button variant="ghost" size="sm" className="!text-danger" onClick={() => rejectPractitioner(pr.id)}>Reject</Button>
                <Button variant="accent" size="sm" onClick={() => updatePractitioner(pr.id, { status: 'active' })}>Approve</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Manage team</h2>
        <div className="space-y-2">
          {active.map((pr) => (
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
              {role === 'Owner' && pr.id !== currentId && pr.role !== 'Owner' && (
                <button
                  onClick={() => {
                    const owner = practitioners.find((p) => p.role === 'Owner')
                    const owned = patients.filter((p) => p.owningPractitionerId === pr.id)
                    const reassignNote = owned.length > 0
                      ? ` ${owned.length} of their patient${owned.length !== 1 ? 's' : ''} will be automatically reassigned to ${owner?.name ?? 'you'} so no one is left without an owner.`
                      : ''
                    if (!window.confirm(`Remove ${pr.name} from the active team?${reassignNote} Their appointments, prescriptions, and case history all stay exactly as they are — this just ends their access. You can reinstate them any time.`)) return
                    updatePractitioner(pr.id, { status: 'inactive' })
                    if (owner) owned.forEach((p) => assignPatient(p.id, owner.id))
                    toast({
                      title: 'Practitioner removed',
                      message: owned.length > 0
                        ? `${pr.name} no longer has access. ${owned.length} patient${owned.length !== 1 ? 's' : ''} reassigned to ${owner?.name ?? 'the clinic owner'}.`
                        : `${pr.name} no longer has access. Reinstate any time below.`,
                    })
                  }}
                  className="rounded-full p-1.5 text-faint transition hover:bg-danger/10 hover:text-danger"
                  title="Remove from team"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {role === 'Owner' && inactive.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Inactive</h2>
          <div className="space-y-2">
            {inactive.map((pr) => (
              <div key={pr.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 opacity-70">
                <Avatar initials={pr.initials} size={38} />
                <div className="flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">{pr.name}</div>
                  <div className="text-[12px] text-muted">{pr.specialty}</div>
                </div>
                <button
                  onClick={() => {
                    updatePractitioner(pr.id, { status: 'active' })
                    toast({ title: 'Practitioner reinstated', message: `${pr.name} is back on the active team.` })
                  }}
                  className="rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-accent hover:text-white"
                >
                  Reinstate
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-display text-[15px] font-bold text-ink">Staff & permissions</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          {role === 'Owner'
            ? 'What each role can do — click a cell to change it. Owner and Practitioner always have full access; Schedule & billing isn\'t restrictable yet.'
            : 'What each role can do today — the same gates the app itself enforces.'}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-faint">
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">See case notes</th>
                <th className="px-3 py-2 font-semibold">Schedule & billing</th>
                <th className="px-3 py-2 font-semibold">Assign cases</th>
                <th className="px-3 py-2 font-semibold">Accept handoffs</th>
              </tr>
            </thead>
            <tbody>
              {(['Owner', 'Practitioner', 'Assistant', 'Receptionist'] as const).map((r) => {
                const editable = role === 'Owner' && (r === 'Assistant' || r === 'Receptionist')
                const perms = r === 'Assistant' || r === 'Receptionist' ? rolePermissions[r] : null
                const cells: { key: keyof RolePermissionSet | 'schedule'; value: boolean }[] = [
                  { key: 'seeCaseNotes', value: perms ? perms.seeCaseNotes : true },
                  { key: 'schedule', value: true },
                  { key: 'assignCases', value: perms ? perms.assignCases : true },
                  { key: 'acceptHandoffs', value: perms ? perms.acceptHandoffs : true },
                ]
                const labelFor: Record<string, string> = {
                  seeCaseNotes: 'see case notes',
                  assignCases: 'assign cases',
                  acceptHandoffs: 'accept handoffs',
                }
                return (
                  <tr key={r} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4 font-semibold text-ink">{r}</td>
                    {cells.map((c) => {
                      const isReallyEditable = editable && c.key !== 'schedule'
                      const icon = c.value
                        ? <Check size={16} weight="bold" className="text-success" />
                        : <X size={16} weight="bold" className="text-faint" />
                      if (!isReallyEditable) {
                        return <td key={c.key} className="px-3 py-2.5">{icon}</td>
                      }
                      return (
                        <td key={c.key} className="px-3 py-2.5">
                          <button
                            onClick={() => {
                              const next = !c.value
                              const verb = next ? 'grant' : 'remove'
                              if (!window.confirm(`${verb === 'grant' ? 'Grant' : 'Remove'} "${labelFor[c.key]}" ${verb === 'grant' ? 'to' : 'from'} ${r}?`)) return
                              updateRolePermission(r as EditableRole, { [c.key]: next } as Partial<RolePermissionSet>)
                              toast({ title: 'Permission updated', message: `${r} can ${next ? 'now' : 'no longer'} ${labelFor[c.key]}.` })
                            }}
                            className="rounded-full p-1 transition hover:bg-surface-hover active:scale-90"
                            title={`Click to ${c.value ? 'remove' : 'grant'}`}
                          >
                            {icon}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-[15px] font-bold text-ink">Assignment rules</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Saved as your preference for now — none of these change app behavior yet, so treat them as a note to build toward rather than a live switch.
        </p>
        <div className="mt-3 space-y-3">
          <button
            onClick={() => role === 'Owner' && toggleRule('autoAssignBookings')}
            disabled={role !== 'Owner'}
            className="flex w-full items-start justify-between gap-4 text-left disabled:cursor-default"
          >
            <div>
              <div className="text-[13px] font-medium text-ink">Auto-assign new bookings</div>
              <div className="text-[12px] text-muted">New appointments go to the practitioner the patient booked with.</div>
            </div>
            {assignmentRules.autoAssignBookings
              ? <ToggleRight size={28} weight="fill" className="shrink-0 text-accent" />
              : <ToggleLeft size={28} weight="fill" className="shrink-0 text-faint" />}
          </button>
          <button
            onClick={() => role === 'Owner' && toggleRule('walkInsSharedQueue')}
            disabled={role !== 'Owner'}
            className="flex w-full items-start justify-between gap-4 text-left disabled:cursor-default"
          >
            <div>
              <div className="text-[13px] font-medium text-ink">Walk-ins to shared queue</div>
              <div className="text-[12px] text-muted">Unassigned patients wait in a shared queue anyone can pick up.</div>
            </div>
            {assignmentRules.walkInsSharedQueue
              ? <ToggleRight size={28} weight="fill" className="shrink-0 text-accent" />
              : <ToggleLeft size={28} weight="fill" className="shrink-0 text-faint" />}
          </button>
          <button
            onClick={() => role === 'Owner' && toggleRule('outOfOfficeDelegation')}
            disabled={role !== 'Owner'}
            className="flex w-full items-start justify-between gap-4 text-left disabled:cursor-default"
          >
            <div>
              <div className="text-[13px] font-medium text-ink">Out-of-office delegation</div>
              <div className="text-[12px] text-muted">While you're away, follow-ups pass to your covering practitioner.</div>
            </div>
            {assignmentRules.outOfOfficeDelegation
              ? <ToggleRight size={28} weight="fill" className="shrink-0 text-accent" />
              : <ToggleLeft size={28} weight="fill" className="shrink-0 text-faint" />}
          </button>
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
  const practitionerSettings = useClinic((s) => s.practitionerSettings)
  const updatePractitionerSettings = useClinic((s) => s.updatePractitionerSettings)
  const toast = useToast()

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const [workingDays, setWorkingDays] = useState<Set<string>>(new Set(practitionerSettings.workingDays))
  const [morningStart, setMorningStart] = useState(practitionerSettings.morningStart)
  const [morningEnd, setMorningEnd] = useState(practitionerSettings.morningEnd)
  const [eveningStart, setEveningStart] = useState(practitionerSettings.eveningStart)
  const [eveningEnd, setEveningEnd] = useState(practitionerSettings.eveningEnd)

  useEffect(() => {
    setWorkingDays(new Set(practitionerSettings.workingDays))
    setMorningStart(practitionerSettings.morningStart)
    setMorningEnd(practitionerSettings.morningEnd)
    setEveningStart(practitionerSettings.eveningStart)
    setEveningEnd(practitionerSettings.eveningEnd)
  }, [practitionerSettings])

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

      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          updatePractitionerSettings({
            workingDays: Array.from(workingDays),
            morningStart, morningEnd, eveningStart, eveningEnd,
          })
          toast({ title: 'Schedule saved', message: `${workingDays.size} working days, ${totalSlots} weekly slots` })
        }}
      >
        Save schedule
      </Button>
    </Card>
  )
}

// ── INSTANT MEETING ──
// A video call for someone who isn't a registered patient (a referral
// consult, a prospective patient, anyone outside the roster) — no
// appointment or patient record required. The room id is generated once,
// on open, so the link shown and the room actually joined are always the
// same one — sharing it first and joining a few minutes later still lands
// in the same call.
function InstantMeetingModal({ onClose, onStart }: { onClose: () => void; onStart: (id: string, guestName: string) => void }) {
  const [id] = useState(() => newId())
  const [guestName, setGuestName] = useState('')
  const [copied, setCopied] = useState(false)
  const roomName = `sneham-consult-${id.replace(/[^a-zA-Z0-9]/g, '')}`
  const link = `https://meet.jit.si/${roomName}`
  const shareMessage = `Join our video consultation${guestName.trim() ? ` (${guestName.trim()})` : ''}: ${link}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be blocked (permissions, non-secure context) —
      // the link is still visible and selectable in the field below.
    }
  }

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
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-bold text-ink">Instant meeting</h2>
          <button onClick={onClose} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
        </div>
        <p className="mb-5 text-[12.5px] text-muted">
          For anyone not in your patient roster — a referral consult, a prospective patient, anyone. Share the link however you like; whoever opens it joins this same call.
        </p>

        <div>
          <Label>Who is this with? (optional, just for your reference)</Label>
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="e.g. Dr. Mehta (referral) or Priya (prospective patient)"
            className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
          />
        </div>

        <div className="mt-4">
          <Label>Meeting link</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={link}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full flex-1 rounded-[12px] border border-border bg-screen px-3.5 py-2.5 text-[12.5px] text-muted outline-none"
            />
            <Button variant="ghost" size="sm" onClick={copyLink}>
              <Copy size={14} weight="bold" /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => shareTextViaWhatsApp(shareMessage)}
          >
            <WhatsappLogo size={16} weight="fill" className="text-success" /> Share via WhatsApp
          </Button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => onStart(id, guestName.trim())}>
            <VideoCamera size={15} weight="fill" /> Join now
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── NEW PATIENT MODAL ──
function NewPatientModal({ onClose }: { onClose: () => void }) {
  const addPatient = useClinic((s) => s.addPatient)
  const toast = useToast()
  const [form, setForm] = useState({ name: '', age: '', sex: 'Female' as Patient['sex'], phone: '', chiefComplaint: '', location: '', referralSource: undefined as Patient['referralSource'] })
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
      referralSource: form.referralSource,
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
        className="max-h-[90vh] w-[440px] overflow-y-auto rounded-[20px] border border-border bg-surface p-6 shadow-modal"
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
          <div>
            <Label>How did they find us?</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {REFERRAL_SOURCES.map((r) => (
                <Chip
                  key={r}
                  selected={form.referralSource === r}
                  onClick={() => setForm((f) => ({ ...f, referralSource: f.referralSource === r ? undefined : r }))}
                >
                  {r}
                </Chip>
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

// ── EDIT PATIENT MODAL ──
function EditPatientModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const updatePatientDetails = useClinic((s) => s.updatePatientDetails)
  const toast = useToast()
  const [form, setForm] = useState({
    name: patient.name,
    age: String(patient.age),
    sex: patient.sex,
    phone: patient.phone ?? '',
    chiefComplaint: patient.chiefComplaint,
    location: patient.location,
    allergies: patient.allergies,
    regularMedication: patient.regularMedication,
    referralSource: patient.referralSource,
  })
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = () => {
    if (!form.name.trim() || !form.chiefComplaint.trim()) return
    updatePatientDetails(patient.id, {
      name: form.name.trim(),
      age: parseInt(form.age) || 0,
      sex: form.sex,
      location: form.location.trim(),
      phone: form.phone.trim(),
      chiefComplaint: form.chiefComplaint.trim(),
      allergies: form.allergies.trim(),
      regularMedication: form.regularMedication.trim(),
      referralSource: form.referralSource,
    })
    toast({ title: 'Patient details updated', message: `${form.name.trim()}'s record has been saved.` })
    onClose()
  }

  const fields = [
    { key: 'name', label: 'Full name', placeholder: 'e.g. Priya Sharma', required: true },
    { key: 'age', label: 'Age', placeholder: 'e.g. 34', type: 'number' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
    { key: 'chiefComplaint', label: 'Chief complaint', placeholder: 'e.g. Chronic migraine', required: true },
    { key: 'location', label: 'Location', placeholder: 'e.g. Andheri West' },
    { key: 'allergies', label: 'Allergies', placeholder: 'e.g. Dust, penicillin — or "No allergies"' },
    { key: 'regularMedication', label: 'Regular medication', placeholder: 'e.g. None' },
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
        className="max-h-[90vh] w-[440px] overflow-y-auto rounded-[20px] border border-border bg-surface p-6 shadow-modal"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-bold text-ink">Edit patient details</h2>
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
          <div>
            <Label>How did they find us?</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {REFERRAL_SOURCES.map((r) => (
                <Chip
                  key={r}
                  selected={form.referralSource === r}
                  onClick={() => setForm((f) => ({ ...f, referralSource: f.referralSource === r ? undefined : r }))}
                >
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onSubmit} className={!form.name.trim() || !form.chiefComplaint.trim() ? 'opacity-50' : ''}>
            Save changes
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── PERMANENT DELETE MODAL ──
// Deliberately not a window.confirm() — this is the single most
// destructive action in the app (irreversible, cascades across every
// dependent record), so it gets a real confirmation flow: live counts of
// what will be destroyed, and a typed-name match before the button even
// enables. See CLAUDE.md's own design principle — warnings are reserved
// for exactly this kind of irreversible error.
function PermanentDeleteModal({ patient, onClose, onDeleted }: { patient: Patient; onClose: () => void; onDeleted: () => void }) {
  const permanentlyDeletePatient = useClinic((s) => s.permanentlyDeletePatient)
  const toast = useToast()
  const [impact, setImpact] = useState<Record<string, number> | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPatientDeletionImpact(patient.id).then((r) => { if (!cancelled) setImpact(r) })
    return () => { cancelled = true }
  }, [patient.id])

  const impactLabels: Record<string, string> = {
    appointments: 'appointments', prescriptions: 'prescriptions', invoices: 'invoices',
    investigation_orders: 'investigation orders', case_visits: 'case visits', documents: 'documents',
    check_ins: 'check-ins', handoffs: 'handoffs', second_opinions: 'second opinions',
    outcomes: 'outcomes', messages: 'messages',
  }
  const nonZero = impact ? Object.entries(impact).filter(([, n]) => n > 0) : []
  const canConfirm = confirmText.trim().toLowerCase() === patient.name.trim().toLowerCase() && !deleting

  const onConfirm = async () => {
    setDeleting(true)
    setError(null)
    const result = await permanentlyDeletePatient(patient.id)
    setDeleting(false)
    if (result.ok) {
      toast({ title: 'Patient permanently deleted', message: `${patient.name}'s record and all linked data have been removed.` })
      onDeleted()
    } else {
      setError(result.error ?? 'The delete failed — nothing was removed. Please try again.')
    }
  }

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
        className="max-h-[90vh] w-[460px] overflow-y-auto rounded-[20px] border border-danger/30 bg-surface p-6 shadow-modal"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-bold text-danger">Permanently delete patient</h2>
          <button onClick={onClose} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
        </div>

        <p className="text-[13px] text-body">
          This permanently deletes <strong>{patient.name}</strong>'s record. This cannot be undone.
        </p>

        {impact === null ? (
          <p className="mt-3 text-[12.5px] text-faint">Checking what's linked to this patient…</p>
        ) : nonZero.length > 0 ? (
          <div className="mt-3 rounded-[12px] bg-danger/5 px-3.5 py-3">
            <div className="text-[12px] font-semibold text-danger">This will also delete:</div>
            <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-body">
              {nonZero.map(([key, n]) => (
                <li key={key}>{n} {impactLabels[key] ?? key}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-[12.5px] text-faint">No linked records found.</p>
        )}

        <div className="mt-4">
          <div className="text-[13px] text-body">Type <strong>"{patient.name}"</strong> to confirm</div>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={patient.name}
            className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-danger"
          />
        </div>

        {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={!canConfirm}>
            {deleting ? 'Deleting…' : 'Permanently delete'}
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
