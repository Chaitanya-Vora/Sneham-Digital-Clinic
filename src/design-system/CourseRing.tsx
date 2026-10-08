import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// A ring drawn around an avatar: how far through the prescribed course the
// patient is. Solid arc = days gone, dotted track = days still to come — the
// same "solid is done, planned is dashed" language as the day bars on the
// calendar. `ended` turns the arc amber; `progress={null}` (until settled / no
// course) leaves just the dotted track.
const PALETTE = {
  onDark: { track: 'rgba(244,242,234,0.40)', arc: '#F4F2EA', ended: '#EBC27A' },
  onLight: { track: '#C7CCB8', arc: '#41603C', ended: '#D8A24A' },
}

export function CourseRing({
  size = 92,
  progress,
  ended = false,
  tone = 'onDark',
  children,
}: {
  size?: number
  progress: number | null
  ended?: boolean
  tone?: 'onDark' | 'onLight'
  children: ReactNode
}) {
  const c = PALETTE[tone]
  const pct = progress === null ? 0 : Math.max(0, Math.min(1, progress)) * 100
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke={c.track} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0.1 6.1" />
        {pct > 0 && (
          <motion.circle
            cx="50" cy="50" r="46" fill="none" stroke={ended ? c.ended : c.arc} strokeWidth="4.2" strokeLinecap="round"
            pathLength={100} strokeDasharray={100} transform="rotate(-90 50 50)"
            initial={{ strokeDashoffset: 100 }} animate={{ strokeDashoffset: 100 - pct }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <div className="absolute overflow-hidden rounded-full" style={{ inset: Math.round(size * 0.115) }}>{children}</div>
    </div>
  )
}
