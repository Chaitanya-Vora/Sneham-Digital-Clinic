import { useEffect, useState } from 'react'
import { CalendarBlank, Clock, Minus, Plus } from '@phosphor-icons/react'
import { addDaysISO, todayISO, firstAvailableMorningSlot, customFollowUpPreset, MAX_FOLLOW_UP_DAYS, type FollowUpPreset } from '../core/day'
import { FOLLOW_UP_DAY_CHIPS, lastFollowUpDays, rememberFollowUpDays, followUpDateLabel, daysFromToday } from '../core/followUpChoice'
import { useClinic } from '../core/store'
import { BottomSheet, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'

// "Follow-up after how many days?" — one sheet for every place a follow-up is
// offered. The date it will land on (and the slot it will take) is on screen
// before she confirms; the usual choices are one tap, and any other number is
// a tap of + / − or typed in. Tapping the date opens the calendar instead.
export function FollowUpSheet({ open, patientName, onClose, onSelect }: { open: boolean; patientName: string; onClose: () => void; onSelect: (preset: FollowUpPreset) => void }) {
  const appts = useClinic((s) => s.appointments)
  const [text, setText] = useState(() => String(lastFollowUpDays()))
  useEffect(() => { if (open) setText(String(lastFollowUpDays())) }, [open])

  const n = Number(text)
  const valid = text.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_FOLLOW_UP_DAYS
  const date = valid ? addDaysISO(todayISO(), n) : null
  const slot = date ? firstAvailableMorningSlot(appts, date) : ''
  // Functional update: two quick taps must both count, so each reads the number it is stepping from.
  const step = (by: number) => setText((prev) => {
    const v = Number(prev)
    const from = prev.trim() !== '' && Number.isInteger(v) && v >= 1 && v <= MAX_FOLLOW_UP_DAYS ? v : lastFollowUpDays()
    return String(Math.min(MAX_FOLLOW_UP_DAYS, Math.max(1, from + by)))
  })
  const confirm = () => {
    if (!valid) return
    rememberFollowUpDays(n)
    onSelect(customFollowUpPreset(n))
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <div className="font-display text-[17px] font-bold text-ink">Follow-up</div>
          <div className="text-[12.5px] text-muted">{patientName}</div>
        </div>

        <div className="relative rounded-[16px] border border-border bg-surface px-4 py-3.5">
          <div className="font-display text-[26px] font-bold leading-tight text-ink">{date ? followUpDateLabel(date) : '—'}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">{valid ? `in ${n} day${n === 1 ? '' : 's'}` : `Enter 1 to ${MAX_FOLLOW_UP_DAYS} days`}</div>
          {slot && (
            <div className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
              <Clock size={14} weight="bold" /> First free slot, {slot}
            </div>
          )}
          <CalendarBlank size={20} className="absolute right-3.5 top-3.5 text-faint" aria-hidden="true" />
          <input
            type="date"
            min={addDaysISO(todayISO(), 1)}
            value={date ?? ''}
            onChange={(e) => { const d = e.target.value ? daysFromToday(e.target.value) : 0; if (d >= 1 && d <= MAX_FOLLOW_UP_DAYS) setText(String(d)) }}
            aria-label="Pick the follow-up date"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            data-selectable="true"
          />
        </div>

        <div>
          <Label>Days from today</Label>
          <div className="mt-1.5 flex gap-1.5">
            {FOLLOW_UP_DAY_CHIPS.map((d) => (
              <Pressable
                key={d}
                hap="tick"
                onClick={() => setText(String(d))}
                className={`flex-1 rounded-[12px] border py-2.5 text-center font-display text-[15px] font-semibold ${valid && n === d ? 'border-brand bg-brand text-screen' : 'border-border bg-surface text-ink'}`}
              >
                {d}
              </Pressable>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-3">
            <Pressable ariaLabel="One day earlier" hap="tick" onClick={() => step(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink">
              <Minus size={16} weight="bold" />
            </Pressable>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_FOLLOW_UP_DAYS}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirm() }}
                aria-label="Number of days until the follow-up"
                className="w-16 bg-transparent text-center font-display text-[24px] font-bold text-ink outline-none"
                data-selectable="true"
              />
              <span className="text-[13px] text-muted">days</span>
            </div>
            <Pressable ariaLabel="One day later" hap="tick" onClick={() => step(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink">
              <Plus size={16} weight="bold" />
            </Pressable>
          </div>
        </div>

        <Pressable
          hap="success"
          disabled={!valid}
          onClick={confirm}
          className={`w-full rounded-pill py-3 text-center font-display text-[15px] font-semibold text-screen shadow-float ${valid ? 'bg-brand' : 'bg-brand/40'}`}
        >
          {date ? `Schedule for ${followUpDateLabel(date)}` : 'Schedule follow-up'}
        </Pressable>
        <Pressable hap="tick" onClick={onClose} className="w-full py-1.5 text-center text-[13.5px] font-semibold text-muted">
          Skip for now
        </Pressable>
      </div>
    </BottomSheet>
  )
}
