import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { easeCalm } from './motion'

// ── CountUp ──────────────────────────────────────────────────
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 1.1,
  className = '',
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: easeCalm,
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, duration])
  return <span className={className}>{format(display)}</span>
}

// ── Animated progress ring ───────────────────────────────────
export function ProgressRing({
  pct,
  size = 140,
  stroke = 12,
  track = '#E9EEE1',
  color = '#7A9B66',
  children,
}: {
  pct: number
  size?: number
  stroke?: number
  track?: string
  color?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(circ - (Math.max(0, Math.min(100, pct)) / 100) * circ))
    return () => cancelAnimationFrame(id)
  }, [pct, circ])
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  )
}

// ── Animated bar ─────────────────────────────────────────────
export function ProgressBar({ pct, className = '', color = 'bg-accent' }: { pct: number; className?: string; color?: string }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, pct))))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return (
    <div className={`h-2 overflow-hidden rounded-pill bg-tint-pale ${className}`}>
      <div className={`h-full rounded-pill ${color}`} style={{ width: `${w}%`, transition: 'width 1s cubic-bezier(.22,.61,.36,1)' }} />
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.06] ${className}`} />
}
