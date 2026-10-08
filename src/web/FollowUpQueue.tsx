import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretDown } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { followUpQueue, courseNote, type QueueRow } from '../core/course'
import { todayISO } from '../core/day'
import { FOLLOW_UP_DAY_CHIPS } from '../core/followUpChoice'
import { useBookFollowUp } from '../core/useFollowUpBooking'
import { Avatar, Card, Label } from '../design-system/ui'
import { FollowUpPresetMenu } from './FollowUpPresetMenu'

// The web console's recall queue: patients whose course of medicine has ended (or
// ends this week) and who have no visit booked yet — the same list, in the same
// order, as the phone's Follow-ups tab and the dashboard's "Needs attention".
// One click on a day count books the next visit, with Undo in the toast.
export function FollowUpQueue({ onReview }: { onReview: (patientId: string) => void }) {
  const patients = useClinic((s) => s.patients)
  const appointments = useClinic((s) => s.appointments)
  const prescriptions = useClinic((s) => s.prescriptions)
  const book = useBookFollowUp()
  const [customFor, setCustomFor] = useState<string | null>(null)
  const [showLater, setShowLater] = useState(false)

  const today = todayISO()
  const { needs } = useMemo(() => followUpQueue(patients, appointments, prescriptions), [patients, appointments, prescriptions, today])
  const overdue = needs.filter((r) => r.bucket === 'overdue')
  const soon = needs.filter((r) => r.bucket === 'soon')
  const later = needs.filter((r) => r.bucket === 'later')
  const urgent = overdue.length + soon.length

  const row = (r: QueueRow) => {
    const tone = r.bucket === 'overdue' ? 'text-danger' : r.bucket === 'soon' ? 'text-amber-text' : 'text-muted'
    return (
      // The row clips while it collapses after a booking, but must not clip the custom-days popover while that is open.
      <motion.div key={r.patient.id} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24 }} style={{ position: 'relative', overflow: customFor === r.patient.id ? 'visible' : 'hidden', zIndex: customFor === r.patient.id ? 20 : 0 }}>
        <div className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-0">
          <Avatar initials={r.patient.initials} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[14px] font-semibold text-ink">{r.patient.name}</div>
            <div className="truncate text-[12px] text-muted">{r.patient.currentRemedy} · <span className={`font-semibold ${tone}`}>{courseNote(r.course)}</span></div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-label text-faint">Book in</span>
            {FOLLOW_UP_DAY_CHIPS.map((d) => (
              <button key={d} onClick={() => book(r.patient, d)} title={`Book the next visit in ${d} days`} className="h-9 min-w-[42px] rounded-pill border border-border bg-surface px-2 text-[13px] font-medium text-muted outline-none transition hover:border-green-border hover:bg-tint hover:text-ink-deep focus-visible:ring-2 focus-visible:ring-brand/40">{d}</button>
            ))}
            <div className="relative">
              <button onClick={() => setCustomFor(customFor === r.patient.id ? null : r.patient.id)} aria-label="Pick another number of days" className="h-9 min-w-[42px] rounded-pill border border-border bg-surface px-2 text-[13px] font-medium text-muted outline-none transition hover:border-green-border hover:bg-tint hover:text-ink-deep focus-visible:ring-2 focus-visible:ring-brand/40">•••</button>
              <FollowUpPresetMenu
                open={customFor === r.patient.id}
                onClose={() => setCustomFor(null)}
                onSelect={(preset, choice) => { setCustomFor(null); const days = Number(preset.match(/\d+/)?.[0] ?? 0); if (days) book(r.patient, days, choice) }}
              />
            </div>
          </div>
          <button onClick={() => onReview(r.patient.id)} className="shrink-0 rounded-pill px-2 py-1 text-[12.5px] font-semibold text-brand outline-none transition hover:bg-tint focus-visible:ring-2 focus-visible:ring-brand/40">Review →</button>
        </div>
      </motion.div>
    )
  }

  if (needs.length === 0) return null
  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
        <h2 className="font-display text-[15px] font-bold text-ink">Need a date <span className="font-body text-[13px] font-normal text-muted">· {urgent}</span></h2>
      </div>
      <AnimatePresence initial={false}>
        {overdue.length > 0 && <motion.div key="h-over" layout exit={{ opacity: 0 }} className="px-5 pb-1.5 pt-2"><Label>Overdue · {overdue.length}</Label></motion.div>}
        {overdue.map(row)}
        {soon.length > 0 && <motion.div key="h-soon" layout exit={{ opacity: 0 }} className="px-5 pb-1.5 pt-3"><Label>Ending this week · {soon.length}</Label></motion.div>}
        {soon.map(row)}
      </AnimatePresence>
      {urgent === 0 && <div className="px-5 py-6 text-center text-[13px] text-muted">No one is due yet — every course that has ended has a visit booked.</div>}
      {later.length > 0 && (
        <div className="border-t border-border">
          <button onClick={() => setShowLater((v) => !v)} className="flex w-full items-center justify-center gap-1 py-3 text-[13px] font-semibold text-muted outline-none transition hover:text-body focus-visible:bg-screen">
            {showLater ? 'Hide' : 'Show'} {later.length} not due yet <CaretDown size={12} weight="bold" className={`transition-transform ${showLater ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>{showLater && <motion.div key="later" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>{later.map(row)}</motion.div>}</AnimatePresence>
        </div>
      )}
    </Card>
  )
}
