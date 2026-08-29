import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Spinner, EnvelopeSimple } from '@phosphor-icons/react'
import { SnehamLockup } from '../design-system/Logo'
import { useAuth } from './AuthProvider'

interface Props {
  onSwitch: (screen: 'login') => void
}

export function ForgotPasswordScreen({ onSwitch }: Props) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const canSubmit = email.includes('@')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await resetPassword(email)
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
            <EnvelopeSimple size={36} weight="fill" className="text-brand" />
          </div>
          <h1 className="mt-6 font-display text-[24px] font-bold text-ink">Check your email</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            If an account exists for <span className="font-semibold text-body">{email}</span>,
            you'll receive a password reset link shortly.
          </p>
          <button
            onClick={() => onSwitch('login')}
            className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-accent-deep"
          >
            <ArrowLeft size={14} weight="bold" /> Back to sign in
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6">
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
          Reset your password
        </h1>
        <p className="mt-1 text-center text-[14px] text-muted">
          Enter your email and we'll send a reset link
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
                Send reset link <ArrowRight size={18} weight="bold" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => onSwitch('login')}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-accent-deep"
          >
            <ArrowLeft size={14} weight="bold" /> Back to sign in
          </button>
        </div>
      </motion.div>
    </div>
  )
}
