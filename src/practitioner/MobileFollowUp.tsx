import { useState } from 'react'
import { CaretLeft, TrendUp, Handshake, FloppyDisk, Check } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import type { CheckIn, OutcomeKind } from '../core/types'
import { addDaysISO, todayISO, formatDayLabel } from '../core/day'
import { Badge, BottomSheet, Button, Card, Chip, Label } from '../design-system/ui'

const OUTCOMES: OutcomeKind[] = ['Clear improvement', 'Partial', 'No change', 'Aggravation', 'Changed remedy']
// Compare data is derived from case visits — no hardcoded mock

const CHECKIN_TONE: Record<CheckIn['marked'], { border: string; bg: string; text: string; badge: 'green' | 'amber' | 'neutral'; label: string }> = {
  better: { border: 'border-green-border', bg: 'bg-tint', text: 'text-ink-deep', badge: 'green', label: 'Feeling better' },
  worse: { border: 'border-amber-border', bg: 'bg-amber-tint', text: 'text-amber-text', badge: 'amber', label: 'Needs attention' },
  same: { border: 'border-border', bg: 'bg-screen', text: 'text-muted', badge: 'neutral', label: 'No change' },
}

export function MobileFollowUp({
  patientId,
  onBack,
  onDone,
}: {
  patientId: string
  onBack: () => void
  onDone: () => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const doctorId = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners.filter((p) => p.id !== doctorId))
  const checkIn = useClinic((s) => s.checkIns.find((c) => c.patientId === patientId))
  const caseVisits = useClinic((s) => s.caseVisits.filter((v) => v.patientId === patientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
  const saveOutcome = useClinic((s) => s.saveOutcome)
  const createHandoff = useClinic((s) => s.createHandoff)

  const [outcome, setOutcome] = useState<OutcomeKind>('Partial')
  const [note, setNote] = useState(patient?.currentRemedy ? `Continue ${patient.currentRemedy}; review in two weeks.` : '')
  const [handoff, setHandoff] = useState(false)
  const [toId, setToId] = useState(practitioners[0]?.id ?? '')
  const [handoffReason, setHandoffReason] = useState('')
  const [coveringUntilDate, setCoveringUntilDate] = useState(addDaysISO(todayISO(), 7))
  const [saved, setSaved] = useState(false)

  if (!patient) return (
    <div className="flex h-full items-center justify-center bg-screen">
      <div className="text-center">
        <div className="text-[14px] text-muted">Patient not found</div>
        <button onClick={onBack} className="mt-3 text-[13px] font-semibold text-brand">Go back</button>
      </div>
    </div>
  )

  function save() {
    if (saved) return
    saveOutcome({ patientId, practitionerId: doctorId, remedy: patient?.currentRemedy ?? '—', outcome, note })
    setSaved(true)
  }

  return (
    <div className="flex h-full flex-col bg-screen">
      <div className="px-[18px] pb-2 pt-[var(--app-top)]">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-brand">
          <CaretLeft size={15} weight="bold" /> Back
        </button>
        <div className="mt-1 flex items-center gap-2">
          <div className="font-display text-[18px] font-bold text-ink">Follow-up review</div>
          {checkIn?.marked === 'better' && <Badge tone="green">Improving</Badge>}
          {checkIn?.marked === 'worse' && <Badge tone="amber">Needs attention</Badge>}
        </div>
        <div className="text-[12px] text-faint">{patient.name} · {patient.currentRemedy ?? 'No active remedy'}</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-[18px] pb-[120px] pt-2">
        {checkIn && (
          <Card className={`${CHECKIN_TONE[checkIn.marked].border} ${CHECKIN_TONE[checkIn.marked].bg} p-4`}>
            <div className="flex items-center justify-between">
              <Label>Patient check-in</Label>
              <Badge tone={CHECKIN_TONE[checkIn.marked].badge}>{CHECKIN_TONE[checkIn.marked].label}</Badge>
            </div>
            <p className={`mt-1.5 text-[12.5px] italic ${CHECKIN_TONE[checkIn.marked].text}`}>“{checkIn.freeText}”</p>
          </Card>
        )}

        {caseVisits.length > 0 && (
          <Card className="p-4">
            <Label>Visit history</Label>
            {caseVisits.slice(0, 4).map((v) => (
              <div key={v.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                <span className="flex-1 text-[13px] font-semibold text-ink">{new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                <span className="text-[12px] text-muted">{v.remedy ?? '—'}</span>
                {v.outcome && <Badge tone={v.outcome === 'Clear improvement' ? 'green' : 'neutral'}>{v.outcome}</Badge>}
              </div>
            ))}
          </Card>
        )}
        {caseVisits.length === 0 && (
          <Card className="px-4 py-6 text-center text-[13px] text-muted">No previous visits recorded yet.</Card>
        )}

        <div>
          <Label>Record the outcome</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {OUTCOMES.map((o) => <Chip key={o} selected={o === outcome} onClick={() => setOutcome(o)}>{o}</Chip>)}
          </div>
        </div>

        <div>
          <Label>Note for the record</Label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-y rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none focus:border-green-border"
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-surface/95 px-[18px] pb-[var(--app-bottom)] pt-3 backdrop-blur">
        <Button variant="ghost" className="flex-1" onClick={() => setHandoff(true)}>
          <Handshake size={16} /> Hand off
        </Button>
        <Button variant="primary" className="flex-1" onClick={save} disabled={saved}>
          <FloppyDisk size={16} /> Save outcome
        </Button>
      </div>

      {/* handoff sheet */}
      <BottomSheet open={handoff} onClose={() => setHandoff(false)}>
        <div className="font-display text-[17px] font-bold text-ink">Hand off {patient.name}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">Ownership stays with you while someone else covers.</div>
        <div className="mt-3 space-y-2">
          {practitioners.map((p) => (
            <button
              key={p.id}
              onClick={() => setToId(p.id)}
              className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left ${
                toId === p.id ? 'border-green-border bg-tint' : 'border-border bg-surface'
              }`}
            >
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{p.name}</div>
                <div className="text-[12px] text-muted">{p.specialty}</div>
              </div>
              {toId === p.id && <Check size={18} weight="bold" className="text-brand" />}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label>Covering until</Label>
          <input
            type="date"
            value={coveringUntilDate}
            min={addDaysISO(todayISO(), 1)}
            onChange={(e) => setCoveringUntilDate(e.target.value)}
            className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
          />
        </div>
        <div className="mt-3">
          <Label>Reason for handoff</Label>
          <input
            value={handoffReason}
            onChange={(e) => setHandoffReason(e.target.value)}
            placeholder="e.g. On leave next week"
            className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
          />
        </div>
        <Button
          variant="primary"
          className="mt-4 w-full"
          disabled={!handoffReason.trim()}
          onClick={() => {
            createHandoff({
              patientId,
              fromId: doctorId,
              toId,
              coveringUntil: formatDayLabel(coveringUntilDate),
              note: { currentRemedy: patient.currentRemedy ?? '—', caseStatus: `${outcome} at last review.`, reason: handoffReason.trim(), watchFor: note },
            })
            setHandoff(false)
            onDone()
          }}
        >
          Send handoff
        </Button>
      </BottomSheet>

      {/* saved confirmation */}
      <BottomSheet open={saved} onClose={() => { setSaved(false); onDone() }}>
        <div className="flex flex-col items-center py-3 text-center">
          <div className="animate-pop flex h-16 w-16 items-center justify-center rounded-full bg-tint text-accent">
            <Check size={32} weight="bold" />
          </div>
          <div className="mt-3 font-display text-[18px] font-bold text-ink">Outcome saved</div>
          <div className="mt-1 text-[13px] text-muted">{outcome} recorded for {patient.name}.</div>
          <Button variant="primary" className="mt-5 w-full" onClick={() => { setSaved(false); onDone() }}>Done</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
