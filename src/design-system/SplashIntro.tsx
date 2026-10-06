import { motion } from 'framer-motion'
import { SnehamMark } from './Logo'
import { GuardedMotionDiv } from './presence'

// The brand block shared by every loading moment (launch, sign-in hand-off).
// Sizes match the login screen's SnehamHero exactly, so the logo reads as one
// continuous thing from splash to login to loading instead of changing size at
// each step. Each moment keeps its own entrance: the launch hand-off pops the
// mark in quickly; the sign-in loader (`relaxed`) uses its original, slower
// pop and text rise.
export function BrandSplash({ children, relaxed = false }: { children?: React.ReactNode; relaxed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3.5">
      <motion.div
        initial={{ opacity: 0, scale: relaxed ? 0.5 : 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={relaxed ? { type: 'spring', stiffness: 260, damping: 20, delay: 0.1 } : { type: 'spring', stiffness: 300, damping: 18 }}
      >
        <SnehamMark size={48} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: relaxed ? 12 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={relaxed ? { duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] } : { delay: 0.15, duration: 0.25 }}
        className="text-center"
      >
        <div className="font-display text-[34px] font-bold leading-[1] tracking-[-0.03em] text-ink">Sneham</div>
        <div className="font-display text-[21px] font-semibold leading-[1.15] tracking-[-0.012em] text-body-mid">Digital Clinic</div>
        <div className="mt-2 font-body text-[12px] tracking-[0.07em] text-faint">Healing with compassion</div>
      </motion.div>
      {children}
    </div>
  )
}

// A brief animated hand-off shown only on native (the native Capacitor
// splash screen already covers the true cold-boot moment with the same
// mark on the same background — this takes over the instant that lifts,
// for as long as the real auth check is still running, see App.tsx).
//
// Self-contained and easy to remove: delete this file and the few lines in
// App.tsx that render it to go back to no intro at all.
export function SplashIntro() {
  return (
    <GuardedMotionDiv
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-canvas px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <BrandSplash />
    </GuardedMotionDiv>
  )
}
