import type { Prescription } from './types'
import { isRestockDue } from './day'

// Which published, opted-in prescriptions are due for a restock call right
// now — computed live, same as every other "due" stat in this app, no
// scheduled job. A reminder auto-resolves the moment a newer prescription
// for the same patient + remedy is published, on the assumption that
// republishing it is exactly what "she called about the refill" looks like
// in the data — no separate dismiss action needed.
export function restockRemindersDue(prescriptions: Prescription[], today: Date = new Date()): Prescription[] {
  const published = prescriptions.filter((p) => p.status === 'published' && p.publishedAt)
  return published.filter((p) => {
    if (!p.restockReminderEnabled || !isRestockDue(p.publishedAt!, today)) return false
    const supersededBy = published.find(
      (other) => other.patientId === p.patientId && other.remedy === p.remedy && other.publishedAt! > p.publishedAt!,
    )
    return !supersededBy
  })
}
