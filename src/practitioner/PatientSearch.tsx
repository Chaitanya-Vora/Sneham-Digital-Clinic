import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDayLabel, toISO, todayISO, addDaysISO, firstAvailableMorningSlot } from '../core/day'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CaretLeft,
  MagnifyingGlass,
  X,
  NotePencil,
  ArrowsClockwise,
  ArrowsLeftRight,
  Prescription,
  CalendarPlus,
  Clock,
  Flask,
  Plus,
  UserPlus,
  UsersThree,
  ChatCircleDots,
  CurrencyInr,
  Printer,
  PencilSimple,
  TestTube,
  ClipboardText,
  Heartbeat,
  Handshake,
  Check,
} from '@phosphor-icons/react'
import { useClinic, selPrescriptionsFor, selDosesFor } from '../core/store'
import type { Appointment, Patient, Invoice, InvoiceLineItem, PaymentMode, ReferralSource } from '../core/types'
import { Avatar, Badge, BottomSheet, Button, Card, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, pushVariants, listContainer, listItem } from '../design-system/motion'
import { CountUp, ProgressBar } from '../design-system/feedback'
import { PullToRefresh } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { exportInvoicePdf, exportPatientHistoryPdf } from '../core/pdfExport'
import { DEFAULT_CONSULT_FEE, invoiceTotal } from '../core/billing'
import { Archive, ArrowCounterClockwise, DownloadSimple, DotsThreeVertical, Phone, WhatsappLogo } from '@phosphor-icons/react'
import { shareViaWhatsApp } from '../core/share'
import { PatientQuickView } from './PatientQuickView'

const REFERRAL_SOURCES: ReferralSource[] = ['Offline', 'Instagram', 'References', 'Referral']

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other']
const INVOICE_STATUS_TONE = { paid: 'green', partial: 'amber', unpaid: 'amber', waived: 'neutral', cancelled: 'danger' } as const
const INVOICE_STATUS_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', waived: 'Waived', cancelled: 'Cancelled' } as const

/** `Patient.lastSeen` is a free-form display label ("Today", "10 Jul", "04 Jul") — not
 *  an ISO date — so it can't be sorted lexicographically. This resolves it to a
 *  rough timestamp for recency ordering only, assuming the current year and rolling
 *  back a year if that lands in the future (lastSeen is always in the past). */
function lastSeenTimestamp(label: string): number {
  const now = new Date()
  const lower = label.trim().toLowerCase()
  if (lower === 'today') return now.getTime()
  if (lower === 'yesterday') return now.getTime() - 86400000
  const parsed = Date.parse(`${label} ${now.getFullYear()}`)
  if (!Number.isNaN(parsed)) {
    return parsed > now.getTime() ? Date.parse(`${label} ${now.getFullYear() - 1}`) : parsed
  }
  return 0
}

// ─────────────────────────────────────────────────────────────
// 1. PatientSearchSheet — full-screen search overlay
// ─────────────────────────────────────────────────────────────

export function PatientSearchSheet({
  open,
  onClose,
  onSelect,
  onAddPatient,
  quickView,
}: {
  open: boolean
  onClose: () => void
  onSelect: (patientId: string) => void
  onAddPatient: () => void
  // When provided, tapping a result opens a quick-view peek first (Case
  // sheet / New prescription / View full profile) instead of jumping
  // straight to patient detail — used by the header search. Omitted for the
  // quick-bill search, which should stay a single fast tap to pick a payer.
  quickView?: { onOpenCase: (patientId: string) => void; onPrescribe: (patientId: string) => void }
}) {
  const patients = useClinic((s) => s.patients)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetTransformRef = useRef<HTMLDivElement>(null)
  const [peekPatientId, setPeekPatientId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return [...patients]
        .sort((a, b) => lastSeenTimestamp(b.lastSeen) - lastSeenTimestamp(a.lastSeen))
        .slice(0, 5)
    }
    const q = query.toLowerCase()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.wsCode.toLowerCase().includes(q) ||
        p.chiefComplaint.toLowerCase().includes(q) ||
        (p.currentRemedy?.toLowerCase().includes(q) ?? false),
    )
  }, [query, patients])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={sheetTransformRef}
          className="absolute inset-0 z-50 flex flex-col bg-screen"
          variants={pushVariants}
          custom={1}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring}
          onAnimationComplete={(def) => {
            if (def === 'center') sheetTransformRef.current?.style.setProperty('transform', 'none')
          }}
        >
          {/* header + search */}
          <div className="flex items-center gap-2 px-[18px] pb-2 pt-[var(--app-top)]">
            <Pressable ariaLabel="back" hap="tick" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
              <CaretLeft size={18} className="text-body" />
            </Pressable>
            <div className="flex flex-1 items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-2">
              <MagnifyingGlass size={16} className="text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, WS code, complaint, remedy..."
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
                data-selectable="true"
              />
              {query && (
                <Pressable ariaLabel="clear" hap="tick" onClick={() => setQuery('')} className="text-faint">
                  <X size={14} />
                </Pressable>
              )}
            </div>
            <Pressable ariaLabel="add patient" hap="tick" onClick={onAddPatient} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand">
              <Plus size={18} weight="bold" />
            </Pressable>
          </div>

          {/* label */}
          <div className="px-[18px] py-1.5">
            <Label>{query.trim() ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'Recent patients'}</Label>
          </div>

          {/* results */}
          <div className="flex-1 overflow-y-auto px-[18px] pb-[var(--app-bottom)]">
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2">
              {filtered.map((p) => (
                <motion.div key={p.id} variants={listItem}>
                  <Pressable
                    as="div"
                    hap="tick"
                    scale={0.99}
                    onClick={() => {
                      if (quickView) setPeekPatientId(p.id)
                      else { onSelect(p.id); onClose() }
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-border bg-surface px-3.5 py-3 shadow-card"
                  >
                    <Avatar initials={p.initials} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[14px] font-semibold text-ink">{p.name}</div>
                      <div className="truncate text-[12px] text-muted">
                        {p.age}y &middot; {p.chiefComplaint}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {p.currentRemedy && <Badge tone="green">{p.currentRemedy}</Badge>}
                      <span className="text-[11px] text-faint">{p.lastSeen}</span>
                    </div>
                  </Pressable>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-[13px] text-muted">No patients found.</div>
              )}
            </motion.div>
          </div>

          {quickView && (
            <PatientQuickView
              patientId={peekPatientId}
              onClose={() => setPeekPatientId(null)}
              onOpenCase={(id) => { onClose(); quickView.onOpenCase(id) }}
              onPrescribe={(id) => { onClose(); quickView.onPrescribe(id) }}
              onViewProfile={(id) => { onSelect(id); onClose() }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────
// 2. PatientDetailScreen — full-screen patient detail view
// ─────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'history' | 'prescriptions'

export function PatientDetailScreen({
  patientId,
  onBack,
  onOpenCase,
  onOpenFollowUp,
  onPrescribe,
  onOrderInvestigations,
}: {
  patientId: string
  onBack: () => void
  onOpenCase: (patientId: string) => void
  onOpenFollowUp: (patientId: string) => void
  onPrescribe: () => void
  onOrderInvestigations: () => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const appointments = useClinic((s) => s.appointments.filter((a) => a.patientId === patientId))
  const allAppointments = useClinic((s) => s.appointments)
  const invoices = useClinic((s) => s.invoices.filter((i) => i.patientId === patientId))
  const prescriptions = useClinic(selPrescriptionsFor(patientId))
  const doses = useClinic(selDosesFor(patientId))
  const outcomes = useClinic((s) => s.outcomes.filter((o) => o.patientId === patientId))
  const investigationOrders = useClinic((s) => s.investigationOrders.filter((o) => o.patientId === patientId))
  const checkIns = useClinic((s) => s.checkIns.filter((c) => c.patientId === patientId))
  const archivePatient = useClinic((s) => s.archivePatient)
  const restorePatient = useClinic((s) => s.restorePatient)
  const toast = useToast()

  const ME = useClinic((s) => s.currentPractitionerId)
  const practitioners = useClinic((s) => s.practitioners)
  const assignPatient = useClinic((s) => s.assignPatient)
  const createHandoff = useClinic((s) => s.createHandoff)
  const handoffs = useClinic((s) => s.handoffs.filter((h) => h.patientId === patientId))

  const scheduleFollowUpAction = useClinic((s) => s.scheduleFollowUp)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [billing, setBilling] = useState<{ appointmentId?: string; existingInvoice?: Invoice } | null>(null)
  // null = showing the preset list; a date string = the "Custom" picker is open
  const [customDate, setCustomDate] = useState<string | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [handoffToId, setHandoffToId] = useState('')
  const [handoffCoveringUntil, setHandoffCoveringUntil] = useState(addDaysISO(todayISO(), 7))
  const [handoffCaseStatus, setHandoffCaseStatus] = useState('')
  const [handoffReason, setHandoffReason] = useState('')
  const [handoffWatchFor, setHandoffWatchFor] = useState('')

  if (!patient) {
    return (
      <div className="flex h-full flex-col bg-screen">
        <div className="px-[18px] pb-3 pt-[var(--app-top)]">
          <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <CaretLeft size={18} className="text-body" />
          </Pressable>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-[18px] text-center">
          <div className="font-display text-[16px] font-semibold text-ink">Patient not found</div>
          <div className="text-[13px] text-muted">This patient may have been removed or the link is out of date.</div>
          <Pressable hap="tick" onClick={onBack} className="mt-4 flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-body">
            <CaretLeft size={16} /> Go back
          </Pressable>
        </div>
      </div>
    )
  }

  // dose adherence
  const totalDoses = doses.length
  const loggedDoses = doses.filter((d) => d.loggedToday).length
  const adherencePct = totalDoses > 0 ? Math.round((loggedDoses / totalDoses) * 100) : 0

  // next appointment
  const nextAppt = appointments.find((a) => a.status === 'Upcoming' || a.status === 'Waiting')
  const latestCheckIn = checkIns.length > 0 ? checkIns[0] : null

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'prescriptions', label: 'Prescriptions' },
  ]

  const owningDoctor = practitioners.find((p) => p.id === patient.owningPractitionerId)
  const activeCoverage = handoffs.find((h) => h.status === 'accepted')
  const reassignCandidates = practitioners.filter((p) => p.status === 'active' && p.id !== patient.owningPractitionerId)
  const handoffCandidates = practitioners.filter((p) => p.status === 'active' && p.id !== ME)

  const bookFollowUp = (isoDate: string) => {
    const time = firstAvailableMorningSlot(allAppointments, isoDate)
    scheduleFollowUpAction({
      patientId,
      practitionerId: patient.owningPractitionerId ?? ME,
      time,
      date: isoDate,
      type: 'In person',
      reason: 'Follow-up',
    })
    haptic('success')
    toast({ title: `Follow-up scheduled · ${formatDayLabel(isoDate)} · ${time}` })
    setFollowUpOpen(false)
    setCustomDate(null)
  }

  const handleScheduleFollowUp = (label: string) => {
    if (label === 'Custom') {
      // Don't auto-book — hand the doctor a date picker defaulted to a week out.
      haptic('tick')
      setCustomDate(toISO(new Date(Date.now() + 7 * 86400000)))
      return
    }
    const daysMap: Record<string, number> = { 'In 1 week': 7, 'In 2 weeks': 14, 'In 1 month': 30 }
    const daysAhead = daysMap[label] ?? 7
    const target = new Date(Date.now() + daysAhead * 86400000)
    bookFollowUp(toISO(target))
  }

  return (
    <div className="flex h-full flex-col bg-screen">
      {/* header */}
      <div className="px-[18px] pb-3 pt-[var(--app-top)]">
        <div className="flex items-center gap-2">
          <Pressable ariaLabel="back" hap="tick" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <CaretLeft size={18} className="text-body" />
          </Pressable>
          <div className="flex-1" />
          <Badge tone="neutral">{patient.wsCode}</Badge>
          <Pressable ariaLabel="more actions" hap="tick" onClick={() => setActionsOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <DotsThreeVertical size={18} weight="bold" className="text-body" />
          </Pressable>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Avatar initials={patient.initials} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[19px] font-bold text-ink">{patient.name}</div>
            <div className="truncate text-[13px] text-muted">
              {[`${patient.age}y`, patient.sex, patient.location].filter(Boolean).join(' · ')}
            </div>
          </div>
          {patient.phone && (
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={`tel:${patient.phone}`}
                onClick={() => haptic('tick')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-body"
              >
                <Phone size={15} />
              </a>
              <Pressable
                ariaLabel="message on whatsapp"
                hap="tick"
                onClick={() => {
                  const ok = shareViaWhatsApp(patient.phone, `Hi ${patient.name.split(' ')[0]}, this is Sneham Digital Clinic.`)
                  if (!ok) toast({ title: 'No phone number on file', message: 'Add a phone number for this patient first.' })
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white"
              >
                <WhatsappLogo size={17} weight="fill" />
              </Pressable>
            </div>
          )}
        </div>

        {/* status row — who owns this patient's care lives in the Care
            team card below now, not duplicated here */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {patient.currentRemedy && <Badge tone="green">{patient.currentRemedy}</Badge>}
          <span className="text-[11px] text-faint">Last seen: {patient.lastSeen}</span>
        </div>

        {/* dose adherence */}
        {totalDoses > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <Label>Dose adherence</Label>
              <span className="text-[12px] font-semibold text-ink">{adherencePct}% doses taken this cycle</span>
            </div>
            <ProgressBar pct={adherencePct} className="mt-1.5" />
          </div>
        )}

        {/* quick actions */}
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <Pressable hap="impact" onClick={() => onOpenCase(patientId)} className="flex items-center justify-center gap-1.5 rounded-pill bg-brand py-2.5 text-[13px] font-semibold text-screen">
            <NotePencil size={16} weight="fill" /> Case sheet
          </Pressable>
          <Pressable hap="tick" onClick={() => onOpenFollowUp(patientId)} className="flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-2.5 text-[13px] font-semibold text-body">
            <ArrowsClockwise size={16} weight="fill" /> Follow-up
          </Pressable>
          <Pressable hap="tick" onClick={onPrescribe} className="flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-2.5 text-[13px] font-semibold text-body">
            <Prescription size={16} weight="fill" /> Prescribe
          </Pressable>
          <Pressable hap="tick" onClick={() => setBilling({})} className="flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-2.5 text-[13px] font-semibold text-body">
            <CurrencyInr size={16} weight="bold" /> Bill
          </Pressable>
          <Pressable hap="tick" onClick={onOrderInvestigations} className="col-span-2 flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-2.5 text-[13px] font-semibold text-body">
            <TestTube size={16} weight="fill" /> Order investigations
          </Pressable>
        </div>
      </div>

      {/* tabs */}
      <div className="flex border-b border-border px-[18px]">
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            as="div"
            hap="tick"
            onClick={() => setTab(t.id)}
            className={`relative flex-1 cursor-pointer py-2.5 text-center text-[13px] font-semibold ${
              tab === t.id ? 'text-brand' : 'text-muted'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <motion.div
                layoutId="patient-detail-tab"
                className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand"
                transition={spring}
              />
            )}
          </Pressable>
        ))}
      </div>

      {/* tab content */}
      <div className="flex-1 overflow-y-auto px-[18px] pb-[120px] pt-3">
        {tab === 'overview' && (
          <div className="space-y-3">
            <Card className="space-y-2.5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                  <UsersThree size={18} weight="fill" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">Care team</div>
                  <div className="text-[12px] text-muted">
                    {owningDoctor
                      ? `Primary doctor: ${owningDoctor.id === ME ? 'You' : owningDoctor.name}`
                      : 'Unassigned — open to the active team'}
                  </div>
                </div>
              </div>
              {activeCoverage && (
                <div className="flex items-center gap-2 rounded-[12px] border border-green-border bg-tint px-3 py-2">
                  <Handshake size={15} weight="fill" className="shrink-0 text-brand" />
                  <div className="text-[12px] text-ink-deep">
                    {practitioners.find((p) => p.id === activeCoverage.toPractitionerId)?.name ?? 'A colleague'} is covering until {activeCoverage.coveringUntil}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-2.5">
                <Pressable
                  hap="tick"
                  onClick={() => setReassignOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-2 text-[12.5px] font-semibold text-body"
                >
                  <ArrowsLeftRight size={15} /> Reassign
                </Pressable>
                <Pressable
                  hap="tick"
                  onClick={() => { setHandoffToId(handoffCandidates[0]?.id ?? ''); setHandoffOpen(true) }}
                  className="flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface py-2 text-[12.5px] font-semibold text-body"
                >
                  <Handshake size={15} /> Hand off
                </Pressable>
              </div>
            </Card>

            {nextAppt && (
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                    <Clock size={18} weight="fill" />
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-[14px] font-semibold text-ink">Next appointment</div>
                    <div className="text-[12px] text-muted">{nextAppt.time} &middot; {formatDayLabel(nextAppt.date)} &middot; {nextAppt.type}</div>
                  </div>
                  <Badge tone={nextAppt.status === 'Waiting' ? 'amber' : 'neutral'}>{nextAppt.status}</Badge>
                </div>
              </Card>
            )}

            <Card className="space-y-2.5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                  <ClipboardText size={18} weight="fill" />
                </div>
                <div className="font-display text-[14px] font-semibold text-ink">Clinical summary</div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <Label>Chief complaint</Label>
                <span className="text-[13px] text-body">{patient.chiefComplaint}</span>
              </div>
              {patient.allergies && (
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <Label>Allergies</Label>
                  <span className="text-[13px] text-body">{patient.allergies}</span>
                </div>
              )}
              {patient.regularMedication && (
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <Label>Regular medication</Label>
                  <span className="text-[13px] text-body">{patient.regularMedication}</span>
                </div>
              )}
            </Card>

            {latestCheckIn && (
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                    <Heartbeat size={18} weight="fill" />
                  </div>
                  <div className="font-display text-[14px] font-semibold text-ink">Latest check-in</div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Badge tone={latestCheckIn.marked === 'better' ? 'green' : latestCheckIn.marked === 'worse' ? 'amber' : 'neutral'}>
                    {latestCheckIn.marked === 'better' ? 'Feeling better' : latestCheckIn.marked === 'worse' ? 'Feeling worse' : 'No change'}
                  </Badge>
                </div>
                {latestCheckIn.changeChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {latestCheckIn.changeChips.map((chip) => (
                      <Badge key={chip} tone="neutral">{chip}</Badge>
                    ))}
                  </div>
                )}
                {latestCheckIn.freeText && (
                  <div className="mt-2 text-[13px] text-body">{latestCheckIn.freeText}</div>
                )}
              </Card>
            )}

            <Card className="px-4 py-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                    <CurrencyInr size={18} weight="fill" />
                  </div>
                  <div className="font-display text-[14px] font-semibold text-ink">Billing</div>
                </div>
                <Pressable hap="tick" onClick={() => setBilling({})} className="text-[12px] font-semibold text-brand">Quick bill</Pressable>
              </div>
              {invoices.length === 0 ? (
                <p className="py-3 text-center text-[12.5px] text-faint">No invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNo - a.invoiceNo).map((inv) => {
                    const total = invoiceTotal(inv.items)
                    const cancelled = inv.status === 'cancelled'
                    return (
                      <div key={inv.id} className={`flex items-center gap-2.5 rounded-[14px] border border-border bg-surface px-3 py-2.5 ${cancelled ? 'opacity-60' : ''}`}>
                        <div className="flex-1">
                          <div className={`font-display text-[13.5px] font-semibold text-ink ${cancelled ? 'line-through' : ''}`}>
                            ₹{total.toLocaleString('en-IN')} <span className="font-body text-[11px] font-normal text-faint">#{inv.invoiceNo}</span>
                          </div>
                          <div className="text-[11.5px] text-muted">{formatDayLabel(inv.date)} · {inv.items[0]?.name ?? 'Consultation'}{inv.items.length > 1 ? ` +${inv.items.length - 1} more` : ''}</div>
                        </div>
                        <Badge tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                        {!cancelled && (
                          <Pressable hap="tick" onClick={() => setBilling({ appointmentId: inv.appointmentId, existingInvoice: inv })} className="text-faint">
                            <PencilSimple size={16} />
                          </Pressable>
                        )}
                        <Pressable hap="tick" onClick={() => exportInvoicePdf(inv, patient).catch(() => {})} className="text-faint">
                          <Printer size={16} />
                        </Pressable>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-2.5">
            {outcomes.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-muted">No consultation history yet.</div>
            ) : (
              <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
                {outcomes.map((o) => (
                  <motion.div key={o.id} variants={listItem}>
                    <Card className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] text-faint">{new Date(o.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <Badge tone={o.outcome === 'Clear improvement' ? 'green' : o.outcome === 'Partial' ? 'amber' : 'neutral'}>{o.outcome}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Flask size={14} className="text-brand" />
                        <span className="text-[13px] font-semibold text-ink">{o.remedy}</span>
                      </div>
                      {o.note && <div className="mt-1 text-[12px] text-muted">{o.note}</div>}
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {tab === 'prescriptions' && (
          <div className="space-y-2.5">
            {prescriptions.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-muted">No prescriptions yet.</div>
            ) : (
              <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
                {prescriptions.map((rx) => (
                  <motion.div key={rx.id} variants={listItem}>
                    <Card className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="font-display text-[14px] font-semibold text-ink">{rx.remedy}</div>
                        <Badge tone="green">{rx.potency}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                        <span>{rx.repetition}</span>
                        <span>&middot;</span>
                        <span>{rx.durationDays ? `${rx.durationDays} days` : 'Until settled'}</span>
                      </div>
                      <div className="mt-1.5 text-[11px] text-faint">
                        {rx.status === 'published' ? 'Published' : rx.status === 'cancelled' ? 'Cancelled' : 'Saved (not yet published)'} {new Date(rx.publishedAt ?? rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* schedule follow-up FAB */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-[18px]" style={{ paddingBottom: 'var(--app-bottom)' }}>
        <Pressable
          hap="impact"
          onClick={() => { setCustomDate(null); setFollowUpOpen(true) }}
          className="flex w-full items-center justify-center gap-2 rounded-pill bg-brand py-3 font-display text-[15px] font-semibold text-white shadow-float"
        >
          <CalendarPlus size={18} weight="fill" /> Schedule follow-up
        </Pressable>
      </div>

      {/* follow-up bottom sheet */}
      <BottomSheet open={followUpOpen} onClose={() => { setFollowUpOpen(false); setCustomDate(null) }}>
        {customDate === null ? (
          <>
            <div className="font-display text-[17px] font-bold text-ink">Schedule follow-up</div>
            <div className="mt-0.5 text-[12.5px] text-muted">Pick a time for {patient.name}.</div>
            <div className="mt-3 space-y-2">
              {['In 1 week', 'In 2 weeks', 'In 1 month', 'Custom'].map((opt) => (
                <Pressable
                  key={opt}
                  as="div"
                  hap="tick"
                  scale={0.98}
                  onClick={() => handleScheduleFollowUp(opt)}
                  className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-brand">
                    <CalendarPlus size={18} />
                  </div>
                  <div className="flex-1 text-[14px] font-semibold text-ink">{opt}</div>
                  <span className="text-faint">&rsaquo;</span>
                </Pressable>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="font-display text-[17px] font-bold text-ink">Pick a date</div>
            <div className="mt-0.5 text-[12.5px] text-muted">Follow-up for {patient.name}.</div>
            <div className="mt-3">
              <Label>Date</Label>
              <input
                type="date"
                value={customDate}
                min={todayISO()}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-1.5 w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
                data-selectable="true"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Pressable hap="tick" onClick={() => setCustomDate(null)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">
                Back
              </Pressable>
              <Pressable hap="success" onClick={() => bookFollowUp(customDate)} className="flex-1 rounded-pill bg-brand py-2.5 text-center text-[14px] font-semibold text-screen">
                Confirm
              </Pressable>
            </div>
          </>
        )}
      </BottomSheet>

      <InvoiceSheet
        patientId={patientId}
        open={billing !== null}
        appointmentId={billing?.appointmentId}
        existingInvoice={billing?.existingInvoice}
        onClose={() => setBilling(null)}
      />

      {/* kebab actions */}
      <BottomSheet open={actionsOpen} onClose={() => setActionsOpen(false)}>
        <div className="font-display text-[17px] font-bold text-ink">{patient.name}</div>
        <div className="mt-3 space-y-1">
          <Pressable
            as="div"
            hap="tick"
            onClick={() => { setActionsOpen(false); setEditOpen(true) }}
            className="flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-3"
          >
            <PencilSimple size={18} className="text-body" />
            <span className="text-[14px] font-medium text-ink">Edit patient details</span>
          </Pressable>
          <Pressable
            as="div"
            hap="tick"
            onClick={async () => {
              setActionsOpen(false)
              setExporting(true)
              try {
                await exportPatientHistoryPdf(patient, prescriptions, investigationOrders, outcomes)
              } catch (e) {
                toast({ title: 'Export failed', message: e instanceof Error ? e.message : 'Please try again.' })
              } finally {
                setExporting(false)
              }
            }}
            className="flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-3"
          >
            <DownloadSimple size={18} className="text-body" />
            <span className="text-[14px] font-medium text-ink">{exporting ? 'Exporting…' : 'Export patient summary (PDF)'}</span>
          </Pressable>
          {patient.archivedAt ? (
            <Pressable
              as="div"
              hap="tick"
              onClick={() => {
                restorePatient(patient.id)
                setActionsOpen(false)
                toast({ title: 'Patient restored', message: `${patient.name} is back in the active roster.` })
              }}
              className="flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-3"
            >
              <ArrowCounterClockwise size={18} className="text-brand" />
              <span className="text-[14px] font-semibold text-brand">Restore patient</span>
            </Pressable>
          ) : (
            <Pressable
              as="div"
              hap="warn"
              onClick={() => {
                if (!window.confirm(`Archive ${patient.name}? They'll be hidden from the active roster but nothing is deleted.`)) return
                archivePatient(patient.id)
                setActionsOpen(false)
                toast({ title: 'Patient archived', message: `${patient.name} is hidden from the active roster.` })
                onBack()
              }}
              className="flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-3"
            >
              <Archive size={18} className="text-body" />
              <span className="text-[14px] font-medium text-ink">Archive patient</span>
            </Pressable>
          )}
        </div>
      </BottomSheet>

      <EditPatientSheet patient={patient} open={editOpen} onClose={() => setEditOpen(false)} />

      {/* reassign — permanent change of primary doctor */}
      <BottomSheet open={reassignOpen} onClose={() => setReassignOpen(false)}>
        <div className="font-display text-[17px] font-bold text-ink">Reassign {patient.name}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">Change who owns this patient's care going forward.</div>
        <div className="mt-3 space-y-2">
          {reassignCandidates.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                assignPatient(patientId, p.id)
                setReassignOpen(false)
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
          {reassignCandidates.length === 0 && (
            <div className="py-6 text-center text-[13px] text-muted">No other active practitioners to reassign to.</div>
          )}
        </div>
      </BottomSheet>

      {/* hand off — temporary coverage, ownership stays with the current doctor */}
      <BottomSheet open={handoffOpen} onClose={() => setHandoffOpen(false)}>
        <div className="font-display text-[17px] font-bold text-ink">Hand off {patient.name}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">Ownership stays with you while someone else covers.</div>
        <div className="mt-3 space-y-2">
          {handoffCandidates.map((p) => (
            <button
              key={p.id}
              onClick={() => setHandoffToId(p.id)}
              className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left ${
                handoffToId === p.id ? 'border-green-border bg-tint' : 'border-border bg-surface'
              }`}
            >
              <Avatar initials={p.initials} size={36} />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{p.name}</div>
                <div className="text-[12px] text-muted">{p.specialty}</div>
              </div>
              {handoffToId === p.id && <Check size={18} weight="bold" className="text-brand" />}
            </button>
          ))}
          {handoffCandidates.length === 0 && (
            <div className="py-4 text-center text-[13px] text-muted">No other active practitioners to hand off to.</div>
          )}
        </div>
        <div className="mt-3">
          <Label>Covering until</Label>
          <input
            type="date"
            value={handoffCoveringUntil}
            min={addDaysISO(todayISO(), 1)}
            onChange={(e) => setHandoffCoveringUntil(e.target.value)}
            className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
            data-selectable="true"
          />
        </div>
        <div className="mt-3">
          <Label>Case status</Label>
          <input
            value={handoffCaseStatus}
            onChange={(e) => setHandoffCaseStatus(e.target.value)}
            placeholder={`e.g. Stable on ${patient.currentRemedy ?? 'current remedy'}, review in 2 weeks`}
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
        <div className="mt-3">
          <Label>What to watch for</Label>
          <textarea
            value={handoffWatchFor}
            onChange={(e) => setHandoffWatchFor(e.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-y rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none focus:border-green-border"
          />
        </div>
        <Button
          variant="primary"
          className="mt-4 w-full"
          disabled={!handoffReason.trim() || !handoffToId}
          onClick={() => {
            createHandoff({
              patientId,
              fromId: ME,
              toId: handoffToId,
              coveringUntil: formatDayLabel(handoffCoveringUntil),
              note: {
                currentRemedy: patient.currentRemedy ?? '—',
                caseStatus: handoffCaseStatus.trim() || 'No status given.',
                reason: handoffReason.trim(),
                watchFor: handoffWatchFor,
              },
            })
            setHandoffOpen(false)
            haptic('success')
            const to = practitioners.find((p) => p.id === handoffToId)
            toast({ title: 'Handoff sent', message: `${to?.name ?? 'Your colleague'} will be notified.` })
            setHandoffCaseStatus('')
            setHandoffReason('')
            setHandoffWatchFor('')
          }}
        >
          Send handoff
        </Button>
      </BottomSheet>
    </div>
  )
}

// ── BILLING (mobile) ──
// A doctor seeing a quick walk-in (e.g. a cold) can bill and print/share an
// invoice with the clinic's letterhead directly from her phone, no
// appointment required — same real Invoice model as the web console, so a
// bill made here shows up correctly in Reports on either surface. Also
// reused to edit or cancel an existing invoice (existingInvoice set).
export function InvoiceSheet({
  patientId,
  open,
  appointmentId,
  existingInvoice,
  onClose,
}: {
  patientId: string | null
  open: boolean
  appointmentId?: string
  existingInvoice?: Invoice
  onClose: () => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const ME = useClinic((s) => s.currentPractitionerId)
  const createInvoice = useClinic((s) => s.createInvoice)
  const updateInvoice = useClinic((s) => s.updateInvoice)
  const cancelInvoice = useClinic((s) => s.cancelInvoice)
  const toast = useToast()

  const [items, setItems] = useState<InvoiceLineItem[]>([{ name: 'Consultation', qty: 1, unitPrice: DEFAULT_CONSULT_FEE }])
  const [amountReceived, setAmountReceived] = useState(DEFAULT_CONSULT_FEE)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash')
  const [waived, setWaived] = useState(false)
  const [saving, setSaving] = useState(false)
  const receivedTouched = useRef(false)

  // Editing an existing invoice always initializes from ITS values, never a
  // fresh default (the exact bug class this billing code had before — a
  // hardcoded fee default that ignored what was actually on the bill).
  useEffect(() => {
    if (!open) return
    receivedTouched.current = false
    if (existingInvoice) {
      setItems(existingInvoice.items)
      setAmountReceived(existingInvoice.amountReceived)
      setPaymentMode(existingInvoice.paymentMode)
      setWaived(existingInvoice.status === 'waived')
    } else {
      setItems([{ name: 'Consultation', qty: 1, unitPrice: DEFAULT_CONSULT_FEE }])
      setAmountReceived(DEFAULT_CONSULT_FEE)
      setPaymentMode('Cash')
      setWaived(false)
    }
  }, [open, existingInvoice])

  const total = invoiceTotal(items)

  // Keep "amount received" following the total for the common instant-
  // payment case — but never fight the doctor once she's typed her own figure.
  useEffect(() => {
    if (open && !receivedTouched.current) setAmountReceived(total)
  }, [open, total])

  if (!open || !patientId) return null

  const updateItem = (i: number, patch: Partial<InvoiceLineItem>) =>
    setItems((its) => its.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((its) => [...its, { name: '', qty: 1, unitPrice: 0 }])
  const removeItem = (i: number) => setItems((its) => (its.length > 1 ? its.filter((_, idx) => idx !== i) : its))

  async function handleSaveAndPrint() {
    if (!patient) return
    if (items.some((it) => !it.name.trim())) { toast({ title: 'Every item needs a name' }); return }
    setSaving(true)
    const status = waived ? 'waived' : amountReceived <= 0 ? 'unpaid' : amountReceived >= total ? 'paid' : 'partial'
    let invoice: Invoice | null
    if (existingInvoice) {
      updateInvoice(existingInvoice.id, { items, amountReceived: waived ? 0 : amountReceived, paymentMode, status })
      invoice = { ...existingInvoice, items, amountReceived: waived ? 0 : amountReceived, paymentMode, status }
    } else {
      invoice = await createInvoice({
        patientId: patient.id,
        practitionerId: ME,
        appointmentId,
        date: todayISO(),
        items,
        paymentMode,
        amountReceived: waived ? 0 : amountReceived,
        status,
      })
    }
    setSaving(false)
    if (!invoice) return
    haptic('success')
    toast({ title: existingInvoice ? 'Bill updated' : 'Bill saved', message: `₹${total.toLocaleString('en-IN')} · ${patient.name}` })
    await exportInvoicePdf(invoice, patient).catch(() => {
      toast({ title: 'Saved, but the PDF failed', message: 'You can reprint it from the invoice list.' })
    })
    onClose()
  }

  function handleCancel() {
    if (!existingInvoice) return
    cancelInvoice(existingInvoice.id)
    haptic('impact')
    toast({ title: 'Bill cancelled', message: `Invoice #${existingInvoice.invoiceNo} won’t count toward revenue anymore.` })
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">{existingInvoice ? `Edit invoice #${existingInvoice.invoiceNo}` : 'Quick bill'}</div>
      {patient && <div className="mt-0.5 text-[12.5px] text-muted">{patient.name}</div>}

      <Label className="mt-4">Items</Label>
      <div className="mt-1.5 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="e.g. Consultation, Medicine"
              className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-green-border"
              data-selectable="true"
            />
            <input
              type="number"
              value={item.qty}
              onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
              className="w-11 rounded-[10px] border border-border bg-surface px-1 py-2 text-center text-[13px] text-ink outline-none focus:border-green-border"
              title="Quantity"
              data-selectable="true"
            />
            <div className="flex w-[84px] items-center gap-1 rounded-[10px] border border-border bg-surface px-2 py-2">
              <span className="text-[12px] text-muted">₹</span>
              <input
                type="number"
                value={item.unitPrice}
                onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                className="w-full bg-transparent text-[13px] text-ink outline-none"
                title="Price per unit"
                data-selectable="true"
              />
            </div>
            <Pressable hap="tick" onClick={() => removeItem(i)} className={`p-1 text-faint ${items.length === 1 ? 'opacity-30' : ''}`}>
              <X size={14} weight="bold" />
            </Pressable>
          </div>
        ))}
      </div>
      <Pressable hap="tick" onClick={addItem} className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-brand">
        <Plus size={13} weight="bold" /> Add item
      </Pressable>

      <div className="mt-3 flex items-center justify-between rounded-[12px] bg-tint px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-ink-deep">Total</span>
        <span className="text-[15px] font-bold text-ink-deep">₹{total.toLocaleString('en-IN')}</span>
      </div>

      <Label className="mt-4">Amount received</Label>
      <div className="mt-1.5 flex items-center gap-2 rounded-[14px] border border-border bg-surface px-3.5 py-2.5">
        <span className="text-[14px] font-semibold text-muted">₹</span>
        <input
          type="number"
          value={waived ? 0 : amountReceived}
          disabled={waived}
          onChange={(e) => { receivedTouched.current = true; setAmountReceived(Number(e.target.value) || 0) }}
          className="w-full bg-transparent text-[14px] font-semibold text-ink outline-none disabled:opacity-50"
          data-selectable="true"
        />
        {!waived && amountReceived !== total && (
          <Pressable hap="tick" onClick={() => { receivedTouched.current = true; setAmountReceived(total) }} className="shrink-0 text-[11.5px] font-semibold text-brand">Paid in full</Pressable>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="accent-brand" />
          Waive this bill (no charge)
        </label>
        {!waived && amountReceived < total && <span className="text-[12px] font-semibold text-amber-text">Balance ₹{(total - amountReceived).toLocaleString('en-IN')}</span>}
      </div>

      <Label className="mt-4">Payment mode</Label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {PAYMENT_MODES.map((m) => (
          <Chip key={m} selected={paymentMode === m} onClick={() => { haptic('select'); setPaymentMode(m) }}>{m}</Chip>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        {existingInvoice && (
          <Button variant="ghost" className="!text-danger" onClick={handleCancel}>Cancel bill</Button>
        )}
        <Button variant="accent" className="flex-1" disabled={saving} onClick={handleSaveAndPrint}>
          <CurrencyInr size={16} weight="bold" /> {saving ? 'Saving…' : 'Save & print'}
        </Button>
      </div>
    </BottomSheet>
  )
}

// ─────────────────────────────────────────────────────────────
// EditPatientSheet — bottom sheet to edit an existing patient
// ─────────────────────────────────────────────────────────────
function EditPatientSheet({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const updatePatientDetails = useClinic((s) => s.updatePatientDetails)
  const toast = useToast()

  const [name, setName] = useState(patient.name)
  const [age, setAge] = useState(String(patient.age))
  const [sex, setSex] = useState(patient.sex)
  const [phone, setPhone] = useState(patient.phone ?? '')
  const [complaint, setComplaint] = useState(patient.chiefComplaint)
  const [location, setLocation] = useState(patient.location)
  const [allergies, setAllergies] = useState(patient.allergies)
  const [regularMedication, setRegularMedication] = useState(patient.regularMedication)
  const [referralSource, setReferralSource] = useState<ReferralSource | undefined>(patient.referralSource)

  // Re-sync whenever a different patient's sheet opens (not on every
  // keystroke — patient identity is the only thing that should reset the form).
  useEffect(() => {
    setName(patient.name)
    setAge(String(patient.age))
    setSex(patient.sex)
    setPhone(patient.phone ?? '')
    setComplaint(patient.chiefComplaint)
    setLocation(patient.location)
    setAllergies(patient.allergies)
    setRegularMedication(patient.regularMedication)
    setReferralSource(patient.referralSource)
  }, [patient.id])

  const inputCls = 'w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border'

  const onSave = () => {
    if (!name.trim() || !complaint.trim()) { haptic('warn'); return }
    updatePatientDetails(patient.id, {
      name: name.trim(),
      age: parseInt(age, 10) || 0,
      sex,
      location: location.trim(),
      phone: phone.trim(),
      chiefComplaint: complaint.trim(),
      allergies: allergies.trim(),
      regularMedication: regularMedication.trim(),
      referralSource,
    })
    haptic('success')
    toast({ title: 'Patient details updated' })
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Edit patient details</div>

      <div className="mt-3 space-y-3">
        <div>
          <Label>Name</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label>Age</Label>
            <input value={age} onChange={(e) => setAge(e.target.value)} type="number" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
          </div>
          <div className="flex-[2]">
            <Label>Sex</Label>
            <div className="mt-1.5 flex gap-2">
              {(['Female', 'Male', 'Other'] as const).map((s) => (
                <Chip key={s} selected={sex === s} onClick={() => { haptic('select'); setSex(s) }} className="flex-1 text-center">{s}</Chip>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Phone</Label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+91 98765 43210" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>Chief complaint</Label>
          <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={2} className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>Location</Label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>Allergies</Label>
          <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Dust, penicillin — or “No allergies”" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>Regular medication</Label>
          <input value={regularMedication} onChange={(e) => setRegularMedication(e.target.value)} placeholder="e.g. None" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>How did they find us?</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {REFERRAL_SOURCES.map((r) => (
              <Chip key={r} selected={referralSource === r} onClick={() => { haptic('select'); setReferralSource((cur) => (cur === r ? undefined : r)) }}>
                {r}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <Pressable
        hap="none"
        onClick={onSave}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-pill bg-accent py-3 font-display text-[15px] font-semibold text-white shadow-float"
      >
        Save changes
      </Pressable>
    </BottomSheet>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. AddPatientSheet — bottom sheet to register a new patient
// ─────────────────────────────────────────────────────────────

export function AddPatientSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (patientId: string) => void
}) {
  const addPatient = useClinic((s) => s.addPatient)
  const toast = useToast()

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'Female' | 'Male' | 'Other'>('Female')
  const [phone, setPhone] = useState('')
  const [complaint, setComplaint] = useState('')
  const [location, setLocation] = useState('')
  const [referralSource, setReferralSource] = useState<ReferralSource | undefined>(undefined)
  const [nameError, setNameError] = useState('')
  const [ageError, setAgeError] = useState('')

  const reset = () => {
    setName('')
    setAge('')
    setSex('Female')
    setPhone('')
    setComplaint('')
    setLocation('')
    setReferralSource(undefined)
    setNameError('')
    setAgeError('')
  }

  const onRegister = () => {
    const nameOk = name.trim().length > 0
    const ageOk = age.trim().length > 0
    setNameError(nameOk ? '' : 'Name is required')
    setAgeError(ageOk ? '' : 'Age is required')
    if (!nameOk || !ageOk) { haptic('warn'); return }
    const patient = addPatient({
      name: name.trim(),
      age: parseInt(age, 10) || 0,
      sex,
      location: location.trim(),
      chiefComplaint: complaint.trim(),
      phone: phone.trim(),
      referralSource,
    })
    haptic('success')
    toast({ title: `${patient.name} registered` })
    onAdded(patient.id)
    reset()
    onClose()
  }

  const inputCls = 'w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border'

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">New patient</div>

      <div className="mt-3 space-y-3">
        <div>
          <Label>Name</Label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError('') }}
            placeholder="Full name"
            className={`mt-1.5 ${inputCls} ${nameError ? 'border-danger' : ''}`}
            data-selectable="true"
          />
          {nameError && <p className="mt-1 text-[12px] text-danger">{nameError}</p>}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label>Age</Label>
            <input
              value={age}
              onChange={(e) => { setAge(e.target.value); if (ageError) setAgeError('') }}
              type="number"
              placeholder="Age"
              className={`mt-1.5 ${inputCls} ${ageError ? 'border-danger' : ''}`}
              data-selectable="true"
            />
            {ageError && <p className="mt-1 text-[12px] text-danger">{ageError}</p>}
          </div>
          <div className="flex-[2]">
            <Label>Sex</Label>
            <div className="mt-1.5 flex gap-2">
              {(['Female', 'Male', 'Other'] as const).map((s) => (
                <Chip key={s} selected={sex === s} onClick={() => { haptic('select'); setSex(s) }} className="flex-1 text-center">{s}</Chip>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Phone</Label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+91 98765 43210" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>Chief complaint</Label>
          <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={2} placeholder="Primary symptoms or concern" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>Location</Label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chiplun" className={`mt-1.5 ${inputCls}`} data-selectable="true" />
        </div>

        <div>
          <Label>How did they find us?</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {REFERRAL_SOURCES.map((r) => (
              <Chip key={r} selected={referralSource === r} onClick={() => { haptic('select'); setReferralSource((cur) => (cur === r ? undefined : r)) }}>
                {r}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <Pressable
        hap="none"
        onClick={onRegister}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-pill bg-accent py-3 font-display text-[15px] font-semibold text-white shadow-float disabled:opacity-40"
      >
        <UserPlus size={18} weight="fill" /> Register
      </Pressable>
    </BottomSheet>
  )
}
