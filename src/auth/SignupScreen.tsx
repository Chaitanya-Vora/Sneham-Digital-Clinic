import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bell, CalendarCheck, ChatCircleText, CheckCircle, Prescription, UsersThree } from '@phosphor-icons/react'
import { useAuth } from './AuthProvider'
import { AUDIENCE, AuthField, AuthShell, ErrorNote, GoogleButton, LinkButton, OrDivider, PasswordField, PrimaryButton, StrengthBar, isEmail } from './AuthKit'

interface Props {
  onSwitch: (screen: 'login') => void
}

const COPY = {
  patient: {
    title: 'Create your account',
    subtitle: 'Book visits, follow your remedies and message your doctor — all in one place.',
    namePlaceholder: 'e.g. Priya Sharma',
    perks: [
      { icon: <CalendarCheck size={14} weight="fill" />, label: 'Book visits' },
      { icon: <Bell size={14} weight="fill" />, label: 'Dose reminders' },
      { icon: <ChatCircleText size={14} weight="fill" />, label: 'Message your doctor' },
    ],
  },
  practitioner: {
    title: 'Create your account',
    subtitle: 'Set up your practice — patients, prescriptions and your schedule.',
    namePlaceholder: 'Dr. Neha Tripathi',
    perks: [
      { icon: <UsersThree size={14} weight="fill" />, label: 'Patients' },
      { icon: <Prescription size={14} weight="fill" />, label: 'Prescriptions' },
      { icon: <CalendarCheck size={14} weight="fill" />, label: 'Schedule' },
    ],
  },
} as const

export function SignupScreen({ onSwitch }: Props) {
  const { signUp, signInWithGoogle, oauthError } = useAuth()
  const copy = COPY[AUDIENCE]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  // Nothing is flagged until she has tried to continue (or left a field) — then it says exactly what is wrong.
  const [tried, setTried] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }))
  const show = (k: string) => tried || touched[k]

  const problems = {
    name: name.trim().length < 2 ? 'Enter your full name.' : null,
    email: !isEmail(email) ? 'Enter a valid email address, like name@example.com.' : null,
    password: password.length < 6 ? 'Use at least 6 characters.' : null,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setTried(true)
    if (problems.name || problems.email || problems.password) return
    setBusy(true)
    setError('')
    const { error: err } = await signUp(email.trim(), password, name.trim())
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="One last step — confirm your address to activate your account."
        footer={<LinkButton onClick={() => onSwitch('login')}>Back to sign in</LinkButton>}
      >
        <div className="flex flex-col items-center py-4 text-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-tint"><CheckCircle size={36} weight="fill" className="text-brand" /></motion.div>
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
            We sent a confirmation link to <span className="font-semibold text-body">{email.trim()}</span>. Open it to activate your account.
          </p>
          <p className="mt-3 text-[12.5px] text-faint">Can't find it? Look in your spam folder.</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.subtitle}
      perks={[...copy.perks]}
      footer={<>Already have an account? <LinkButton onClick={() => onSwitch('login')}>Sign in</LinkButton></>}
    >
      <GoogleButton onClick={async () => { const { error: err } = await signInWithGoogle(); if (err) setError(err) }} />
      <OrDivider>or with email</OrDivider>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField id="su-name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} placeholder={copy.namePlaceholder} autoComplete="name" error={show('name') ? problems.name : null} />
        <AuthField id="su-email" label="Email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch('email')} placeholder="you@example.com" autoComplete="email" error={show('email') ? problems.email : null} />
        <div>
          <PasswordField id="su-password" label="Password" value={password} onChange={setPassword} onBlur={() => touch('password')} placeholder="At least 6 characters" autoComplete="new-password" error={show('password') ? problems.password : null} />
          <StrengthBar password={password} />
        </div>

        {(error || oauthError) && <ErrorNote>{error || oauthError}</ErrorNote>}

        <PrimaryButton type="submit" busy={busy}>Create account <ArrowRight size={18} weight="bold" /></PrimaryButton>
      </form>
    </AuthShell>
  )
}
