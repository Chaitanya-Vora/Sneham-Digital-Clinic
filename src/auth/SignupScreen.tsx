import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeSlash, ArrowRight, Spinner, CheckCircle } from '@phosphor-icons/react'
import { SnehamLockup } from '../design-system/Logo'
import { useAuth } from './AuthProvider'

interface Props {
  onSwitch: (screen: 'login') => void
}

export function SignupScreen({ onSwitch }: Props) {
  const { signUp, signInWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const pwMatch = password === confirm
  const canSubmit = name.trim().length >= 2 && email.includes('@') && password.length >= 6 && pwMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await signUp(email, password, name.trim())
    if (err) {
      setError(err)
      setBusy(false)
    } else {
      setSent(true)
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[380px] text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tint">
            <CheckCircle size={36} weight="fill" className="text-brand" />
          </div>
          <h1 className="mt-6 font-display text-[24px] font-bold text-ink">Check your email</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            We sent a confirmation link to <span className="font-semibold text-body">{email}</span>.
            Click it to activate your account.
          </p>
          <button
            onClick={() => onSwitch('login')}
            className="mt-8 text-[13px] font-semibold text-brand hover:text-accent-deep"
          >
            Back to sign in
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        <div className="flex justify-center">
          <SnehamLockup />
        </div>

        <h1 className="mt-8 text-center font-display text-[28px] font-bold leading-tight text-ink">
          Create your account
        </h1>
        <p className="mt-1 text-center text-[14px] text-muted">
          Set up your clinic in under a minute
        </p>

        <button
          onClick={async () => {
            const { error: err } = await signInWithGoogle()
            if (err) setError(err)
          }}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-[12px] border border-border bg-surface py-3.5 text-[15px] font-semibold text-ink transition hover:bg-surface-hover"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="relative mt-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-canvas px-4 text-[12px] text-muted">or create with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-label text-muted">
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Neha Tripathi"
              autoComplete="name"
              className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-label text-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              autoComplete="email"
              className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-label text-muted">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 pr-12 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-body"
              >
                {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-label text-muted">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className={`w-full rounded-[10px] border bg-surface px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-faint focus:ring-2 ${
                confirm && !pwMatch
                  ? 'border-danger focus:border-danger focus:ring-danger/20'
                  : 'border-border focus:border-accent focus:ring-accent/20'
              }`}
            />
            {confirm && !pwMatch && (
              <p className="mt-1 text-[12px] text-danger">Passwords don't match</p>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[8px] border border-danger/20 bg-danger/5 px-3 py-2.5 text-[13px] text-danger"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-brand py-3.5 text-[15px] font-semibold text-white shadow-cta transition hover:bg-accent-deep disabled:opacity-50"
          >
            {busy ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <>
                Create account <ArrowRight size={18} weight="bold" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[13px] text-muted">
          Already have an account?{' '}
          <button
            onClick={() => onSwitch('login')}
            className="font-semibold text-brand hover:text-accent-deep"
          >
            Sign in
          </button>
        </div>
      </motion.div>
    </div>
  )
}
