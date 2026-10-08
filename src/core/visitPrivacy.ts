import type { Appointment } from './types'

// A visit the doctor booked for her own reference is never shown to the patient: not in
// the app, not announced, not part of their history. The doctor's own screens show every
// visit. This is the one rule every patient-facing list goes through.
export const isVisibleToPatient = (a: Pick<Appointment, 'hiddenFromPatient'>): boolean => !a.hiddenFromPatient

/** Only the visits this patient is meant to see. */
export function visitsForPatient<T extends Pick<Appointment, 'patientId' | 'hiddenFromPatient'>>(appointments: T[], patientId: string): T[] {
  return appointments.filter((a) => a.patientId === patientId && isVisibleToPatient(a))
}
