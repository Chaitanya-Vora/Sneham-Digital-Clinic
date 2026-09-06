import { Component, type ErrorInfo, type ReactNode } from 'react'

// Every deploy renames every JS chunk (content-hashed filenames). A tab left
// open across a deploy is still holding the old filenames, so the next
// lazy-loaded surface (App.tsx's WebApp/PractitionerApp/PatientApp) 404s
// fetching a chunk that no longer exists — this is the "keeps crashing,
// have to keep clicking Restart app" report. A single reload fetches the
// current index.html, which points at the current chunks, and silently
// fixes it — so we do that automatically instead of showing an error.
const CHUNK_LOAD_ERROR = /fetch dynamically imported module|loading dynamically imported module|importing a module script failed|loading chunk/i
const RELOAD_GUARD_KEY = 'sneham:chunk-reload-at'
const RELOAD_GUARD_WINDOW_MS = 15000

function alreadyTriedReload() {
  const at = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
  return Date.now() - at < RELOAD_GUARD_WINDOW_MS
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
    if (CHUNK_LOAD_ERROR.test(error.message) && !alreadyTriedReload()) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
      window.location.reload()
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    // Reload is already in flight (or about to be, from componentDidCatch
    // above) — show a quiet loading state instead of an alarming error.
    if (CHUNK_LOAD_ERROR.test(this.state.error.message) && !alreadyTriedReload()) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-canvas px-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-brand" />
          <div className="text-[13px] text-muted">Loading the latest version…</div>
        </div>
      )
    }

    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-8 text-center">
        <div className="font-display text-[19px] font-bold text-ink">Something went wrong</div>
        <div className="max-w-[300px] text-[13px] text-muted">{this.state.error.message}</div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload() }}
          className="rounded-pill bg-brand px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          Restart app
        </button>
      </div>
    )
  }
}
