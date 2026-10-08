import { useEffect, useRef, type ReactNode } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './ui'

// The web console's own "are you sure?" — replaces the browser pop-up. Used only
// for actions that change someone else's day or access; anything she can simply
// take back is done at once with an Undo toast instead. Call it like a function:
//
//   if (!(await confirmDialog({ title: 'Cancel appointment?', message: '…', confirmLabel: 'Cancel it', cancelLabel: 'Keep it' }))) return
//
// <ConfirmHost /> is mounted once at the root of the console.
export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  icon?: ReactNode
  tone?: 'danger' | 'primary'
}

interface Pending { opts: ConfirmOptions; resolve: (ok: boolean) => void }
const useConfirmStore = create<{ pending: Pending | null }>(() => ({ pending: null }))

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // A second question while one is open means the first was abandoned.
    useConfirmStore.getState().pending?.resolve(false)
    useConfirmStore.setState({ pending: { opts, resolve } })
  })
}

export function ConfirmHost() {
  const pending = useConfirmStore((s) => s.pending)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const answer = (ok: boolean) => {
    const p = useConfirmStore.getState().pending
    if (!p) return
    useConfirmStore.setState({ pending: null })
    p.resolve(ok)
  }

  useEffect(() => {
    if (!pending) return
    cancelRef.current?.focus() // Enter must never confirm a destructive action by accident
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  const o = pending?.opts
  const danger = (o?.tone ?? 'danger') === 'danger'
  return (
    <AnimatePresence>
      {pending && o && (
        <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/30 px-4 backdrop-blur-[2px]" onClick={() => answer(false)}>
          <motion.div
            role="alertdialog" aria-modal="true" aria-label={o.title}
            initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[400px] max-w-full rounded-[24px] border border-border bg-surface p-6 text-center shadow-modal"
          >
            {o.icon && <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${danger ? 'bg-danger/10 text-danger' : 'bg-tint text-brand'}`}>{o.icon}</div>}
            <div className={`font-display text-[18px] font-bold text-ink ${o.icon ? 'mt-3' : ''}`}>{o.title}</div>
            {o.message && <div className="mt-1.5 text-[14px] leading-relaxed text-muted">{o.message}</div>}
            <div className="mt-5 flex gap-2">
              <button ref={cancelRef} onClick={() => answer(false)} className="flex-1 rounded-pill border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-body outline-none transition hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand/40">{o.cancelLabel ?? 'Cancel'}</button>
              {danger
                ? <button onClick={() => answer(true)} className="flex-1 rounded-pill bg-danger px-4 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-danger/40">{o.confirmLabel}</button>
                : <Button className="flex-1" onClick={() => answer(true)}>{o.confirmLabel}</Button>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
