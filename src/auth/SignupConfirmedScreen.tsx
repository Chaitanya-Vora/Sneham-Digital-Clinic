import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { useAuth } from './AuthProvider'
import { AuthShell, PrimaryButton } from './AuthKit'

export function SignupConfirmedScreen() {
  const { dismissSignupConfirmation } = useAuth()

  return (
    <AuthShell title="Email verified" subtitle="Your account is confirmed and you're signed in.">
      <div className="flex flex-col items-center pb-2 pt-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-tint"><CheckCircle size={36} weight="fill" className="text-brand" /></motion.div>
        <div className="mt-5 w-full">
          <PrimaryButton type="button" onClick={dismissSignupConfirmation}>Continue to Sneham <ArrowRight size={18} weight="bold" /></PrimaryButton>
        </div>
      </div>
    </AuthShell>
  )
}
