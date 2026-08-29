import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CircleNotch, ArrowClockwise } from '@phosphor-icons/react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { haptic } from './haptics'

// ── Pull to refresh ──────────────────────────────────────────
export function PullToRefresh({
  onRefresh,
  children,
  className = '',
  style,
}: {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const locked = useRef(false)
  const armed = useRef(false)
  const ref = useRef<HTMLDivElement>(null)
  const THRESH = 62

  return (
    <div
      ref={ref}
      className={`no-scrollbar ${className}`}
      style={{ overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', ...style }}
      onTouchStart={(e) => {
        locked.current = false
        if ((ref.current?.scrollTop ?? 0) <= 0) {
          startY.current = e.touches[0].clientY
          armed.current = false
        } else startY.current = null
      }}
      onTouchMove={(e) => {
        if (startY.current == null || refreshing || locked.current) return
        const dy = e.touches[0].clientY - startY.current
        if (dy < -4) { locked.current = true; return }
        if (dy > 8) {
          const damped = Math.min(dy * 0.45, 90)
          setPull(damped)
          if (!armed.current && damped >= THRESH) {
            armed.current = true
            haptic('select')
          }
        }
      }}
      onTouchEnd={async () => {
        if (pull >= THRESH && !refreshing) {
          setRefreshing(true)
          setPull(44)
          haptic('success')
          await onRefresh()
          setRefreshing(false)
        }
        setPull(0)
        startY.current = null
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-brand"
        style={{ height: refreshing ? 44 : pull, transition: startY.current == null ? 'height .28s cubic-bezier(.22,.61,.36,1)' : 'none' }}
      >
        {refreshing ? (
          <CircleNotch size={22} className="animate-spin" weight="bold" />
        ) : (
          <ArrowClockwise
            size={20}
            weight="bold"
            style={{ opacity: Math.min(pull / THRESH, 1), transform: `rotate(${pull * 3}deg)` }}
          />
        )}
      </div>
      {children}
    </div>
  )
}

// ── Swipe between sibling views (tabs) ───────────────────────
export function useHorizontalSwipe({
  onNext,
  onPrev,
  count,
  index,
}: {
  onNext: () => void
  onPrev: () => void
  count?: number
  index?: number
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return
      const dx = e.changedTouches[0].clientX - start.current.x
      const dy = e.changedTouches[0].clientY - start.current.y
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        const atStart = index !== undefined && index <= 0
        const atEnd = index !== undefined && count !== undefined && index >= count - 1
        if (dx < 0 && !atEnd) { haptic('tick'); onNext() }
        else if (dx > 0 && !atStart) { haptic('tick'); onPrev() }
      }
      start.current = null
    },
  }
}

// ── Hardware back button for native apps ─────────────────────
export function useNativeBackButton(onBack: () => void) {
  const cb = useCallback(() => { onBack() }, [onBack])
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = CapApp.addListener('backButton', cb)
    return () => { listener.then((l) => l.remove()) }
  }, [cb])
}

// ── Edge swipe-back for pushed screens ───────────────────────
export function EdgeSwipeBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const [dx, setDx] = useState(0)

  useNativeBackButton(onBack)

  return (
    <motion.div
      className="h-full w-full"
      style={{ x: dx }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t.clientX <= 40) start.current = { x: t.clientX, y: t.clientY }
      }}
      onTouchMove={(e) => {
        if (!start.current) return
        const d = e.touches[0].clientX - start.current.x
        if (d > 0) setDx(Math.min(d, 120))
      }}
      onTouchEnd={() => {
        if (dx > 70) {
          haptic('impact')
          onBack()
        }
        setDx(0)
        start.current = null
      }}
    >
      {children}
    </motion.div>
  )
}

export { AnimatePresence }
