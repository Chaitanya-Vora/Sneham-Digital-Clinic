import { useEffect, useRef } from 'react'

// Unsent text survives the phone killing the app in the background (common on
// some Android skins) or a reload: it is kept on the device, written within
// half a second of typing and immediately when the app is hidden, and cleared
// the moment it is saved/sent. Stored locally only — nothing here is synced.
const PREFIX = 'sneham-draft:'
const RESUME_KEY = 'sneham-resume'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const stored = JSON.parse(raw) as { v: T; t: number }
    if (Date.now() - stored.t > MAX_AGE_MS) { localStorage.removeItem(PREFIX + key); return null }
    return stored.v
  } catch { return null }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(PREFIX + key) } catch { /* storage unavailable */ }
}

function writeDraft<T>(key: string, value: T) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now() })) } catch { /* storage full/unavailable */ }
}

// Keeps `value` saved while `active` (there is something worth keeping), and
// clears it otherwise.
export function useDraftWriter<T>(key: string, value: T, active: boolean) {
  const latest = useRef({ value, active })
  latest.current = { value, active }
  useEffect(() => {
    if (!active) { clearDraft(key); return }
    const t = setTimeout(() => writeDraft(key, value), 400)
    return () => clearTimeout(t)
    // value is compared by reference; callers pass a fresh object each change
  }, [key, value, active])
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && latest.current.active) writeDraft(key, latest.current.value)
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush) }
  }, [key])
}

// "Where I was" — only ever set while a screen holds unsaved text, and cleared
// on any normal exit, so it survives only an abrupt app kill.
export interface ResumePointer { kind: 'compare'; patientId: string; t: number }
export function setResume(p: Omit<ResumePointer, 't'>) {
  try { localStorage.setItem(RESUME_KEY, JSON.stringify({ ...p, t: Date.now() })) } catch { /* ignore */ }
}
export function clearResume() {
  try { localStorage.removeItem(RESUME_KEY) } catch { /* ignore */ }
}
export function readResume(maxAgeMs = 30 * 60 * 1000): ResumePointer | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as ResumePointer
    if (Date.now() - p.t > maxAgeMs) { clearResume(); return null }
    return p
  } catch { return null }
}
