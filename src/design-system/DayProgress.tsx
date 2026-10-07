import { motion } from 'framer-motion'
import { spring } from './motion'

// A day at a glance: solid = done, hatched = still to come. The same visual
// language everywhere, so "planned" and "finished" never look alike.
export function DayProgress({
  done,
  total,
  className = '',
  onDark = false,
}: {
  done: number
  total: number
  className?: string
  onDark?: boolean
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
  return (
    <span
      role="img"
      aria-label={`${done} of ${total} seen`}
      className={`hatch relative inline-block h-[5px] overflow-hidden rounded-full ring-1 ring-inset ${onDark ? 'text-white/80 ring-white/40' : 'text-faint ring-border-dash'} ${className}`}
    >
      <motion.span
        className={`absolute inset-y-0 left-0 rounded-full ${onDark ? 'bg-white' : 'bg-brand'}`}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={spring}
      />
    </span>
  )
}
