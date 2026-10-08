import { AnimatePresence, motion } from 'framer-motion'
import { CaretLeft, DotsThreeVertical } from '@phosphor-icons/react'
import { Pressable } from '../../design-system/Pressable'

// When the hero has scrolled away, a slim green bar keeps the name, back and
// the menu within reach.
export function ProfileMiniBar({ show, name, subtitle, onBack, onMore }: { show: boolean; name: string; subtitle?: string; onBack: () => void; onMore: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.18 }}
          className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 bg-brand/95 px-[18px] pb-2.5 pt-[var(--app-top)] text-screen shadow-float backdrop-blur-md"
        >
          <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><CaretLeft size={18} weight="bold" /></Pressable>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[16px] font-bold leading-tight">{name}</div>
            {subtitle && <div className="truncate text-[11.5px] text-white/70">{subtitle}</div>}
          </div>
          <Pressable ariaLabel="more actions" hap="tick" onClick={onMore} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><DotsThreeVertical size={18} weight="bold" /></Pressable>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
