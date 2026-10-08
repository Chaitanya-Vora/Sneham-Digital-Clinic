import { CaretRight, Handshake, PencilSimple, Warning } from '@phosphor-icons/react'
import { Avatar, Badge, Card, Label } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'

// What a doctor wants to know before she opens the case: the complaint, anything
// the patient is allergic to (in amber — it matters), regular medication, and
// who is looking after the patient.
export interface SnapshotProps {
  complaint: string
  allergies: string
  medication: string
  care: { initials: string; line: string; coverage?: string }
  onEdit: () => void
  onOpenCare: () => void
}

const split = (s: string) => s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)

export function ClinicalSnapshot({ complaint, allergies, medication, care, onEdit, onOpenCare }: SnapshotProps) {
  const allergyList = split(allergies)
  return (
    <Card className="mt-4 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="font-display text-[15px] font-semibold text-ink">Clinical snapshot</div>
        <Pressable hap="tick" onClick={onEdit} ariaLabel="edit patient details" className="relative tap-pad flex items-center gap-1 text-[12.5px] font-semibold text-brand"><PencilSimple size={14} /> Edit</Pressable>
      </div>
      <div className="mt-3">
        <Label>Chief complaint</Label>
        <div className={`mt-0.5 text-[14px] leading-snug ${complaint ? 'text-ink' : 'text-faint'}`}>{complaint || 'Not recorded'}</div>
      </div>
      {allergyList.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <Label className="flex items-center gap-1 !text-amber-text"><Warning size={12} weight="fill" /> Allergies</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{allergyList.map((a) => <Badge key={a} tone="amber">{a}</Badge>)}</div>
        </div>
      )}
      {medication.trim() && (
        <div className="mt-3 border-t border-border pt-3">
          <Label>Regular medication</Label>
          <div className="mt-0.5 text-[14px] leading-snug text-ink">{medication}</div>
        </div>
      )}
      <div className="mt-3 border-t border-border pt-1.5">
        <Pressable as="div" hap="tick" scale={0.99} onClick={onOpenCare} className="relative -mx-1 flex cursor-pointer items-center gap-2.5 rounded-[12px] px-1 py-1.5">
          <Avatar initials={care.initials} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">Care team</div>
            <div className="truncate text-[12px] text-muted">{care.line}</div>
          </div>
          <CaretRight size={15} className="text-faint" />
        </Pressable>
      </div>
      {care.coverage && (
        <div className="mt-2.5 flex items-center gap-2 rounded-[12px] border border-green-border bg-tint px-3 py-2 text-[12px] text-ink-deep">
          <Handshake size={15} weight="fill" className="shrink-0 text-brand" /> {care.coverage}
        </div>
      )}
    </Card>
  )
}
