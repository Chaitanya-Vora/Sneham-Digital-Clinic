import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { ErrorBoundary } from './design-system/ErrorBoundary'
import { AuthProvider } from './auth/AuthProvider'
import { AuthGate } from './auth/AuthGate'
import App from './App'
import './index.css'

if (Capacitor.isNativePlatform()) {
  SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <App />
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

if (Capacitor.isNativePlatform()) {
  void (async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations()
      await Promise.all((regs ?? []).map((r) => r.unregister()))
      const keys = await caches?.keys()
      await Promise.all((keys ?? []).map((k) => caches.delete(k)))
    } catch { /* ignore */ }
  })()
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
