import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { supabase } from './supabase'
import { diag } from './diagnostics'
import { parseManifest, decideUpdate } from './liveUpdateRules'

// Live updates: fixes to the app's screens reach the phones without a new APK.
//
//  - The owner publishes a signed web bundle (scripts/release-ota.sh) to a
//    public Supabase Storage bucket, plus a small manifest saying what is
//    newest. See docs/LIVE_UPDATES.md.
//  - The phone checks the manifest at launch and when it has been in the
//    background a while, downloads the bundle, and the native plugin REFUSES it
//    unless it carries a valid signature from this app's own key (baked into the
//    APK; the private key never leaves the owner's Mac).
//  - It is applied the next time the app starts — or right when you come back
//    to the app after a while away, or from Profile → "Restart to update".
//  - If an update fails to start properly, the plugin puts the app back on the
//    version inside the APK and never retries that update.
//
// Only HTML/CSS/JS can change this way. Anything native needs a new APK, which
// is what `minNativeVersionCode` in the manifest guards.
//
// Every step is wrapped: a failure here must never be able to affect the app.

declare const __APP_BUILD__: { version: string; sha: string; date: string; number: number }

const SURFACE = import.meta.env.VITE_DEFAULT_SURFACE as string | undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHECK_EVERY_MS = 15 * 60 * 1000 // at most this often when coming back to the app
const APPLY_AFTER_AWAY_MS = 5 * 60 * 1000 // applied on return only if you were away this long (a new "session")
const FIRST_CHECK_DELAY_MS = 6000 // let the app load its data first


export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'downloading' }
  | { kind: 'ready'; build: number } // downloaded and verified; applies on next start
  | { kind: 'needs-new-app' } // the update needs a newer APK than this phone has

let status: UpdateStatus = { kind: 'idle' }
const listeners = new Set<() => void>()
const setStatus = (s: UpdateStatus) => { status = s; listeners.forEach((l) => l()) }
export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => status)
}

export const liveUpdatesEnabled = () =>
  Capacitor.isNativePlatform() && (SURFACE === 'practitioner' || SURFACE === 'patient') && Boolean(SUPABASE_URL)

const baseUrl = () => `${SUPABASE_URL}/storage/v1/object/public/ota/${SURFACE}`

let checking = false
let lastCheckAt = 0

export async function checkForLiveUpdate(): Promise<void> {
  if (!liveUpdatesEnabled() || checking) return
  if (status.kind === 'ready' || status.kind === 'downloading') return
  checking = true
  lastCheckAt = Date.now()
  try {
    const res = await fetch(`${baseUrl()}/manifest.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) { diag('update', `no manifest (${res.status})`); return }
    const manifest = parseManifest(await res.json())
    if (!manifest) { diag('update', 'manifest ignored (unexpected shape)'); return }

    const { LiveUpdate } = await import('@capawesome/capacitor-live-update')
    const [{ versionCode }, { bundleIds: blocked }, { bundleIds: have }] = await Promise.all([
      LiveUpdate.getVersionCode(), LiveUpdate.getBlockedBundles(), LiveUpdate.getDownloadedBundles(),
    ])
    const decision = decideUpdate({ manifest, runningBuild: __APP_BUILD__.number, appVersionCode: Number(versionCode), blockedBundleIds: blocked, downloadedBundleIds: have })
    if (decision.action === 'ignore') { if (decision.reason !== 'not newer') diag('update', `build ${manifest.build} skipped: ${decision.reason}`); return }
    if (decision.action === 'needs-new-app') { diag('update', `build ${manifest.build} ${decision.reason}`); setStatus({ kind: 'needs-new-app' }); return }

    setStatus({ kind: 'downloading' })
    if (decision.needsDownload) {
      const started = Date.now()
      await LiveUpdate.downloadBundle({ url: `${baseUrl()}/${manifest.file}`, bundleId: manifest.bundleId, signature: manifest.signature })
      diag('update', `downloaded build ${manifest.build} in ${Date.now() - started}ms`)
    }
    await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId })
    setStatus({ kind: 'ready', build: manifest.build })
    diag('update', `build ${manifest.build} ready for next start`)
  } catch (e) {
    setStatus({ kind: 'idle' })
    diag('update', `check failed: ${e instanceof Error ? e.message : 'unknown'}`)
  } finally {
    checking = false
  }
}

// Switches to the downloaded version now. Live connections are closed first —
// the web view is reloaded in place, and an open connection can stop the new
// version from starting. In-progress text is already kept by the draft vault.
export async function applyLiveUpdateNow(): Promise<void> {
  if (!liveUpdatesEnabled() || status.kind !== 'ready') return
  try {
    diag('update', 'applying now')
    await supabase.removeAllChannels()
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update')
    await LiveUpdate.reload()
  } catch (e) {
    diag('update', `apply failed: ${e instanceof Error ? e.message : 'unknown'}`)
  }
}

let started = false
export function initLiveUpdates() {
  if (started || !liveUpdatesEnabled()) return
  started = true
  void (async () => {
    try {
      const { LiveUpdate } = await import('@capawesome/capacitor-live-update')
      // As early as possible: tells the plugin this version started fine, which
      // cancels its automatic roll-back timer.
      const r = await LiveUpdate.ready()
      diag('update', `started build ${__APP_BUILD__.number}${r.currentBundleId ? ` (live update ${r.currentBundleId})` : ' (built into the app)'}${r.rollback ? ' — ROLLED BACK to the built-in version' : ''}`)
    } catch (e) {
      diag('update', `ready() failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }

    setTimeout(() => void checkForLiveUpdate(), FIRST_CHECK_DELAY_MS)

    let awaySince = 0
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) { awaySince = Date.now(); return }
      const away = awaySince ? Date.now() - awaySince : 0
      awaySince = 0
      // Back after a while with an update waiting: switch now, unless she is
      // in the middle of typing.
      const el = document.activeElement
      const typing = el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      if (status.kind === 'ready' && away >= APPLY_AFTER_AWAY_MS && !typing) { void applyLiveUpdateNow(); return }
      if (Date.now() - lastCheckAt >= CHECK_EVERY_MS) void checkForLiveUpdate()
    })
  })()
}
