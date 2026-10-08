import { useEffect, useState } from 'react'
import { Clock } from '@phosphor-icons/react'
import { MAX_FOLLOW_UP_DAYS, addDaysISO, todayISO, firstAvailableMorningSlot, customFollowUpPreset, type FollowUpPreset } from '../core/day'
import { FOLLOW_UP_DAY_CHIPS, lastFollowUpDays, rememberFollowUpDays, followUpDateLabel } from '../core/followUpChoice'
import { useClinic } from '../core/store'
import { Card } from '../design-system/ui'

// Small anchored popover, not a full modal — matches the template-picker
// popover already used in CaseSheet.tsx (absolute + top-full + shadow-float)
// rather than borrowing the mobile app's bottom sheet, which would look
// out of place on desktop. Same idea as the phone's follow-up sheet: the date
// and slot are shown before she confirms; a chip for the usual day counts, or
// any number typed in. Opens on the number she chose last time.
export function FollowUpPresetMenu({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (preset: FollowUpPreset) => void }) {
  const appts = useClinic((s) => s.appointments)
  const [text, setText] = useState(() => String(lastFollowUpDays()))
  useEffect(() => { if (open) setText(String(lastFollowUpDays())) }, [open])
  if (!open) return null

  const n = Number(text)
  const valid = text.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_FOLLOW_UP_DAYS
  const date = valid ? addDaysISO(todayISO(), n) : null
  const slot = date ? firstAvailableMorningSlot(appts, date) : ''
  const confirm = () => {
    if (!valid) return
    rememberFollowUpDays(n)
    onSelect(customFollowUpPreset(n))
  }

  return (
    <Card className="absolute right-0 top-full z-10 mt-1 w-72 p-3 shadow-float">
      <div className="text-[11px] font-semibold uppercase tracking-label text-faint">Schedule follow-up</div>
      <div className="mt-2 rounded-[10px] bg-tint px-3 py-2.5">
        <div className="font-display text-[19px] font-bold leading-tight text-ink">{date ? followUpDateLabel(date) : '—'}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
          {valid ? <>in {n} day{n === 1 ? '' : 's'}{slot && <><span aria-hidden="true">·</span><Clock size={12} weight="bold" className="text-brand" /> {slot}</>}</> : `Enter 1 to ${MAX_FOLLOW_UP_DAYS} days`}
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {FOLLOW_UP_DAY_CHIPS.map((d) => (
          <button
            key={d}
            onClick={() => setText(String(d))}
            className={`flex-1 rounded-[8px] border py-1.5 text-center text-[13px] font-semibold transition ${valid && n === d ? 'border-brand bg-brand text-screen' : 'border-border bg-surface text-ink hover:bg-tint'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
        <span>or</span>
        <input
          type="number"
          min={1}
          max={MAX_FOLLOW_UP_DAYS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm() }}
          aria-label="Number of days until the follow-up"
          className="w-16 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-center text-[13px] font-semibold text-ink outline-none focus:border-green-border"
        />
        <span>days</span>
      </div>
      <button
        onClick={confirm}
        disabled={!valid}
        className="mt-3 w-full rounded-pill bg-brand py-2 text-[13px] font-semibold text-screen transition disabled:opacity-40"
      >
        {date ? `Schedule for ${followUpDateLabel(date)}` : 'Schedule'}
      </button>
      <button
        onClick={onClose}
        className="mt-1.5 w-full py-1 text-center text-[12px] font-semibold text-faint hover:text-body"
      >
        Not now
      </button>
    </Card>
  )
}
