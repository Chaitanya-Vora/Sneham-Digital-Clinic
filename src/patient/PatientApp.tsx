import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { Share } from '@capacitor/share'
import { formatDayLabel, todayISO, isPastISO, addDaysISO } from '../core/day'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  CalendarPlus,
  FolderSimple,
  House,
  Prescription as RxIcon,
  BellSimple,
  User,
  CalendarBlank,
  Flask,
  X,
  Check,
  ArrowsClockwise,
  ShareNetwork,
  FilePdf,
  MapPin,
  VideoCamera,
  CaretLeft,
  Clock,
  Trash,
  Export,
  Smiley,
  ChatText,
  FileText,
  Notepad,
  ChatsCircle,
  SignOut,
} from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { useAuth } from '../auth/AuthProvider'
import type { AppNotification, Appointment, CheckIn, Patient } from '../core/types'
import { Avatar, Badge, BottomSheet, Button, Card, Label, Toggle } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, tabVariants, pushVariants, listContainer, listItem } from '../design-system/motion'
import { CountUp, ProgressRing } from '../design-system/feedback'
import { PullToRefresh, useHorizontalSwipe, EdgeSwipeBack } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { ChatThread } from '../components/ChatThread'
import { exportPrescriptionPdf } from '../core/pdfExport'

type Tab = 'home' | 'appointments' | 'prescriptions' | 'profile'
const TAB_ORDER: Tab[] = ['home', 'appointments', 'prescriptions', 'profile']

function jitsiUrl(appointmentId: string) {
  return `https://meet.jit.si/sneham-consult-${appointmentId.replace(/[^a-zA-Z0-9]/g, '')}`
}
function openJitsi(appointmentId: string) {
  const url = jitsiUrl(appointmentId)
  if (Capacitor.isNativePlatform()) Browser.open({ url }).catch(() => {})
  else window.open(url, '_blank', 'noopener,noreferrer')
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type PushedScreen = null | 'doses' | 'personal' | 'medical' | 'notifications' | 'privacy' | 'checkin' | 'documents' | 'messages'

// Resolves "which patient is me" for the logged-in account: a linked auth
// account first (works on any device, survives reinstalls), then a
// locally-remembered id (for patients registered before accounts were
// linked). Deliberately never falls back to "the first patient in the
// list" — that showed one patient's medical records to a different,
// unrelated logged-in patient.
function useMyPatient() {
  const { user } = useAuth()
  return useClinic((s) => {
    if (user) {
      const linked = s.patients.find((p) => p.authUserId === user.id)
      if (linked) return linked
    }
    const savedId = localStorage.getItem('sneham-my-patient-id')
    if (savedId) {
      const found = s.patients.find((p) => p.id === savedId)
      if (found) return found
    }
    return null
  })
}

export function PatientApp() {
  const [tab, setTab] = useState<Tab>('home')
  const [dir, setDir] = useState(1)
  const [pushed, setPushed] = useState<PushedScreen>(null)

  const patient = useMyPatient()
  const ME = patient?.id ?? ''
  const prescriptions = useClinic((s) => s.prescriptions.filter((r) => r.patientId === ME))
  const doses = useClinic((s) => s.doseReminders.filter((d) => d.patientId === ME))
  const notifs = useClinic((s) => s.notifications.filter((n) => n.surface === 'patient'))
  const toggleDose = useClinic((s) => s.toggleDoseLogged)
  const setRemindersEnabled = useClinic((s) => s.setRemindersEnabled)
  const markRead = useClinic((s) => s.markNotificationRead)
  const markAllPatientRead = useClinic((s) => s.markAllRead)
  const banner = notifs.find((n) => !n.read)

  const goTab = (next: Tab) => {
    if (next === tab) return
    setDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 1 : -1)
    setTab(next)
  }
  const tabIdx = TAB_ORDER.indexOf(tab)
  const swipe = useHorizontalSwipe({
    onNext: () => { if (tabIdx < TAB_ORDER.length - 1) goTab(TAB_ORDER[tabIdx + 1]) },
    onPrev: () => { if (tabIdx > 0) goTab(TAB_ORDER[tabIdx - 1]) },
    count: TAB_ORDER.length,
    index: tabIdx,
  })

  const hydrate = useClinic((s) => s.hydrate)
  const userId = useClinic((s) => s.userId)
  const hydrated = useClinic((s) => s.hydrated)
  const refresh = async () => { if (userId) await hydrate(userId, patient?.name ?? 'Patient') }

  // Auto-refresh every 15s so changes from the practitioner appear without manual pull
  useEffect(() => {
    const t = setInterval(() => {
      const s = useClinic.getState()
      if (s.userId && !s.hydrating) s.hydrate(s.userId, '')
    }, 15000)
    return () => clearInterval(t)
  }, [])

  if (!patient) {
    if (!hydrated) {
      // Only the very first load (before we know anything yet) shows the
      // spinner. The 15s background poll also flips `hydrating` on and off,
      // but it must never re-show this spinner in place of the
      // registration form — that was silently wiping whatever a patient
      // had already typed, every 15 seconds, while filling it in.
      return (
        <div className="flex h-full items-center justify-center bg-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
        </div>
      )
    }
    return <PatientSelfRegister />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-screen">
      <AnimatePresence>
        {banner && <NotifBanner n={banner} onClose={() => markAllPatientRead('patient')} />}
      </AnimatePresence>

      {/* pushed screens */}
      <AnimatePresence custom={1}>
        {pushed === 'doses' && (
          <motion.div
            key="doses"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <DosesScreen doses={doses} onToggle={toggleDose} back={() => setPushed(null)} onRefresh={refresh} />
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'personal' && (
          <motion.div
            key="personal"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <ProfileDetail title="Personal details" back={() => setPushed(null)} onRefresh={refresh}>
                <div className="space-y-3">
                  <ReadOnlyField label="Full name" value={patient.name} />
                  <ReadOnlyField label="Age" value={`${patient.age} years`} />
                  <ReadOnlyField label="Sex" value={patient.sex} />
                  <ReadOnlyField label="Location" value={patient.location} />
                  <ReadOnlyField label="Patient since" value={patient.patientSince} />
                  <ReadOnlyField label="WS Code" value={patient.wsCode} />
                </div>
              </ProfileDetail>
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'medical' && (
          <motion.div
            key="medical"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <ProfileDetail title="Medical basics" back={() => setPushed(null)} onRefresh={refresh}>
                <div className="space-y-3">
                  <ReadOnlyField label="Chief complaint" value={patient.chiefComplaint} />
                  <ReadOnlyField label="Current remedy" value={patient.currentRemedy || 'None'} />
                  <ReadOnlyField label="Allergies" value={patient.allergies || 'None recorded'} />
                  <ReadOnlyField label="Regular medication" value={patient.regularMedication || 'None recorded'} />
                </div>
              </ProfileDetail>
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'notifications' && (
          <motion.div
            key="notif-settings"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <NotificationSettingsScreen back={() => setPushed(null)} onRefresh={refresh} />
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'privacy' && (
          <motion.div
            key="privacy"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <DataPrivacyScreen back={() => setPushed(null)} onRefresh={refresh} />
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'checkin' && (
          <motion.div
            key="checkin"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <CheckInScreen back={() => setPushed(null)} onRefresh={refresh} patientId={ME} />
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'documents' && (
          <motion.div
            key="documents"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <DocumentsScreen back={() => setPushed(null)} onRefresh={refresh} patientId={ME} />
            </EdgeSwipeBack>
          </motion.div>
        )}
        {pushed === 'messages' && (
          <motion.div
            key="messages"
            className="absolute inset-0 z-40 bg-screen"
            custom={1}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            <EdgeSwipeBack onBack={() => setPushed(null)}>
              <MessagesScreen back={() => setPushed(null)} onRefresh={refresh} patientId={ME} />
            </EdgeSwipeBack>
          </motion.div>
        )}
      </AnimatePresence>

      {/* tab content */}
      <AnimatePresence custom={dir} initial={false}>
        <motion.div
          key={tab}
          className="absolute inset-0"
          custom={dir}
          variants={tabVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
          {...swipe}
        >
          {tab === 'home' && (
            <HomeScreen patient={patient} doses={doses} onToggleDose={toggleDose} go={goTab} openDoses={() => setPushed('doses')} onRefresh={refresh} notifs={notifs} markRead={markRead} onPush={setPushed} patientId={ME} />
          )}
          {tab === 'prescriptions' && (
            <RxScreen prescriptions={prescriptions} onToggleReminders={setRemindersEnabled} goDoses={() => setPushed('doses')} onRefresh={refresh} />
          )}
          {tab === 'appointments' && <AppointmentsScreen onRefresh={refresh} patientId={ME} />}
          {tab === 'profile' && <ProfileScreen patient={patient} onRefresh={refresh} onPush={setPushed} />}
        </motion.div>
      </AnimatePresence>

      <TabBar tab={tab} onChange={(t) => { setPushed(null); goTab(t) }} />
    </div>
  )
}

// ── shared screen scaffold: fixed header + scrolling content ──
function Screen({
  header,
  children,
  onRefresh,
  swipeProps,
}: {
  header: ReactNode
  children: ReactNode
  onRefresh: () => Promise<void>
  swipeProps?: any
}) {
  return (
    <div className="flex h-full flex-col" {...swipeProps}>
      {header}
      <PullToRefresh onRefresh={onRefresh} className="flex-1 px-[18px] pb-[128px]">
        {children}
      </PullToRefresh>
    </div>
  )
}

function BigHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-[18px] pb-3 pt-[var(--app-top)]">
      <div>
        {sub && <div className="text-[12px] text-faint">{sub}</div>}
        <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{title}</h1>
      </div>
      {right}
    </div>
  )
}

// ── read-only field for profile detail screens ──
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3">
      <Label>{label}</Label>
      <div className="mt-1 text-[14px] font-semibold text-ink" data-selectable="true">{value}</div>
    </Card>
  )
}

// ── notification banner ──
function NotifBanner({ n, onClose }: { n: AppNotification; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [n.id, onClose])
  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.97 }}
      transition={spring}
      className="absolute inset-x-3 z-40 flex items-start gap-3 rounded-[20px] border border-green-border bg-surface/95 px-4 py-3 shadow-modal backdrop-blur"
      style={{ top: 'calc(var(--app-top) + 8px)' }}
    >
      <div className="mt-0.5 text-accent"><RxIcon size={20} weight="fill" /></div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[13px] font-semibold text-ink">{n.title}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted" data-selectable="true">{n.message}</div>
      </div>
      <Pressable ariaLabel="dismiss" hap="tick" onClick={onClose} className="text-faint"><X size={15} weight="bold" /></Pressable>
    </motion.div>
  )
}

// ── Notification list panel ──
function NotificationListPanel({ notifs, markRead, onClose }: { notifs: AppNotification[]; markRead: (id: string) => void; onClose: () => void }) {
  return (
    <BottomSheet open onClose={onClose}>
      <h2 className="font-display text-[18px] font-bold text-ink">Notifications</h2>
      {notifs.length === 0 && (
        <p className="mt-4 text-center text-[13px] text-muted">No notifications yet</p>
      )}
      <motion.div variants={listContainer} initial="hidden" animate="show" className="mt-3 space-y-2">
        {notifs.map((n) => (
          <motion.div key={n.id} variants={listItem}>
            <div className={`flex items-start gap-3 rounded-[16px] px-3.5 py-3 ${n.read ? 'bg-surface' : 'bg-tint border border-green-border'}`}>
              <div className="mt-0.5 text-accent"><RxIcon size={18} weight="fill" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[13px] font-semibold text-ink">{n.title}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-muted">{n.message}</div>
                <div className="mt-1 text-[11px] text-faint">{n.time}</div>
              </div>
              {!n.read && (
                <Pressable ariaLabel="mark read" hap="tick" onClick={() => markRead(n.id)} className="mt-0.5 text-[11px] font-semibold text-brand">
                  Mark read
                </Pressable>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </BottomSheet>
  )
}

// ── HOME ──
function HomeScreen({ patient, doses, onToggleDose, go, openDoses, onRefresh, notifs, markRead, onPush, patientId }: any) {
  const toast = useToast()
  const practitioners = useClinic((s) => s.practitioners)
  const allAppointments = useClinic((s) => s.appointments)
  const nextAppt = useClinic((s) => s.appointments.filter((a) => a.patientId === patientId && a.status !== 'Seen' && a.status !== 'Cancelled' && !isPastISO(a.date)).sort((a, b) => a.date.localeCompare(b.date))[0])
  const doctorName = useClinic((s) => s.practitioners.find((p) => p.id === (nextAppt?.practitionerId ?? patient?.owningPractitionerId ?? s.practitioners[0]?.id))?.name ?? 'your doctor')
  const reschedule = useClinic((s) => s.rescheduleAppointment)
  const [notifOpen, setNotifOpen] = useState(false)
  const [rescheduleCustom, setRescheduleCustom] = useState(false)
  const [customDate, setCustomDate] = useState(todayISO())
  const [customSlot, setCustomSlot] = useState<string | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  const header = (
    <div className="flex items-center gap-3 px-[18px] pb-2 pt-[var(--app-top)]">
      <Pressable ariaLabel="profile" hap="tick" onClick={() => go('profile')} className="flex items-center gap-3">
        <Avatar initials={patient.initials} size={44} />
        <div>
          <div className="text-[12px] text-faint">{timeOfDayGreeting()}</div>
          <div className="font-display text-[19px] font-bold text-ink">{patient.name}</div>
        </div>
      </Pressable>
      <div className="flex-1" />
      <Pressable
        ariaLabel="notifications"
        hap="tick"
        onClick={() => setNotifOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Bell size={19} className="text-body" />
        {notifs.some((n: AppNotification) => !n.read) && (
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-amber" />
        )}
      </Pressable>
    </div>
  )
  return (
    <Screen header={header} onRefresh={onRefresh}>
      {notifOpen && <NotificationListPanel notifs={notifs} markRead={markRead} onClose={() => setNotifOpen(false)} />}

      {/* reschedule bottom sheet */}
      <BottomSheet open={rescheduleOpen} onClose={() => { setRescheduleOpen(false); setRescheduleCustom(false); setCustomSlot(null) }}>
        {!rescheduleCustom ? (
          <>
            <h2 className="font-display text-[18px] font-bold text-ink">Reschedule appointment</h2>
            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Tomorrow same time', sub: nextAppt ? `Tomorrow at ${nextAppt.time}` : 'No appointment to move' },
                { label: 'Next available slot', sub: `Checks ${doctorName}'s calendar` },
                { label: 'Choose date & time', sub: 'Pick from available slots' },
              ].map((opt) => (
                <Pressable
                  key={opt.label}
                  as="div"
                  hap="success"
                  scale={0.98}
                  onClick={() => {
                    if (!nextAppt) { toast({ title: 'No upcoming appointment to reschedule' }); setRescheduleOpen(false); return }
                    if (opt.label === 'Choose date & time') {
                      setCustomDate(nextAppt.date)
                      setCustomSlot(nextAppt.time)
                      setRescheduleCustom(true)
                      return
                    }
                    if (opt.label === 'Tomorrow same time') {
                      const date = addDaysISO(todayISO(), 1)
                      reschedule(nextAppt.id, nextAppt.time, date)
                      setRescheduleOpen(false)
                      toast({ title: 'Appointment rescheduled', message: `Tomorrow at ${nextAppt.time}` })
                      return
                    }
                    const { date, time } = findNextAvailableSlot(allAppointments, nextAppt.practitionerId, todayISO())
                    reschedule(nextAppt.id, time, date)
                    setRescheduleOpen(false)
                    toast({ title: 'Appointment rescheduled', message: `${formatDayLabel(date)} at ${time}` })
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-[16px] border border-border bg-surface px-4 py-3.5"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-ink">{opt.label}</div>
                    <div className="text-[12px] text-muted">{opt.sub}</div>
                  </div>
                  <span className="text-faint">&rsaquo;</span>
                </Pressable>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-[18px] font-bold text-ink">Choose date &amp; time</h2>
            <Label className="mt-4">Date</Label>
            <input
              type="date"
              value={customDate}
              min={todayISO()}
              onChange={(e) => { setCustomDate(e.target.value); setCustomSlot(null) }}
              className="mt-2 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
            />
            <Label className="mt-4">Available slots</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(() => {
                const taken = new Set(
                  allAppointments
                    .filter((a) => a.practitionerId === nextAppt?.practitionerId && a.date === customDate && a.status !== 'Cancelled' && a.id !== nextAppt?.id)
                    .map((a) => a.time),
                )
                const open = CLINIC_SLOTS.filter((s) => !taken.has(s))
                if (open.length === 0) return <p className="text-[13px] text-muted">No open slots on this date.</p>
                return open.map((slot) => (
                  <Pressable
                    key={slot}
                    hap="tick"
                    onClick={() => setCustomSlot(slot)}
                    className={`flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${customSlot === slot ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted'}`}
                  >
                    <Clock size={14} /> {slot}
                  </Pressable>
                ))
              })()}
            </div>
            <div className="mt-5 flex gap-2">
              <Pressable hap="tick" onClick={() => setRescheduleCustom(false)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">
                Back
              </Pressable>
              <Pressable
                hap="success"
                onClick={() => {
                  if (!nextAppt || !customSlot) return
                  reschedule(nextAppt.id, customSlot, customDate)
                  setRescheduleOpen(false)
                  setRescheduleCustom(false)
                  toast({ title: 'Appointment rescheduled', message: `${formatDayLabel(customDate)} at ${customSlot}` })
                }}
                className={`flex-1 rounded-pill py-2.5 text-center text-[14px] font-semibold text-white ${customSlot ? 'bg-brand' : 'bg-brand/40 pointer-events-none'}`}
              >
                Confirm
              </Pressable>
            </div>
          </>
        )}
      </BottomSheet>

      <div className="space-y-4">
        {/* live video consult — prominent join card */}
        {nextAppt && nextAppt.status === 'In consult' && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            className="rounded-[24px] p-5 text-white shadow-float"
            style={{ background: 'linear-gradient(135deg,#3FA65A,#1F7A3D)' }}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold opacity-95">
              <span className="h-2 w-2 animate-breathe rounded-full bg-white" /> Live now
            </div>
            <div className="mt-2 font-display text-[20px] font-bold">{doctorName} is ready</div>
            <div className="mt-1 text-[13px] opacity-90">Your consultation is live · tap to join</div>
            <Pressable
              hap="impact"
              onClick={() => {
                openJitsi(nextAppt.id)
                haptic('impact')
              }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-pill bg-white/95 py-3 text-[14px] font-semibold text-brand"
            >
              <VideoCamera size={16} weight="fill" /> Join now
            </Pressable>
          </motion.div>
        )}

        {/* next appointment */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="rounded-[24px] p-5 text-white shadow-float"
          style={{ background: 'linear-gradient(135deg,#5A7C4E,#41603C)' }}
        >
          <div className="flex items-center justify-between text-[12px] opacity-90">
            <span>Next appointment</span>
            {nextAppt && <Badge tone="green" className="!bg-white/20 !text-white">{nextAppt.type === 'Video' ? <VideoCamera size={12} weight="fill" /> : <MapPin size={12} weight="fill" />} {nextAppt.type}</Badge>}
          </div>
          <div className="mt-2 font-display text-[22px] font-bold">{nextAppt ? `${nextAppt.time} · ${formatDayLabel(nextAppt.date)}` : 'No upcoming visit'}</div>
          {nextAppt && <div className="mt-1 text-[13px] opacity-90">{doctorName} · {nextAppt.reason ?? patient.chiefComplaint ?? 'Consultation'}</div>}
          {nextAppt && (
            <div className="mt-4 flex gap-2">
              {nextAppt.type === 'Video' && (
                <Pressable
                  hap="impact"
                  onClick={() => {
                    if (nextAppt.status === 'In consult') {
                      openJitsi(nextAppt.id)
                    } else {
                      toast({ title: 'Video consult', message: 'Opens 5 minutes before your appointment' })
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-pill bg-white/95 px-4 py-2 text-[13px] font-semibold text-brand"
                >
                  <VideoCamera size={16} weight="fill" /> {nextAppt.status === 'In consult' ? 'Join now' : 'Join video call'}
                </Pressable>
              )}
              <Pressable hap="tick" onClick={() => setRescheduleOpen(true)} className="rounded-pill border border-white/40 px-4 py-2 text-[13px] font-semibold">
                Reschedule
              </Pressable>
            </div>
          )}
        </motion.div>

        {/* quick actions */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { icon: CalendarPlus, label: 'Book', on: () => go('appointments') },
            { icon: ChatText, label: 'Check in', on: () => onPush('checkin') },
            { icon: BellSimple, label: 'Reminders', on: openDoses },
            { icon: ChatsCircle, label: 'Messages', on: () => onPush('messages') },
          ].map((a) => (
            <Pressable key={a.label} as="div" hap="tick" onClick={a.on} scale={0.94} className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border border-border bg-surface py-3.5">
              <a.icon size={22} className="text-brand" />
              <span className="text-[11px] font-medium text-body">{a.label}</span>
            </Pressable>
          ))}
        </div>

        {doses.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Label>Today's doses</Label>
              <Pressable hap="tick" onClick={openDoses} className="text-[12px] font-semibold text-brand">All reminders &rarr;</Pressable>
            </div>
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
              {doses.map((d: any) => (
                <motion.div key={d.id} variants={listItem}><DoseRow d={d} onToggle={onToggleDose} /></motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* check-in banner — matches original design */}
        <Pressable as="div" hap="tick" onClick={() => onPush('checkin')} scale={0.98}>
          <Card className="flex items-center gap-3 border-green-border bg-tint px-4 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
              <Smiley size={24} weight="fill" className="animate-breathe text-brand" />
            </div>
            <div className="flex-1">
              <div className="font-display text-[14px] font-semibold text-ink">How are you feeling?</div>
              <div className="text-[12px] text-muted">Your check-in helps {doctorName} track progress</div>
            </div>
            <span className="rounded-pill bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">Check in</span>
          </Card>
        </Pressable>
      </div>
    </Screen>
  )
}

function DoseRow({ d, onToggle }: { d: any; onToggle: (id: string) => void }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${d.loggedToday ? 'bg-tint text-brand' : 'bg-amber-tint text-amber-text'}`}>
        <Flask size={20} weight="fill" />
      </div>
      <div className="flex-1">
        <div className="font-display text-[14px] font-semibold text-ink">{d.remedy} {d.potency}</div>
        <div className="text-[12px] text-muted">{d.slot} · {d.time}</div>
      </div>
      <Pressable
        ariaLabel={d.loggedToday ? 'logged' : 'mark taken'}
        hap={d.loggedToday ? 'tick' : 'success'}
        scale={0.8}
        onClick={() => onToggle(d.id)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${d.loggedToday ? 'border-accent bg-accent text-white' : 'border-border-dash bg-surface text-faint'}`}
      >
        <motion.span key={String(d.loggedToday)} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
          <Check size={16} weight="bold" />
        </motion.span>
      </Pressable>
    </Card>
  )
}

// ── PRESCRIPTIONS ──
function RxScreen({ prescriptions, onToggleReminders, goDoses, onRefresh }: any) {
  const toast = useToast()
  const patient = useMyPatient()
  const practitioners = useClinic((s) => s.practitioners)
  const myDoctor = practitioners.find((p) => p.id === patient?.owningPractitionerId) ?? practitioners[0]
  const header = <BigHeader title="Prescriptions" sub={`${myDoctor?.name ?? 'Doctor'} · Sneham Digital Clinic`} />
  return (
    <Screen header={header} onRefresh={onRefresh}>
      <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4">
        {prescriptions.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <Flask size={28} className="text-muted" />
            <span className="text-[13px] text-muted">No remedies prescribed yet</span>
          </Card>
        )}
        {prescriptions.map((rx: any) => (
          <motion.div key={rx.id} variants={listItem}>
            <Card className="overflow-hidden p-0">
              <div className="flex items-start gap-3 px-4 pt-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-tint text-brand"><Flask size={22} weight="fill" /></div>
                <div className="flex-1">
                  <div className="font-display text-[17px] font-bold text-ink">{rx.remedy}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="amber">{rx.potency}</Badge>
                    <Badge tone="green">{rx.doseGlobules} globules</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-px bg-border">
                <Field label="Repetition" value={rx.repetition} />
                <Field label="Duration" value={rx.durationDays ? `${rx.durationDays} days` : 'Until settled'} />
              </div>
              <div className="px-4 py-3">
                <Label>How to take it</Label>
                <p className="mt-1 text-[13px] leading-relaxed text-body" data-selectable="true">{rx.preparation}</p>
              </div>
              {rx.reminderTimes.length > 0 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">Dose reminders</div>
                    <div className="text-[12px] text-muted">{rx.remindersEnabled ? `On · ${rx.reminderTimes.join(' and ')}` : 'Off'}</div>
                  </div>
                  <Toggle on={rx.remindersEnabled} onChange={(v) => { haptic('select'); onToggleReminders(rx.id, v) }} />
                </div>
              )}
              <div className="flex gap-2 border-t border-border px-4 py-3">
                <Pressable
                  hap="tick"
                  onClick={async () => {
                    const doctor = practitioners.find((p: any) => p.id === rx.practitionerId)
                    const credentials = [doctor?.qualifications, doctor?.registrationNo].filter(Boolean).join(' · ')
                    try {
                      await exportPrescriptionPdf(rx, patient?.name ?? 'Patient', doctor?.name ?? 'Doctor', undefined, credentials || undefined)
                      toast({ title: 'PDF exported' })
                    } catch (e) {
                      // The PDF is written successfully before the native share
                      // sheet ever opens — dismissing that sheet rejects with a
                      // "canceled" message, which isn't a real export failure.
                      const message = e instanceof Error ? e.message : String(e)
                      if (!/cancel/i.test(message)) toast({ title: 'PDF export failed' })
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-pill bg-screen py-2 text-[13px] font-semibold text-body"
                >
                  <FilePdf size={16} /> PDF
                </Pressable>
                <Pressable
                  hap="tick"
                  onClick={async () => {
                    const shareData = {
                      title: `Prescription: ${rx.remedy} ${rx.potency}`,
                      text: `My prescription from Sneham Digital Clinic: ${rx.remedy} ${rx.potency}, ${rx.repetition}`,
                    }
                    if (Capacitor.isNativePlatform()) {
                      // navigator.share is undefined in a Capacitor WebView —
                      // use the native share sheet instead.
                      try {
                        await Share.share(shareData)
                      } catch {
                        // user cancelled the native share sheet — ignore
                      }
                    } else if (navigator.share) {
                      try {
                        await navigator.share(shareData)
                      } catch {
                        // user cancelled share — ignore
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(shareData.text)
                        toast({ title: 'Prescription copied' })
                      } catch {
                        toast({ title: 'Could not copy', message: 'Sharing is unavailable on this device' })
                      }
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-pill bg-screen py-2 text-[13px] font-semibold text-body"
                >
                  <ShareNetwork size={16} /> Share
                </Pressable>
              </div>
            </Card>
          </motion.div>
        ))}
        <Pressable hap="tick" onClick={goDoses} className="flex w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface py-3 text-[14px] font-semibold text-body">
          <BellSimple size={16} /> View all dose reminders
        </Pressable>
      </motion.div>
    </Screen>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-2.5">
      <Label>{label}</Label>
      <div className="mt-0.5 text-[13px] font-semibold text-ink">{value}</div>
    </div>
  )
}

// ── DOSES (pushed) ──
function DosesScreen({ doses, onToggle, back, onRefresh }: any) {
  const toast = useToast()
  const pct = useMemo(() => (doses.length === 0 ? 0 : Math.round((doses.filter((d: any) => d.loggedToday).length / doses.length) * 100)), [doses])
  const header = (
    <div className="px-[18px] pb-1 pt-[var(--app-top)]">
      <Pressable hap="impact" onClick={back} className="flex min-h-[44px] min-w-[44px] items-center gap-1 text-[13px] font-semibold text-brand"><CaretLeft size={15} weight="bold" /> Prescriptions</Pressable>
      <h1 className="mt-1 font-display text-[24px] font-bold text-ink">Dose reminders</h1>
    </div>
  )
  if (doses.length === 0) {
    return (
      <Screen header={header} onRefresh={onRefresh}>
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Flask size={28} className="text-muted" />
          <span className="text-[14px] font-semibold text-ink">No dose reminders yet</span>
          <span className="max-w-[220px] text-[13px] text-muted">These appear once your doctor prescribes a remedy with reminders turned on.</span>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-4">
        <Card className="flex flex-col items-center py-6">
          <ProgressRing pct={pct} size={148} stroke={13}>
            <CountUp value={pct} format={(n) => `${Math.round(n)}%`} className="font-display text-[30px] font-bold text-ink" />
            <span className="text-[11px] text-faint">logged today</span>
          </ProgressRing>
        </Card>

        <Label>Today</Label>
        <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
          {doses.map((d: any) => <motion.div key={d.id} variants={listItem}><DoseRow d={d} onToggle={onToggle} /></motion.div>)}
        </motion.div>

        <div className="flex gap-2">
          <Pressable
            hap="tick"
            onClick={() => {
              haptic('impact')
              toast({ title: 'Snoozed', message: 'We\'ll remind you in 1 hour' })
            }}
            className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[13px] font-semibold text-body"
          >
            Snooze 1 hr
          </Pressable>
          <Pressable
            hap="tick"
            onClick={() => {
              haptic('impact')
              toast({ title: 'Skipped', message: 'Today\'s remaining doses skipped' })
            }}
            className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[13px] font-semibold text-body"
          >
            Skip today
          </Pressable>
        </div>

      </div>
    </Screen>
  )
}

// ── APPOINTMENTS ──
// Typical clinic hours offered when booking — filtered per-date against
// what's already on the calendar, so this is a starting list, not the
// actual availability.
const CLINIC_SLOTS = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM']

/** Scans forward from `fromDate` (inclusive) for the practitioner's first
 *  open slot, so "next available slot" reflects the real calendar instead
 *  of always landing back on the same time. */
function findNextAvailableSlot(appts: Appointment[], practitionerId: string, fromDate: string): { date: string; time: string } {
  for (let i = 0; i < 30; i++) {
    const date = addDaysISO(fromDate, i)
    const taken = new Set(appts.filter((a) => a.practitionerId === practitionerId && a.date === date && a.status !== 'Cancelled').map((a) => a.time))
    const slot = CLINIC_SLOTS.find((s) => !taken.has(s))
    if (slot) return { date, time: slot }
  }
  return { date: fromDate, time: CLINIC_SLOTS[0] }
}

function usePastVisits(patientId: string) {
  const appointments = useClinic((s) => s.appointments.filter((a) => a.patientId === patientId && (a.status === 'Seen' || isPastISO(a.date))))
  const practitioners = useClinic((s) => s.practitioners)
  const outcomes = useClinic((s) => s.outcomes.filter((o) => o.patientId === patientId))

  return useMemo(() =>
    appointments.map((apt, i) => {
      const doc = practitioners.find((p) => p.id === apt.practitionerId)
      const outcome = outcomes[i]
      const docName = doc ? (/^dr\.?\s/i.test(doc.name) ? doc.name : `Dr. ${doc.name}`) : 'Doctor'
      return {
        id: apt.id,
        date: outcome ? new Date(outcome.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : formatDayLabel(apt.date),
        time: apt.time,
        doctor: docName,
        type: apt.type,
        remedy: outcome?.remedy ?? null,
        outcome: outcome?.outcome ?? null,
      }
    }),
  [appointments, practitioners, outcomes])
}

const outcomeTone = (o: string) => {
  switch (o) {
    case 'Clear improvement': return 'green' as const
    case 'Partial': return 'amber' as const
    case 'No change': return 'neutral' as const
    case 'Aggravation': return 'danger' as const
    default: return 'neutral' as const
  }
}

function AppointmentsScreen({ onRefresh, patientId }: { onRefresh: () => Promise<void>; patientId: string }) {
  const toast = useToast()
  const appointments = useClinic((s) => s.appointments.filter((a) => a.patientId === patientId))
  const allAppointments = useClinic((s) => s.appointments)
  const practitioners = useClinic((s) => s.practitioners)
  const myPractitionerId = useClinic((s) => s.patients.find((p) => p.id === patientId)?.owningPractitionerId)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const pastVisits = usePastVisits(patientId)
  const [bookingOpen, setBookingOpen] = useState(false)
  // Default to the patient's own treating practitioner, not just whoever
  // happens to be first in the list — that previously let a booking land
  // on the wrong doctor (or, briefly, on a stray practitioner row created
  // by an unrelated bug) whenever the clinic had more than one on staff.
  const [selectedPractitioner, setSelectedPractitioner] = useState('')
  const [selectedType, setSelectedType] = useState<'In person' | 'Video'>('In person')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const bookingInFlight = useRef(false)

  // Only offer slots that aren't already booked for this practitioner on
  // this date — booking used to always target today at one of 4 fixed
  // times regardless of what was already on the calendar.
  const availableSlots = useMemo(() => {
    const taken = new Set(
      allAppointments
        .filter((a) => a.practitionerId === selectedPractitioner && a.date === selectedDate && a.status !== 'Cancelled')
        .map((a) => a.time),
    )
    return CLINIC_SLOTS.filter((slot) => !taken.has(slot))
  }, [allAppointments, selectedPractitioner, selectedDate])
  const effectiveSlot = selectedSlot && availableSlots.includes(selectedSlot) ? selectedSlot : availableSlots[0]

  const upcoming = appointments
    .filter((a) => a.status !== 'Seen' && a.status !== 'Cancelled' && !isPastISO(a.date))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date)
      if (dc !== 0) return dc
      const toMin = (t: string) => { const [h, rest] = t.split(':'); const m = parseInt(rest); const hr = parseInt(h) % 12 + (t.includes('PM') ? 12 : 0); return hr * 60 + m }
      return toMin(a.time) - toMin(b.time)
    })

  const statusTone = (status: string) => {
    switch (status) {
      case 'Upcoming': return 'green' as const
      case 'In consult': return 'purple' as const
      case 'Waiting': return 'amber' as const
      case 'Seen': return 'neutral' as const
      default: return 'neutral' as const
    }
  }

  const header = <BigHeader title="Appointments" />
  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-4">
        {/* booking bottom sheet */}
        <BottomSheet open={bookingOpen} onClose={() => setBookingOpen(false)}>
          <h2 className="font-display text-[18px] font-bold text-ink">Book a visit</h2>

          {(() => {
            const lastVisit = [...appointments].filter((a) => a.status === 'Seen').sort((a, b) => b.date.localeCompare(a.date))[0]
            const lastDoc = lastVisit ? practitioners.find((p) => p.id === lastVisit.practitionerId) : null
            if (!lastVisit || !lastDoc) return null
            return (
              <Pressable
                hap="tick"
                onClick={() => {
                  setSelectedPractitioner(lastVisit.practitionerId)
                  setSelectedType(lastVisit.type)
                  setSelectedSlot(null)
                }}
                className="mt-3 flex w-full items-center gap-2.5 rounded-[14px] border border-dashed border-green-border bg-tint px-3.5 py-2.5 text-left"
              >
                <ArrowsClockwise size={16} className="text-brand" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">Same as last time</div>
                  <div className="text-[11.5px] text-muted">{lastDoc.name} · {lastVisit.type}</div>
                </div>
              </Pressable>
            )
          })()}

          <Label className="mt-4">Practitioner</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {practitioners.map((p) => (
              <Pressable
                key={p.id}
                hap="tick"
                onClick={() => setSelectedPractitioner(p.id)}
                className={`flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${selectedPractitioner === p.id ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted'}`}
              >
                {p.id === myPractitionerId && <Check size={13} weight="bold" className="text-brand" />}
                {p.name}
                {p.id !== myPractitionerId && <span className="text-[11px] font-normal text-faint">Covering</span>}
              </Pressable>
            ))}
          </div>

          <Label className="mt-4">Consult type</Label>
          <div className="mt-2 flex gap-2">
            {(['In person', 'Video'] as const).map((t) => (
              <Pressable
                key={t}
                hap="tick"
                onClick={() => setSelectedType(t)}
                className={`flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${selectedType === t ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted'}`}
              >
                {t === 'Video' && <VideoCamera size={14} weight="fill" />}
                {t === 'In person' && <MapPin size={14} weight="fill" />}
                {t}
              </Pressable>
            ))}
          </div>

          <Label className="mt-4">Date</Label>
          <input
            type="date"
            value={selectedDate}
            min={todayISO()}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null) }}
            className="mt-2 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
          />

          <Label className="mt-4">Available slots</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableSlots.length === 0 && (
              <p className="text-[13px] text-muted">No open slots on this date — try another day.</p>
            )}
            {availableSlots.map((slot) => (
              <Pressable
                key={slot}
                hap="tick"
                onClick={() => setSelectedSlot(slot)}
                className={`flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${effectiveSlot === slot ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted'}`}
              >
                <Clock size={14} /> {slot}
              </Pressable>
            ))}
          </div>

          <Button
            variant="accent"
            size="lg"
            className="mt-5 w-full min-h-[44px]"
            disabled={!effectiveSlot}
            onClick={() => {
              if (!effectiveSlot) return
              // Guards against a double-tap firing two bookings before the
              // sheet has a chance to close (this is how one bad tap once
              // turned into several duplicate follow-ups).
              if (bookingInFlight.current) return
              bookingInFlight.current = true
              const doc = practitioners.find((p) => p.id === selectedPractitioner)
              scheduleFollowUp({
                patientId,
                practitionerId: selectedPractitioner,
                time: effectiveSlot,
                date: selectedDate,
                type: selectedType,
                reason: selectedType === 'Video' ? 'Video consultation' : 'Consultation',
              })
              setBookingOpen(false)
              setSelectedSlot(null)
              haptic('success')
              toast({
                title: 'Visit booked',
                message: `${selectedType} with ${doc?.name ?? 'Doctor'} · ${formatDayLabel(selectedDate)} at ${effectiveSlot}`,
              })
            }}
          >
            <CalendarPlus size={16} weight="fill" /> Confirm booking
          </Button>
        </BottomSheet>

        {/* Upcoming */}
        {upcoming.length > 0 && <Label>Upcoming</Label>}
        <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
          {upcoming.map((apt: Appointment) => (
            <motion.div key={apt.id} variants={listItem}>
              <Card className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-[16px] font-semibold text-ink">{formatDayLabel(apt.date)} · {apt.time}</div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {practitioners.find((p) => p.id === apt.practitionerId)?.name ?? 'Doctor'} · {apt.type}
                      {apt.reason && ` · ${apt.reason}`}
                    </div>
                  </div>
                  <Badge tone={statusTone(apt.status)}>{apt.status}</Badge>
                </div>
                {apt.tag && <div className="mt-1.5 text-[12px] text-faint">{apt.tag}</div>}
                {apt.status === 'In consult' && (
                  <Pressable
                    hap="impact"
                    onClick={() => {
                      openJitsi(apt.id)
                      haptic('impact')
                    }}
                    className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-pill bg-brand py-2.5 text-[13px] font-semibold text-white"
                  >
                    <VideoCamera size={15} weight="fill" /> Join
                  </Pressable>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {upcoming.length === 0 && (
          <Card className="p-5">
            <p className="text-center text-[13px] text-muted">No upcoming appointments</p>
          </Card>
        )}

        <Pressable
          hap="impact"
          onClick={() => {
            setSelectedPractitioner(myPractitionerId || practitioners[0]?.id || '')
            bookingInFlight.current = false
            setBookingOpen(true)
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-pill bg-accent py-3 font-display text-[15px] font-semibold text-white shadow-float"
        >
          <CalendarPlus size={16} weight="fill" /> Book a visit
        </Pressable>

        {/* Past visits */}
        {pastVisits.length > 0 && (
          <>
            <Label>Past visits</Label>
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
              {pastVisits.map((v) => (
                <motion.div key={v.id} variants={listItem}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-display text-[15px] font-semibold text-ink">{v.date} · {v.time}</div>
                        <div className="mt-0.5 text-[13px] text-muted">
                          {v.doctor} · {v.type === 'Video' && <VideoCamera size={12} weight="fill" className="inline text-brand" />} {v.type}
                        </div>
                      </div>
                      {v.outcome && <Badge tone={outcomeTone(v.outcome)}>{v.outcome}</Badge>}
                    </div>
                    {v.remedy && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Flask size={13} className="text-brand" />
                        <span className="text-[12px] font-medium text-body">{v.remedy}</span>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
        {pastVisits.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarBlank size={28} className="text-muted" />
            <span className="text-[13px] text-muted">No past visits yet</span>
          </Card>
        )}
      </div>
    </Screen>
  )
}

// ── PROFILE ──
function ProfileScreen({ patient, onRefresh, onPush }: { patient: any; onRefresh: () => Promise<void>; onPush: (s: PushedScreen) => void }) {
  const header = <BigHeader title="Profile" />
  const rows: { title: string; sub: string; push: PushedScreen }[] = [
    { title: 'Personal details', sub: `${patient.name} · ${patient.age} · ${patient.location}`, push: 'personal' },
    { title: 'Medical basics', sub: [patient.allergies, patient.regularMedication].filter(Boolean).join(' · ') || 'Not recorded yet', push: 'medical' },
    { title: 'Notifications', sub: 'Doses, appointments, follow-ups', push: 'notifications' },
    { title: 'Messages', sub: 'Chat with your doctor', push: 'messages' },
    { title: 'Documents', sub: 'Reports, prescriptions, invoices', push: 'documents' },
    { title: 'Data & privacy', sub: 'Who can see my records, export, delete', push: 'privacy' },
  ]
  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-4">
        <div className="flex flex-col items-center py-3">
          <Avatar initials={patient.initials} size={72} />
          <div className="mt-3 font-display text-[20px] font-bold text-ink">{patient.name}</div>
          <div className="text-[13px] text-muted">{patient.wsCode} · Sneham Digital Clinic, {patient.location}</div>
        </div>
        {rows.map((row) => (
          <Pressable
            key={row.title}
            as="div"
            hap="tick"
            scale={0.98}
            onClick={() => onPush(row.push)}
            className="flex cursor-pointer items-center justify-between rounded-[20px] border border-border bg-surface px-4 py-3.5"
          >
            <div>
              <div className="text-[14px] font-semibold text-ink">{row.title}</div>
              <div className="text-[12px] text-muted">{row.sub}</div>
            </div>
            <span className="text-faint">&rsaquo;</span>
          </Pressable>
        ))}
        <SignOutRow />
      </div>
    </Screen>
  )
}

function SignOutRow() {
  const { signOut } = useAuth()
  const resetDemo = useClinic((s) => s.resetDemo)
  return (
    <Pressable
      as="div"
      hap="impact"
      scale={0.98}
      onClick={() => {
        localStorage.removeItem('sneham-my-patient-id')
        resetDemo()
        signOut()
      }}
      className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-border bg-surface py-3 text-[13px] font-semibold text-danger"
    >
      <SignOut size={16} weight="bold" /> Sign out
    </Pressable>
  )
}

// ── Profile detail pushed screen ──
function ProfileDetail({ title, back, onRefresh, children }: { title: string; back: () => void; onRefresh: () => Promise<void>; children: ReactNode }) {
  const header = (
    <div className="px-[18px] pb-1 pt-[var(--app-top)]">
      <Pressable hap="impact" onClick={back} className="flex min-h-[44px] min-w-[44px] items-center gap-1 text-[13px] font-semibold text-brand"><CaretLeft size={15} weight="bold" /> Profile</Pressable>
      <h1 className="mt-1 font-display text-[24px] font-bold text-ink">{title}</h1>
    </div>
  )
  return (
    <Screen header={header} onRefresh={onRefresh}>
      {children}
    </Screen>
  )
}

// ── Notification settings pushed screen ──
function NotificationSettingsScreen({ back, onRefresh }: { back: () => void; onRefresh: () => Promise<void> }) {
  const [doseReminders, setDoseReminders] = useState(true)
  const [appointmentReminders, setAppointmentReminders] = useState(true)
  const [followUpReminders, setFollowUpReminders] = useState(true)

  const header = (
    <div className="px-[18px] pb-1 pt-[var(--app-top)]">
      <Pressable hap="impact" onClick={back} className="flex min-h-[44px] min-w-[44px] items-center gap-1 text-[13px] font-semibold text-brand"><CaretLeft size={15} weight="bold" /> Profile</Pressable>
      <h1 className="mt-1 font-display text-[24px] font-bold text-ink">Notifications</h1>
    </div>
  )
  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-3">
        <Card className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[14px] font-semibold text-ink">Dose reminders</div>
            <div className="text-[12px] text-muted">Get notified when it's time to take your remedy</div>
          </div>
          <Toggle on={doseReminders} onChange={(v) => { haptic('select'); setDoseReminders(v) }} />
        </Card>
        <Card className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[14px] font-semibold text-ink">Appointment reminders</div>
            <div className="text-[12px] text-muted">Remind me before upcoming visits</div>
          </div>
          <Toggle on={appointmentReminders} onChange={(v) => { haptic('select'); setAppointmentReminders(v) }} />
        </Card>
        <Card className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[14px] font-semibold text-ink">Follow-up reminders</div>
            <div className="text-[12px] text-muted">Nudge for check-ins and follow-up bookings</div>
          </div>
          <Toggle on={followUpReminders} onChange={(v) => { haptic('select'); setFollowUpReminders(v) }} />
        </Card>
      </div>
    </Screen>
  )
}

// ── Data & privacy pushed screen ──
function DataPrivacyScreen({ back, onRefresh }: { back: () => void; onRefresh: () => Promise<void> }) {
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { signOut } = useAuth()
  const resetDemo = useClinic((s) => s.resetDemo)
  const patient = useMyPatient()
  const prescriptions = useClinic((s) => s.prescriptions.filter((r) => r.patientId === patient?.id))
  const appointments = useClinic((s) => s.appointments.filter((a) => a.patientId === patient?.id))
  const doses = useClinic((s) => s.doseReminders.filter((d) => d.patientId === patient?.id))
  const messages = useClinic((s) => s.messages.filter((m) => m.patientId === patient?.id))

  const handleExport = async () => {
    const data = { patient, prescriptions, appointments, doses, messages, exportedAt: new Date().toISOString() }
    const json = JSON.stringify(data, null, 2)
    const fileName = `sneham-export-${patient?.name?.replace(/\s+/g, '-') ?? 'patient'}.json`

    if (Capacitor.isNativePlatform()) {
      // The blob + <a download> trick below is a browser-only API — it's
      // silently a no-op inside a Capacitor WebView, so "Export my data"
      // did nothing at all on the patient APK.
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const written = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
        await Share.share({ title: fileName, url: written.uri })
        haptic('success')
        toast({ title: 'Data exported' })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (!/cancel/i.test(message)) toast({ title: 'Could not export data', message: 'Check your connection and try again.' })
      }
      return
    }

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    haptic('success')
    toast({ title: 'Data exported', message: 'JSON file downloaded' })
  }

  const handleDelete = () => {
    localStorage.removeItem('sneham-my-patient-id')
    resetDemo()
    signOut()
  }

  const header = (
    <div className="px-[18px] pb-1 pt-[var(--app-top)]">
      <Pressable hap="impact" onClick={back} className="flex min-h-[44px] min-w-[44px] items-center gap-1 text-[13px] font-semibold text-brand"><CaretLeft size={15} weight="bold" /> Profile</Pressable>
      <h1 className="mt-1 font-display text-[24px] font-bold text-ink">Data & privacy</h1>
    </div>
  )
  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-3">
        <Pressable
          as="div"
          hap="impact"
          scale={0.98}
          onClick={handleExport}
          className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-4"
        >
          <Export size={20} className="text-brand" />
          <div>
            <div className="text-[14px] font-semibold text-ink">Export my data</div>
            <div className="text-[12px] text-muted">Download all your records as a JSON file</div>
          </div>
        </Pressable>
        <Pressable
          as="div"
          hap="impact"
          scale={0.98}
          onClick={() => setConfirmDelete(true)}
          className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-dashed border-danger/30 bg-surface px-4 py-4"
        >
          <Trash size={20} className="text-danger" />
          <div>
            <div className="text-[14px] font-semibold text-danger">Delete account</div>
            <div className="text-[12px] text-muted">Permanently remove your data</div>
          </div>
        </Pressable>
      </div>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h2 className="font-display text-[18px] font-bold text-danger">Delete your account?</h2>
        <p className="mt-2 text-[13px] text-muted">This will permanently remove all your health data, prescriptions, and appointment history. This action cannot be undone.</p>
        <div className="mt-5 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete everything</Button>
        </div>
      </BottomSheet>
    </Screen>
  )
}

// ── CHECK-IN FORM ──
// A continuous 0–100% slider reads truer than five fixed buttons — "a bit
// better than yesterday" doesn't have to round to one of five buckets.
// marked (better/same/worse) still derives from the value, since the rest
// of the app (badges, the doctor's dashboard) reads that three-way signal.
function feelingForPct(pct: number): 'better' | 'same' | 'worse' {
  return pct >= 60 ? 'better' : pct <= 40 ? 'worse' : 'same'
}
function feelingLabelForPct(pct: number): string {
  if (pct >= 80) return 'Much better'
  if (pct >= 60) return 'Somewhat better'
  if (pct >= 40) return 'About the same'
  if (pct >= 20) return 'Worse'
  return 'Much worse'
}

const SYMPTOM_CHIPS = [
  'Sleeping better', 'Less anxious', 'More energy', 'Appetite improved',
  'Pain reduced', 'Still tired', 'Waking at night', 'Headaches persist',
  'Digestion better', 'Mood improved',
]

function CheckInScreen({ back, onRefresh, patientId }: { back: () => void; onRefresh: () => Promise<void>; patientId: string }) {
  const toast = useToast()
  const doctorName = useClinic((s) => {
    const myId = s.patients.find((p) => p.id === patientId)?.owningPractitionerId
    return s.practitioners.find((p) => p.id === myId)?.name ?? s.practitioners[0]?.name ?? 'your doctor'
  })
  const prescriptions = useClinic((s) => s.prescriptions.filter((r) => r.patientId === patientId))
  const existingCheckIns = useClinic((s) => s.checkIns.filter((c) => c.patientId === patientId))
  const submitCheckIn = useClinic((s) => s.submitCheckIn)
  const rx = prescriptions[0]

  const [pct, setPct] = useState(50)
  const [sliderTouched, setSliderTouched] = useState(false)
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) => prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip])
  }

  // Only a missing prescription genuinely blocks check-in — not yet moving
  // the slider shouldn't freeze the button; it should respond and nudge instead.
  const canSubmit = !!rx

  const handleSubmit = () => {
    if (!rx) return
    if (!sliderTouched) {
      haptic('warn')
      toast({ title: 'Move the slider first', message: 'Show how you\'re feeling before submitting your check-in.' })
      return
    }
    submitCheckIn({
      patientId,
      prescriptionId: rx.id,
      marked: feelingForPct(pct),
      improvementPct: pct,
      changeChips: selectedChips,
      freeText,
    })
    haptic('success')
    setSubmitted(true)
  }

  const header = (
    <div className="px-[18px] pb-1 pt-[var(--app-top)]">
      <Pressable hap="impact" onClick={back} className="flex min-h-[44px] min-w-[44px] items-center gap-1 text-[13px] font-semibold text-brand"><CaretLeft size={15} weight="bold" /> Home</Pressable>
      <h1 className="mt-1 font-display text-[24px] font-bold text-ink">How are you feeling?</h1>
    </div>
  )

  if (submitted) {
    return (
      <Screen header={header} onRefresh={onRefresh}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={springSoft} className="flex flex-col items-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-tint">
            <Check size={32} weight="bold" className="text-brand" />
          </div>
          <div className="mt-4 font-display text-[20px] font-bold text-ink">Check-in submitted</div>
          <div className="mt-2 max-w-[260px] text-center text-[14px] leading-relaxed text-muted">
            {doctorName} will review your update before your next visit.
          </div>
          <Pressable
            hap="impact"
            onClick={back}
            className="mt-8 min-h-[44px] min-w-[44px] rounded-pill bg-accent px-8 py-2.5 font-display text-[14px] font-semibold text-white shadow-float"
          >
            Done
          </Pressable>
        </motion.div>
      </Screen>
    )
  }

  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-5">
        {rx && (
          <Card className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><Flask size={20} weight="fill" /></div>
            <div>
              <div className="text-[14px] font-semibold text-ink">{rx.remedy} {rx.potency}</div>
              <div className="text-[12px] text-muted">{rx.repetition}</div>
            </div>
          </Card>
        )}

        <div>
          <Label>Overall improvement</Label>
          <Card className="mt-2.5 p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[32px] font-bold leading-none text-ink">{sliderTouched ? `${pct}%` : '—'}</span>
              {sliderTouched && <span className="text-[13px] font-semibold text-muted">{feelingLabelForPct(pct)}</span>}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => { setSliderTouched(true); setPct(Number(e.target.value)) }}
              className="mt-3 w-full accent-brand"
              aria-label="Overall improvement"
            />
            <div className="mt-1 flex justify-between text-[11px] text-faint">
              <span>No better</span>
              <span>Much better</span>
            </div>
          </Card>
        </div>

        <div>
          <Label>What's changed?</Label>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SYMPTOM_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                hap="tick"
                onClick={() => toggleChip(chip)}
                className={`rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition ${selectedChips.includes(chip) ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted'}`}
              >
                {chip}
              </Pressable>
            ))}
          </div>
        </div>

        <div>
          <Label>Anything else?</Label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={`Tell ${doctorName} how you've been feeling...`}
            rows={3}
            className="mt-2 w-full resize-none rounded-[14px] border border-border bg-surface px-4 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-green-border focus:ring-1 focus:ring-accent/30"
          />
        </div>

        {existingCheckIns.length > 0 && (
          <div>
            <Label>Previous check-ins</Label>
            <div className="mt-2 space-y-2">
              {[...existingCheckIns].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 2).map((ci) => (
                <Card key={ci.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted">{new Date(ci.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <Badge tone={ci.marked === 'better' ? 'green' : ci.marked === 'same' ? 'amber' : 'danger'}>{ci.marked === 'better' ? 'Better' : ci.marked === 'same' ? 'Same' : 'Worse'}</Badge>
                  </div>
                  {ci.changeChips.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ci.changeChips.map((c) => <span key={c} className="rounded-pill bg-screen px-2 py-0.5 text-[10px] font-medium text-body">{c}</span>)}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {!rx && <p className="text-center text-[12px] text-muted">Check-ins open once your doctor has prescribed a remedy.</p>}
        <Button
          variant="accent"
          size="lg"
          className="w-full min-h-[44px]"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <Notepad size={16} weight="fill" /> Submit check-in
        </Button>
      </div>
    </Screen>
  )
}

// ── DOCUMENTS ──
function DocumentsScreen({ back, onRefresh, patientId }: { back: () => void; onRefresh: () => Promise<void>; patientId: string }) {
  const toast = useToast()
  const documents = useClinic((s) => s.documents.filter((d) => d.patientId === patientId))

  const kindIcon = (kind: string) => {
    switch (kind) {
      case 'Prescription': return <RxIcon size={20} weight="fill" className="text-brand" />
      case 'Report': return <FileText size={20} weight="fill" className="text-amber" />
      case 'Invoice': return <FilePdf size={20} weight="fill" className="text-muted" />
      default: return <FilePdf size={20} weight="fill" className="text-muted" />
    }
  }

  const kindTone = (kind: string) => {
    switch (kind) {
      case 'Prescription': return 'green' as const
      case 'Report': return 'amber' as const
      default: return 'neutral' as const
    }
  }

  const header = (
    <div className="px-[18px] pb-1 pt-[var(--app-top)]">
      <Pressable hap="impact" onClick={back} className="flex min-h-[44px] min-w-[44px] items-center gap-1 text-[13px] font-semibold text-brand"><CaretLeft size={15} weight="bold" /> Home</Pressable>
      <h1 className="mt-1 font-display text-[24px] font-bold text-ink">Documents</h1>
    </div>
  )

  return (
    <Screen header={header} onRefresh={onRefresh}>
      <div className="space-y-4">
        {documents.length === 0 && (
          <Card className="flex flex-col items-center py-8">
            <FolderSimple size={36} className="text-faint" />
            <p className="mt-3 text-[14px] font-semibold text-ink">No documents yet</p>
            <p className="mt-1 text-[13px] text-muted">Prescriptions and reports will appear here</p>
          </Card>
        )}

        <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
          {documents.map((doc) => (
            <motion.div key={doc.id} variants={listItem}>
              <Pressable
                as="div"
                hap="tick"
                scale={0.98}
                onClick={() => {
                  if (!doc.fileUrl) {
                    toast({ title: 'Not available', message: 'This document has no file attached.' })
                    return
                  }
                  if (Capacitor.isNativePlatform()) Browser.open({ url: doc.fileUrl }).catch(() => {})
                  else window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')
                }}
                className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3.5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-tint">
                  {kindIcon(doc.kind)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink">{doc.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                    <span>{doc.date}</span>
                    <span>·</span>
                    <Badge tone={kindTone(doc.kind)}>{doc.kind}</Badge>
                    <span>·</span>
                    <span>{doc.size}</span>
                  </div>
                </div>
                <span className="text-faint">&rsaquo;</span>
              </Pressable>
            </motion.div>
          ))}
        </motion.div>

        <div className="text-center text-[12px] text-faint">
          {documents.length} document{documents.length !== 1 ? 's' : ''} · uploaded by you and your practitioners
        </div>
      </div>
    </Screen>
  )
}

function MessagesScreen({ back, onRefresh, patientId }: { back: () => void; onRefresh: () => Promise<void>; patientId: string }) {
  const doctorName = useClinic((s) => {
    const myId = s.patients.find((p) => p.id === patientId)?.owningPractitionerId
    return s.practitioners.find((p) => p.id === myId)?.name ?? s.practitioners[0]?.name ?? 'Your doctor'
  })
  const initials = doctorName.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-full flex-col bg-screen">
      {/* WhatsApp-style green header */}
      <div className="flex items-center gap-3 bg-brand px-3 pb-3 pt-[var(--app-top)]">
        <Pressable ariaLabel="back" hap="impact" onClick={back} className="flex h-9 w-9 items-center justify-center">
          <CaretLeft size={20} weight="bold" className="text-white" />
        </Pressable>
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 font-display text-[14px] font-semibold text-white">
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-display text-[16px] font-semibold text-white">{doctorName}</div>
          <div className="text-[11px] text-white/70">Doctor</div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ChatThread patientId={patientId} viewAs="patient" />
      </div>
    </div>
  )
}

// ── TAB BAR (animated indicator) ──
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: any; label: string }[] = [
    { id: 'home', icon: House, label: 'Home' },
    { id: 'appointments', icon: CalendarBlank, label: 'Visits' },
    { id: 'prescriptions', icon: RxIcon, label: 'Rx' },
    { id: 'profile', icon: User, label: 'Profile' },
  ]
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/85 px-4 pt-2 backdrop-blur-xl"
      style={{ paddingBottom: 'var(--app-bottom)' }}
    >
      {items.map((it) => {
        const on = tab === it.id
        return (
          <Pressable key={it.id} as="div" hap="tick" scale={0.9} onClick={() => onChange(it.id)} className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-1">
            <span className="relative flex h-9 w-14 items-center justify-center">
              {on && <motion.span layoutId="patient-tab" className="absolute inset-0 rounded-pill bg-tint-pale" transition={spring} />}
              <span className={`relative ${on ? 'text-brand' : 'text-faint'}`}><it.icon size={21} weight={on ? 'fill' : 'regular'} /></span>
            </span>
            <span className={`text-[10px] font-medium ${on ? 'text-brand' : 'text-faint'}`}>{it.label}</span>
          </Pressable>
        )
      })}
    </div>
  )
}

// ── PATIENT SELF-REGISTRATION ──
function PatientSelfRegister() {
  const { user } = useAuth()
  const addPatient = useClinic((s) => s.addPatient)
  const linkPatientIdentity = useClinic((s) => s.linkPatientIdentity)
  const patients = useClinic((s) => s.patients)
  const toast = useToast()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'Female' | 'Male' | 'Other'>('Female')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [complaint, setComplaint] = useState('')
  const [step, setStep] = useState<1 | 'confirm' | 2>(1)
  const [matchedPatient, setMatchedPatient] = useState<Patient | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const canProceed = name.trim().length >= 2 && age.trim().length > 0 && phone.trim().length >= 7
  const canSubmit = complaint.trim().length >= 3

  // If the practitioner already added this person as a patient, their phone
  // number is the only thing we have to recognise them by — so a real match
  // here means "link this login to that existing record" instead of
  // creating a duplicate. Only ever matches a record no one has claimed yet.
  function handleContinue() {
    if (!canProceed) return
    const trimmedPhone = phone.trim()
    const match = patients.find((p) => p.phone?.trim() === trimmedPhone && !p.authUserId)
    if (match) {
      setMatchedPatient(match)
      setStep('confirm')
    } else {
      setStep(2)
    }
  }

  function claimMatch() {
    if (!matchedPatient || !user) return
    linkPatientIdentity(matchedPatient.id, user.id)
    localStorage.setItem('sneham-my-patient-id', matchedPatient.id)
    toast({ title: 'Welcome back', message: `We found your record, ${matchedPatient.name}.` })
  }

  function notMe() {
    setMatchedPatient(null)
    setStep(2)
  }

  function submit() {
    if (!canSubmit) return
    setSaving(true)
    const created = addPatient({
      name: name.trim(),
      age: parseInt(age, 10) || 0,
      sex,
      location: location.trim() || 'Mumbai',
      chiefComplaint: complaint.trim(),
      phone: phone.trim(),
    })
    if (user) linkPatientIdentity(created.id, user.id)
    localStorage.setItem('sneham-my-patient-id', created.id)
    toast({ title: 'Welcome to Sneham', message: 'Your profile has been created.' })
  }

  return (
    <div className="flex h-full flex-col bg-screen">
      <div className="px-[18px] pb-4 pt-[var(--app-top)]">
        <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint">
          <User size={26} className="text-brand" />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Welcome to Sneham</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">Tell us a little about yourself so your doctor can see your profile.</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-[18px] pb-[120px]">
          {step === 1 && (
            <div className="space-y-4 animate-fade">
              <div>
                <Label>Full name</Label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-body outline-none focus:border-green-border"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Age</Label>
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
                    placeholder="28"
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-body outline-none focus:border-green-border"
                  />
                </div>
                <div>
                  <Label>Sex</Label>
                  <div className="mt-1.5 flex gap-2">
                    {(['Female', 'Male', 'Other'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSex(opt)}
                        className={`flex-1 rounded-[12px] border py-2.5 text-[14px] font-semibold transition ${
                          sex === opt ? 'border-brand bg-brand text-white' : 'border-border bg-surface text-body'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Phone number</Label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  type="tel"
                  className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-body outline-none focus:border-green-border"
                />
                <p className="mt-1 text-[11.5px] text-faint">If your clinic already has a record for you, this helps us find it.</p>
              </div>
              <div>
                <Label>City</Label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Mumbai"
                  className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-body outline-none focus:border-green-border"
                />
              </div>
            </div>
          )}
          {step === 'confirm' && matchedPatient && (
            <div className="space-y-4 animate-fade">
              <Card className="flex items-center gap-3 px-4 py-4">
                <Avatar initials={matchedPatient.initials} size={48} />
                <div>
                  <div className="font-display text-[16px] font-bold text-ink">{matchedPatient.name}</div>
                  <div className="text-[13px] text-muted">{matchedPatient.age} &middot; {matchedPatient.location}</div>
                </div>
              </Card>
              <p className="text-[14px] leading-relaxed text-body">We found an existing record with this phone number at Sneham Digital Clinic. Is this you?</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 animate-fade">
              <div>
                <Label>What brings you here?</Label>
                <p className="mt-0.5 text-[12px] text-faint">Describe your main health concern</p>
                <textarea
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  rows={4}
                  placeholder="e.g. Difficulty sleeping, frequent headaches..."
                  className="mt-2 w-full resize-y rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-body outline-none focus:border-green-border"
                  autoFocus
                />
              </div>
            </div>
          )}
      </div>

      <div className="flex gap-2 border-t border-border bg-surface/95 px-[18px] pb-[var(--app-bottom)] pt-3 backdrop-blur">
        {step === 2 && (
          <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>
            <CaretLeft size={16} /> Back
          </Button>
        )}
        {step === 1 && (
          <Button variant="primary" className="flex-1" disabled={!canProceed} onClick={handleContinue}>
            Continue
          </Button>
        )}
        {step === 'confirm' && (
          <>
            <Button variant="ghost" className="flex-1" onClick={notMe}>
              Not me
            </Button>
            <Button variant="primary" className="flex-1" onClick={claimMatch}>
              Yes, that's me
            </Button>
          </>
        )}
        {step === 2 && (
          <Button variant="primary" className="flex-1" disabled={!canSubmit || saving} onClick={submit}>
            {saving ? 'Creating profile...' : 'Get started'}
          </Button>
        )}
      </div>
    </div>
  )
}
