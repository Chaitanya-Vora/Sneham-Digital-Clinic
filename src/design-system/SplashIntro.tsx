import { motion } from 'framer-motion'
import { SnehamMark } from './Logo'

// A brief animated hand-off shown only on native (the native Capacitor
// splash screen already covers the true cold-boot moment with the same
// mark on the same background — this takes over the instant that lifts,
// for as long as the real auth check is still running, see App.tsx).
//
// Self-contained and easy to remove: delete this file and the few lines in
// App.tsx that render it to go back to no intro at all.
export function SplashIntro() {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-canvas"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      >
        <SnehamMark size={64} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.25 }}
        className="text-center"
      >
        <div className="font-display text-[19px] font-bold text-ink">Sneham</div>
        <div className="font-display text-[13px] font-semibold text-body-mid">Digital Clinic</div>
      </motion.div>
    </motion.div>
  )
}
