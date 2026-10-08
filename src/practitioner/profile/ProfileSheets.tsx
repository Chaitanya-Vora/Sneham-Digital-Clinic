import { useEffect, useState, type ReactNode } from 'react'
import {
  Archive, ArrowCounterClockwise, ArrowsCounterClockwise, ArrowsLeftRight, CalendarPlus, Check, ClockCounterClockwise, DownloadSimple, Handshake, PencilSimple, Prohibit, UsersThree,
} from '@phosphor-icons/react'
import { useShallow } from 'zustand/react/shallow'
import { CASE_RETAKE_APPT_MARKER, useClinic } from '../../core/store'
import { addDaysISO, firstAvailableMorningSlot, formatDayLabel, todayISO } from '../../core/day'
import { getSections, type CaseTemplateName } from '../../core/caseTemplate'
import type { Outcome, Patient, Prescription } from '../../core/types'
import { Avatar, Badge, BottomSheet, Button, Chip, Label } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'
import { haptic } from '../../design-system/haptics'
import { useToast } from '../../design-system/toast'
import { AttachmentList } from '../../components/FollowUpAttachments'

// The sheets that hang off a patient's profile. Each one owns its own form state, so the
// profile itself stays a calm layout.

const dateShort = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

// ── the ⋯ menu ──────────────────────────────────────────────────────────
function MenuRow({ icon, label, detail, tone, onClick, disabled }: { icon: ReactNode; label: string; detail?: string; tone?: 'brand' | 'danger'; onClick: () => void; disabled?: boolean }) {
  return (
    <Pressable as="div" hap="tick" scale={0.99} onClick={disabled ? undefined : onClick} className={`flex items-center gap-3 rounded-[14px] px-2 py-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className={tone === 'danger' ? 'text-danger' : 'text-brand'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-[14.5px] font-medium ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{label}</div>
        {detail && <div className="text-[12px] text-muted">{detail}</div>}
      </div>
    </Pressable>
  )
}

export function ProfileMenuSheet({ patient, open, onClose, retakePending, exporting, onBook, onEdit, onCare, onRetake, onHistory, onExport, onArchive, onRestore }: {
  patient: Patient; open: boolean; onClose: () => void; retakePending: boolean; exporting: boolean
  onBook: () => void; onEdit: () => void; onCare: () => void; onRetake: () => void; onHistory: () => void; onExport: () => void; onArchive: () => void; onRestore: () => void
}) {
  const close = (fn: () => void) => () => { onClose(); fn() }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">{patient.name}</div>
      <div className="mt-2 space-y-0.5">
        <MenuRow icon={<CalendarPlus size={20} />} label="Book a follow-up" onClick={close(onBook)} />
        <MenuRow icon={<PencilSimple size={20} />} label="Edit patient details" onClick={close(onEdit)} />
        <MenuRow icon={<UsersThree size={20} />} label="Care team" detail="Reassign or hand off" onClick={close(onCare)} />
        <MenuRow icon={<ArrowsCounterClockwise size={20} />} label={retakePending ? 'Case retake pending' : 'Case retake'} detail={retakePending ? undefined : "A fresh case-taking when the remedy hasn't worked"} disabled={retakePending} onClick={close(onRetake)} />
        <MenuRow icon={<ClockCounterClockwise size={20} />} label="Case history" detail="Every case-taking and retake" onClick={close(onHistory)} />
        <MenuRow icon={<DownloadSimple size={20} />} label={exporting ? 'Exporting…' : 'Export patient summary (PDF)'} onClick={close(onExport)} />
        {patient.archivedAt
          ? <MenuRow icon={<ArrowCounterClockwise size={20} />} label="Restore patient" onClick={close(onRestore)} />
          : <MenuRow icon={<Archive size={20} />} label="Archive patient" detail="Hidden from the active roster — nothing is deleted" onClick={close(onArchive)} />}
      </div>
    </BottomSheet>
  )
}

// ── care team ───────────────────────────────────────────────────────────
export function CareSheet({ patient, open, onClose, onReassign, onHandoff }: { patient: Patient; open: boolean; onClose: () => void; onReassign: () => void; onHandoff: () => void }) {
  const ME = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const handoffs = useClinic(useShallow((s) => s.handoffs.filter((h) => h.patientId === patient.id)))
  const owner = practitioners.find((p) => p.id === patient.owningPractitionerId)
  const coverage = handoffs.find((h) => h.status === 'accepted')
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Care team</div>
      <div className="mt-0.5 text-[12.5px] text-muted">{owner ? `Primary doctor: ${owner.id === ME ? 'You' : owner.name}` : 'Unassigned — open to the active team'}</div>
      {coverage && (
        <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-green-border bg-tint px-3 py-2">
          <Handshake size={15} weight="fill" className="shrink-0 text-brand" />
          <div className="text-[12.5px] text-ink-deep">{practitioners.find((p) => p.id === coverage.toPractitionerId)?.name ?? 'A colleague'} is covering until {coverage.coveringUntil}</div>
        </div>
      )}
      <div className="mt-3 space-y-0.5">
        <MenuRow icon={<ArrowsLeftRight size={20} />} label="Reassign" detail="Change who owns this patient's care going forward" onClick={() => { onClose(); onReassign() }} />
        <MenuRow icon={<Handshake size={20} />} label="Hand off" detail="Someone covers for a while — ownership stays with you" onClick={() => { onClose(); onHandoff() }} />
      </div>
    </BottomSheet>
  )
}

// ── reassign — permanent change of primary doctor ───────────────────────
export function ReassignSheet({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const practitioners = useClinic((s) => s.practitioners)
  const assignPatient = useClinic((s) => s.assignPatient)
  const toast = useToast()
  const candidates = practitioners.filter((p) => p.status === 'active' && p.id !== patient.owningPractitionerId)
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Reassign {patient.name}</div>
      <div className="mt-0.5 text-[12.5px] text-muted">Change who owns this patient's care going forward.</div>
      <div className="mt-3 space-y-2">
        {candidates.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              assignPatient(patient.id, p.id)
              onClose()
              haptic('success')
              toast({ title: 'Patient reassigned', message: `${patient.name} is now assigned to ${p.name}.` })
            }}
            className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-left"
          >
            <Avatar initials={p.initials} size={36} />
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-ink">{p.name}</div>
              <div className="text-[12px] text-muted">{p.specialty}</div>
            </div>
          </button>
        ))}
        {candidates.length === 0 && <div className="py-6 text-center text-[13px] text-muted">No other active practitioners to reassign to.</div>}
      </div>
    </BottomSheet>
  )
}

// ── hand off — temporary coverage, ownership stays with the current doctor ──
export function HandoffSheet({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const ME = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const createHandoff = useClinic((s) => s.createHandoff)
  const toast = useToast()
  const candidates = practitioners.filter((p) => p.status === 'active' && p.id !== ME)
  const [toId, setToId] = useState('')
  const [until, setUntil] = useState(addDaysISO(todayISO(), 7))
  const [caseStatus, setCaseStatus] = useState('')
  const [reason, setReason] = useState('')
  const [watchFor, setWatchFor] = useState('')
  useEffect(() => { if (open) setToId(candidates[0]?.id ?? '') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Hand off {patient.name}</div>
      <div className="mt-0.5 text-[12.5px] text-muted">Ownership stays with you while someone else covers.</div>
      <div className="mt-3 space-y-2">
        {candidates.map((p) => (
          <button
            key={p.id}
            onClick={() => setToId(p.id)}
            className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left ${toId === p.id ? 'border-green-border bg-tint' : 'border-border bg-surface'}`}
          >
            <Avatar initials={p.initials} size={36} />
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-ink">{p.name}</div>
              <div className="text-[12px] text-muted">{p.specialty}</div>
            </div>
            {toId === p.id && <Check size={18} weight="bold" className="text-brand" />}
          </button>
        ))}
        {candidates.length === 0 && <div className="py-4 text-center text-[13px] text-muted">No other active practitioners to hand off to.</div>}
      </div>
      <div className="mt-3">
        <Label>Covering until</Label>
        <input type="date" value={until} min={addDaysISO(todayISO(), 1)} onChange={(e) => setUntil(e.target.value)} className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border" data-selectable="true" />
      </div>
      <div className="mt-3">
        <Label>Case status</Label>
        <input value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)} placeholder={`e.g. Stable on ${patient.currentRemedy ?? 'current remedy'}, review in 2 weeks`} className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border" />
      </div>
      <div className="mt-3">
        <Label>Reason for handoff</Label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. On leave next week" className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border" />
      </div>
      <div className="mt-3">
        <Label>What to watch for</Label>
        <textarea value={watchFor} onChange={(e) => setWatchFor(e.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none focus:border-green-border" />
      </div>
      <Button
        variant="primary"
        className="mt-4 w-full"
        disabled={!reason.trim() || !toId}
        onClick={() => {
          createHandoff({
            patientId: patient.id,
            fromId: ME,
            toId,
            coveringUntil: formatDayLabel(until),
            coveringUntilDate: until,
            note: { currentRemedy: patient.currentRemedy ?? '—', caseStatus: caseStatus.trim() || 'No status given.', reason: reason.trim(), watchFor },
          })
          onClose()
          haptic('success')
          toast({ title: 'Handoff sent', message: `${practitioners.find((p) => p.id === toId)?.name ?? 'Your colleague'} will be notified.` })
          setCaseStatus(''); setReason(''); setWatchFor('')
        }}
      >
        Send handoff
      </Button>
    </BottomSheet>
  )
}

// ── case retake — reason first, then either start now or schedule it as a real appointment ──
export function RetakeSheet({ patient, open, onClose, onStartNow }: { patient: Patient; open: boolean; onClose: () => void; onStartNow: () => void }) {
  const ME = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const allAppointments = useClinic((s) => s.appointments)
  const startCaseRetake = useClinic((s) => s.startCaseRetake)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const lastVisit = useClinic((s) => s.caseVisits.filter((v) => v.patientId === patient.id).sort((a, b) => b.date.localeCompare(a.date))[0])
  const toast = useToast()
  const active = practitioners.filter((p) => p.status === 'active')
  const owner = practitioners.find((p) => p.id === patient.owningPractitionerId)
  const [reason, setReason] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(addDaysISO(todayISO(), 7))
  useEffect(() => { if (open) { setReason(''); setScheduling(false) } }, [open])

  return (
    <BottomSheet open={open} onClose={onClose}>
      {!scheduling ? (
        <>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-purple-tint text-purple"><ArrowsCounterClockwise size={18} weight="fill" /></div>
            <div className="font-display text-[17px] font-bold text-ink">Case retake</div>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">A fresh case-taking after the remedy hasn't worked. The current notes stay on record as their own visit.</p>
          {lastVisit && (
            <div className="mt-3 rounded-[10px] bg-tint-pale px-3 py-2 text-[12px] text-muted">
              Last visit: {dateShort(lastVisit.date)} &middot; {lastVisit.remedy ?? 'no remedy recorded'}
            </div>
          )}
          <div className="mt-3">
            <Label>Reason for retake</Label>
            <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No improvement after 4 weeks" rows={2} className="mt-1.5 w-full resize-y rounded-[12px] border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-body outline-none focus:border-purple-border" />
          </div>
          <Pressable
            hap="tick"
            onClick={() => {
              if (!reason.trim()) return
              startCaseRetake(patient.id, reason.trim())
              onClose()
              onStartNow()
            }}
            className={`mt-4 flex w-full items-center justify-center rounded-pill py-2.5 text-[13px] font-semibold text-screen ${reason.trim() ? 'bg-purple' : 'bg-purple/40'}`}
          >
            Retake now — patient's with me
          </Pressable>
          <Pressable
            hap="tick"
            onClick={() => { if (!reason.trim()) return; setDoctorId(owner?.id ?? ME); setScheduling(true) }}
            className={`mt-2 flex w-full items-center justify-center rounded-pill border py-2.5 text-[13px] font-semibold ${reason.trim() ? 'border-purple-border text-purple' : 'border-border text-faint'}`}
          >
            Schedule for later
          </Pressable>
        </>
      ) : (
        <>
          <Pressable hap="tick" onClick={() => setScheduling(false)} className="relative tap-pad-text text-[13px] font-semibold text-brand">&larr; Back</Pressable>
          <div className="mt-1 font-display text-[17px] font-bold text-ink">Schedule retake</div>
          <div className="mt-3">
            <Label>Doctor</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {active.map((p) => <Chip key={p.id} selected={doctorId === p.id} onClick={() => setDoctorId(p.id)}>{p.name}</Chip>)}
            </div>
          </div>
          <div className="mt-3">
            <Label>Date</Label>
            <input type="date" value={date} min={addDaysISO(todayISO(), 1)} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-purple-border" data-selectable="true" />
          </div>
          <Button
            variant="primary"
            className="mt-4 w-full !bg-purple"
            onClick={() => {
              const time = firstAvailableMorningSlot(allAppointments, date)
              scheduleFollowUp({ patientId: patient.id, practitionerId: doctorId, time, date, type: 'In person', reason: CASE_RETAKE_APPT_MARKER + reason.trim() })
              onClose()
              setScheduling(false)
              haptic('success')
              toast({ title: 'Retake scheduled', message: `${formatDayLabel(date)} · ${time}` })
            }}
          >
            Book retake
          </Button>
        </>
      )}
    </BottomSheet>
  )
}

// ── case history — every case-taking and retake, as it was written ──────
export function CaseHistorySheet({ patient, open, onClose, initialVisitId }: { patient: Patient; open: boolean; onClose: () => void; initialVisitId: string | null }) {
  const visits = useClinic(useShallow((s) => s.caseVisits.filter((v) => v.patientId === patient.id)))
  const templates = useClinic((s) => s.caseTemplates)
  const sorted = [...visits].sort((a, b) => b.date.localeCompare(a.date))
  const [visitId, setVisitId] = useState<string | null>(initialVisitId)
  useEffect(() => { if (open) setVisitId(initialVisitId ?? sorted[0]?.id ?? null) }, [open, initialVisitId]) // eslint-disable-line react-hooks/exhaustive-deps
  const visit = sorted.find((v) => v.id === visitId)

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Case history &middot; {patient.name}</div>
      {sorted.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-muted">No visits recorded yet.</div>
      ) : (
        <>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {sorted.map((v) => (
              <button key={v.id} onClick={() => setVisitId(v.id)} className={`shrink-0 rounded-[12px] border px-3 py-2 text-left ${visitId === v.id ? 'border-green-border bg-tint' : 'border-border bg-surface'}`}>
                <div className="text-[12px] font-semibold text-ink">{dateShort(v.date)}</div>
                {v.isRetake && <Badge tone="purple">Retake</Badge>}
              </button>
            ))}
          </div>
          {visit && (() => {
            const viewSections = getSections((visit.template as CaseTemplateName) ?? 'chronic', templates)
            const sections = visit.sections as Record<string, { fields?: Record<string, string>; chips?: Record<string, string[]> } | undefined>
            return (
              <div className="mt-3 max-h-[50vh] space-y-3 overflow-y-auto">
                {visit.isRetake && visit.retakeReason && <div className="rounded-[10px] border border-purple-border bg-purple-tint px-3 py-2 text-[12.5px] text-purple">{visit.retakeReason}</div>}
                {viewSections.map((s) => {
                  const state = sections?.[s.id]
                  const hasFields = Object.values(state?.fields ?? {}).some((v) => v?.trim())
                  const hasChips = Object.values(state?.chips ?? {}).some((arr) => arr?.length)
                  if (!hasFields && !hasChips) return null
                  return (
                    <div key={s.id}>
                      <Label>{s.title}</Label>
                      {s.fields.map((f) => {
                        if (f.type === 'chips') {
                          const selected = state?.chips?.[f.key] ?? []
                          if (!selected.length) return null
                          return <div key={f.key} className="mt-1 flex flex-wrap gap-1.5">{selected.map((v) => <span key={v} className="rounded-pill bg-tint px-2 py-0.5 text-[12px] text-body">{v}</span>)}</div>
                        }
                        const val = state?.fields?.[f.key] ?? ''
                        if (!val.trim()) return null
                        return <p key={f.key} className="mt-1 text-[12.5px] leading-relaxed text-body">{val}</p>
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </>
      )}
    </BottomSheet>
  )
}

// ── a follow-up review, as it was recorded ──────────────────────────────
export function OutcomeSheet({ outcome, open, onClose }: { outcome: Outcome | undefined; open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      {outcome && (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-[17px] font-bold text-ink">Follow-up review</div>
              <div className="text-[12.5px] text-muted">{new Date(outcome.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <Badge tone={outcome.outcome === 'Clear improvement' ? 'green' : outcome.outcome === 'Partial' ? 'amber' : outcome.outcome === 'Aggravation' ? 'danger' : 'neutral'}>{outcome.outcome}</Badge>
          </div>
          <div className="mt-3 rounded-[12px] bg-screen px-3.5 py-2.5">
            <Label>Remedy reviewed</Label>
            <div className="mt-0.5 text-[14px] font-semibold text-ink">{outcome.remedy}</div>
          </div>
          {outcome.note ? <p className="mt-3 text-[13.5px] leading-relaxed text-body">{outcome.note}</p> : <p className="mt-3 text-[13px] text-muted">No note was written.</p>}
          <AttachmentList attachments={outcome.attachments} />
        </div>
      )}
    </BottomSheet>
  )
}

// ── cancel / discard a prescription ─────────────────────────────────────
export function CancelRxSheet({ patient, rx, open, onClose }: { patient: Patient; rx: Prescription | undefined; open: boolean; onClose: () => void }) {
  const cancelPrescription = useClinic((s) => s.cancelPrescription)
  const toast = useToast()
  const draft = rx?.status === 'draft'
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><Prohibit size={28} weight="bold" /></div>
        <div className="mt-3 font-display text-[17px] font-bold text-ink">{draft ? 'Discard this draft?' : 'Cancel this prescription?'}</div>
        <div className="mt-1 text-[13px] text-muted">{rx ? `${rx.remedy} ${rx.potency}` : ''}</div>
        <div className="mt-2 text-[12.5px] leading-relaxed text-muted">
          {draft ? 'It was never sent to the patient.' : `It disappears from ${patient.name.split(' ')[0]}'s app and its dose reminders stop. It stays in your records, marked cancelled.`}
        </div>
        <div className="mt-4 flex w-full gap-2">
          <Pressable hap="tick" onClick={onClose} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Keep it</Pressable>
          <Pressable
            hap="impact"
            onClick={() => {
              if (rx) cancelPrescription(rx.id)
              onClose()
              toast({ title: draft ? 'Draft discarded' : 'Prescription cancelled' })
            }}
            className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white"
          >
            {draft ? 'Discard' : 'Cancel it'}
          </Pressable>
        </div>
      </div>
    </BottomSheet>
  )
}
