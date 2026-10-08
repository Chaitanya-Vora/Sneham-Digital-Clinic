import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, X, SunHorizon, CalendarBlank, ArrowsClockwise, Prescription as RxIcon, Tray } from '@phosphor-icons/react'
import { spring } from '../design-system/motion'

// Shared scaffolding for the design lab: a phone-sized frame with the app's own
// safe-area variables, the real tab bar's look, and a toast that looks and
// behaves like the app's (with an Undo action).

export const dayLabel = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
export const addDays = (n: number, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return d }

export function Phone({ label, note, height = 800, children }: { label: string; note?: string; height?: number; children: React.ReactNode }) {
  return (
    <div className="shrink-0">
      <div className="mb-2 px-1">
        <div className="font-display text-[14px] font-semibold text-ink">{label}</div>
        {note && <div className="text-[12px] text-muted">{note}</div>}
      </div>
      <div
        className="relative overflow-hidden rounded-[40px] border border-border-dash bg-screen shadow-card-lg"
        style={{ width: 390, height, ['--app-top' as string]: '22px', ['--app-bottom' as string]: '18px' } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}

export function FakeTabBar({ active }: { active: 'today' | 'calendar' | 'followups' | 'rx' | 'inbox' }) {
  const items = [
    { id: 'today', icon: SunHorizon, label: 'Today' },
    { id: 'calendar', icon: CalendarBlank, label: 'Schedule' },
    { id: 'followups', icon: ArrowsClockwise, label: 'Follow-ups' },
    { id: 'rx', icon: RxIcon, label: 'Rx' },
    { id: 'inbox', icon: Tray, label: 'Inbox' },
  ] as const
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/85 px-3 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'var(--app-bottom)' }}>
      {items.map((it) => {
        const on = active === it.id
        return (
          <div key={it.id} className="flex flex-1 flex-col items-center gap-1">
            <span className="relative flex h-9 w-14 items-center justify-center">
              {on && <span className="absolute inset-0 rounded-pill bg-tint-pale" />}
              <span className={`relative ${on ? 'text-brand' : 'text-faint'}`}><it.icon size={21} weight={on ? 'fill' : 'regular'} /></span>
            </span>
            <span className={`text-[11px] font-medium ${on ? 'text-brand' : 'text-faint'}`}>{it.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export interface FrameToastData { id: number; title: string; message?: string; undo?: () => void }

/** The app's toast card, pinned inside one phone frame. */
export function FrameToast({ toast, onClose }: { toast: FrameToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 6500)
    return () => clearTimeout(t)
  }, [toast, onClose])
  return (
    <div className="pointer-events-none absolute inset-x-4 top-0 z-[300] pt-[var(--app-top)]">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="pointer-events-auto flex items-start gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5 shadow-modal"
          >
            <div className="mt-0.5 text-accent"><CheckCircle size={22} weight="fill" /></div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-semibold text-ink">{toast.title}</div>
              {toast.message && <div className="mt-0.5 text-[13px] text-muted">{toast.message}</div>}
              {toast.undo && (
                <button onClick={() => { toast.undo!(); onClose() }} className="mt-2 text-[13px] font-semibold text-brand hover:text-accent">Undo →</button>
              )}
            </div>
            <button onClick={onClose} className="text-faint hover:text-body" aria-label="dismiss"><X size={16} weight="bold" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Section({ id, n, title, problem, need, children }: { id: string; n: number; title: string; problem: string; need: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-border-dash pt-10">
      <div className="mb-6 max-w-[760px]">
        <div className="text-[12px] font-semibold uppercase tracking-label text-faint">Problem {n}</div>
        <h2 className="mt-1 font-display text-[26px] font-bold text-ink">{title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-body"><span className="font-semibold text-ink">What's wrong. </span>{problem}</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-body"><span className="font-semibold text-ink">What she needs. </span>{need}</p>
      </div>
      {children}
    </section>
  )
}

export const spring_ = spring
