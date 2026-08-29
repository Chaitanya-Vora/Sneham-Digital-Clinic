import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, X } from '@phosphor-icons/react'

export interface Toast {
  id: string
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

let tid = 0
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (t) => {
    const id = `t-${++tid}`
    set((s) => ({ toasts: [{ ...t, id }, ...s.toasts] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 7200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export function ToastHost() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none absolute right-5 top-5 z-[80] flex w-[340px] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="pointer-events-auto flex items-start gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5 shadow-modal"
          >
            <div className="mt-0.5 text-accent">
              <CheckCircle size={22} weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-semibold text-ink">{t.title}</div>
              {t.message && <div className="mt-0.5 text-[13px] text-muted">{t.message}</div>}
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    dismiss(t.id)
                  }}
                  className="mt-2 text-[13px] font-semibold text-brand hover:text-accent"
                >
                  {t.action.label} →
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-body" aria-label="dismiss">
              <X size={16} weight="bold" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// convenience hook so surfaces don't import the store shape directly
export function useToast() {
  return useToasts((s) => s.show)
}
