import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import { formatDayLabel, todayISO, addDaysISO, followUpPresetDate, firstAvailableMorningSlot } from '../core/day'
import { sampleFrames, testFlag } from '../core/diagnostics'
import { FollowUpSheet } from './FollowUpSheet'
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
  Prohibit,
} from '@phosphor-icons/react'
import { useClinic, selPrescriptionsFor, selDosesFor, CASE_RETAKE_APPT_MARKER } from '../core/store'
import type { Appointment, Patient, Invoice, InvoiceLineItem, PaymentMode, ReferralSource, CaseVisit } from '../core/types'
import { Avatar, Badge, BottomSheet, Button, Card, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, pushVariants, listContainer, listItem } from '../design-system/motion'
import { CountUp, ProgressBar } from '../design-system/feedback'
import { PullToRefresh } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { DEFAULT_CONSULT_FEE, invoiceTotal } from '../core/billing'
import { Archive, ArrowCounterClockwise, ArrowsCounterClockwise, DownloadSimple, DotsThreeVertical, Phone } from '@phosphor-icons/react'
import { WhatsAppIcon } from '../design-system/BrandIcons'
import { shareViaWhatsApp } from '../core/share'
import { getSections, type CaseTemplateName } from '../core/caseTemplate'
import { PatientQuickView } from './PatientQuickView'
import { AttachmentList } from '../components/FollowUpAttachments'
import { GuardedMotionDiv } from '../design-system/presence'
import { useShallow } from 'zustand/react/shallow'
import { usePatientLookup, findPatientMatches } from '../core/duplicates'

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
  // TEST switch ("lighter search"): the list follows typing a moment later in small slices, and only the
  // first screenful of rows fades in one by one — rows further down appear without their own animation and
  // are only drawn when scrolled to. Looks the same; off = exactly as before.
  const light = testFlag('lightsearch')
  const deferredQuery = useDeferredValue(query)
  const shownQuery = light ? deferredQuery : query

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 120)
      sampleFrames(`search open${light ? ' (light)' : ''}`, 1500)
    } else if (wasOpen.current) {
      sampleFrames(`search close${light ? ' (light)' : ''}`, 1500)
    }
    wasOpen.current = open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => { if (open && query) sampleFrames(`search typing${light ? ' (light)' : ''}`, 1000) }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!shownQuery.trim()) {
      return [...patients]
        .sort((a, b) => lastSeenTimestamp(b.lastSeen) - lastSeenTimestamp(a.lastSeen))
        .slice(0, 5)
    }
    const q = shownQuery.toLowerCase()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.wsCode.toLowerCase().includes(q) ||
        p.chiefComplaint.toLowerCase().includes(q) ||
        (p.currentRemedy?.toLowerCase().includes(q) ?? false),
    )
  }, [shownQuery, patients])

  return (
    <AnimatePresence>
      {open && (
        <GuardedMotionDiv
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
            <Pressable ariaLabel="back" hap="tick" onClick={onClose} className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
              <CaretLeft size={18} className="text-body" />
            </Pressable>
            <div className="flex flex-1 items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-3">
              <MagnifyingGlass size={16} className="text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, WS code, complaint, remedy..."
                className="-my-3 w-full bg-transparent py-3 text-[13px] outline-none placeholder:text-faint"
                data-selectable="true"
              />
              {query && (
                <Pressable ariaLabel="clear" hap="tick" onClick={() => setQuery('')} className="relative tap-pad-lg flex h-8 w-8 shrink-0 items-center justify-center text-faint">
                  <X size={16} />
                </Pressable>
              )}
            </div>
            <Pressable ariaLabel="add patient" hap="tick" onClick={onAddPatient} className="relative tap-pad-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand">
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
              {filtered.map((p, i) => {
                const lateRow = light && i >= 8
                const Wrap = lateRow ? 'div' : motion.div
                return (
                <Wrap key={p.id} {...(lateRow ? { style: { contentVisibility: 'auto', containIntrinsicSize: 'auto 72px' } } : { variants: listItem })}>
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
                      <span className="text-[12px] text-faint">{p.lastSeen}</span>
                    </div>
                  </Pressable>
                </Wrap>
                )
              })}
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
        </GuardedMotionDiv>
      )}
    </AnimatePresence>
  )
}

// The patient's profile screen now lives in PatientProfile.tsx.

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
    await (await import('../core/pdfExport')).exportInvoicePdf(invoice, patient).catch(() => {
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
              className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-2.5 py-3 text-[13px] text-ink outline-none focus:border-green-border"
              data-selectable="true"
            />
            <input
              type="number"
              value={item.qty}
              onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
              className="w-11 rounded-[10px] border border-border bg-surface px-1 py-3 text-center text-[13px] text-ink outline-none focus:border-green-border"
              title="Quantity"
              data-selectable="true"
            />
            <div className="flex w-[84px] items-center gap-1 rounded-[10px] border border-border bg-surface px-2">
              <span className="text-[12px] text-muted">₹</span>
              <input
                type="number"
                value={item.unitPrice}
                onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                className="w-full bg-transparent py-3 text-[13px] text-ink outline-none"
                title="Price per unit"
                data-selectable="true"
              />
            </div>
            <Pressable hap="tick" onClick={() => removeItem(i)} className={`relative tap-pad p-1 text-faint ${items.length === 1 ? 'opacity-30' : ''}`} ariaLabel="remove item">
              <X size={14} weight="bold" />
            </Pressable>
          </div>
        ))}
      </div>
      <Pressable hap="tick" onClick={addItem} className="relative tap-pad-y mt-2 flex items-center gap-1 py-2 text-[12.5px] font-semibold text-brand">
        <Plus size={13} weight="bold" /> Add item
      </Pressable>

      <div className="mt-3 flex items-center justify-between rounded-[12px] bg-tint px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-ink-deep">Total</span>
        <span className="text-[15px] font-bold text-ink-deep">₹{total.toLocaleString('en-IN')}</span>
      </div>

      <Label className="mt-4">Amount received</Label>
      <div className="mt-1.5 flex items-center gap-2 rounded-[14px] border border-border bg-surface px-3.5">
        <span className="text-[14px] font-semibold text-muted">₹</span>
        <input
          type="number"
          value={waived ? 0 : amountReceived}
          disabled={waived}
          onChange={(e) => { receivedTouched.current = true; setAmountReceived(Number(e.target.value) || 0) }}
          className="w-full bg-transparent py-3 text-[14px] font-semibold text-ink outline-none disabled:opacity-50"
          data-selectable="true"
        />
        {!waived && amountReceived !== total && (
          <Pressable hap="tick" onClick={() => { receivedTouched.current = true; setAmountReceived(total) }} className="relative tap-pad shrink-0 text-[12px] font-semibold text-brand">Paid in full</Pressable>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <label className="flex min-h-[44px] items-center gap-2 text-[12.5px] text-muted">
          <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="h-5 w-5 accent-brand" />
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
export function EditPatientSheet({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
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
  onOpenExisting,
}: {
  open: boolean
  onClose: () => void
  onAdded: (patientId: string) => void
  onOpenExisting?: (patientId: string) => void
}) {
  const addPatient = useClinic((s) => s.addPatient)
  const allPatients = useClinic((s) => s.patients)
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
  const [nameConfirmed, setNameConfirmed] = useState(false)

  // Checked as the name/number is typed, against what's already on the device.
  const lookup = usePatientLookup(allPatients)
  const matches = findPatientMatches(lookup, name, phone)

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
    setNameConfirmed(false)
  }

  const openExisting = (id: string) => {
    haptic('tick')
    onClose()
    onOpenExisting?.(id)
  }

  const onRegister = () => {
    const nameOk = name.trim().length > 0
    const ageOk = age.trim().length > 0
    setNameError(nameOk ? '' : 'Name is required')
    setAgeError(ageOk ? '' : 'Age is required')
    if (!nameOk || !ageOk) { haptic('warn'); return }
    // Same name as someone already registered: confirm it's a different person.
    if (matches.sameName.length > 0 && !nameConfirmed) { setNameError('Tick the box below if this is a different person'); haptic('warn'); return }
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
            onChange={(e) => { setName(e.target.value); setNameConfirmed(false); if (nameError) setNameError('') }}
            placeholder="Full name"
            className={`mt-1.5 ${inputCls} ${nameError ? 'border-danger' : ''}`}
            data-selectable="true"
          />
          {nameError && <p className="mt-1 text-[12px] text-danger">{nameError}</p>}
          {matches.sameName.length > 0 && (
            <div className="mt-2 rounded-[14px] border border-amber-border bg-amber-tint px-3.5 py-3">
              <div className="text-[12.5px] font-semibold text-amber-text">
                {matches.sameName.length === 1 ? 'A patient with this name already exists' : `${matches.sameName.length} patients with this name already exist`}
              </div>
              <div className="mt-1.5 space-y-0.5">
                {matches.sameName.slice(0, 3).map((p) => (
                  <Pressable
                    key={p.id}
                    hap="tick"
                    onClick={() => openExisting(p.id)}
                    className="relative tap-pad-y4 block w-full truncate text-left text-[12.5px] text-amber-text underline decoration-amber-text/40 decoration-1 underline-offset-2"
                  >
                    {p.name} · {p.age} {p.sex[0]} · {p.wsCode}
                  </Pressable>
                ))}
              </div>
              <Pressable
                hap="select"
                onClick={() => { setNameConfirmed((v) => !v); setNameError('') }}
                className="relative tap-pad-y mt-2.5 flex w-full items-center gap-2 text-left text-[12.5px] font-medium text-amber-text"
              >
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-amber-text/60 ${nameConfirmed ? 'bg-amber-text text-white' : 'bg-transparent'}`}>
                  {nameConfirmed && <Check size={12} weight="bold" />}
                </span>
                This is a different person — register as new
              </Pressable>
            </div>
          )}
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
          {matches.samePhone.length > 0 && (
            <div className="mt-2 rounded-[14px] border border-amber-border bg-amber-tint px-3.5 py-2.5">
              <div className="text-[12.5px] font-semibold text-amber-text">This number is already on file</div>
              <div className="mt-1 space-y-0.5">
                {matches.samePhone.slice(0, 3).map((p) => (
                  <Pressable
                    key={p.id}
                    hap="tick"
                    onClick={() => openExisting(p.id)}
                    className="relative tap-pad-y4 block w-full truncate text-left text-[12.5px] text-amber-text underline decoration-amber-text/40 decoration-1 underline-offset-2"
                  >
                    {p.name} · {p.age} {p.sex[0]} · {p.wsCode}
                  </Pressable>
                ))}
              </div>
              <div className="mt-1 text-[11.5px] text-amber-text/80">Family members can share a number — carry on if this is someone new.</div>
            </div>
          )}
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
