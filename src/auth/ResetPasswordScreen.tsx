import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { useAuth } from './AuthProvider'
import { AuthShell, ErrorNote, LinkButton, PasswordField, PrimaryButton, StrengthBar } from './AuthKit'

export function ResetPasswordScreen() {
  const { updatePassword, cancelPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [tried, setTried] = useState(false)

  const problem = password.length < 6 ? 'Use at least 6 characters.' : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setTried(true)
    if (problem) return
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
      <AuthShell title="Password updated" subtitle="You're signed in with your new password.">
        <div className="flex flex-col items-center py-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-tint"><CheckCircle size={36} weight="fill" className="text-brand" /></motion.div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your account." footer={<LinkButton onClick={cancelPasswordRecovery}>Never mind, keep my current password</LinkButton>}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <PasswordField id="rp-password" label="New password" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" autoFocus error={tried ? problem : null} />
          <StrengthBar password={password} />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton type="submit" busy={busy}>Update password <ArrowRight size={18} weight="bold" /></PrimaryButton>
      </form>
    </AuthShell>
  )
}
