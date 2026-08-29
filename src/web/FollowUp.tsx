import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TrendUp, TrendDown, Minus, Handshake, FloppyDisk, X, CheckCircle } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import type { OutcomeKind } from '../core/types'
import { Avatar, Badge, Button, Card, Chip, Label, PatientNotFound } from '../design-system/ui'
import { useToast } from '../design-system/toast'
import { addDaysISO, todayISO, formatDayLabel } from '../core/day'

const OUTCOMES: OutcomeKind[] = ['Clear improvement', 'Partial', 'No change', 'Aggravation', 'Changed remedy']

const COMPARE = [
  { field: 'Sleep onset', then: '60–90 min', now: '20 min', dir: 'up' },
  { field: 'Night waking', then: '3–4 times', now: 'Once', dir: 'up' },
  { field: 'Morning energy', then: 'Exhausted', now: 'Fair', dir: 'up' },
  { field: 'Irritability', then: 'High', now: 'Moderate', dir: 'up' },
  { field: 'Appetite', then: 'Low', now: 'Normal', dir: 'up' },
] as const

export function FollowUp({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const doctorId = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const checkIn = useClinic((s) => s.checkIns.find((c) => c.patientId === patientId))
  const pastOutcomes = useClinic((s) => s.outcomes.filter((o) => o.patientId === patientId))
  const saveOutcome = useClinic((s) => s.saveOutcome)
  const createHandoff = useClinic((s) => s.createHandoff)
  const toast = useToast()

  const [outcome, setOutcome] = useState<OutcomeKind>('Partial')
  const [note, setNote] = useState('')
  const [handoffOpen, setHandoffOpen] = useState(false)

  const ciTone = checkIn?.marked === 'worse' ? 'amber' as const : checkIn?.marked === 'better' ? 'green' as const : undefined
  const ciLabel = checkIn?.marked === 'worse' ? 'Needs attention' : checkIn?.marked === 'better' ? 'Feeling better' : 'No change'
  const ciCardCls = ciTone === 'amber' ? 'border-amber-border bg-amber-tint' : ciTone === 'green' ? 'border-green-border bg-tint-pale' : 'border-border bg-surface'
  const ciTextCls = ciTone === 'amber' ? 'text-amber-text' : ciTone === 'green' ? 'text-ink' : 'text-muted'
  const ciBarCls = ciTone === 'amber' ? 'bg-amber' : ciTone === 'green' ? 'bg-success' : 'bg-faint'

  if (!patient) return <PatientNotFound onBack={onBack} />

  function onSave() {
    if (!patient) return
    saveOutcome({ patientId, practitionerId: doctorId, remedy: patient.currentRemedy ?? '—', outcome, note })
    toast({ title: 'Outcome saved', message: `${outcome} recorded for ${patient.name}.` })
    onBack()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-[13px] font-semibold text-brand">← {patient.name}</button>
          <h1 className="mt-1 font-display text-[20px] font-bold text-ink">Follow-up · {patient.name}</h1>
          <div className="text-[12.5px] text-faint">Initial case 12 Jun → today · {patient.currentRemedy} · day 16 of 28</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHandoffOpen(true)}>
            <Handshake size={15} /> Hand off this follow-up
          </Button>
          <Button variant="primary" size="sm" onClick={onSave}>
            <FloppyDisk size={15} /> Save outcome
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <div className="space-y-4">
          {/* comparison */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-ink">Initial vs today</h2>
              <Badge tone="green">+65% overall</Badge>
            </div>
            <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 border-b border-border pb-2">
              {['Symptom', '12 Jun', '26 Jul', ''].map((h, i) => <Label key={i}>{h}</Label>)}
            </div>
            {COMPARE.map((r) => (
              <div key={r.field} className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-2 border-b border-border py-3 last:border-0">
                <span className="text-[13.5px] font-semibold text-ink">{r.field}</span>
                <span className="text-[13px] text-muted">{r.then}</span>
                <span className="text-[13px] font-semibold text-body">{r.now}</span>
                <span className="text-success"><TrendUp size={17} weight="bold" /></span>
              </div>
            ))}
          </Card>

          {/* outcome */}
          <Card className="p-5">
            <Label>Record the outcome</Label>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <Chip key={o} selected={o === outcome} onClick={() => setOutcome(o)}>{o}</Chip>
              ))}
            </div>
            <div className="mt-4">
              <Label>Note for the record</Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-2 w-full resize-y rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-body outline-none focus:border-green-border"
              />
            </div>
          </Card>
        </div>

        {/* right rail */}
        <div className="space-y-4">
          {checkIn && (
            <Card className={`${ciCardCls} p-5`}>
              <div className="flex items-center justify-between">
                <Label>Their own check-in</Label>
                <Badge tone={ciTone}>{ciLabel}</Badge>
              </div>
              <p className={`mt-2 text-[13px] italic leading-relaxed ${ciTextCls}`}>"{checkIn.freeText}"</p>
              <div className="mt-3 h-2 overflow-hidden rounded-pill bg-white/60">
                <div className={`h-full rounded-pill ${ciBarCls}`} style={{ width: `${checkIn.improvementPct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {checkIn.changeChips.map((c) => <Badge key={c} tone={ciTone} className="!bg-white/70">{c}</Badge>)}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <Label>Past responses to this remedy</Label>
            <div className="mt-3 space-y-3">
              {pastOutcomes.map((o) => (
                <div key={o.id} className="flex items-start gap-2.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${o.outcome === 'Clear improvement' ? 'bg-success' : o.outcome === 'No change' ? 'bg-faint' : 'bg-amber'}`} />
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{o.remedy} · {o.outcome}</div>
                    <div className="text-[12px] text-muted">{new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} — {o.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex items-center gap-3 p-4">
            <Avatar initials="NT" size={38} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-ink">Dr. Neha Tripathi</div>
              <div className="text-[12px] text-faint">Case owner · assignee for this follow-up</div>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {handoffOpen && (
          <HandoffDrawer
            patientId={patientId}
            fromId={doctorId}
            practitioners={practitioners.filter((p) => p.id !== doctorId)}
            onClose={() => setHandoffOpen(false)}
            onSend={(toId, watchFor) => {
              createHandoff({
                patientId,
                fromId: doctorId,
                toId,
                coveringUntil: formatDayLabel(addDaysISO(todayISO(), 7)),
                note: {
                  currentRemedy: patient.currentRemedy ?? '—',
                  caseStatus: `${outcome} at last review.`,
                  reason: 'Covering the follow-up.',
                  watchFor,
                },
              })
              setHandoffOpen(false)
              const to = practitioners.find((p) => p.id === toId)
              toast({ title: 'Follow-up assigned', message: `${to?.name} is covering ${patient.name} for 7 days. Ownership stays with you.` })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function HandoffDrawer({
  patientId,
  practitioners,
  onClose,
  onSend,
}: {
  patientId: string
  fromId: string
  practitioners: { id: string; name: string; initials: string; specialty: string; openCases: number }[]
  onClose: () => void
  onSend: (toId: string, watchFor: string) => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const [toId, setToId] = useState(practitioners[0]?.id ?? '')
  const [watchFor, setWatchFor] = useState('')

  useEffect(() => {
    if (!patient) onClose()
  }, [patient, onClose])

  if (!patient) return null

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/25" onClick={onClose} />
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed right-0 top-0 z-[75] flex h-full w-[420px] flex-col bg-screen shadow-modal"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="font-display text-[16px] font-bold text-ink">Assign follow-up</div>
            <div className="text-[12px] text-faint">{patient.name}</div>
          </div>
          <button onClick={onClose} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <Label>Who’s covering</Label>
            <div className="mt-2 space-y-2">
              {practitioners.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setToId(p.id)}
                  className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition ${
                    toId === p.id ? 'border-green-border bg-tint' : 'border-border bg-surface hover:bg-surface-hover'
                  }`}
                >
                  <Avatar initials={p.initials} size={38} />
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{p.name}</div>
                    <div className="text-[12px] text-muted">{p.specialty} · {p.openCases} open</div>
                  </div>
                  {toId === p.id && <CheckCircle size={20} weight="fill" className="text-brand" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>What to watch for (required)</Label>
            <textarea
              value={watchFor}
              onChange={(e) => setWatchFor(e.target.value)}
              rows={4}
              className="mt-2 w-full resize-y rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-body outline-none focus:border-green-border"
            />
          </div>

          <Card className="bg-purple-tint p-4">
            <div className="text-[12.5px] font-semibold text-purple">Reverts automatically</div>
            <p className="mt-1 text-[12px] text-purple/80">Cover expires {formatDayLabel(addDaysISO(todayISO(), 7))} and the case returns to you. {patient.name} will be told a colleague is covering.</p>
          </Card>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" disabled={!toId || !watchFor.trim()} onClick={() => onSend(toId, watchFor)}>
            Send handoff
          </Button>
        </div>
      </motion.div>
    </>
  )
}
