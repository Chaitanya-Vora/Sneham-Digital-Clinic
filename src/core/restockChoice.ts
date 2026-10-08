import { RESTOCK_REMINDER_DAYS, RESTOCK_REMINDER_MAX_DAYS, RESTOCK_REMINDER_MIN_DAYS, RESTOCK_REMINDER_WINDOW_DAYS, addDaysISO, fromISO, todayISO, type ISODate } from './day'

// The refill reminder's day count: the usual choices one tap away, any other number a tap
// of + / − or typed in. The picker opens on the number she chose last time (remembered on
// this device only), so her own rhythm — say 30 — is the default she never has to set again.
export const RESTOCK_DAY_CHIPS = [14, 21, 30, 45]
const KEY = 'sneham-restock-days'

export function lastRestockDays(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isInteger(n) && n >= RESTOCK_REMINDER_MIN_DAYS && n <= RESTOCK_REMINDER_MAX_DAYS ? n : RESTOCK_REMINDER_DAYS
  } catch { return RESTOCK_REMINDER_DAYS }
}

export function rememberRestockDays(days: number) {
  try { localStorage.setItem(KEY, String(days)) } catch { /* storage unavailable */ }
}

/** The date a reminder set to `days` will first appear if the prescription is published today. */
export function restockFirstDate(days: number, from: ISODate = todayISO()): ISODate {
  return addDaysISO(from, days)
}

/** "Thu, 29 Oct" */
export function restockDateLabel(iso: ISODate): string {
  return fromISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export const RESTOCK_WINDOW_LABEL = `${RESTOCK_REMINDER_WINDOW_DAYS / 7} weeks`
