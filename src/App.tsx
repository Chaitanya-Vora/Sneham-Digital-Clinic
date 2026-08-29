import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Stethoscope, User, Monitor, SignOut, QrCode, X } from '@phosphor-icons/react'
import QRCode from 'qrcode'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useAuth } from './auth/AuthProvider'
import { UpdatePrompt } from './design-system/UpdatePrompt'
import type { Surface } from './core/types'
import { useClinic } from './core/store'
import { useShell } from './core/shell'
import { SnehamMark, SnehamLockup } from './design-system/Logo'
import { PhoneFrame } from './design-system/ui'
import { Onboarding } from './web/Onboarding'

// Each surface is only ever needed by one deployment at a time — the web
// build never needs the practitioner/patient app code and vice versa — so
// they're code-split instead of all three shipping in one bundle.
const WebApp = lazy(() => import('./web/WebApp').then((m) => ({ default: m.WebApp })))
const PractitionerApp = lazy(() => import('./practitioner/PractitionerApp').then((m) => ({ default: m.PractitionerApp })))
const PatientApp = lazy(() => import('./patient/PatientApp').then((m) => ({ default: m.PatientApp })))

function SurfaceFallback() {
  return (
    <div className="flex h-full min-h-[100dvh] items-center justify-center bg-screen">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
    </div>
  )
}

function useSurfaces() {
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const patients = useClinic((s) => s.patients)
  const firstPatient = patients[0]
  return [
    { value: 'web' as Surface, label: 'Clinic web', caption: 'Full practice console' },
    { value: 'practitioner' as Surface, label: 'Practitioner', caption: doctor?.name ?? 'Doctor' },
    { value: 'patient' as Surface, label: 'Patient', caption: firstPatient?.name ?? 'Patient' },
  ]
}

// Set on the production web deployment's Vercel env (VITE_DEFAULT_SURFACE=web)
// so a doctor handed this URL sees only the practice console — no dev-only
// surface toggle, no "preview the mobile apps" launcher. Local dev leaves
// this unset, so the toggle still works for testing all three surfaces.
const FIXED_SURFACE = (import.meta.env.VITE_DEFAULT_SURFACE as Surface | undefined) || null

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

export default function App() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const hydrate = useClinic((s) => s.hydrate)
  const hydrated = useClinic((s) => s.hydrated)
  const resetDailyDoses = useClinic((s) => s.resetDailyDoses)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {})
      StatusBar.setBackgroundColor({ color: '#EFEDE4' }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.full_name || user.email || 'Doctor'
      hydrate(user.id, name)
    }
  }, [user, hydrate, hydrated])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') resetDailyDoses()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [resetDailyDoses])

  return (
    <>
      <UpdatePrompt />
      {isMobile ? <MobileShell /> : <DesktopShell />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Mobile: a real full-screen app experience (for scanning on a phone)
// ─────────────────────────────────────────────────────────────
function MobileShell() {
  const surface = useShell((s) => s.surface)
  const setSurface = useShell((s) => s.setSurface)

  if (!surface) return <Launcher onPick={setSurface} />

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-screen">
      <Suspense fallback={<SurfaceFallback />}>
        {surface === 'web' ? <WebApp /> : surface === 'practitioner' ? <PractitionerApp /> : <PatientApp />}
      </Suspense>
    </div>
  )
}

function Launcher({ onPick }: { onPick: (s: Surface) => void }) {
  const { signOut } = useAuth()
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const firstPatient = useClinic((s) => s.patients[0])
  const cards: { value: Surface; label: string; desc: string; icon: any; note?: string }[] = [
    { value: 'patient', label: 'Patient app', desc: `${firstPatient?.name ?? 'Patient'} · appointments, remedies, dose reminders`, icon: User },
    { value: 'practitioner', label: 'Practitioner app', desc: `${doctor?.name ?? 'Doctor'} · today, case sheets, prescribe`, icon: Stethoscope },
    { value: 'web', label: 'Clinic web', desc: 'Full practice console · best on a larger screen', icon: Monitor, note: 'Optimised for desktop' },
  ]
  return (
    <div className="min-h-[100dvh] bg-canvas px-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 48px)' }}>
      <SnehamLockup />
      <h1 className="mt-8 font-display text-[26px] font-bold leading-tight text-ink">Choose an experience</h1>
      <p className="mt-1 text-[14px] text-muted">All surfaces share one live dataset — changes appear everywhere instantly.</p>

      <div className="mt-6 space-y-3">
        {cards.map((c) => (
          <button
            key={c.value}
            onClick={() => onPick(c.value)}
            className="flex w-full items-center gap-4 rounded-[22px] border border-border bg-surface px-5 py-4 text-left shadow-card transition active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint text-brand">
              <c.icon size={24} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="font-display text-[16px] font-bold text-ink">{c.label}</div>
              <div className="text-[12.5px] leading-snug text-muted">{c.desc}</div>
              {c.note && <div className="mt-1 text-[11px] font-semibold text-amber-text">{c.note}</div>}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <button onClick={signOut} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger">
          <SignOut size={14} weight="bold" /> Sign out
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Desktop: side-by-side surface switcher with device frames
// ─────────────────────────────────────────────────────────────
function DesktopShell() {
  const [surface, setSurface] = useState<Surface>(FIXED_SURFACE ?? 'web')
  const [qrOpen, setQrOpen] = useState(false)
  const { user, signOut } = useAuth()
  const surfaces = useSurfaces()
  const active = surfaces.find((s) => s.value === surface)!
  const hydrated = useClinic((s) => s.hydrated)
  const patients = useClinic((s) => s.patients)
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const [onboarded, setOnboarded] = useState(false)

  const needsOnboarding = hydrated && patients.length === 0 && doctor && !onboarded && (
    doctor?.name === user?.email || doctor?.name === 'Doctor' || !doctor?.qualifications
  )

  if (needsOnboarding) {
    return <Onboarding onDone={() => setOnboarded(true)} />
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="sticky top-0 z-[90] flex items-center justify-between gap-4 border-b border-border/70 bg-canvas/85 px-5 py-2.5 backdrop-blur">
        {/* WebApp's own sidebar already shows the Sneham mark — showing it
            here too, directly above it, was pure duplication. */}
        {surface === 'web' ? <div /> : (
          <div className="flex items-center gap-2.5">
            <SnehamMark size={28} />
            <span className="font-display text-[13px] font-semibold text-ink">Sneham Digital Clinic</span>
          </div>
        )}
        {!FIXED_SURFACE && (
          <div className="inline-flex rounded-pill bg-screen p-1">
            {surfaces.map((s) => (
              <button
                key={s.value}
                onClick={() => setSurface(s.value)}
                className={`rounded-pill px-4 py-1.5 text-[13px] font-body font-semibold transition ${
                  surface === s.value ? 'bg-brand text-screen shadow-sm' : 'text-muted hover:text-body'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden text-[12px] text-muted lg:inline">
              {user.user_metadata?.full_name || user.email}
            </span>
          )}
          {!FIXED_SURFACE && (
            <button
              onClick={() => setQrOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-body"
              title="Install on phone"
            >
              <QrCode size={14} weight="bold" /> Install
            </button>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-danger"
            title="Sign out"
          >
            <SignOut size={14} weight="bold" /> Sign out
          </button>
        </div>
      </div>

      <Suspense fallback={<SurfaceFallback />}>
        {surface === 'web' ? (
          <WebApp />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-8">
            <div className="text-center">
              <div className="font-display text-[15px] font-semibold text-ink">{active.label}</div>
              <div className="text-[12px] text-faint">{active.caption}</div>
            </div>
            <PhoneFrame>{surface === 'practitioner' ? <PractitionerApp /> : <PatientApp />}</PhoneFrame>
          </div>
        )}
      </Suspense>

      <QRInstallModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  )
}

function QRInstallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!open || !canvasRef.current) return
    const url = `http://${window.location.hostname}:${window.location.port}`
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: { dark: '#41603C', light: '#FCFBF6' },
    })
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-[360px] rounded-3xl border border-border bg-surface p-8 text-center shadow-modal animate-pop"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-body">
          <X size={20} />
        </button>
        <h2 className="font-display text-[22px] font-bold text-ink">Install on your phone</h2>
        <p className="mt-1 text-[13px] text-muted">Scan with your phone camera</p>
        <div className="mx-auto mt-6 inline-block rounded-2xl border border-border bg-raised p-4">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-tint px-4 py-2 text-[13px] font-semibold text-brand">
          {window.location.hostname}:{window.location.port}
        </div>
        <div className="mt-4 space-y-2 text-left text-[13px] text-body">
          <p><span className="font-semibold text-ink">1.</span> Scan the QR with your phone camera</p>
          <p><span className="font-semibold text-ink">2.</span> Open in Chrome on your phone</p>
          <p><span className="font-semibold text-ink">3.</span> Tap <span className="font-semibold">Add to Home Screen</span> from the menu</p>
        </div>
        <p className="mt-4 text-[11px] text-faint">Same WiFi network required. Shake your phone to check for updates.</p>
      </div>
    </div>,
    document.body,
  )
}
