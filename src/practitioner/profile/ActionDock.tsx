import type { ReactNode } from 'react'
import { Pressable } from '../../design-system/Pressable'

// The five things she does from a profile, as round buttons with labels —
// the way a contact card does it. Prescribe is the one filled button.
export interface DockItem { key: string; label: string; icon: ReactNode; primary?: boolean; onClick: () => void }

export function ActionDock({ items }: { items: DockItem[] }) {
  return (
    <div className="mt-5 flex justify-between px-0.5">
      {items.map((it) => (
        <Pressable key={it.key} as="div" hap={it.primary ? 'impact' : 'tick'} scale={0.94} onClick={it.onClick} ariaLabel={it.label} className="flex w-[64px] cursor-pointer flex-col items-center gap-1.5">
          <div className={`flex h-[56px] w-[56px] items-center justify-center rounded-full ${it.primary ? 'bg-brand text-screen shadow-cta' : 'border border-border bg-surface text-brand shadow-card'}`}>{it.icon}</div>
          <div className="text-center text-[12px] font-semibold leading-tight text-ink">{it.label}</div>
        </Pressable>
      ))}
    </div>
  )
}
