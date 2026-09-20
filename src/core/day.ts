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

export type FollowUpPreset = '1 week' | '2 weeks' | '1 month'
export const FOLLOW_UP_PRESETS: FollowUpPreset[] = ['1 week', '2 weeks', '1 month']

/** Shared with every "schedule a follow-up" entry point (Today tab, patient
 *  profile, case sheet, follow-up review) so "2 weeks" means the same date
 *  everywhere, computed once instead of four slightly-driftable copies. */
export function followUpPresetDate(preset: FollowUpPreset, from: Date = new Date()): ISODate {
  const days = { '1 week': 7, '2 weeks': 14, '1 month': 30 }[preset]
  const dt = new Date(from)
  dt.setDate(dt.getDate() + days)
  return toISO(dt)
}

// How long after publishing a course of medicine to nudge about a refill
// call, and how long that nudge stays visible before it quietly ages out
// (rather than nagging forever if she decides not to restock).
export const RESTOCK_REMINDER_DAYS = 21
export const RESTOCK_REMINDER_WINDOW_DAYS = 14

/** Whole days between an ISO timestamp (e.g. Prescription.publishedAt) and
 *  today — used for the restock-reminder window, computed live on every
 *  render, the same way Follow-ups due already is. No scheduled job. */
export function daysSince(isoTimestamp: string, today: Date = new Date()): number {
  const then = new Date(isoTimestamp)
  const msPerDay = 86400000
  // Compare calendar dates, not exact 24h spans, so "published this
  // morning" reads as day 0 all day rather than flipping to day 1 by
  // evening.
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

export function isRestockDue(publishedAt: string, today: Date = new Date()): boolean {
  const d = daysSince(publishedAt, today)
  return d >= RESTOCK_REMINDER_DAYS && d <= RESTOCK_REMINDER_DAYS + RESTOCK_REMINDER_WINDOW_DAYS
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

/** Minutes since midnight for a "9:30 AM"-style time string — for sorting
 *  appointments within a single day. */
export function minutesFromMidnight(time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return 0
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h * 60 + Number(m[2])
}

/** Chronological sort key combining an ISO date and a "9:30 AM" time string —
 *  comparing `time` strings alone (e.g. "10:00 AM".localeCompare("9:30 AM"))
 *  sorts lexicographically, not chronologically, and silently ignores the
 *  date entirely, so a slot next week can read as "sooner" than one today. */
export function dateTimeKey(date: ISODate, time: string): number {
  return fromISO(date).getTime() + minutesFromMidnight(time) * 60000
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
