import { useClinic } from '../core/store'
import { Avatar, Badge, BottomSheet, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { Phone, Prescription as RxIcon, NotePencil } from '@phosphor-icons/react'

// A quick "peek" at a patient — tapping a name on Today or Follow-ups opens
// this instead of committing straight to the full case sheet. Deliberately
// built from data already in the store (no new fetches), so it's instant.
export function PatientQuickView({
  patientId,
  onClose,
  onOpenCase,
  onPrescribe,
}: {
  patientId: string | null
  onClose: () => void
  onOpenCase: (id: string) => void
  onPrescribe: (id: string) => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const rxCount = useClinic((s) => (patientId ? s.prescriptions.filter((r) => r.patientId === patientId && r.status !== 'draft').length : 0))

  return (
    <BottomSheet open={!!patient} onClose={onClose}>
      {patient && (
        <>
          <div className="flex items-center gap-3">
            <Avatar initials={patient.initials} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[17px] font-bold text-ink">{patient.name}</div>
              <div className="truncate text-[12.5px] text-muted">{patient.age}y · {patient.sex} · {patient.wsCode}</div>
            </div>
            <Badge tone={patient.assignment === 'Mine' ? 'neutral' : 'amber'}>{patient.assignment}</Badge>
            {patient.phone && (
              <a
                href={`tel:${patient.phone}`}
                onClick={(e) => { e.stopPropagation(); haptic('tick') }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-body"
              >
                <Phone size={16} />
              </a>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-[14px] border border-border bg-surface px-3.5 py-3">
              <Label>Chief complaint</Label>
              <div className="mt-1 truncate text-[13px] font-medium text-ink">{patient.chiefComplaint || '—'}</div>
            </div>
            <div className="rounded-[14px] border border-border bg-surface px-3.5 py-3">
              <Label>Current remedy</Label>
              <div className="mt-1 truncate text-[13px] font-medium text-ink">{patient.currentRemedy || '—'}</div>
            </div>
            <div className="rounded-[14px] border border-border bg-surface px-3.5 py-3">
              <Label>Last seen</Label>
              <div className="mt-1 text-[13px] font-medium text-ink">{patient.lastSeen}</div>
            </div>
            <div className="rounded-[14px] border border-border bg-surface px-3.5 py-3">
              <Label>Prescriptions</Label>
              <div className="mt-1 text-[13px] font-medium text-ink">{rxCount} on record</div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Pressable
              hap="tick"
              onClick={() => { onClose(); onOpenCase(patient.id) }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-3 text-[13.5px] font-semibold text-body"
            >
              <NotePencil size={16} /> Case sheet
            </Pressable>
            <Pressable
              hap="impact"
              onClick={() => { onClose(); onPrescribe(patient.id) }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand py-3 text-[13.5px] font-semibold text-screen"
            >
              <RxIcon size={16} weight="fill" /> New prescription
            </Pressable>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
