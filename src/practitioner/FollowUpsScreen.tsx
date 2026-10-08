import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowsClockwise, CaretDown } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { followUpQueue, courseNote, type QueueRow } from '../core/course'
import { formatDayLabel, todayISO } from '../core/day'
import { FOLLOW_UP_DAY_CHIPS } from '../core/followUpChoice'
import { useBookFollowUp } from '../core/useFollowUpBooking'
import { Avatar, Badge, Card, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { TickNumber } from '../design-system/feedback'
import { FollowUpSheet } from './FollowUpSheet'
import { PatientQuickView } from './PatientQuickView'

// The Follow-ups tab as a recall queue. Who is due is read from the course the
// doctor prescribed ("course ended 20 days ago"), not from when she last saw the
// patient, and the next visit is booked from the card itself — one tap on a day
// count, with Undo — instead of a sheet per patient.
const SHOWN_BOOKED = 5

export function FollowUpsScreen({ openCompare, openCase, goRx }: { openCompare: (id: string) => void; openCase: (id: string) => void; goRx: (id: string) => void }) {
  const patients = useClinic((s) => s.patients)
  const appointments = useClinic((s) => s.appointments)
  const prescriptions = useClinic((s) => s.prescriptions)
  const bookFollowUp = useBookFollowUp()

  const [peekId, setPeekId] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<QueueRow | null>(null)
  const [showLater, setShowLater] = useState(false)
  const [showAllBooked, setShowAllBooked] = useState(false)

  const today = todayISO() // re-reads each render, so the queue moves on at midnight
  const { needs, booked } = useMemo(() => followUpQueue(patients, appointments, prescriptions), [patients, appointments, prescriptions, today])
  const overdue = needs.filter((r) => r.bucket === 'overdue')
  const soon = needs.filter((r) => r.bucket === 'soon')
  const later = needs.filter((r) => r.bucket === 'later')
  const urgent = overdue.length + soon.length // what is actually waiting on her; the rest are mid-course

  const book = (row: QueueRow, days: number) => bookFollowUp(row.patient, days)

  const card = (row: QueueRow) => {
    const tone = row.bucket === 'overdue' ? 'text-danger' : row.bucket === 'soon' ? 'text-amber-text' : 'text-muted'
    return (
      <motion.div key={row.patient.id} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.26 }} className="overflow-hidden">
        <div className="pb-2.5">
          <Card className="px-3.5 py-3">
            <div className="flex items-center gap-3">
              <Pressable as="div" hap="tick" scale={0.99} onClick={() => setPeekId(row.patient.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <Avatar initials={row.patient.initials} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[14px] font-semibold text-ink">{row.patient.name}</div>
                  <div className="text-[12px] leading-snug text-muted">{row.patient.currentRemedy} · <span className={`font-semibold ${tone}`}>{courseNote(row.course)}</span></div>
                </div>
              </Pressable>
              <Pressable hap="tick" onClick={() => openCompare(row.patient.id)} className="relative tap-pad shrink-0 px-1 py-2 text-[12.5px] font-semibold text-brand">Review →</Pressable>
            </div>
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-label text-faint">Book the next visit in (days)</div>
              <div className="flex gap-1.5">
                {FOLLOW_UP_DAY_CHIPS.map((d) => (
                  <Chip key={d} onClick={() => book(row, d)} className="flex-1 !px-0 !py-3 text-center">{d}</Chip>
                ))}
                <Chip onClick={() => setSheetFor(row)} className="flex-1 !px-0 !py-3 text-center">•••</Chip>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    )
  }

  if (needs.length + booked.length === 0) {
    return (
      <div className="space-y-4">
        <div className="font-display text-[20px] font-bold text-ink">Follow-ups</div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint"><ArrowsClockwise size={24} className="text-faint" /></div>
          <div className="mt-4 font-display text-[16px] font-semibold text-ink">No follow-ups pending</div>
          <div className="mt-1 text-[13px] text-muted">Patients on a remedy will appear here<br />when they need a check-in.</div>
        </div>
      </div>
    )
  }

  const bookedShown = showAllBooked ? booked : booked.slice(0, SHOWN_BOOKED)
  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[20px] font-bold text-ink">Follow-ups</div>
        <div className="text-[13px] text-muted"><TickNumber value={urgent} /> need a date · {booked.length} booked</div>
      </div>

      <div>
        <AnimatePresence initial={false}>
          {overdue.length > 0 && <motion.div key="h-over" layout exit={{ opacity: 0 }}><Label className="mb-2">Overdue · {overdue.length}</Label></motion.div>}
          {overdue.map(card)}
          {soon.length > 0 && <motion.div key="h-soon" layout exit={{ opacity: 0 }} className={overdue.length > 0 ? 'mt-4' : ''}><Label className="mb-2">Ending this week · {soon.length}</Label></motion.div>}
          {soon.map(card)}
        </AnimatePresence>
        {urgent === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="font-display text-[16px] font-semibold text-ink">{later.length > 0 ? 'No one is due yet' : 'Everyone has a date'}</div>
            <div className="mt-1 text-[13px] text-muted">{later.length > 0 ? 'Courses are still running — nothing is waiting on you.' : 'Nothing is waiting on you here.'}</div>
          </div>
        )}
        {later.length > 0 && (
          <div className="mt-2">
            <Pressable hap="tick" onClick={() => setShowLater((v) => !v)} className="relative tap-pad-y mx-auto flex items-center gap-1 py-2 text-[13px] font-semibold text-muted">
              {showLater ? 'Hide' : 'Show'} {later.length} not due yet <CaretDown size={12} weight="bold" className={`transition-transform ${showLater ? 'rotate-180' : ''}`} />
            </Pressable>
            <AnimatePresence initial={false}>
              {showLater && <motion.div key="later" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mt-3">{later.map(card)}</motion.div>}
            </AnimatePresence>
          </div>
        )}
      </div>

      {booked.length > 0 && (
        <div>
          <Label className="mb-2">Booked · {booked.length}</Label>
          <Card className="overflow-hidden">
            {bookedShown.map((r, i) => (
              <Pressable key={r.patient.id} as="div" hap="tick" scale={0.995} onClick={() => setPeekId(r.patient.id)} className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                <Avatar initials={r.patient.initials} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[13.5px] font-semibold text-ink">{r.patient.name}</div>
                  <div className="truncate text-[12px] text-muted">{r.patient.currentRemedy}</div>
                </div>
                <Badge tone="green">{formatDayLabel(r.nextAppt!.date)}</Badge>
              </Pressable>
            ))}
            {booked.length > SHOWN_BOOKED && (
              <Pressable hap="tick" onClick={() => setShowAllBooked((v) => !v)} className="w-full border-t border-border py-3 text-center text-[13px] font-semibold text-brand">
                {showAllBooked ? 'Show fewer' : `See all ${booked.length}`}
              </Pressable>
            )}
          </Card>
        </div>
      )}

      <FollowUpSheet
        open={sheetFor !== null}
        patientName={sheetFor?.patient.name ?? ''}
        onClose={() => setSheetFor(null)}
        onSelect={(preset) => {
          const row = sheetFor
          const days = Number(preset.match(/\d+/)?.[0] ?? 0)
          setSheetFor(null)
          if (row && days) book(row, days)
        }}
      />
      <PatientQuickView patientId={peekId} onClose={() => setPeekId(null)} onOpenCase={openCase} onPrescribe={goRx} />
    </div>
  )
}
