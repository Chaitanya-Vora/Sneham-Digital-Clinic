import { forwardRef, useEffect, type CSSProperties, type ReactNode } from 'react'
import { motion, usePresence, type HTMLMotionProps } from 'framer-motion'

// A screen that is animating out stays in the DOM until its exit animation
// reports done. If that report is ever lost (an interrupted transition, the
// app backgrounded mid-animation), an invisible screen would sit on top of
// the live one and swallow taps — the UI looks fine but nothing responds.
// This makes a leaving screen untouchable the moment it starts leaving, and
// force-removes it after a grace period as a last resort.
export function usePresenceGuard(graceMs = 1200): boolean {
  const [isPresent, safeToRemove] = usePresence()
  useEffect(() => {
    if (isPresent || !safeToRemove) return
    const t = setTimeout(safeToRemove, graceMs)
    return () => clearTimeout(t)
  }, [isPresent, safeToRemove, graceMs])
  return isPresent
}

export function GuardedLayer({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const isPresent = usePresenceGuard()
  return (
    <div className={className} style={isPresent ? style : { ...style, pointerEvents: 'none' }}>
      {children}
    </div>
  )
}

export const GuardedMotionDiv = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(function GuardedMotionDiv({ style, ...rest }, ref) {
  const isPresent = usePresenceGuard()
  return <motion.div ref={ref} style={isPresent ? style : { ...style, pointerEvents: 'none' }} {...rest} />
})
