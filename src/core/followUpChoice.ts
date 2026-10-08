import { MAX_FOLLOW_UP_DAYS, fromISO, todayISO, type ISODate } from './day'

// The follow-up picker: quick day counts she uses most, plus whatever number
// she typed. It opens on the number she chose last time, so her usual follow-up
// is one tap away. Remembered on this device only.
export const FOLLOW_UP_DAY_CHIPS = [7, 10, 15, 20, 30]
const DEFAULT_DAYS = 15
const KEY = 'sneham-followup-days'

export function lastFollowUpDays(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isInteger(n) && n >= 1 && n <= MAX_FOLLOW_UP_DAYS ? n : DEFAULT_DAYS
  } catch { return DEFAULT_DAYS }
}

export function rememberFollowUpDays(days: number) {
  try { localStorage.setItem(KEY, String(days)) } catch { /* storage unavailable */ }
}

/** "Thu, 22 Oct" — the date a follow-up lands on, always with its weekday. */
export function followUpDateLabel(iso: ISODate): string {
  return fromISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Whole days from today to `iso` (negative for the past). */
export function daysFromToday(iso: ISODate): number {
  return Math.round((fromISO(iso).getTime() - fromISO(todayISO()).getTime()) / 86400000)
}
