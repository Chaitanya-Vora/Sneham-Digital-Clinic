import { useState } from 'react'
import { ArrowRight, Stethoscope, User } from '@phosphor-icons/react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './AuthProvider'
import { AUDIENCE, AuthField, AuthShell, ErrorNote, GoogleButton, LinkButton, OrDivider, PasswordField, PrimaryButton, isEmail } from './AuthKit'

const SURFACE_ENV = import.meta.env.VITE_DEFAULT_SURFACE as string | undefined
const surfaceLabel = SURFACE_ENV === 'patient' ? 'Patient' : SURFACE_ENV === 'practitioner' ? 'Practitioner' : null
const SurfaceIcon = SURFACE_ENV === 'patient' ? User : Stethoscope

interface Props {
  onSwitch: (screen: 'signup' | 'forgot') => void
}

export function LoginScreen({ onSwitch }: Props) {
  const { signIn, signInWithGoogle, oauthError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!isEmail(email)) return setError('Enter the email address you signed up with.')
    if (password.length < 6) return setError('Your password is at least 6 characters.')
    setBusy(true)
    setError('')
    const { error: err } = await signIn(email.trim(), password)
    if (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={AUDIENCE === 'patient' ? 'Sign in to see your appointments, remedies and messages.' : 'Sign in to your practice.'}
      tag={surfaceLabel && Capacitor.isNativePlatform() ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white/90"><SurfaceIcon size={13} weight="fill" /> {surfaceLabel}</span>
      ) : undefined}
      footer={<>New here? <LinkButton onClick={() => onSwitch('signup')}>Create an account</LinkButton></>}
    >
      <GoogleButton onClick={async () => { const { error: err } = await signInWithGoogle(); if (err) setError(err) }} />
      <OrDivider>or sign in with email</OrDivider>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField id="li-email" label="Email" type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} placeholder="you@example.com" autoComplete="email" />
        <div>
          <PasswordField id="li-password" label="Password" value={password} onChange={(v) => { setPassword(v); setError('') }} placeholder="Enter your password" autoComplete="current-password" />
          <div className="mt-2 text-right text-[13px]"><LinkButton onClick={() => onSwitch('forgot')}>Forgot password?</LinkButton></div>
        </div>

        {(error || oauthError) && <ErrorNote>{error || oauthError}</ErrorNote>}

        <PrimaryButton type="submit" busy={busy}>Sign in <ArrowRight size={18} weight="bold" /></PrimaryButton>
      </form>
    </AuthShell>
  )
}
