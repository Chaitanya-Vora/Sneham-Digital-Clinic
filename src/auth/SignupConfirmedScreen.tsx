import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight } from '@phosphor-icons/react'
import { SnehamLockup } from '../design-system/Logo'
import { useAuth } from './AuthProvider'

export function SignupConfirmedScreen() {
  const { dismissSignupConfirmation } = useAuth()

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px] text-center"
      >
        <div className="flex justify-center">
          <SnehamLockup />
        </div>

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
          className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-tint"
        >
          <CheckCircle size={36} weight="fill" className="text-brand" />
        </motion.div>

        <h1 className="mt-6 font-display text-[24px] font-bold text-ink">Email verified</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Your account is confirmed and you're signed in.
        </p>

        <button
          onClick={dismissSignupConfirmation}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-[12px] bg-brand py-3.5 text-[15px] font-semibold text-white shadow-cta transition hover:bg-accent-deep"
        >
          Continue to Sneham <ArrowRight size={18} weight="bold" />
        </button>
      </motion.div>
    </div>
  )
}
