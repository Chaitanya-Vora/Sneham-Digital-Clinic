import { useEffect, useState } from 'react'
import type { Appointment, TimeBlock, TimeBlockColor } from '../core/types'
import { BottomSheet, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { Minus, Plus, Check } from '@phosphor-icons/react'

// Shared styling for a block's color category — used both by this picker
// and by whatever draws blocks on a day grid, so the swatch someone taps
// here is exactly the color that shows up on the schedule.
export const BLOCK_COLORS: { key: TimeBlockColor; swatch: string; bg: string; border: string; text: string }[] = [
  { key: 'green', swatch: '#41603C', bg: 'bg-tint/70', border: 'border-green-border', text: 'text-ink-deep' },
  { key: 'amber', swatch: '#D8A24A', bg: 'bg-amber-tint/70', border: 'border-amber-border', text: 'text-amber-text' },
  { key: 'coral', swatch: '#B85A45', bg: 'bg-danger/10', border: 'border-danger/30', text: 'text-danger' },
  { key: 'purple', swatch: '#5C4A66', bg: 'bg-purple-tint/70', border: 'border-purple-border', text: 'text-purple' },
  { key: 'blue', swatch: '#4A6B85', bg: 'bg-[#E7EEF2]', border: 'border-[#C7D6DE]', text: 'text-[#2F4B5C]' },
]
export function blockColorStyle(color: TimeBlockColor) {
  return BLOCK_COLORS.find((c) => c.key === color) ?? BLOCK_COLORS[0]
}

const PRESETS = ['Lunch', 'Admin', 'Personal', 'Meeting']

// 30-min increments, 7 AM – 8 PM — a real time picker (not whole-hour-only),
// built the same way every other picker in this app is: an in-screen chip
// grid, never a native <input type="time"> (Android's native time/date
// popups have their own history of rendering corrupted in this app — see
// the transform-clearing fix elsewhere — so new pickers stay custom-built).
const TIME_OPTIONS: number[] = []
for (let h = 7; h <= 20; h += 0.5) TIME_OPTIONS.push(h)

function fmtClock(h: number): string {
  const hour = Math.floor(h)
  const min = Math.round((h - hour) * 60)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}

function overlaps(startA: number, durA: number, startB: number, durB: number): boolean {
  const endA = startA + durA / 60
  const endB = startB + durB / 60
  return startA < endB && startB < endA
}

export function BlockTimeSheet({
  open,
  existingBlocks,
  existingAppts,
  onClose,
  onConfirm,
}: {
  open: boolean
  // Same practitioner + same date's existing blocks/appointments — the
  // conflict check runs against exactly these, nothing fetched internally.
  existingBlocks: TimeBlock[]
  existingAppts: Appointment[]
  onClose: () => void
  onConfirm: (input: { startHour: number; durationMin: number; reason: string; color: TimeBlockColor }) => void
}) {
  const [startHour, setStartHour] = useState(13)
  const [durationMin, setDurationMin] = useState(60)
  const [reason, setReason] = useState('Lunch')
  const [color, setColor] = useState<TimeBlockColor>('green')
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    if (open) { setStartHour(13); setDurationMin(60); setReason('Lunch'); setColor('green'); setConflict(false) }
  }, [open])

  function checkConflict(sh: number, dur: number) {
    const hit =
      existingBlocks.some((b) => overlaps(sh, dur, b.startHour, b.durationMin)) ||
      existingAppts.some((a) => overlaps(sh, dur, parseApptHour(a.time), a.durationMin))
    setConflict(hit)
    return hit
  }

  function parseApptHour(time: string): number {
    const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!m) return 9
    let h = parseInt(m[1])
    const min = parseInt(m[2])
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h + min / 60
  }

  function handleConfirm() {
    if (checkConflict(startHour, durationMin)) { haptic('warn'); return }
    onConfirm({ startHour, durationMin, reason: reason.trim() || 'Blocked', color })
  }

  const style = blockColorStyle(color)

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Block time</div>

      <div className="mt-3">
        <Label>Start time</Label>
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
          {TIME_OPTIONS.map((h) => (
            <Chip key={h} selected={startHour === h} onClick={() => { haptic('select'); setStartHour(h); checkConflict(h, durationMin) }} className="text-[11px]">
              {fmtClock(h)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <Label>Duration</Label>
        <div className="mt-1.5 flex items-center gap-3">
          <Pressable ariaLabel="decrease duration" hap="tick" onClick={() => { const d = Math.max(15, durationMin - 15); setDurationMin(d); checkConflict(startHour, d) }} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <Minus size={15} />
          </Pressable>
          <div className="min-w-[64px] text-center font-display text-[16px] font-bold text-ink">
            {durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}` : `${durationMin}m`}
          </div>
          <Pressable ariaLabel="increase duration" hap="tick" onClick={() => { const d = Math.min(240, durationMin + 15); setDurationMin(d); checkConflict(startHour, d) }} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <Plus size={15} />
          </Pressable>
        </div>
      </div>

      <div className="mt-3">
        <Label>Purpose</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Chip key={p} selected={reason === p} onClick={() => { haptic('tick'); setReason(p) }} className="text-[12px]">{p}</Chip>
          ))}
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Team meeting, courier pickup"
          className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
        />
      </div>

      <div className="mt-3">
        <Label>Color</Label>
        <div className="mt-1.5 flex items-center gap-2.5">
          {BLOCK_COLORS.map((c) => (
            <Pressable
              key={c.key}
              ariaLabel={`${c.key} color`}
              hap="select"
              onClick={() => setColor(c.key)}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: c.swatch }}
            >
              {color === c.key && <Check size={16} weight="bold" className="text-white" />}
            </Pressable>
          ))}
        </div>
      </div>

      {conflict && (
        <div className="mt-3 rounded-[12px] border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[12.5px] font-medium text-danger">
          This overlaps with something already on the schedule — pick a different time.
        </div>
      )}

      <div className={`mt-3 rounded-[12px] border px-3.5 py-2.5 text-[12.5px] font-medium ${style.border} ${style.bg} ${style.text}`}>
        Preview: {reason.trim() || 'Blocked'} · {fmtClock(startHour)} – {fmtClock(startHour + durationMin / 60)}
      </div>

      <Pressable hap="success" onClick={handleConfirm} className="mt-4 flex w-full items-center justify-center rounded-pill bg-accent py-3 font-display text-[15px] font-semibold text-white shadow-float">
        Block time
      </Pressable>
    </BottomSheet>
  )
}
