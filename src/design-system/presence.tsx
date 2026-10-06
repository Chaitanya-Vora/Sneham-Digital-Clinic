import { forwardRef, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useIsPresent, type HTMLMotionProps } from 'framer-motion'

// A screen that is animating out stays in the DOM until its exit animation
// reports done. If that report is ever lost (an interrupted transition, the
// app backgrounded mid-animation), an invisible screen would sit on top of
// the live one and swallow taps — the UI looks fine but nothing responds.
// These wrappers make a leaving screen untouchable the moment it starts
// leaving. They deliberately only *read* presence (useIsPresent): registering
// as a presence consumer (usePresence) makes AnimatePresence wait for this
// component to report back too, which delays or prevents the removal.
export function GuardedLayer({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const isPresent = useIsPresent()
  return (
    <div className={className} style={isPresent ? style : { ...style, pointerEvents: 'none' }}>
      {children}
    </div>
  )
}

export const GuardedMotionDiv = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(function GuardedMotionDiv({ style, ...rest }, ref) {
  const isPresent = useIsPresent()
  return <motion.div ref={ref} style={isPresent ? style : { ...style, pointerEvents: 'none' }} {...rest} />
})

// Rare safety net: if an exit animation ever fails to report completion, the
// leftover screen is invisible and untouchable (above) but still mounted. Once
// nothing has been open for a moment, bumping this value as the `key` of the
// (by then empty) AnimatePresence discards any such leftover. Nothing visible
// changes — it only ever fires well after every exit animation has finished,
// and re-opening something in the meantime cancels it.
export function useGhostSweep(isOpen: boolean, delayMs = 1600): number {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (isOpen) return
    const t = setTimeout(() => setEpoch((e) => e + 1), delayMs)
    return () => clearTimeout(t)
  }, [isOpen, delayMs])
  return epoch
}
