import { toISO, type ISODate } from './day'

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

export interface DayLoad { count: number; done: number; blocked: boolean }
export const EMPTY_LOAD: DayLoad = { count: 0, done: 0, blocked: false }

/** How full a day is, for the bar under its number. */
export function loadBar(count: number, capacity: number): { fill: number; over: boolean } {
  if (count <= 0 || capacity <= 0) return { fill: 0, over: false }
  return { fill: Math.min(1, count / capacity), over: count > capacity }
}

export function monthSummary(loads: Map<ISODate, DayLoad>, year: number, month: number, today: Date) {
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
    const weekday = (d.getDay() + 6) % 7 // 0 = Mon … 6 = Sun
    if (l.count === 0 && !l.blocked && weekday <= 5 && iso >= todayIso) freeDays++ // Mon–Sat, still ahead
  }
  return { visits, freeDays, busiest }
}

export const monthTitle = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
