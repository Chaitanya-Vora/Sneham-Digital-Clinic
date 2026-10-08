import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

declare const __APP_BUILD__: { version: string; sha: string; date: string; number: number }

// A small black-box recorder. It keeps the last ~160 events — app start, going
// to the background and coming back, "restarted after being closed by the
// system", keyboard/viewport changes, long freezes, errors, data refreshes —
// so when something odd happens on a real phone there is evidence instead of
// guesswork. Screen names and timings only: no patient names, ids, or text.
// It never leaves the device unless the user taps "Share diagnostics".
const KEY = 'sneham-diag'
const LIFE_KEY = 'sneham-diag-life'
const MAX = 160

interface Entry { t: number; k: string; d?: string }

function load(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Entry[] } catch { return [] }
}

let buf: Entry[] = load()
let timer: ReturnType<typeof setTimeout> | null = null
let started = false

function save() {
  timer = null
  try { localStorage.setItem(KEY, JSON.stringify(buf)) } catch { /* storage full/unavailable */ }
}
function scheduleSave() { if (!timer) timer = setTimeout(save, 1500) }

// Strip anything that could identify a person from free text (error messages).
function clean(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d{6,}/g, '<num>')
    .slice(0, 160)
}

export function diag(kind: string, detail?: string) {
  buf.push({ t: Date.now(), k: kind, d: detail ? clean(detail) : undefined })
  if (buf.length > MAX) buf.splice(0, buf.length - MAX)
  scheduleSave()
}

function setLife(state: 'active' | 'background') {
  try { localStorage.setItem(LIFE_KEY, JSON.stringify({ s: state, t: Date.now() })) } catch { /* ignore */ }
}

function viewportInfo(): string {
  const vv = window.visualViewport
  return `inner=${innerWidth}x${innerHeight} vv=${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} off=${Math.round(vv.offsetTop)}` : 'n/a'} scroll=${Math.round(scrollX)},${Math.round(scrollY)}`
}

// ── Test tools (only offered in test builds): a frame sampler that sees small hitches the
// freeze log below cannot, and two switches to turn off effects suspected of causing them. ──
export type TestFlag = 'noblur' | 'nofade'
export function testFlag(name: TestFlag): boolean {
  try { return localStorage.getItem(`sneham-test-${name}`) === '1' } catch { return false }
}
export function applyTestFlags() {
  document.documentElement.toggleAttribute('data-test-noblur', testFlag('noblur'))
}
export function setTestFlag(name: TestFlag, on: boolean) {
  try { if (on) localStorage.setItem(`sneham-test-${name}`, '1'); else localStorage.removeItem(`sneham-test-${name}`) } catch { /* ignore */ }
  applyTestFlags()
  diag('test', `${name}=${on ? 'on' : 'off'}`)
}

// Watches the screen for a short window and writes one line: how many frames took longer than
// 25ms (a visible hitch on a 90/120Hz phone) and the worst one. Only runs for the window asked.
let sampling = false
export function sampleFrames(label: string, ms = 1500) {
  if (sampling || typeof document === 'undefined' || document.visibilityState !== 'visible') return
  sampling = true
  const t0 = performance.now()
  let last = t0, worst = 0, slow = 0, frames = 0
  const step = (now: number) => {
    const dt = now - last
    last = now
    frames++
    if (frames > 1) { if (dt > worst) worst = dt; if (dt > 25) slow++ }
    if (now - t0 < ms) requestAnimationFrame(step)
    else { sampling = false; diag('frames', `${label}: ${frames} frames, ${slow} slow(>25ms), worst ${Math.round(worst)}ms`) }
  }
  requestAnimationFrame(step)
}

export function initDiagnostics() {
  if (started) return
  started = true
  applyTestFlags()
  setTimeout(() => sampleFrames('launch', 8000), 0)

  // Was the last run closed normally, or did the system take it away?
  let prev: { s: string; t: number } | null = null
  try { prev = JSON.parse(localStorage.getItem(LIFE_KEY) || 'null') } catch { /* ignore */ }
  const ua = navigator.userAgent
  const webview = (ua.match(/Chrome\/([\d.]+)/) || [])[1] ?? 'unknown'
  const nav = navigator as Navigator & { deviceMemory?: number }
  diag('start', `v${__APP_BUILD__.version} ${__APP_BUILD__.sha} ${Capacitor.getPlatform()} webview=${webview} cores=${navigator.hardwareConcurrency ?? '?'} mem=${nav.deviceMemory ?? '?'}GB dpr=${devicePixelRatio} ${viewportInfo()}`)
  if (prev) {
    const secs = Math.round((Date.now() - prev.t) / 1000)
    diag('relaunch', prev.s === 'background'
      ? `fresh start ${secs}s after the app went to the background — most likely closed by the system`
      : `previous run ended while in the foreground ${secs}s ago — crash, swipe-away, or reload`)
  }
  setLife('active')

  const onState = (active: boolean) => { diag('app', active ? 'foreground' : 'background'); setLife(active ? 'active' : 'background'); if (!active) save() }
  document.addEventListener('visibilitychange', () => onState(document.visibilityState === 'visible'))
  window.addEventListener('pagehide', () => { setLife('background'); save() })
  if (Capacitor.isNativePlatform()) void CapApp.addListener('appStateChange', ({ isActive }) => onState(isActive))

  // Keyboard / viewport — the suspected source of "stuck" screens on Android.
  const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
  document.addEventListener('focusin', (e) => { if (isField(e.target)) diag('focus', `in ${(e.target as HTMLElement).tagName.toLowerCase()} ${viewportInfo()}`) })
  document.addEventListener('focusout', (e) => { if (isField(e.target)) diag('blur', viewportInfo()) })
  let vvTimer: ReturnType<typeof setTimeout> | null = null
  window.visualViewport?.addEventListener('resize', () => {
    if (vvTimer) clearTimeout(vvTimer)
    vvTimer = setTimeout(() => diag('viewport', viewportInfo()), 200)
  })

  // TEST: does a long-press paste actually reach the page? Records only the kind of field and how
  // many characters arrived — never the text itself.
  const fieldName = (t: EventTarget | null) => (t instanceof HTMLElement ? `${t.tagName.toLowerCase()}${(t as HTMLInputElement).type ? `:${(t as HTMLInputElement).type}` : ''}` : '?')
  document.addEventListener('paste', (e) => diag('paste', `paste event in ${fieldName(e.target)} chars=${(e.clipboardData?.getData('text') ?? '').length}`), true)
  document.addEventListener('beforeinput', (e) => { if ((e as InputEvent).inputType === 'insertFromPaste') diag('paste', `beforeinput insertFromPaste in ${fieldName(e.target)}`) }, true)
  document.addEventListener('contextmenu', (e) => diag('contextmenu', `long-press menu event in ${fieldName(e.target)}`), true)

  // Errors (messages are scrubbed of ids/emails/long numbers).
  window.addEventListener('error', (e) => diag('error', e.message))
  window.addEventListener('unhandledrejection', (e) => diag('rejection', String((e.reason && (e.reason.message || e.reason)) ?? 'unknown')))

  // Long freezes (Long Animation Frames where the WebView supports them).
  let longCount = 0
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<PerformanceEntry & { blockingDuration?: number; scripts?: Array<{ sourceURL?: string; sourceFunctionName?: string }> }>) {
        if (entry.duration < 50 || longCount >= 80) continue
        longCount++
        const src = (entry.scripts ?? []).slice(0, 2).map((s) => `${(s.sourceURL ?? '').split('/').pop()?.split('?')[0] ?? ''}:${s.sourceFunctionName ?? ''}`).join(' ')
        diag('long-frame', `${Math.round(entry.duration)}ms blocking=${Math.round(entry.blockingDuration ?? 0)} ${src}`)
      }
    }).observe({ type: 'long-animation-frame', buffered: false } as PerformanceObserverInit)
  } catch { /* not supported on this WebView */ }

  // UI health: leftover screens or an unexpected scroll offset.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return
    const overlays = document.querySelectorAll('div.absolute.inset-0.z-40').length
    if (overlays > 1 || scrollX !== 0) diag('health', `overlays-mounted=${overlays} scrollX=${Math.round(scrollX)}`)
  }, 8000)
}

export function getDiagnosticsText(): string {
  save()
  const b = __APP_BUILD__
  const head = [
    `Sneham diagnostics — v${b.version} (${b.sha}) built ${b.date}`,
    `Platform: ${Capacitor.getPlatform()} · ${navigator.userAgent}`,
    `Screen: ${screen.width}x${screen.height} @${devicePixelRatio}x · now ${new Date().toISOString()}`,
    'No patient information is recorded here — only timings, screen names and device details.',
    '',
  ]
  const lines = buf.map((e) => `${new Date(e.t).toISOString().slice(11, 23)}  ${e.k.padEnd(11)} ${e.d ?? ''}`)
  return [...head, ...lines].join('\n')
}
