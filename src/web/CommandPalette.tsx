import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MagnifyingGlass, ArrowElbowDownLeft } from '@phosphor-icons/react'

export interface Command {
  id: string
  label: string
  hint?: string
  group: string
  icon?: any
  run: () => void
}

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return commands
    return commands.filter((c) => (c.label + ' ' + (c.hint ?? '') + ' ' + c.group).toLowerCase().includes(s))
  }, [q, commands])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  useEffect(() => setActive(0), [q])

  const run = (c?: Command) => {
    if (!c) return
    onClose()
    c.run()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]) }
    else if (e.key === 'Escape') onClose()
  }

  // group in order of first appearance
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>()
    filtered.forEach((c) => { if (!map.has(c.group)) map.set(c.group, []); map.get(c.group)!.push(c) })
    return [...map.entries()]
  }, [filtered])

  let idx = -1

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-ink/25 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="relative w-full max-w-[560px] overflow-hidden rounded-[18px] border border-border bg-surface shadow-modal"
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <MagnifyingGlass size={18} className="text-faint" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patients, jump to a view, take an action…"
                className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
                data-selectable="true"
              />
              <kbd className="rounded-[6px] border border-border bg-screen px-1.5 py-0.5 text-[11px] text-faint">esc</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto py-2">
              {filtered.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-faint">No matches.</div>}
              {groups.map(([group, cmds]) => (
                <div key={group} className="mb-1">
                  <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-label text-faint">{group}</div>
                  {cmds.map((c) => {
                    idx++
                    const on = idx === active
                    const myIdx = idx
                    return (
                      <button
                        key={c.id}
                        onMouseMove={() => setActive(myIdx)}
                        onClick={() => run(c)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${on ? 'bg-tint-pale' : ''}`}
                      >
                        {c.icon && <c.icon size={17} className={on ? 'text-brand' : 'text-muted'} weight={on ? 'fill' : 'regular'} />}
                        <span className="flex-1 text-[13.5px] font-medium text-ink">{c.label}</span>
                        {c.hint && <span className="text-[12px] text-faint">{c.hint}</span>}
                        {on && <ArrowElbowDownLeft size={14} className="text-faint" />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
