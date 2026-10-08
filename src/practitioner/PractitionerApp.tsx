import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WhatsAppIcon } from '../design-system/BrandIcons'
import { AnimatePresence, motion } from 'framer-motion'
import {
  SunHorizon,
  ArrowsClockwise,
  Prescription as RxIcon,
  Tray,
  Bell,
  MagnifyingGlass,
  NotePencil,
  Handshake,
  CalendarBlank,
  CalendarCheck,
  CalendarPlus,
  Plus,
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
  CurrencyInr,
  TestTube,
  X,
  Copy,
} from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { useAuth } from '../auth/AuthProvider'
import { useShell, exitToLauncher } from '../core/shell'
import { INVESTIGATION_CATALOG, ALL_INVESTIGATIONS, wordsOf, matchesAllWords } from '../core/investigations'
import { Avatar, Badge, BottomSheet, Card, Label } from '../design-system/ui'
import { PendingApproval, AccessRemoved } from '../design-system/PendingApproval'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, springSnappy, tabVariants, pushVariants, listContainer, listItem } from '../design-system/motion'
import { TickNumber } from '../design-system/feedback'
import { PullToRefresh, useHorizontalSwipe, EdgeSwipeBack, useNativeBackButton } from '../design-system/gestures'
import { GuardedMotionDiv, useGhostSweep } from '../design-system/presence'
import { readResume, clearResume } from '../core/drafts'
import { ToastHost } from '../design-system/toast'
import { AppInfoRow } from '../components/AppInfo'
import { diag } from '../core/diagnostics'
import { App as CapApp } from '@capacitor/app'
import { useToast } from '../design-system/toast'
import { shareTextViaWhatsApp } from '../core/share'
import { newId } from '../core/db'
import { MobileCaseSheet } from './MobileCaseSheet'
import { MobileFollowUp } from './MobileFollowUp'
import { CalendarScreen } from './Calendar'
import { PatientSearchSheet, AddPatientSheet, InvoiceSheet } from './PatientSearch'
import { PatientDetailScreen } from './PatientProfile'
import { TodayGrid } from './TodayGrid'
import { PatientQuickView } from './PatientQuickView'
import { FollowUpsScreen } from './FollowUpsScreen'
import { QuickRxPicker, QuickRxEditor } from './QuickRx'
// Lazy — Jitsi's SDK is ~116KB and should only load on the rare screen
// that actually starts a video call, not on every app boot.
const VideoConsult = lazy(() => import('../video/VideoConsult').then((m) => ({ default: m.VideoConsult })))

function VideoConsultFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
    </div>
  )
}
import { ChatThread } from '../components/ChatThread'
import { useShallow } from 'zustand/react/shallow'

// ME is resolved from store inside the component
type Tab = 'today' | 'calendar' | 'followups' | 'rx' | 'inbox'
const TAB_ORDER: Tab[] = ['today', 'calendar', 'followups', 'rx', 'inbox']
type Overlay = { kind: 'case' | 'compare' | 'patient-detail' | 'investigations' | 'rx'; patientId: string } | { kind: 'chat'; patientId: string; patientName: string } | { kind: 'video'; appointmentId: string } | null

const refresh = async () => {
  const s = useClinic.getState()
  if (s.userId) await s.hydrate(s.userId, '')
}

// Condenses a legal name with a middle name ("Dr. Neha Bharadwajan Tripathi")
// down to title + first + surname ("Dr. Neha Tripathi") for the persistent
// header, which doesn't have room for the full legal name. Names of 3 words
// or fewer are already that shape and pass through unchanged.
function headerDisplayName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 3) return name
  return [...parts.slice(0, 2), parts[parts.length - 1]].join(' ')
}

export function PractitionerApp() {
  const [tab, setTab] = useState<Tab>('today')
  useEffect(() => { diag('tab', tab) }, [tab])
  const [dir, setDir] = useState(1)
  // Overlay navigation as one atomic value — current screen, what's
  // stacked underneath it (so Patient detail -> Case sheet -> Back returns
  // to Patient detail, not the tab root), and which way to animate. Kept as
  // a single setState call per action rather than nesting setState inside
  // another's updater — React StrictMode's dev-only double-invocation of
  // updater functions turned that into a real bug (Back silently needing an
  // extra tap) the moment the updater had a side effect in it.
  const [overlayNav, setOverlayNav] = useState<{ current: Overlay; history: Overlay[]; dir: number }>({ current: null, history: [], dir: 1 })
  // Android WebView renders native popups (date/time pickers, long-press paste) as a
  // blank box when anchored beneath an ancestor with a resting CSS transform, and
  // framer-motion leaves one applied after this slide finishes — see the identical
  // fix + explanation on BottomSheet in design-system/ui.tsx.
  const overlayTransformRef = useRef<HTMLDivElement>(null)
  const overlay = overlayNav.current
  const overlayEpoch = useGhostSweep(!!overlayNav.current)
  useEffect(() => { diag('overlay', overlayNav.current?.kind ?? 'none') }, [overlayNav.current?.kind])
  const overlayDir = overlayNav.dir
  const [switchOpen, setSwitchOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [addPatientOpen, setAddPatientOpen] = useState(false)
  const [billSearchOpen, setBillSearchOpen] = useState(false)
  const [billPatientId, setBillPatientId] = useState<string | null>(null)
  const [instantMeetingOpen, setInstantMeetingOpen] = useState(false)
  const [guestMeeting, setGuestMeeting] = useState<{ id: string; guestName: string } | null>(null)
  const toast = useToast()
  // Android's back gesture/button exits the app the instant there's nothing
  // in browser history to pop — and this app's screens are React state, not
  // history entries, so a stray swipe on a tab root with nothing open used
  // to close the app outright. Overlay screens already handle their own
  // back via EdgeSwipeBack; this covers everything else: close whichever
  // sheet is open, or — if truly nothing is — require a second press within
  // 2s before actually exiting, the same "press back again to exit"
  // convention every native Android app uses.
  const [exitArmed, setExitArmed] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useNativeBackButton(useCallback(() => {
    if (overlayNav.current) return
    if (switchOpen) { setSwitchOpen(false); return }
    if (searchOpen) { setSearchOpen(false); return }
    if (addPatientOpen) { setAddPatientOpen(false); return }
    if (billSearchOpen) { setBillSearchOpen(false); return }
    if (instantMeetingOpen) { setInstantMeetingOpen(false); return }
    if (exitArmed) { CapApp.exitApp(); return }
    setExitArmed(true)
    haptic('warn')
    toast({ title: 'Press back again to exit' })
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => setExitArmed(false), 2000)
  }, [overlayNav, switchOpen, searchOpen, addPatientOpen, billSearchOpen, instantMeetingOpen, exitArmed, toast]))

  const ME = useClinic((s) => s.currentPractitionerId)
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const unread = useClinic((s) => s.notifications.filter((n) => (n.surface === 'web' || n.surface === 'practitioner') && !n.read).length)
  // Patient chat messages never raise a bell notification, so without this a
  // new message is invisible until the Inbox is opened. Messages + alerts =
  // what's waiting in the Inbox tab.
  const unreadMessages = useClinic((s) => s.messages.reduce((n, m) => n + (m.sender === 'patient' && !m.read ? 1 : 0), 0))

  const goTab = (next: Tab) => {
    if (next === tab) return
    setDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 1 : -1)
    setTab(next)
  }
  // Every way into prescribing must say which patient it is for — Quick Rx used to guess (today's first
  // appointment, or just the first patient in the list) and could publish a real prescription to the wrong
  // person. With a patient it opens the editor on top of wherever she is (so Back returns there); with
  // none it shows the Rx tab, which asks.
  const goToRx = (patientId: string | null) => {
    if (patientId) openOverlay({ kind: 'rx', patientId })
    else goTab('rx')
  }

  // A fresh entry point (from a tab root, global search, or "add patient")
  // — no back-history yet, since there's nothing underneath to return to.
  const openOverlay = (next: Overlay) => {
    setOverlayNav({ current: next, history: [], dir: 1 })
  }
  // Navigating deeper from within an already-open overlay (e.g. Patient
  // detail -> Case sheet) — keeps what's open now so Back can return to it,
  // instead of skipping past it to the tab root.
  const pushOverlay = (next: Overlay) => {
    setOverlayNav((s) => ({
      current: next,
      history: s.current ? [...s.history, s.current] : s.history,
      dir: 1,
    }))
  }
  // Back — pop one level if there's history to return to, else close fully.
  const closeOverlay = () => {
    setOverlayNav((s) => {
      if (s.history.length === 0) return { current: null, history: [], dir: -1 }
      return { current: s.history[s.history.length - 1], history: s.history.slice(0, -1), dir: -1 }
    })
  }
  // The app was killed while a follow-up held unsaved text (the screen sets a
  // resume pointer only in that case and clears it on any normal exit) —
  // reopen straight to it so the restored text is right there.
  useEffect(() => {
    const r = readResume()
    clearResume()
    if (r?.kind === 'compare' && useClinic.getState().patients.some((p) => p.id === r.patientId)) {
      openOverlay({ kind: 'compare', patientId: r.patientId })
    }
    // run once, on app start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prescribing exits the whole patient-detail flow into a different tab —
  // the overlay history no longer applies once we've left it.
  const exitOverlayToRx = (patientId: string) => {
    pushOverlay({ kind: 'rx', patientId })
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
    const unsubscribe = useClinic.getState().subscribeRealtime()
    // Safety net only — realtime above covers normal changes within a
    // second or two. This just catches a dropped websocket (common on
    // flaky mobile networks), at a far slower cadence than the old 15s
    // full-refetch since it's no longer the primary sync path.
    const t = setInterval(() => {
      const s = useClinic.getState()
      if (s.userId && !s.hydrating) s.hydrate(s.userId, '')
    }, 120000)
    return () => { unsubscribe(); clearInterval(t) }
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
  if (doctor.status === 'inactive') {
    return <AccessRemoved name={doctor.name} />
  }

  return (
    <div className="relative h-full w-full overflow-clip bg-screen">
      <ToastHost placement="mobile" />
      {/* base app */}
      <div className="flex h-full flex-col">
        {/* pinned top bar */}
        <div className="flex items-center gap-3 px-[18px] pb-2 pt-[var(--app-top)]">
          <Pressable as="div" hap="tick" scale={0.94} onClick={() => setSwitchOpen(true)} className="relative tap-pad-sm cursor-pointer">
            <Avatar initials={doctor.initials} size={38} />
          </Pressable>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[15px] font-bold text-ink">{headerDisplayName(doctor.name)}</div>
            <div className="truncate text-[12px] text-faint">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · Chiplun clinic</div>
          </div>
          <Pressable ariaLabel="search patients" hap="tick" onClick={() => setSearchOpen(true)} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <MagnifyingGlass size={17} className="text-body" />
          </Pressable>
          <Pressable ariaLabel="notifications" hap="tick" onClick={() => goTab('inbox')} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <Bell size={18} className="text-body" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread}</span>
            )}
          </Pressable>
        </div>

        <div className="relative flex-1 overflow-clip">
          <AnimatePresence custom={dir} initial={false}>
            <GuardedMotionDiv key={tab} className="absolute inset-0" custom={dir} variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.15 }} {...swipe}>
              {tab === 'calendar' ? (
                <CalendarScreen
                  onOpenPatient={(id) => openOverlay({ kind: 'patient-detail', patientId: id })}
                  openCase={(id) => openOverlay({ kind: 'case', patientId: id })}
                  goRx={goToRx}
                />
              ) : (
                <PullToRefresh onRefresh={refresh} className="h-full px-[18px] pb-[120px] pt-2">
                  {tab === 'today' && <TodayGrid openCase={(id) => openOverlay({ kind: 'case', patientId: id })} goRx={goToRx} startVideo={(apptId) => openOverlay({ kind: 'video', appointmentId: apptId })} onQuickBill={() => setBillSearchOpen(true)} onInstantMeeting={() => setInstantMeetingOpen(true)} />}
                  {tab === 'followups' && <FollowUpsScreen openCompare={(id) => openOverlay({ kind: 'compare', patientId: id })} openCase={(id) => openOverlay({ kind: 'case', patientId: id })} goRx={goToRx} />}
                  {tab === 'rx' && <QuickRxPicker onPick={(id) => openOverlay({ kind: 'rx', patientId: id })} />}
                  {tab === 'inbox' && <InboxScreen onOpenPatient={(id) => openOverlay({ kind: 'patient-detail', patientId: id })} onOpenChat={(id, name) => openOverlay({ kind: 'chat', patientId: id, patientName: name })} />}
                </PullToRefresh>
              )}
            </GuardedMotionDiv>
          </AnimatePresence>
        </div>
      </div>

      <TabBar tab={tab} onChange={(t) => (t === 'rx' ? goToRx(null) : goTab(t))} inboxCount={unreadMessages + unread} />

      {/* overlays: case sheet / compare / video — dir flips to -1 on Back so
          the slide direction matches native forward/back conventions */}
      <AnimatePresence key={overlayEpoch} custom={overlayDir}>
        {overlay && (
          <GuardedMotionDiv
            key={overlay.kind + ('patientId' in overlay ? overlay.patientId : overlay.appointmentId)}
            className="absolute inset-0 z-40 bg-screen"
            custom={overlayDir}
            variants={pushVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            onAnimationComplete={(def) => {
              if (def === 'center') overlayTransformRef.current?.style.setProperty('transform', 'none')
            }}
            ref={overlayTransformRef}
          >
            {overlay.kind === 'rx' ? (
              // Has its own back handling: leaving a half-written prescription asks first.
              <QuickRxEditor patientId={overlay.patientId} onClose={closeOverlay} />
            ) : (
            <EdgeSwipeBack onBack={closeOverlay}>
              {overlay.kind === 'video' ? (
                <VideoConsultOverlay appointmentId={overlay.appointmentId} onClose={closeOverlay} />
              ) : overlay.kind === 'case' ? (
                <MobileCaseSheet patientId={overlay.patientId} onBack={closeOverlay} onPrescribe={() => exitOverlayToRx(overlay.patientId)} />
              ) : overlay.kind === 'compare' ? (
                <MobileFollowUp patientId={overlay.patientId} onBack={closeOverlay} onDone={closeOverlay} />
              ) : overlay.kind === 'chat' ? (
                <ChatOverlay patientId={overlay.patientId} patientName={overlay.patientName} onBack={closeOverlay} />
              ) : overlay.kind === 'investigations' ? (
                <QuickInvestigationScreen patientId={overlay.patientId} onBack={closeOverlay} />
              ) : (
                <PatientDetailScreen
                  patientId={overlay.patientId}
                  onBack={closeOverlay}
                  onOpenCase={(id) => pushOverlay({ kind: 'case', patientId: id })}
                  onOpenFollowUp={(id) => pushOverlay({ kind: 'compare', patientId: id })}
                  onPrescribe={() => exitOverlayToRx(overlay.patientId)}
                  onOrderInvestigations={() => pushOverlay({ kind: 'investigations', patientId: overlay.patientId })}
                  onStartVideo={(apptId) => pushOverlay({ kind: 'video', appointmentId: apptId })}
                />
              )}
            </EdgeSwipeBack>
            )}
          </GuardedMotionDiv>
        )}
      </AnimatePresence>

      <ProfileSheet open={switchOpen} onClose={() => setSwitchOpen(false)} />
      <PatientSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(id) => { setSearchOpen(false); openOverlay({ kind: 'patient-detail', patientId: id }) }}
        onAddPatient={() => { setSearchOpen(false); setAddPatientOpen(true) }}
        quickView={{
          onOpenCase: (id) => { setSearchOpen(false); openOverlay({ kind: 'case', patientId: id }) },
          onPrescribe: (id) => { setSearchOpen(false); goToRx(id) },
        }}
      />
      <AddPatientSheet
        open={addPatientOpen}
        onClose={() => setAddPatientOpen(false)}
        onAdded={(id) => { setAddPatientOpen(false); openOverlay({ kind: 'case', patientId: id }) }}
        onOpenExisting={(id) => { setAddPatientOpen(false); openOverlay({ kind: 'patient-detail', patientId: id }) }}
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
          <Suspense fallback={<VideoConsultFallback />}>
            <VideoConsult
              patientName={guestMeeting.guestName || 'Guest'}
              practitionerName={doctor?.name ?? 'Doctor'}
              appointmentId={guestMeeting.id}
              onEnd={() => setGuestMeeting(null)}
            />
          </Suspense>
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
            <div className="text-[12px] text-faint">Reg. {doctor.registrationNo}</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] border border-border bg-surface px-2 py-3 text-center">
            <s.icon size={18} weight="fill" className="mx-auto text-brand" />
            <div className="mt-1 font-display text-[16px] font-bold text-ink">{s.value}</div>
            <div className="text-[12px] text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <div className="rounded-[14px] border border-border bg-surface px-4 py-3">
          <div className="text-[12px] font-semibold uppercase tracking-label text-muted">Remedy list</div>
          <div className="mt-1 text-[13px] text-body">{doctor.remedyList.length} remedies configured</div>
        </div>
      </div>

      <div className="mt-2">
        <AppInfoRow />
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

  // A test that isn't in the preset list yet (new investigations come up): she
  // can add it as her own line, and it prints under "Other / specify" like any other.
  const trimmedQuery = query.trim()
  const canAddCustom =
    trimmedQuery.length > 1 &&
    !selected.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !ALL_INVESTIGATIONS.some(({ test }) => test.toLowerCase() === trimmedQuery.toLowerCase())

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
    await (await import('../core/pdfExport')).exportInvestigationOrderPdf(order, patient).catch(() => {
      toast({ title: 'PDF export failed', message: 'Please try again.' })
    })
    toast({ title: 'Investigation slip generated', message: `${selected.length} test${selected.length === 1 ? '' : 's'} for ${patient.name}.` })
    onBack()
  }

  return (
    <div className="flex h-full flex-col bg-screen">
      <div className="px-[18px] pb-2 pt-[var(--app-top)]">
        <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
          <CaretLeft size={18} className="text-body" />
        </Pressable>
        <div className="mt-1 font-display text-[18px] font-bold text-ink">Investigations</div>
        <div className="text-[12px] text-faint">{patient.name} · investigation request</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-[18px] pb-[120px] pt-2">
        <div>
          <Label>Add investigation</Label>
          <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5">
            <MagnifyingGlass size={16} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing — CBC, thyroid, vitamin d…"
              className="w-full bg-transparent py-3 text-[13px] outline-none placeholder:text-faint"
              data-selectable="true"
            />
          </div>
          {(matches.length > 0 || canAddCustom) && (
            <div className="mt-2 space-y-1.5">
              {matches.map(({ test, category }) => (
                <Pressable
                  key={test}
                  hap="none"
                  onClick={() => { toggleTest(test); setQuery('') }}
                  className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-left"
                >
                  <span className="text-[13px] font-semibold text-ink">{test}</span>
                  <span className="shrink-0 text-[12px] text-faint">{category}</span>
                </Pressable>
              ))}
              {canAddCustom && (
                <Pressable
                  hap="none"
                  onClick={() => { haptic('select'); setSelected((s) => [...s, trimmedQuery]); setQuery('') }}
                  className="flex w-full items-center gap-2 rounded-[12px] border border-dashed border-border bg-surface px-3.5 py-2.5 text-left"
                >
                  <Plus size={14} className="text-brand" />
                  <span className="text-[13px] font-semibold text-ink">Add &quot;{trimmedQuery}&quot; as a custom test</span>
                </Pressable>
              )}
            </div>
          )}
        </div>

        <div>
          <Label>Selected{selected.length > 0 ? ` (${selected.length})` : ''}</Label>
          {selected.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-faint">Nothing added yet — search above to add tests. Not in the list? Type its name and add it as your own test.</p>
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
          <Label>Note on the request</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — e.g. fasting sample required"
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
        <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center">
          <CaretLeft size={20} weight="bold" className="text-white" />
        </Pressable>
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 font-display text-[14px] font-semibold text-white">
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-display text-[16px] font-semibold text-white">{patientName}</div>
          <div className="text-[12px] text-white/70">Patient</div>
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
  const notifs = useClinic(useShallow((s) => s.notifications.filter((n) => n.surface === 'web' || n.surface === 'practitioner')))
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
        <Pressable hap="tick" onClick={() => setView('chats')} className={`relative tap-pad-y4 flex-1 rounded-pill py-2.5 text-center text-[13px] font-semibold transition ${view === 'chats' ? 'bg-brand text-screen' : 'border border-border bg-surface text-body'}`}>
          Chats{totalUnread > 0 ? ` (${totalUnread})` : ''}
        </Pressable>
        <Pressable hap="tick" onClick={() => setView('alerts')} className={`relative tap-pad-y4 flex-1 rounded-pill py-2.5 text-center text-[13px] font-semibold transition ${view === 'alerts' ? 'bg-brand text-screen' : 'border border-border bg-surface text-body'}`}>
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
                          <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{c.unread}</span>
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
                  {/* a <div>, not the default <button>: a button shrinks to its text and centres it, which left this
                      card narrower than the screen with centred text (and it holds its own buttons below) */}
                  <Pressable
                    as="div"
                    hap="tick"
                    className="cursor-pointer"
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
                          <div className="mt-1 text-[12px] text-faint">{n.time}</div>
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
    <Suspense fallback={<VideoConsultFallback />}>
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
    </Suspense>
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
        <WhatsAppIcon size={17} /> Share via WhatsApp
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
function TabBar({ tab, onChange, inboxCount }: { tab: Tab; onChange: (t: Tab) => void; inboxCount: number }) {
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
        const badge = it.id === 'inbox' ? inboxCount : 0
        return (
          <Pressable key={it.id} as="div" hap="tick" scale={0.9} onClick={() => onChange(it.id)} ariaLabel={badge > 0 ? `${it.label}, ${badge} unread` : undefined} className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-1">
            <span className="relative flex h-9 w-14 items-center justify-center">
              {on && <motion.span layoutId="prac-tab" className="absolute inset-0 rounded-pill bg-tint-pale" transition={spring} />}
              <span className={`relative ${on ? 'text-brand' : 'text-faint'}`}><it.icon size={21} weight={on ? 'fill' : 'regular'} /></span>
              <AnimatePresence>
                {badge > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={springSnappy}
                    className="absolute right-1.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface"
                  >
                    <TickNumber value={Math.min(badge, 99)} />{badge > 99 ? '+' : ''}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className={`text-[11px] font-medium ${on ? 'text-brand' : 'text-faint'}`}>{it.label}</span>
          </Pressable>
        )
      })}
    </div>
  )
}
