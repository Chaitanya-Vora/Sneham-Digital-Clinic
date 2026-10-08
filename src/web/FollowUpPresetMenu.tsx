import { useState } from 'react'
import { CalendarPlus } from '@phosphor-icons/react'
import { FOLLOW_UP_PRESETS, MAX_FOLLOW_UP_DAYS, customFollowUpPreset, followUpPresetDate, formatDayLabel, type FollowUpPreset } from '../core/day'
import { Card } from '../design-system/ui'

// Small anchored dropdown, not a full modal — matches the template-picker
// popover already used in CaseSheet.tsx (absolute + top-full + shadow-float)
// rather than borrowing the mobile app's bottom sheet, which would look
// out of place on desktop.
export function FollowUpPresetMenu({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (preset: FollowUpPreset) => void }) {
  // "Custom": the number of days is typed (10, 20 …) instead of picked from the list.
  const [days, setDays] = useState('')
  if (!open) return null
  const n = Number(days)
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_FOLLOW_UP_DAYS
  const confirmCustom = () => { if (valid) onSelect(customFollowUpPreset(n)) }
  return (
    <Card className="absolute right-0 top-full z-10 mt-1 w-64 p-2 shadow-float">
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
      <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2">
        <div className="text-[12px] font-semibold text-ink">Custom — after</div>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={MAX_FOLLOW_UP_DAYS}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmCustom() }}
            placeholder="10"
            aria-label="Number of days until the follow-up"
            className="w-20 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-green-border"
          />
          <span className="text-[12.5px] text-body">days</span>
          <button
            onClick={confirmCustom}
            disabled={!valid}
            className="ml-auto rounded-pill bg-brand px-3 py-1.5 text-[12px] font-semibold text-screen transition disabled:opacity-40"
          >
            Schedule
          </button>
        </div>
        {valid && <div className="mt-1.5 text-[11.5px] text-muted">{formatDayLabel(followUpPresetDate(customFollowUpPreset(n)))}</div>}
      </div>
      <button
        onClick={onClose}
        className="mt-1 w-full rounded-[8px] border-t border-border px-2.5 pt-2 text-left text-[12px] font-semibold text-faint hover:text-body"
      >
        Not now
      </button>
    </Card>
  )
}
