import { toISO, type ISODate } from './day'
import { minutesOfDay } from './clock'

// Date arithmetic for the Calendar tab's week and month views. Everything is
// Monday-first (the clinic's week) and works on local calendar days, never on
// timestamps, so a day can't slip across midnight.
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const addDaysTo = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const mondayOf = (d: Date) => addDaysTo(day(d), -((d.getDay() + 6) % 7))

export const weekOf = (d: Date): Date[] => { const m = mondayOf(d); return Array.from({ length: 7 }, (_, i) => addDaysTo(m, i)) }

/** Every week that touches the month, as full Monday–Sunday rows (4 to 6 of them). */
export function monthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const rows: Date[][] = []
  for (let m = mondayOf(first); m <= last; m = addDaysTo(m, 7)) rows.push(Array.from({ length: 7 }, (_, i) => addDaysTo(m, i)))
  return rows
}

/** One month on, keeping the day of the month where it exists (31 Jan → 28 Feb). */
export function shiftMonth(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay))
}
export const shiftWeek = (d: Date, n: number) => addDaysTo(d, 7 * n)

export interface DayLoad {
  count: number        // visits booked (cancelled ones are not counted)
  done: number         // of those, already seen
  blocked: boolean     // the clinic is off / blocked that day — nothing can be booked
  capacity?: number    // visits the day holds (working hours minus blocked time); the screen's default when absent
}
export const EMPTY_LOAD: DayLoad = { count: 0, done: 0, blocked: false }

/** How full a day is, for the bar under its number. */
export function loadBar(count: number, capacity: number): { fill: number; over: boolean } {
  if (count <= 0) return { fill: 0, over: false }
  // A visit booked on a day with no working hours is not "over capacity" — it is just there.
  if (capacity <= 0) return { fill: 1, over: false }
  return { fill: Math.min(1, count / capacity), over: count > capacity }
}

// ── working hours → how many visits a day holds ──
export interface WorkingHours {
  workingDays: string[]   // "Monday" …
  morningStart: string; morningEnd: string   // "09:00" "13:00"
  eveningStart: string; eveningEnd: string
}
export const SLOT_MINUTES = 30
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const dayName = (d: Date) => DAY_NAMES[d.getDay()]
export const isWorkingDay = (d: Date, hours: Pick<WorkingHours, 'workingDays'>) => hours.workingDays.includes(dayName(d))

/**
 * Visits a day holds: its working hours in half-hour slots, less whatever is blocked
 * (lunch, admin, leave). A day she does not work holds none.
 */
export function dayCapacity(d: Date, hours: WorkingHours, blocks: { startHour: number; durationMin: number }[]): { working: boolean; slots: number } {
  if (!isWorkingDay(d, hours)) return { working: false, slots: 0 }
  const sessions = [
    [minutesOfDay(hours.morningStart), minutesOfDay(hours.morningEnd)],
    [minutesOfDay(hours.eveningStart), minutesOfDay(hours.eveningEnd)],
  ].filter(([a, b]) => b > a)
  let open = 0
  let blocked = 0
  for (const [a, b] of sessions) {
    open += b - a
    for (const blk of blocks) {
      const from = Math.max(a, blk.startHour * 60)
      const to = Math.min(b, blk.startHour * 60 + blk.durationMin)
      if (to > from) blocked += to - from
    }
  }
  return { working: true, slots: Math.max(0, Math.floor((open - Math.min(blocked, open)) / SLOT_MINUTES)) }
}

export function monthSummary(loads: Map<ISODate, DayLoad>, year: number, month: number, today: Date, isOpenDay: (d: Date) => boolean = (d) => (d.getDay() + 6) % 7 <= 5) {
  let visits = 0
  let freeDays = 0
  let busiest: ISODate | null = null
  let busiestCount = 0
  const todayIso = toISO(today)
  for (let d = new Date(year, month, 1); d.getMonth() === month; d = addDaysTo(d, 1)) {
    const iso = toISO(d)
    const l = loads.get(iso) ?? EMPTY_LOAD
    visits += l.count
    if (l.count > busiestCount) { busiestCount = l.count; busiest = iso }
    if (l.count === 0 && !l.blocked && isOpenDay(d) && iso >= todayIso) freeDays++ // a working day, still ahead, nothing booked
  }
  return { visits, freeDays, busiest }
}

export const monthTitle = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
