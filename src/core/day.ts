// Single source of truth for "which day" in the schedule.
//
// Appointments and time blocks previously stored a *human label* in this field
// ("Today", "Sat", "Sun, 23 Aug"). Three incompatible formats were written by
// different screens and compared against each other, so a booking made on one
// surface was invisible on another — and anything saved as "Today" stayed
// "Today" forever. Everything now stores an ISO calendar date and formats the
// label at render time.

/** ISO calendar date, e.g. "2026-08-23". Always local-time, never UTC-shifted. */
export type ISODate = string

/** Local-time ISO date. `toISOString()` is deliberately avoided — it converts to
 *  UTC first, which rolls the date backwards for IST evenings. */
export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function isTodayISO(iso: ISODate): boolean {
  return iso === todayISO()
}

export function isPastISO(iso: ISODate): boolean {
  return iso < todayISO()
}

/** How a date is shown to the practitioner: relative when it is near, dated
 *  when it is not. */
export function formatDayLabel(iso: ISODate): string {
  if (!iso) return ''
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDaysISO(today, 1)) return 'Tomorrow'
  if (iso === addDaysISO(today, -1)) return 'Yesterday'

  const d = fromISO(iso)
  const withinWeek = Math.abs(d.getTime() - fromISO(today).getTime()) < 7 * 86400000
  return d.toLocaleDateString('en-IN',
    withinWeek
      ? { weekday: 'long' }
      : { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Long form for headers: "Sunday, 23 August". */
export function formatDayFull(iso: ISODate): string {
  if (!iso) return ''
  return fromISO(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
}

/** Reads any of the legacy label formats and returns a real date, so rows
 *  written before this change still land on a sensible day rather than
 *  disappearing from every view. */
export function normaliseDayValue(raw: string | null | undefined): ISODate {
  const today = todayISO()
  if (!raw) return today

  const value = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const lower = value.toLowerCase()
  if (lower === 'today') return today
  if (lower === 'tomorrow') return addDaysISO(today, 1)
  if (lower === 'yesterday') return addDaysISO(today, -1)

  // Bare weekday ("Sat") — the next occurrence, today included.
  const bare = WEEKDAY_TO_INDEX[lower.slice(0, 3)]
  if (bare !== undefined && lower.length <= 9) {
    const start = fromISO(today)
    for (let i = 0; i < 7; i++) {
      const probe = new Date(start)
      probe.setDate(probe.getDate() + i)
      if (probe.getDay() === bare) return toISO(probe)
    }
  }

  // "Sun, 23 Aug" / "23 Aug" — assume the current year, and roll to next year
  // if that date has already passed by more than a month.
  const parsed = Date.parse(`${value.replace(/^[A-Za-z]{3},\s*/, '')} ${new Date().getFullYear()}`)
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed)
    if (fromISO(today).getTime() - d.getTime() > 31 * 86400000) d.setFullYear(d.getFullYear() + 1)
    return toISO(d)
  }

  return today
}

/** Half-hour morning slots offered when auto-booking a follow-up, in order. */
export const MORNING_SLOTS = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM']

/** First morning slot on `date` not already taken by an existing appointment,
 *  so follow-ups booked back-to-back don't all land on the same hardcoded
 *  time. Falls back to the last slot if the whole morning is booked out. */
export function firstAvailableMorningSlot(appts: { date: ISODate; time: string }[], date: ISODate): string {
  const taken = new Set(appts.filter((a) => a.date === date).map((a) => a.time))
  return MORNING_SLOTS.find((t) => !taken.has(t)) ?? MORNING_SLOTS[MORNING_SLOTS.length - 1]
}
