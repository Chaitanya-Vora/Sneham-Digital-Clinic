import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, EnvelopeSimple } from '@phosphor-icons/react'
import { useAuth } from './AuthProvider'
import { AuthField, AuthShell, ErrorNote, LinkButton, PrimaryButton, isEmail } from './AuthKit'

interface Props {
  onSwitch: (screen: 'login') => void
}

export function ForgotPasswordScreen({ onSwitch }: Props) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [tried, setTried] = useState(false)

  const problem = !isEmail(email) ? 'Enter the email address you signed up with.' : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setTried(true)
    if (problem) return
    setBusy(true)
    setError('')
    const { error: err } = await resetPassword(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }

  const back = <span className="inline-flex items-center gap-1.5"><ArrowLeft size={14} weight="bold" /> <LinkButton onClick={() => onSwitch('login')}>Back to sign in</LinkButton></span>

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If an account exists for that address, a reset link is on its way." footer={back}>
        <div className="flex flex-col items-center py-4 text-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-tint"><EnvelopeSimple size={34} weight="fill" className="text-brand" /></motion.div>
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">We sent it to <span className="font-semibold text-body">{email.trim()}</span>. It can take a minute to arrive.</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a link to choose a new one." footer={back}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField id="fp-email" label="Email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" error={tried ? problem : null} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton type="submit" busy={busy}>Send reset link <ArrowRight size={18} weight="bold" /></PrimaryButton>
      </form>
    </AuthShell>
  )
}
