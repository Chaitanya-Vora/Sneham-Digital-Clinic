import type { Patient, Practitioner, Handoff } from './types'

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

// A Handoff never changes owningPractitionerId (that's the point — see the
// comment at the top of this file), so it was previously invisible
// everywhere an owner badge shows. This finds the one that's actually live
// right now.
//
// Deliberately checks status !== 'declined' rather than === 'accepted':
// acceptHandoff/declineHandoff exist in the store, but nothing in the app's
// UI ever calls acceptHandoff, so a real handoff never actually reaches
// 'accepted' — every handoff sent today sits at 'pending' forever. Gating
// on 'accepted' would make this badge never appear at all. Treating
// "not declined" as active matches what the app actually does today: the
// covering doctor is covering the moment the handoff is sent, with no
// separate confirmation step anywhere to wait on.
//
// Also excludes handoffs from before coveringUntilDate existed (undefined)
// rather than showing them as covering forever.
export function activeCoveringHandoff(patientId: string, handoffs: Handoff[], todayISO: string): Handoff | undefined {
  return handoffs.find((h) =>
    h.patientId === patientId &&
    h.status !== 'declined' &&
    !!h.coveringUntilDate &&
    h.coveringUntilDate >= todayISO,
  )
}
