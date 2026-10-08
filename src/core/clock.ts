// Clock helpers shared by the schedule screens. Times in the app are "9:30 AM" strings;
// these turn them into numbers and back.

/** "9:30 AM" → minutes after midnight (so 10:00 AM sorts after 9:30 AM). 0 when it cannot be read. */
export function minutesFromMidnight(time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return 0
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2])
}

/** "9:30 AM" → 9.5 (hours, decimal), 9 when it cannot be read. */
export function parseTime(time: string): number {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 9
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h + min / 60
}

/** 13.25 → "1:15 PM" */
export function formatDecimalTime(t: number): string {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** "09:00" (a time input's value) → 540 minutes after midnight. */
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}
