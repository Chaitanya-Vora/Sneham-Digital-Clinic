import { useRef } from 'react'
import { motion } from 'framer-motion'
import { CaretDown, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Pressable } from '../../design-system/Pressable'
import { toISO, type ISODate } from '../../core/day'
import { EMPTY_LOAD, WEEKDAYS, loadBar, monthSummary, monthTitle, monthWeeks, sameDay, type DayLoad } from '../../core/calendarGrid'

// The Calendar tab's canvas: ONE grid that is either the whole month or just
// the selected week. Switching doesn't swap screens — the other weeks fold
// away (and unfold back), so it always feels like the same calendar, and the
// selected day stays put. Under each date a small bar shows how full that day
// is; hatched means the clinic is blocked that day.
//
//  - Tap a day: it becomes the selected day and the agenda below follows.
//  - Swipe sideways: previous / next week (or month, in month view).
//  - Tap the handle (or drag it down / up): open / close the month.
const ROW_H = 54
const EASE = [0.23, 1, 0.32, 1] as const

export type CalendarMode = 'week' | 'month'

export interface CalendarCanvasProps {
  selected: Date
  today: Date
  mode: CalendarMode
  loads: Map<ISODate, DayLoad>
  capacity: number // visits that fill a day, for any day whose load does not say
  isOpenDay?: (d: Date) => boolean // a day she works (for the "free days" count); Mon–Sat by default
  onSelect: (d: Date) => void
  onMode: (m: CalendarMode) => void
  onPage: (dir: -1 | 1) => void
  onToday: () => void
}

export function CalendarCanvas({ selected, today, mode, loads, capacity, isOpenDay, onSelect, onMode, onPage, onToday }: CalendarCanvasProps) {
  const weeks = monthWeeks(selected.getFullYear(), selected.getMonth())
  const activeRow = Math.max(0, weeks.findIndex((w) => w.some((d) => sameDay(d, selected))))
  const dir = useRef<1 | -1>(1)
  const summary = monthSummary(loads, selected.getFullYear(), selected.getMonth(), today, isOpenDay)
  const away = !weeks.some((w) => w.some((d) => sameDay(d, today))) || !sameDay(selected, today)

  const page = (d: -1 | 1) => { dir.current = d; onPage(d) }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Pressable hap="tick" onClick={() => onMode(mode === 'week' ? 'month' : 'week')} ariaLabel={mode === 'week' ? 'show whole month' : 'show this week only'} className="relative tap-pad-text flex items-center gap-1.5 text-left">
          <span className="font-display text-[22px] font-bold leading-tight text-ink">{monthTitle(selected)}</span>
          <CaretDown size={15} weight="bold" className={`mt-0.5 text-faint transition-transform duration-200 ${mode === 'month' ? 'rotate-180' : ''}`} />
        </Pressable>
        <div className="flex items-center gap-1.5">
          {away && (
            <Pressable hap="tick" onClick={onToday} className="rounded-pill border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-brand">Today</Pressable>
          )}
          <Pressable hap="tick" ariaLabel={mode === 'week' ? 'previous week' : 'previous month'} onClick={() => page(-1)} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><CaretLeft size={15} weight="bold" className="text-body" /></Pressable>
          <Pressable hap="tick" ariaLabel={mode === 'week' ? 'next week' : 'next month'} onClick={() => page(1)} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><CaretRight size={15} weight="bold" className="text-body" /></Pressable>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7">
        {WEEKDAYS.map((w) => <div key={w} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-label text-faint">{w[0]}</div>)}
      </div>

      <motion.div
        onPanEnd={(_, info) => { if (Math.abs(info.offset.x) > 48 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.4) page(info.offset.x < 0 ? 1 : -1) }}
        style={{ touchAction: 'pan-y' }}
      >
        <motion.div key={`${selected.getFullYear()}-${selected.getMonth()}-${mode === 'week' ? activeRow : 'm'}`} initial={{ opacity: 0, x: dir.current * 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, ease: EASE }}>
          {weeks.map((week, ri) => {
            const visible = mode === 'month' || ri === activeRow
            return (
              <motion.div
                key={ri}
                initial={false}
                animate={{ height: visible ? ROW_H : 0, opacity: visible ? 1 : 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                aria-hidden={!visible}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-7" style={{ height: ROW_H }}>
                  {week.map((d) => {
                    const iso = toISO(d)
                    const load = loads.get(iso) ?? EMPTY_LOAD
                    const isSel = sameDay(d, selected)
                    const isToday = sameDay(d, today)
                    const inMonth = d.getMonth() === selected.getMonth()
                    const bar = loadBar(load.count, load.capacity ?? capacity)
                    return (
                      <Pressable
                        key={iso}
                        hap="tick"
                        scale={0.94}
                        onClick={() => onSelect(d)}
                        disabled={!visible}
                        ariaLabel={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${load.blocked && load.count === 0 ? 'clinic closed' : load.count === 0 ? 'no visits' : `${load.count} visit${load.count === 1 ? '' : 's'}`}`}
                        className="flex flex-col items-center justify-center gap-1"
                      >
                        <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-full font-display text-[15px] font-semibold transition-colors duration-150 ${isSel ? 'bg-brand text-white' : isToday ? 'border-2 border-brand text-brand' : inMonth ? 'text-ink' : 'text-faint'}`}>{d.getDate()}</span>
                        {load.blocked && load.count === 0 ? (
                          <span aria-hidden="true" className="hatch h-[4px] w-[18px] rounded-full text-faint" />
                        ) : (
                          <span aria-hidden="true" className={`h-[4px] w-[18px] overflow-hidden rounded-full ${load.count > 0 ? 'bg-tint' : ''}`}>
                            <span className={`block h-full rounded-full ${bar.over ? 'bg-amber' : 'bg-brand'}`} style={{ width: `${bar.fill * 100}%` }} />
                          </span>
                        )}
                      </Pressable>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>

      <motion.div
        onPanEnd={(_, info) => { if (info.offset.y > 28) onMode('month'); else if (info.offset.y < -28) onMode('week') }}
        style={{ touchAction: 'none' }}
        className="flex justify-center"
      >
        <Pressable hap="tick" onClick={() => onMode(mode === 'week' ? 'month' : 'week')} ariaLabel={mode === 'week' ? 'show whole month' : 'show this week only'} className="relative tap-pad-y flex h-[18px] w-24 items-center justify-center">
          <span className="h-[4px] w-9 rounded-full bg-border-dash" />
        </Pressable>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ height: mode === 'month' ? 'auto' : 0, opacity: mode === 'month' ? 1 : 0 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="overflow-hidden"
      >
        <div className="pb-1 pt-1 text-center text-[12.5px] text-muted">
          <span className="font-semibold text-ink">{summary.visits}</span> visit{summary.visits === 1 ? '' : 's'} this month
          {summary.freeDays > 0 && <> · <span className="font-semibold text-ink">{summary.freeDays}</span> free day{summary.freeDays === 1 ? '' : 's'} ahead</>}
        </div>
      </motion.div>
    </div>
  )
}
