import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './AuthProvider'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './SignupScreen'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { ResetPasswordScreen } from './ResetPasswordScreen'
import { SignupConfirmedScreen } from './SignupConfirmedScreen'
import { BrandSplash } from '../design-system/SplashIntro'
import { GuardedMotionDiv } from '../design-system/presence'

type Screen = 'login' | 'signup' | 'forgot'

function SplashScreen() {
  return (
    <GuardedMotionDiv
      key="splash"
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-canvas px-6"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <BrandSplash relaxed>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="mt-2.5"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-tint border-t-brand" />
        </motion.div>
      </BrandSplash>
    </GuardedMotionDiv>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, passwordRecovery, justConfirmedSignup } = useAuth()
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

      {!showSplash && user && passwordRecovery && <ResetPasswordScreen />}
      {!showSplash && user && !passwordRecovery && justConfirmedSignup && <SignupConfirmedScreen />}
      {!showSplash && user && !passwordRecovery && !justConfirmedSignup && children}
    </>
  )
}
