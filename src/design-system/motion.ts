import type { Transition, Variants } from 'framer-motion'

// One motion vocabulary for the whole product. Calm × precise.
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }
export const springSoft: Transition = { type: 'spring', stiffness: 230, damping: 28 }
export const springSnappy: Transition = { type: 'spring', stiffness: 640, damping: 32 }
export const easeCalm = [0.22, 0.61, 0.36, 1] as const

// press feedback used by Pressable
export const pressTap = { scale: 0.965 }
export const pressTapSm = { scale: 0.94 }

// screen push/pop (directional)
export const pushVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '32%' : '-18%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-18%' : '32%', opacity: 0 }),
}

// tab cross-fade (lightweight — avoids layout thrash on low-end devices)
export const tabVariants: Variants = {
  enter: () => ({ opacity: 0 }),
  center: { opacity: 1 },
  exit: () => ({ opacity: 0 }),
}

// staggered list entrance (fast, minimal GPU work)
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.01 } },
}
export const listItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
}
