import { useEffect, useState } from 'react'

// The running consult timer used to start counting at the moment the Today
// screen mounted, so closing the app (or the phone closing it) mid-consult
// sent it back to 0:00 while the consult was still going. The start moment is
// now kept on the device, per appointment, and elapsed time is always worked
// out from it — so it stays right across restarts, tab switches and the
// background timers phones slow down.
//
// Limits: it is stored on this device only. A consult started on another
// device is measured from when this one first noticed it.
const PREFIX = 'sneham-consult-start:'
const MAX_AGE_MS = 12 * 60 * 60 * 1000 // a consult never runs this long; guards against a leftover from a crash

export function noteConsultStart(appointmentId: string, at = Date.now()) {
  try { localStorage.setItem(PREFIX + appointmentId, String(at)) } catch { /* storage unavailable */ }
}

export function consultStartedAt(appointmentId: string): number | null {
  try {
    const raw = localStorage.getItem(PREFIX + appointmentId)
    if (!raw) return null
    const at = Number(raw)
    if (!Number.isFinite(at) || Date.now() - at > MAX_AGE_MS || at > Date.now() + 60_000) {
      localStorage.removeItem(PREFIX + appointmentId)
      return null
    }
    return at
  } catch { return null }
}

export function clearConsultStart(appointmentId: string) {
  try { localStorage.removeItem(PREFIX + appointmentId) } catch { /* storage unavailable */ }
}

// 3:07 under an hour, 1:03:07 after.
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// Seconds since the consult for `appointmentId` started; 0 when there isn't one.
export function useConsultElapsed(appointmentId: string | undefined): number {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!appointmentId) { setStartedAt(null); return }
    let start = consultStartedAt(appointmentId)
    if (start == null) { start = Date.now(); noteConsultStart(appointmentId, start) }
    setStartedAt(start)
    setNow(Date.now())
    const tick = () => setNow(Date.now())
    const t = setInterval(tick, 1000)
    // Phones slow timers in the background; catch up the moment we're visible.
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [appointmentId])

  if (!appointmentId || startedAt == null) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}
