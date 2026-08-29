import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { haptic, type Hap } from './haptics'
import { springSnappy } from './motion'

// Every tappable surface goes through this: press-scale + haptic on touch.
// Renders a <button> by default, or a <div> for larger card targets.
export function Pressable({
  as = 'button',
  onClick,
  hap = 'tick',
  scale = 0.965,
  disabled = false,
  className = '',
  style,
  children,
  ariaLabel,
}: {
  as?: 'button' | 'div'
  onClick?: (e?: React.MouseEvent) => void
  hap?: Hap
  scale?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  children: ReactNode
  ariaLabel?: string
}) {
  const common = {
    whileTap: disabled ? undefined : { scale },
    transition: springSnappy,
    onPointerDown: () => {
      if (!disabled) haptic(hap)
    },
    onClick: disabled ? undefined : onClick,
    className,
    style,
    'aria-label': ariaLabel,
  }
  if (as === 'div') {
    return (
      <motion.div role={onClick ? 'button' : undefined} {...common}>
        {children}
      </motion.div>
    )
  }
  return (
    <motion.button disabled={disabled} {...common}>
      {children}
    </motion.button>
  )
}
