import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeSlash, ArrowRight, Spinner, CheckCircle } from '@phosphor-icons/react'
import { SnehamLockup } from '../design-system/Logo'
import { useAuth } from './AuthProvider'

export function ResetPasswordScreen() {
  const { updatePassword, cancelPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const pwMatch = password === confirm
  const canSubmit = password.length >= 6 && pwMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await updatePassword(password)
    if (err) {
      setError(err)
      setBusy(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
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
          <h1 className="mt-6 font-display text-[24px] font-bold text-ink">Password updated</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            You're signed in with your new password.
          </p>
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
          Set a new password
        </h1>
        <p className="mt-1 text-center text-[14px] text-muted">
          Choose a new password for your account
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-label text-muted">
              New password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                autoFocus
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
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
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
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-brand py-3.5 text-[15px] font-semibold text-white shadow-cta transition hover:bg-accent-deep disabled:opacity-60"
          >
            {busy ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <>
                Update password <ArrowRight size={18} weight="bold" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[13px] text-muted">
          <button
            onClick={cancelPasswordRecovery}
            className="font-semibold text-brand hover:text-accent-deep"
          >
            Never mind, keep my current password
          </button>
        </div>
      </motion.div>
    </div>
  )
}
