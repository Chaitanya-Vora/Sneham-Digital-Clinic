import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DotsThree } from '@phosphor-icons/react'

// A "⋯" button that opens a small menu of actions beside it — the web console's
// answer to bare icon buttons (a lone ✕ that cancels something). It opens
// downward, flips upward near the bottom of the window, and closes on a click
// elsewhere, Escape, or when the page scrolls.
export interface MenuItem { key: string; label: string; icon?: ReactNode; tone?: 'danger'; onSelect: () => void }

const MENU_W = 208
const ITEM_H = 40

export function PopoverMenu({ items, label = 'More actions', className = '' }: { items: MenuItem[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    const height = items.length * ITEM_H + 12
    const below = r.bottom + 6 + height <= window.innerHeight - 8
    setPos({ left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)), top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - height) })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-faint outline-none transition hover:bg-screen hover:text-body focus-visible:ring-2 focus-visible:ring-brand/40 ${open ? 'bg-screen text-body' : ''} ${className}`}
      >
        <DotsThree size={22} weight="bold" />
      </button>
      {open && pos && createPortal(
        <div
          ref={menu}
          role="menu"
          style={{ left: pos.left, top: pos.top, width: MENU_W, animation: 'fade .12s ease both' }}
          className="fixed z-[85] rounded-[16px] border border-border bg-surface p-1.5 shadow-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              onClick={() => { setOpen(false); it.onSelect() }}
              className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium outline-none transition focus-visible:bg-screen ${it.tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-screen'}`}
            >
              <span className={it.tone === 'danger' ? 'text-danger' : 'text-brand'}>{it.icon}</span>{it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
