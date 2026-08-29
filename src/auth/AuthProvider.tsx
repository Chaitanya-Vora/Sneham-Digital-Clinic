import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from '../core/supabase'

interface AuthCtx {
  user: User | null
  session: Session | null
  loading: boolean
  oauthError: string | null
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthCtx | null>(null)

const native = Capacitor.isNativePlatform()

// Confirmation / reset emails must land on the deployed web app — inside the
// native shell window.location.origin is https://localhost, which is unreachable.
const WEB_ORIGIN = (import.meta.env.VITE_WEB_ORIGIN as string | undefined) ?? window.location.origin
const emailOrigin = () => (native ? WEB_ORIGIN : window.location.origin)

// Cache the native redirect URI so it's available synchronously after first call
let _cachedNativeRedirect: string | null = null
async function getCachedRedirect() {
  if (!native) return window.location.origin
  if (_cachedNativeRedirect) return _cachedNativeRedirect
  _cachedNativeRedirect = await nativeRedirectUri()
  return _cachedNativeRedirect
}

// Each surface installs under its own applicationId, so each owns its own
// custom scheme. Deriving the scheme from the running app id keeps the two
// APKs from fighting over one deep link.
async function nativeRedirectUri() {
  const { id } = await App.getInfo()
  return `${id}://auth/callback`
}

function paramsFromDeepLink(url: string) {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : ''
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  return new URLSearchParams(`${q}&${hash}`)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [oauthError, setOauthError] = useState<string | null>(null)

  useEffect(() => {
    if (native) getCachedRedirect()
    let settled = false
    const settle = (s: Session | null) => {
      if (settled) return
      settled = true
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    }

    const timer = setTimeout(() => settle(null), 8000)

    supabase.auth
      .getSession()
      .then(({ data }) => settle(data.session ?? null))
      .catch((e) => { console.error('getSession failed:', e); settle(null) })
      .finally(() => clearTimeout(timer))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    // OAuth finishes in the system browser and hands the session back over the
    // app's custom scheme.
    let appUrlListener: { remove: () => void } | undefined
    if (native) {
      App.addListener('appUrlOpen', async ({ url }) => {
        if (!url.includes('auth/callback')) return
        const params = paramsFromDeepLink(url)

        const code = params.get('code')
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        try {
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) throw error
          } else if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) throw error
          } else {
            throw new Error(params.get('error_description') ?? 'Sign-in was cancelled.')
          }
          setOauthError(null)
        } catch (e) {
          setOauthError(e instanceof Error ? e.message : 'Could not complete sign-in.')
        } finally {
          setLoading(false)
          await Browser.close().catch(() => {})
        }
      }).then((l) => { appUrlListener = l })
    }

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
      appUrlListener?.remove()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectTo = await getCachedRedirect()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    })
    return { error: error?.message ?? null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithGoogle = async () => {
    setOauthError(null)

    if (native) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: await nativeRedirectUri(), skipBrowserRedirect: true },
      })
      if (error) return { error: error.message }
      if (!data?.url) return { error: 'Google sign-in is unavailable right now.' }
      await Browser.open({ url: data.url, presentationStyle: 'popover' })
      return { error: null }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const redirectTo = await getCachedRedirect()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    })
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, oauthError, signUp, signIn, signInWithGoogle, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
