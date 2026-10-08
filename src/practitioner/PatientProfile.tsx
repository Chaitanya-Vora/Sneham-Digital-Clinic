import { useMemo, useRef, useState } from 'react'
import { ArrowCounterClockwise, CaretLeft, ClipboardText, CurrencyInr, NotePencil, Prescription as RxIcon, TestTube } from '@phosphor-icons/react'
import { useShallow } from 'zustand/react/shallow'
import { useClinic, selDosesFor, selPrescriptionsFor } from '../core/store'
import { daysFromToday } from '../core/followUpChoice'
import { followUpPresetDate, formatDayLabel } from '../core/day'
import { courseNote, courseOf, latestPublishedByPatient } from '../core/course'
import { buildEpisodes } from '../core/journey'
import { nextStepOf } from '../core/nextStep'
import { useBookFollowUp } from '../core/useFollowUpBooking'
import { shareViaWhatsApp } from '../core/share'
import type { Appointment } from '../core/types'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { useToast } from '../design-system/toast'
import { FollowUpSheet } from './FollowUpSheet'
import { EditPatientSheet, InvoiceSheet } from './PatientSearch'
import { ProfileHero } from './profile/ProfileHero'
import { ProfileMiniBar } from './profile/ProfileMiniBar'
import { NextStepCard, type NextStepView } from './profile/NextStepCard'
import { ActionDock } from './profile/ActionDock'
import { ClinicalSnapshot } from './profile/ClinicalSnapshot'
import { EpisodeJourney } from './profile/EpisodeJourney'
import { RxList } from './profile/RxList'
import { BillingList } from './profile/BillingList'
import { CancelRxSheet, CareSheet, CaseHistorySheet, HandoffSheet, OutcomeSheet, ProfileMenuSheet, ReassignSheet, RetakeSheet } from './profile/ProfileSheets'

type Tab = 'journey' | 'rx' | 'bills'

// A patient's profile: who they are and where they are in treatment (the ring), what to do
// next (one card), the five things a doctor does from here, a snapshot of the case, and the
// whole story underneath — grouped by remedy so it stays short.
export function PatientDetailScreen({ patientId, onBack, onOpenCase, onOpenFollowUp, onPrescribe, onOrderInvestigations, onStartVideo }: {
  patientId: string
  onBack: () => void
  onOpenCase: (patientId: string) => void
  onOpenFollowUp: (patientId: string) => void
  onPrescribe: () => void
  onOrderInvestigations: () => void
  onStartVideo?: (appointmentId: string) => void
}) {
  const ME = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const appointments = useClinic(useShallow((s) => s.appointments.filter((a) => a.patientId === patientId)))
  const allAppointments = useClinic((s) => s.appointments)
  const invoices = useClinic(useShallow((s) => s.invoices.filter((i) => i.patientId === patientId)))
  const prescriptions = useClinic(selPrescriptionsFor(patientId))
  const doses = useClinic(selDosesFor(patientId))
  const outcomes = useClinic(useShallow((s) => s.outcomes.filter((o) => o.patientId === patientId)))
  const investigationOrders = useClinic(useShallow((s) => s.investigationOrders.filter((o) => o.patientId === patientId)))
  const checkIns = useClinic(useShallow((s) => s.checkIns.filter((c) => c.patientId === patientId)))
  const caseVisits = useClinic(useShallow((s) => s.caseVisits.filter((v) => v.patientId === patientId)))
  const handoffs = useClinic(useShallow((s) => s.handoffs.filter((h) => h.patientId === patientId)))
  const caseRetakeActive = useClinic((s) => !!s.caseRetakeIntent[patientId])
  const startConsult = useClinic((s) => s.startConsult)
  const archivePatient = useClinic((s) => s.archivePatient)
  const restorePatient = useClinic((s) => s.restorePatient)
  const bookFollowUp = useBookFollowUp()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('journey')
  const [mini, setMini] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [careOpen, setCareOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [retakeOpen, setRetakeOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyVisitId, setHistoryVisitId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [billing, setBilling] = useState<{ appointmentId?: string; existingInvoice?: (typeof invoices)[number] } | null>(null)
  // The id stays after the sheet closes so its text doesn't change mid-exit.
  const [cancelRx, setCancelRx] = useState<{ id: string; open: boolean }>({ id: '', open: false })
  const [outcomeId, setOutcomeId] = useState<{ id: string; open: boolean }>({ id: '', open: false })
  const [exporting, setExporting] = useState(false)

  const latestRx = useMemo(() => latestPublishedByPatient(prescriptions).get(patientId) ?? null, [prescriptions, patientId])
  const course = courseOf(latestRx)
  const episodes = useMemo(
    () => buildEpisodes({ appointments, prescriptions, outcomes, caseVisits, investigationOrders, invoices, checkIns }).episodes,
    [appointments, prescriptions, outcomes, caseVisits, investigationOrders, invoices, checkIns],
  )
  const rxRows = useMemo(
    () => [...prescriptions]
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
      .map((rx) => ({ rx, course: rx.id === latestRx?.id ? course : null, isLatest: rx.id === latestRx?.id })),
    [prescriptions, latestRx, course],
  )

  if (!patient) {
    return (
      <div className="flex h-full flex-col bg-screen">
        <div className="px-[18px] pb-3 pt-[var(--app-top)]">
          <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <CaretLeft size={18} className="text-body" />
          </Pressable>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-[18px] text-center">
          <div className="font-display text-[16px] font-semibold text-ink">Patient not found</div>
          <div className="text-[13px] text-muted">This patient may have been removed or the link is out of date.</div>
          <Pressable hap="tick" onClick={onBack} className="mt-4 rounded-pill border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-body">Go back</Pressable>
        </div>
      </div>
    )
  }

  const first = patient.name.split(/\s+/)[0]
  const seen = appointments.filter((a) => a.status === 'Seen').length
  const loggedDoses = doses.filter((d) => d.loggedToday).length
  const adherence = doses.length > 0 ? Math.round((loggedDoses / doses.length) * 100) : null
  const owner = practitioners.find((p) => p.id === patient.owningPractitionerId)
  const coverage = handoffs.find((h) => h.status === 'accepted')
  const coverName = coverage ? practitioners.find((p) => p.id === coverage.toPractitionerId)?.name ?? 'A colleague' : null

  // ── what to do next ──
  const step = nextStepOf(appointments, course)
  const startNow = (appt: Appointment) => {
    const busy = allAppointments.find((a) => a.status === 'In consult' && a.practitionerId === ME && a.id !== appt.id)
    if (busy) { toast({ title: 'Finish your current consult first', message: 'End it from Today, then start this one.' }); return }
    startConsult(appt.id)
    haptic('success')
    toast({ title: `Consult started · ${patient.name}` })
    if (appt.type === 'Video') onStartVideo?.(appt.id)
  }
  const apptDetail = (a: Appointment) => [a.type, a.reason].filter(Boolean).join(' · ')
  const view: NextStepView =
    step.kind === 'inConsult'
      ? { kind: 'inConsult', detail: `${step.appt.type} · started ${step.appt.time}`, onContinue: () => (step.appt.type === 'Video' && onStartVideo ? onStartVideo(step.appt.id) : onOpenCase(patientId)) }
    : step.kind === 'today' && step.appt.practitionerId === ME
      ? { kind: 'today', title: `Today at ${step.appt.time}`, detail: apptDetail(step.appt), onStart: () => startNow(step.appt) }
    : step.kind === 'today'
      ? { kind: 'booked', title: `Today at ${step.appt.time}`, detail: `with ${practitioners.find((p) => p.id === step.appt.practitionerId)?.name ?? 'a colleague'} · ${apptDetail(step.appt)}` }
    : step.kind === 'booked'
      ? { kind: 'booked', title: `${formatDayLabel(step.appt.date)} · ${step.appt.time}`, detail: `in ${step.inDays} day${step.inDays === 1 ? '' : 's'} · ${apptDetail(step.appt)}` }
    : step.kind === 'needs'
      ? { kind: 'needs', urgent: step.urgent, detail: step.note, onBook: () => setFollowUpOpen(true) }
    : { kind: 'noRx', onPrescribe }

  const openHistory = (visitId: string | null) => { setHistoryVisitId(visitId); setHistoryOpen(true) }
  const startRetakeNow = () => onOpenCase(patientId)
  const rxToCancel = prescriptions.find((r) => r.id === cancelRx.id)
  const outcomeToShow = outcomes.find((o) => o.id === outcomeId.id)

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'journey', label: 'Journey', n: episodes.length },
    { id: 'rx', label: 'Prescriptions', n: prescriptions.length },
    { id: 'bills', label: 'Billing', n: invoices.length },
  ]

  return (
    <div className="relative h-full bg-screen">
      <div ref={scroller} onScroll={(e) => setMini(e.currentTarget.scrollTop > 230)} className="h-full overflow-y-auto no-scrollbar">
        <ProfileHero
          name={patient.name}
          initials={patient.initials}
          meta={[`${patient.age} yrs`, patient.sex, patient.location].filter(Boolean).join(' · ')}
          idLabel={`Patient ID ${patient.wsCode.replace('#WS-', '')}`}
          phone={patient.phone}
          course={course}
          visits={seen}
          lastSeen={patient.lastSeen}
          adherence={adherence}
          onBack={onBack}
          onMore={() => setMenuOpen(true)}
          onWhatsApp={() => {
            const ok = shareViaWhatsApp(patient.phone, `Hi ${first}, this is Sneham Digital Clinic.`)
            if (!ok) toast({ title: 'No phone number on file', message: 'Add a phone number for this patient first.' })
          }}
        />

        <div className="px-[18px]" style={{ paddingBottom: 'calc(var(--app-bottom) + 28px)' }}>
          <NextStepCard step={view} />
          {patient.archivedAt && (
            <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-border bg-surface px-4 py-3 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="font-display text-[14px] font-semibold text-ink">Archived</div>
                <div className="text-[12px] text-muted">Hidden from the active roster. Nothing was deleted.</div>
              </div>
              <Pressable hap="tick" onClick={() => { restorePatient(patient.id); toast({ title: 'Patient restored', message: `${patient.name} is back in the active roster.` }) }} className="flex shrink-0 items-center gap-1.5 rounded-pill bg-brand px-3.5 py-2 text-[13px] font-semibold text-screen"><ArrowCounterClockwise size={14} weight="bold" /> Restore</Pressable>
            </div>
          )}

          <ActionDock
            items={[
              { key: 'rx', label: 'Prescribe', icon: <RxIcon size={24} weight="fill" />, primary: true, onClick: onPrescribe },
              { key: 'case', label: 'Case', icon: <NotePencil size={23} />, dot: caseRetakeActive, onClick: () => onOpenCase(patientId) },
              { key: 'review', label: 'Review', icon: <ClipboardText size={23} />, onClick: () => onOpenFollowUp(patientId) },
              { key: 'tests', label: 'Tests', icon: <TestTube size={23} />, onClick: onOrderInvestigations },
              { key: 'bill', label: 'Bill', icon: <CurrencyInr size={23} />, onClick: () => setBilling({}) },
            ]}
          />

          <ClinicalSnapshot
            complaint={patient.chiefComplaint}
            allergies={patient.allergies ?? ''}
            medication={patient.regularMedication ?? ''}
            care={{
              initials: owner?.initials ?? '—',
              line: owner ? `Primary doctor: ${owner.id === ME ? 'You' : owner.name}` : 'Unassigned — open to the active team',
              coverage: coverName && coverage ? `${coverName} is covering until ${coverage.coveringUntil}` : undefined,
            }}
            onEdit={() => setEditOpen(true)}
            onOpenCare={() => setCareOpen(true)}
          />

          <div role="tablist" className="mt-6 flex gap-5 border-b border-border">
            {tabs.map((t) => (
              <Pressable key={t.id} hap="tick" onClick={() => setTab(t.id)} ariaLabel={`${t.label}, ${t.n}`} className={`relative -mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[14px] font-semibold ${tab === t.id ? 'border-brand text-ink' : 'border-transparent text-faint'}`}>
                {t.label}<span className={`rounded-pill px-1.5 text-[11px] ${tab === t.id ? 'bg-tint text-brand' : 'bg-screen text-faint'}`}>{t.n}</span>
              </Pressable>
            ))}
          </div>
          <div className="pt-4">
            {tab === 'journey' && (
              <EpisodeJourney
                episodes={episodes}
                onOpen={(ref) => {
                  if (ref.type === 'case') openHistory(ref.id)
                  else if (ref.type === 'outcome') setOutcomeId({ id: ref.id, open: true })
                  else setBilling({ appointmentId: undefined, existingInvoice: invoices.find((i) => i.id === ref.id) })
                }}
              />
            )}
            {tab === 'rx' && <RxList rows={rxRows} patientFirstName={first} onCancel={(rx) => setCancelRx({ id: rx.id, open: true })} />}
            {tab === 'bills' && (
              <BillingList
                invoices={invoices}
                onQuickBill={() => setBilling({})}
                onEdit={(inv) => setBilling({ appointmentId: inv.appointmentId, existingInvoice: inv })}
                onPrint={(inv) => { void import('../core/pdfExport').then((m) => m.exportInvoicePdf(inv, patient)).catch(() => {}) }}
              />
            )}
          </div>
        </div>
      </div>

      <ProfileMiniBar show={mini} name={patient.name} subtitle={course.state === 'none' ? 'No prescription yet' : courseNote(course)[0].toUpperCase() + courseNote(course).slice(1)} onBack={onBack} onMore={() => setMenuOpen(true)} />

      <FollowUpSheet
        open={followUpOpen}
        patientName={patient.name}
        onClose={() => setFollowUpOpen(false)}
        onSelect={(preset) => { setFollowUpOpen(false); bookFollowUp(patient, daysFromToday(followUpPresetDate(preset))) }}
      />

      <ProfileMenuSheet
        patient={patient}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        retakePending={caseRetakeActive}
        exporting={exporting}
        onBook={() => setFollowUpOpen(true)}
        onEdit={() => setEditOpen(true)}
        onCare={() => setCareOpen(true)}
        onRetake={() => setRetakeOpen(true)}
        onHistory={() => openHistory(null)}
        onExport={async () => {
          setExporting(true)
          try {
            await (await import('../core/pdfExport')).exportPatientHistoryPdf(patient, prescriptions, investigationOrders, outcomes)
          } catch (e) {
            toast({ title: 'Export failed', message: e instanceof Error ? e.message : 'Please try again.' })
          } finally {
            setExporting(false)
          }
        }}
        onArchive={() => {
          archivePatient(patient.id)
          toast({ title: 'Patient archived', message: `${patient.name} is hidden from the active roster.`, action: { label: 'Undo', onClick: () => restorePatient(patient.id) } })
          onBack()
        }}
        onRestore={() => { restorePatient(patient.id); toast({ title: 'Patient restored', message: `${patient.name} is back in the active roster.` }) }}
      />
      <CareSheet patient={patient} open={careOpen} onClose={() => setCareOpen(false)} onReassign={() => setReassignOpen(true)} onHandoff={() => setHandoffOpen(true)} />
      <ReassignSheet patient={patient} open={reassignOpen} onClose={() => setReassignOpen(false)} />
      <HandoffSheet patient={patient} open={handoffOpen} onClose={() => setHandoffOpen(false)} />
      <RetakeSheet patient={patient} open={retakeOpen} onClose={() => setRetakeOpen(false)} onStartNow={startRetakeNow} />
      <CaseHistorySheet patient={patient} open={historyOpen} onClose={() => setHistoryOpen(false)} initialVisitId={historyVisitId} />
      <OutcomeSheet outcome={outcomeToShow} open={outcomeId.open} onClose={() => setOutcomeId((o) => ({ ...o, open: false }))} />
      <CancelRxSheet patient={patient} rx={rxToCancel} open={cancelRx.open} onClose={() => setCancelRx((c) => ({ ...c, open: false }))} />
      <EditPatientSheet patient={patient} open={editOpen} onClose={() => setEditOpen(false)} />
      <InvoiceSheet patientId={patientId} open={billing !== null} appointmentId={billing?.appointmentId} existingInvoice={billing?.existingInvoice} onClose={() => setBilling(null)} />
    </div>
  )
}
