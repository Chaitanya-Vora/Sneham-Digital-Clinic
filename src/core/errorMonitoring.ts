import * as Sentry from '@sentry/capacitor'
import * as SentryReact from '@sentry/react'

// Off by default — no DSN means no network calls, no behavior change at all.
// Set VITE_SENTRY_DSN (from sentry.io → Settings → Client Keys) to turn this
// on; nothing else in the app needs to change.
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const SURFACE = (import.meta.env.VITE_DEFAULT_SURFACE as string | undefined) ?? 'web'

export function initErrorMonitoring() {
  if (!DSN) return
  Sentry.init(
    {
      dsn: DSN,
      environment: import.meta.env.PROD ? 'production' : 'development',
      beforeSend(event) {
        event.tags = { ...event.tags, surface: SURFACE }
        return event
      },
    },
    SentryReact.init,
  )
}

// Called from ErrorBoundary.componentDidCatch — a no-op until a DSN is set,
// same as initErrorMonitoring above.
export function reportError(error: Error, componentStack?: string | null) {
  if (!DSN) return
  Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined)
}
