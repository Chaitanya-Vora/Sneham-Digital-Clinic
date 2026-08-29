import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './AuthProvider'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './SignupScreen'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { SnehamMark } from '../design-system/Logo'

type Screen = 'login' | 'signup' | 'forgot'

function SplashScreen() {
  return (
    <motion.div
      key="splash"
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-canvas"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
      >
        <SnehamMark size={72} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 text-center"
      >
        <div className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
          Sneham
        </div>
        <div className="font-display text-[16px] font-semibold text-body-mid">
          Digital Clinic
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="mt-6"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-tint border-t-brand" />
      </motion.div>
    </motion.div>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [screen, setScreen] = useState<Screen>('login')
  const [minSplashDone, setMinSplashDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 1800)
    return () => clearTimeout(t)
  }, [])

  const showSplash = !minSplashDone || loading

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      {!showSplash && !user && (
        <>
          {screen === 'signup' ? (
            <SignupScreen onSwitch={setScreen} />
          ) : screen === 'forgot' ? (
            <ForgotPasswordScreen onSwitch={setScreen} />
          ) : (
            <LoginScreen onSwitch={setScreen} />
          )}
        </>
      )}

      {!showSplash && user && children}
    </>
  )
}
