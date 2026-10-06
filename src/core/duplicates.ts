import { useMemo } from 'react'
import type { Patient } from './types'

// "Is this person already in the roster?" — answered instantly, as the name or
// number is typed. Patients are indexed once (by normalised name and by the
// last ten digits of their phone), so each keystroke is two Map lookups rather
// than a scan, and nothing is sent anywhere: it runs on the data already on
// the device. Archived patients are left out — a restored one would be found
// through the archive, and matching them here would block re-registering.

// Same name ignoring case/spacing and a leading title — "Dr Ritu Shah" and
// "dr.  ritu   shah" are the near-identical spellings someone re-typing a name
// from memory produces.
export function normalisePatientName(name: string): string {
  return name.trim().toLowerCase().replace(/^(dr|mr|mrs|ms|miss)\.?\s+/, '').replace(/\s+/g, ' ')
}

// Indian mobile numbers are written many ways: "+91 98765 43210", "098765-43210",
// "9876543210". Comparing the last ten digits treats them all as the same.
// Anything shorter than a full number is not compared (a half-typed number
// would match everything).
export function normalisePhone(raw: string | undefined | null): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : ''
}

export interface PatientLookup {
  byName: Map<string, Patient[]>
  byPhone: Map<string, Patient[]>
}

export function buildPatientLookup(patients: Patient[]): PatientLookup {
  const byName = new Map<string, Patient[]>()
  const byPhone = new Map<string, Patient[]>()
  const add = (m: Map<string, Patient[]>, k: string, p: Patient) => {
    if (!k) return
    const list = m.get(k)
    if (list) list.push(p)
    else m.set(k, [p])
  }
  for (const p of patients) {
    if (p.archivedAt) continue
    add(byName, normalisePatientName(p.name), p)
    add(byPhone, normalisePhone(p.phone), p)
  }
  return { byName, byPhone }
}

export function usePatientLookup(patients: Patient[]): PatientLookup {
  return useMemo(() => buildPatientLookup(patients), [patients])
}

export interface PatientMatches {
  sameName: Patient[]
  // Same number, excluding anyone already listed as a same-name match.
  samePhone: Patient[]
}

const NONE: PatientMatches = { sameName: [], samePhone: [] }

export function findPatientMatches(lookup: PatientLookup, name: string, phone: string): PatientMatches {
  const n = normalisePatientName(name)
  const sameName = n ? lookup.byName.get(n) ?? [] : []
  const ph = normalisePhone(phone)
  const phoneHits = ph ? lookup.byPhone.get(ph) ?? [] : []
  const samePhone = sameName.length ? phoneHits.filter((p) => !sameName.includes(p)) : phoneHits
  if (!sameName.length && !samePhone.length) return NONE
  return { sameName, samePhone }
}
