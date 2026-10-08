import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { CaretLeft, Check, DeviceMobile, EnvelopeSimple, Lock, MagnifyingGlass, Prescription as RxIcon, Printer, Warning } from '@phosphor-icons/react'
import { addDaysISO, formatDayLabel, todayISO } from '../core/day'
import { useClinic, RX_PRIVACY_UNAVAILABLE } from '../core/store'
import type { Potency, Repetition } from '../core/types'
import { isOneOffRepetition } from '../core/types'
import { MASTER_REMEDIES } from '../core/remedies'
import { STANDARD_MEDICINE_INSTRUCTIONS } from '../core/rxInstructions'
import { cleanSlipLabel, lastSlipLabel, mentionsRemedy, messageFallback, rememberSlipLabel, slipLine } from '../core/rxPrivacy'
import { shareViaEmail, shareViaSms, shareViaWhatsApp } from '../core/share'
import { WhatsAppIcon } from '../design-system/BrandIcons'
import { Avatar, Badge, BottomSheet, Card, Chip, Label, Stepper, Toggle } from '../design-system/ui'
import { EdgeSwipeBack } from '../design-system/gestures'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { useToast } from '../design-system/toast'
import { NameOnSlip } from '../components/NameOnSlip'
import { SlipPreview } from '../components/SlipPreview'

const POTENCIES: Potency[] = ['6C', '12C', '30C', '200C', '1M', '10M', '50M', 'CM', 'LM', 'Q']
const REPS: Repetition[] = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed', 'Once only today']

// ── Choosing who it is for ───────────────────────────────────────────────
// Every entry point into prescribing must say which patient it is for — Quick Rx
// used to guess and could publish to the wrong person. This is the Rx tab until a
// patient is chosen; choosing one opens the editor below.
export function QuickRxPicker({ onPick }: { onPick: (patientId: string) => void }) {
  const patients = useClinic((s) => s.patients)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients
  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[20px] font-bold text-ink">Quick prescription</div>
        <div className="text-[13px] text-muted">Choose who you're prescribing for.</div>
      </div>
      <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-3">
        <MagnifyingGlass size={16} className="text-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patients" className="-my-3 w-full bg-transparent py-3 text-[13px] outline-none placeholder:text-faint" data-selectable="true" />
      </div>
      <div className="space-y-2">
        {matches.map((p) => (
          <Pressable key={p.id} as="div" hap="tick" scale={0.99} onClick={() => onPick(p.id)} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-3.5 py-3">
            <Avatar initials={p.initials} size={38} />
            <div className="flex-1">
              <div className="font-display text-[14px] font-semibold text-ink">{p.name}</div>
              <div className="text-[12px] text-muted">{p.age} &middot; {p.wsCode}</div>
            </div>
          </Pressable>
        ))}
        {matches.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No patients found</div>}
      </div>
    </div>
  )
}

const splitAllergies = (s: string) => s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)

// ── The prescription editor ──────────────────────────────────────────────
// A full-screen layer (like the case sheet): the tab bar steps aside, Publish stays
// reachable, and a live preview shows what the PATIENT will be given — the printed
// slip, the patient app and the message — which is not always what she records.
// The remedy is always recorded privately; "Name on the slip: Hide" (on by default)
// keeps it off everything the patient receives (core/rxPrivacy.ts).
export function QuickRxEditor({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const ME = useClinic((s) => s.currentPractitionerId)
  const doctor = useClinic((s) => s.practitioners.find((p) => p.id === s.currentPractitionerId))
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const publish = useClinic((s) => s.publishPrescription)
  const updatePractitioner = useClinic((s) => s.updatePractitioner)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const markPrescriptionShared = useClinic((s) => s.markPrescriptionShared)
  const privacy = useClinic((s) => s.rxPrivacySupported)
  const [publishedRxId, setPublishedRxId] = useState<string | null>(null)
  const publishedRx = useClinic((s) => s.prescriptions.find((r) => r.id === publishedRxId))
  const toast = useToast()

  // Nothing is pre-selected: a real remedy and patient must be chosen before Publish does anything.
  // The remedy field is the actual value — typing always works; the chips fill the same field.
  const [remedy, setRemedy] = useState('')
  const [showAllRemedies, setShowAllRemedies] = useState(false)
  const [potency, setPotency] = useState<Potency>('200C')
  const [dose, setDose] = useState(4)
  const [duration, setDuration] = useState(14)
  const [rep, setRep] = useState<Repetition>('Once daily · night')
  const [prep, setPrep] = useState('')
  const [restockReminder, setRestockReminder] = useState(false)
  // Hiding the name is the starting point for every prescription — showing it is a deliberate choice each time.
  const [hide, setHide] = useState(true)
  const [label, setLabel] = useState(() => lastSlipLabel())
  const [done, setDone] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const oneOff = isOneOffRepetition(rep)
  const hideEffective = hide && privacy !== false // the name can only be hidden if the database supports it

  // What actually prints on the slip — in the doctor's own words. It fills itself in from the fields
  // until she edits it directly; after that her words win.
  const [bodyText, setBodyText] = useState('')
  const [bodyTouched, setBodyTouched] = useState(false)
  const rxLike = useMemo(
    () => ({ remedy: remedy.trim(), potency, doseGlobules: dose, repetition: rep, durationDays: oneOff ? null : duration, hideRemedy: hideEffective, slipLabel: cleanSlipLabel(label) }),
    [remedy, potency, dose, rep, duration, oneOff, hideEffective, label],
  )
  useEffect(() => {
    if (bodyTouched) return
    setBodyText(remedy.trim() ? slipLine(rxLike) : '')
  }, [rxLike, bodyTouched, remedy])

  // Her standard instructions go into the box that PRINTS. They replace the auto-filled line, and are added
  // below anything she has already written rather than overwriting it.
  const insertStandardInstructions = () => {
    haptic('tick')
    const typed = bodyTouched && bodyText.trim() !== ''
    setBodyTouched(true)
    setBodyText(!typed ? STANDARD_MEDICINE_INSTRUCTIONS : bodyText.includes(STANDARD_MEDICINE_INSTRUCTIONS) ? bodyText : `${bodyText.trim()}\n\n${STANDARD_MEDICINE_INSTRUCTIONS}`)
  }

  const remedyList = doctor?.remedyList ?? []
  const list = useMemo(() => {
    const q = remedy.toLowerCase()
    const personal = remedyList.filter((r) => r.toLowerCase().includes(q))
    if (q.length < 2) return personal
    const personalSet = new Set(remedyList.map((r) => r.toLowerCase()))
    const master = MASTER_REMEDIES.filter((r) => r.toLowerCase().includes(q) && !personalSet.has(r.toLowerCase()))
    return [...personal, ...master]
  }, [remedyList, remedy])
  const isNewRemedy = remedy.trim().length > 1 && !remedyList.some((r) => r.toLowerCase() === remedy.trim().toLowerCase())

  // Does the text she wrote for the patient still give the name away? (Only matters while it is hidden.)
  const leak = hideEffective && remedy.trim() ? (mentionsRemedy(bodyText, remedy) ?? mentionsRemedy(prep, remedy)) : null

  const canPublish = !!patient && !!remedy.trim()
  const dirty = remedy.trim() !== '' || bodyTouched || prep.trim() !== ''
  const requestClose = () => { if (dirty && !publishedRxId) setDiscardOpen(true); else onClose() }

  if (!patient) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-screen px-8 text-center">
        <div className="font-display text-[17px] font-bold text-ink">Patient not found</div>
        <Pressable hap="tick" onClick={onClose} className="rounded-pill bg-brand px-5 py-2.5 text-[14px] font-semibold text-screen">Back</Pressable>
      </div>
    )
  }
  const firstName = patient.name.split(/\s+/)[0]
  const allergies = splitAllergies(patient.allergies ?? '')

  // Fires the real external share for the just-published prescription and only then marks the channel
  // shared — the same "no fake success" rule as the web console's chips. WhatsApp and Email carry the
  // real letterhead prescription (the PDF) on the phone; SMS cannot attach a file, so it stays text.
  async function shareRx(channel: 'WhatsApp' | 'SMS' | 'Email') {
    if (!publishedRxId || !patient) return
    const body = bodyText.trim() || messageFallback({ ...rxLike, remedy: remedy.trim() })
    const message = `Prescription from ${doctor?.name ?? 'your doctor'} for ${patient.name}:\n${body}${prep.trim() ? `\nPreparation: ${prep.trim()}` : ''}`
    if (Capacitor.isNativePlatform() && publishedRx && (channel === 'WhatsApp' || channel === 'Email')) {
      haptic('success')
      try {
        await (await import('../core/pdfExport')).exportPrescriptionPdf(publishedRx, patient, { shareText: `Prescription from ${doctor?.name ?? 'your doctor'} for ${patient.name}` })
        markPrescriptionShared(publishedRxId, channel)
      } catch {
        toast({ title: 'Couldn’t prepare the prescription PDF', message: 'Please try again.' })
      }
      return
    }
    let sent = true
    if (channel === 'WhatsApp') sent = shareViaWhatsApp(patient.phone, message)
    else if (channel === 'SMS') sent = shareViaSms(patient.phone, message)
    else shareViaEmail(undefined, `Prescription for ${patient.name}`, message)
    if (!sent) { toast({ title: 'No phone number on file', message: `Add a phone number for ${patient.name} first.` }); return }
    haptic('success')
    markPrescriptionShared(publishedRxId, channel)
  }

  function onPublish() {
    if (!canPublish || !patient) return
    let rx
    try {
      rx = publish({
        patientId: patient.id, practitionerId: ME, remedy: remedy.trim(), potency, doseGlobules: dose, repetition: rep,
        durationDays: oneOff ? null : duration, preparation: prep, bodyText: bodyText.trim() || undefined,
        remindersEnabled: !oneOff, reminderTimes: rep === 'Twice daily' ? ['8:00 AM', '8:00 PM'] : ['8:00 PM'],
        sharedVia: ['Patient app'], origin: 'practitioner', restockReminderEnabled: restockReminder,
        hideRemedy: hideEffective, slipLabel: hideEffective ? cleanSlipLabel(label) : undefined,
      })
    } catch (e) {
      if (e instanceof Error && e.message === RX_PRIVACY_UNAVAILABLE) {
        toast({ title: 'Couldn’t hide the name', message: 'The database update for this has not been applied yet. Switch to Show, or ask the clinic owner to apply it.' })
        return
      }
      throw e
    }
    if (hideEffective) rememberSlipLabel(label)
    setPublishedRxId(rx.id)
    // Publishing books the review too, same as the web console — a course that ends without anyone
    // checking back is exactly what this closes.
    if (!oneOff && duration > 0) {
      scheduleFollowUp({ patientId: patient.id, practitionerId: ME, time: '10:00 AM', date: addDaysISO(todayISO(), duration), type: 'In person', reason: 'Follow-up' })
    }
    haptic('success')
    setDone(true)
  }

  return (
    <EdgeSwipeBack onBack={requestClose}>
      <div className="relative flex h-full flex-col bg-screen">
        <div className="shrink-0 border-b border-border/60 bg-screen px-[18px] pb-3 pt-[var(--app-top)]">
          <div className="flex items-center gap-3">
            <Pressable ariaLabel="back" hap="tick" onClick={requestClose} className="relative tap-pad-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface"><CaretLeft size={18} className="text-body" /></Pressable>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[18px] font-bold leading-tight text-ink">Prescription</div>
              <div className="flex items-center gap-1.5 truncate text-[12.5px] text-muted"><Avatar initials={patient.initials} size={16} /> <span className="truncate">{patient.name} · {patient.age} yrs</span></div>
            </div>
            {allergies.length > 0 && (
              <Badge tone="amber" className="max-w-[44%] shrink-0"><Warning size={11} weight="fill" className="shrink-0" /><span className="truncate">{allergies[0]}{allergies.length > 1 ? ` +${allergies.length - 1}` : ''}</span></Badge>
            )}
          </div>
          <div className="mt-3">
            <SlipPreview rx={rxLike} instructions={bodyText} doctorName={doctor?.name ?? 'your doctor'} patientName={patient.name} note={prep} />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-[18px] pb-[140px] pt-3 no-scrollbar">
          <Card className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Remedy</Label>
              <span className="flex items-center gap-1 text-[12px] font-semibold text-muted"><Lock size={11} weight="fill" /> {hideEffective ? 'Only you see this' : 'Shown to the patient'}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-3">
              <MagnifyingGlass size={16} className="text-faint" />
              <input value={remedy} onChange={(e) => setRemedy(e.target.value)} placeholder="Type or select a remedy" className="-my-3 w-full bg-transparent py-3 text-[13px] outline-none placeholder:text-faint" data-selectable="true" aria-label="Remedy" />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(remedy || showAllRemedies ? list : list.slice(0, 8)).map((r) => (
                <Chip key={r} selected={r === remedy} onClick={() => { haptic('select'); setRemedy(r) }}>
                  {r === remedy && <Check size={12} weight="bold" className="mr-1 inline" />}{r}
                </Chip>
              ))}
              {!remedy && !showAllRemedies && list.length > 8 && (
                <Pressable hap="tick" onClick={() => setShowAllRemedies(true)} className="relative tap-pad-y4 rounded-pill border border-dashed border-border-dash px-3 py-2 text-[12px] font-semibold text-muted">+{list.length - 8} more</Pressable>
              )}
              {isNewRemedy && (
                <Chip className="border-dashed" onClick={() => { if (!doctor) return; haptic('success'); updatePractitioner(doctor.id, { remedyList: [...doctor.remedyList, remedy.trim()] }) }}>
                  + Add "{remedy.trim()}" to my list
                </Chip>
              )}
            </div>
            <div className="mt-4">
              <Label>Potency</Label>
              <input value={potency} onChange={(e) => setPotency(e.target.value)} placeholder="e.g. 200C, 50M, LM1" aria-label="Potency" className="mt-2 w-full rounded-pill border border-border bg-surface px-3.5 py-3 text-[13px] text-ink outline-none placeholder:text-faint focus:border-green-border" data-selectable="true" />
              <div className="mt-2 flex flex-wrap gap-2">
                {POTENCIES.map((p) => <Chip key={p} selected={p === potency} onClick={() => { haptic('select'); setPotency(p) }}>{p}</Chip>)}
              </div>
            </div>
          </Card>

          <Card className="px-4 py-3.5">
            <NameOnSlip hide={hideEffective} onHide={(v) => { haptic('tick'); setHide(v) }} label={label} onLabel={setLabel} supported={privacy} />
          </Card>

          <Card className="space-y-3.5 px-4 py-3.5">
            <div className="flex items-center justify-between"><Label>Dose</Label><Stepper value={dose} min={1} max={30} onChange={(v) => { haptic('tick'); setDose(v) }} suffix="globules" /></div>
            {!oneOff && <div className="flex items-center justify-between"><Label>Duration</Label><Stepper value={duration} min={1} max={90} onChange={(v) => { haptic('tick'); setDuration(v) }} suffix="days" /></div>}
            <div>
              <Label>How often</Label>
              <div className="mt-2 flex flex-wrap gap-2">{REPS.map((r) => <Chip key={r} selected={r === rep} onClick={() => { haptic('select'); setRep(r) }}>{r}</Chip>)}</div>
            </div>
          </Card>

          <Card className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-[15px] font-semibold text-ink">Instructions</div>
                <div className="text-[12px] text-muted">Exactly as it will print — your own words are fine</div>
              </div>
              <Pressable hap="none" onClick={insertStandardInstructions} className="relative tap-pad shrink-0 text-[12.5px] font-semibold text-brand">Insert standard</Pressable>
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => { setBodyText(e.target.value); setBodyTouched(true) }}
              rows={4}
              placeholder="Write it exactly as it should appear on the printed slip — your own shorthand is fine (e.g. Px 200C, 1 dose)"
              aria-label="Instructions as they will print"
              data-selectable="true"
              className="mt-2.5 w-full rounded-[14px] border border-border bg-screen px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none placeholder:text-faint focus:border-green-border"
            />
            {bodyTouched && (
              <Pressable hap="tick" onClick={() => setBodyTouched(false)} className="relative tap-pad-y mt-1 text-[12.5px] font-semibold text-brand">Reset to auto-filled</Pressable>
            )}
            {leak && (
              <div className="mt-2.5 flex items-start gap-2 rounded-[12px] border border-amber-border bg-amber-tint px-3 py-2.5 text-[12.5px] leading-snug text-amber-text">
                <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
                <span>Your text still says “{leak}” — the patient would see it. Edit it, or switch the name to Show.</span>
              </div>
            )}
          </Card>

          <Card className="px-4 py-3.5">
            <div className="font-display text-[15px] font-semibold text-ink">Note for the patient</div>
            <div className="text-[12px] text-muted">Shown in the patient app — e.g. how to take it</div>
            <textarea value={prep} onChange={(e) => setPrep(e.target.value)} rows={3} placeholder="e.g. Dissolve under the tongue at night, 15 minutes away from food or drink." aria-label="Note for the patient" data-selectable="true" className="mt-2.5 w-full rounded-[14px] border border-border bg-screen px-3.5 py-2.5 text-[13px] leading-relaxed text-body outline-none placeholder:text-faint focus:border-green-border" />
          </Card>

          <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <div className="font-display text-[15px] font-semibold text-ink">Remind me about a refill</div>
              <div className="text-[12px] text-muted">Shows on Today from day 21, until you prescribe this again.</div>
            </div>
            <Toggle on={restockReminder} onChange={(v) => { haptic('tick'); setRestockReminder(v) }} label="Remind me about a refill" />
          </Card>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-surface/90 px-[18px] pt-3 backdrop-blur-xl" style={{ paddingBottom: 'var(--app-bottom)' }}>
          <Pressable
            hap="none"
            onClick={onPublish}
            disabled={!canPublish}
            className={`flex w-full items-center justify-center gap-2 rounded-pill py-3.5 font-display text-[15px] font-semibold text-screen shadow-cta transition ${canPublish ? 'bg-brand' : 'bg-brand/40'}`}
          >
            <RxIcon size={18} weight="fill" /> {canPublish ? 'Publish & share' : 'Choose a remedy to continue'}
          </Pressable>
          {canPublish && hideEffective && <div className="mt-1.5 flex items-center justify-center gap-1 text-[12px] text-muted"><Lock size={11} weight="fill" /> The remedy name stays with you</div>}
        </div>

        <BottomSheet open={done} onClose={() => setDone(false)}>
          <div className="flex flex-col items-center py-3 text-center">
            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-tint text-accent">
              <Check size={32} weight="bold" />
            </motion.div>
            <div className="mt-3 font-display text-[19px] font-bold text-ink">Prescription published</div>
            <div className="mt-1 px-4 text-[13px] text-muted">
              {remedy} {potency} &middot; {rep} &mdash; sent to {patient.name}{"'"}s app.
              {!oneOff && <> Follow-up auto-booked for {formatDayLabel(addDaysISO(todayISO(), duration))}.</>}
            </div>
            {hideEffective && <div className="mt-2 flex items-center gap-1.5 rounded-pill bg-screen px-3 py-1 text-[12px] font-medium text-muted"><Lock size={11} weight="fill" /> Name hidden from {firstName}{cleanSlipLabel(label) ? ` · slip says ${cleanSlipLabel(label)}` : ''}</div>}

            <div className="mt-4 flex w-full gap-2">
              {([['WhatsApp', WhatsAppIcon], ['SMS', DeviceMobile], ['Email', EnvelopeSimple]] as const).map(([c, Icon]) => (
                <Pressable
                  key={c}
                  hap="tick"
                  onClick={() => void shareRx(c)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-[14px] border px-2 py-2.5 text-[12px] font-semibold ${publishedRx?.sharedVia.includes(c) ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'}`}
                >
                  <Icon size={17} weight="fill" />
                  {c}
                </Pressable>
              ))}
            </div>

            <Pressable
              hap="tick"
              onClick={async () => {
                if (!publishedRx) return
                await (await import('../core/pdfExport')).exportPrescriptionPdf(publishedRx, patient).catch(() => {})
              }}
              className="relative tap-pad-y mt-3 flex items-center gap-1.5 py-1 text-[12.5px] font-semibold text-body"
            >
              <Printer size={14} /> Print / save as PDF
            </Pressable>
            <Pressable hap="tick" onClick={() => { setDone(false); onClose() }} className="mt-4 w-full rounded-pill bg-brand py-3 text-center font-display text-[14px] font-semibold text-screen">Done</Pressable>
          </div>
        </BottomSheet>

        <BottomSheet open={discardOpen} onClose={() => setDiscardOpen(false)}>
          <div className="flex flex-col items-center py-2 text-center">
            <div className="font-display text-[17px] font-bold text-ink">Discard this prescription?</div>
            <div className="mt-1 text-[13px] text-muted">Nothing has been sent. What you have written for {firstName} will be lost.</div>
            <div className="mt-4 flex w-full gap-2">
              <Pressable hap="tick" onClick={() => setDiscardOpen(false)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Keep writing</Pressable>
              <Pressable hap="impact" onClick={() => { setDiscardOpen(false); onClose() }} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Discard</Pressable>
            </div>
          </div>
        </BottomSheet>
      </div>
    </EdgeSwipeBack>
  )
}
