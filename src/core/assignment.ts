import type { Patient, Practitioner } from './types'

// Who currently has a patient — always computed live from
// `owningPractitionerId` relative to whoever is asking, never read from
// Patient.assignment. That field is written per-action (e.g. "just
// assigned to me") and can't correctly describe the same patient to two
// different logged-in doctors at once, which is exactly what made it go
// stale/wrong after a reassignment.
export function ownerLabel(patient: Patient, viewerPractitionerId: string | null, practitioners: Practitioner[]): string {
  if (!patient.owningPractitionerId) return 'Unassigned'
  if (patient.owningPractitionerId === viewerPractitionerId) return 'Mine'
  return practitioners.find((p) => p.id === patient.owningPractitionerId)?.name ?? 'Assigned out'
}

export function ownerTone(patient: Patient, viewerPractitionerId: string | null): 'green' | 'amber' | 'neutral' {
  if (!patient.owningPractitionerId) return 'amber'
  if (patient.owningPractitionerId === viewerPractitionerId) return 'green'
  return 'neutral'
}

export function isMine(patient: Patient, viewerPractitionerId: string | null): boolean {
  return patient.owningPractitionerId === viewerPractitionerId
}

export function isUnassigned(patient: Patient): boolean {
  return !patient.owningPractitionerId
}

export function isAssignedToOthers(patient: Patient, viewerPractitionerId: string | null): boolean {
  return !!patient.owningPractitionerId && patient.owningPractitionerId !== viewerPractitionerId
}
