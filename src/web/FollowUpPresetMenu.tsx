import { CalendarPlus } from '@phosphor-icons/react'
import { FOLLOW_UP_PRESETS, type FollowUpPreset } from '../core/day'
import { Card } from '../design-system/ui'

// Small anchored dropdown, not a full modal — matches the template-picker
// popover already used in CaseSheet.tsx (absolute + top-full + shadow-float)
// rather than borrowing the mobile app's bottom sheet, which would look
// out of place on desktop.
export function FollowUpPresetMenu({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (preset: FollowUpPreset) => void }) {
  if (!open) return null
  return (
    <Card className="absolute right-0 top-full z-10 mt-1 w-56 p-2 shadow-float">
      <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-label text-faint">Schedule follow-up</div>
      {FOLLOW_UP_PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onSelect(preset)}
          className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-tint"
        >
          <CalendarPlus size={15} className="text-brand" /> In {preset}
        </button>
      ))}
      <button
        onClick={onClose}
        className="mt-1 w-full rounded-[8px] border-t border-border px-2.5 pt-2 text-left text-[12px] font-semibold text-faint hover:text-body"
      >
        Not now
      </button>
    </Card>
  )
}
