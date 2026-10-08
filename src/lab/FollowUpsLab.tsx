import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, Chip, Avatar, Badge, Label } from '../design-system/ui'
import { TickNumber } from '../design-system/feedback'
import { FollowUpSheet } from '../practitioner/FollowUpSheet'
import { Phone, FakeTabBar, FrameToast, addDays, dayLabel, type FrameToastData } from './kit'

// Follow-ups as a recall queue: who is due is read from the course itself
// (how long ago the prescribed course ended), and the next visit is booked
// from the card — one tap on a day count, with Undo — instead of opening a
// sheet per patient.
interface Q { id: string; name: string; i: string; remedy: string; kind: 'overdue' | 'soon'; days: number }
const QUEUE: Q[] = [
  { id: 'a', name: 'Ananya Rao', i: 'AR', remedy: 'Sulphur 200C', kind: 'overdue', days: 20 },
  { id: 'k', name: 'Kabir Shah', i: 'KS', remedy: 'Pulsatilla 1M', kind: 'overdue', days: 6 },
  { id: 's', name: 'Suaad Parkar', i: 'SP', remedy: 'Sulphur 0/2', kind: 'overdue', days: 2 },
  { id: 't', name: 'Tara Nair', i: 'TN', remedy: 'Calcarea carb 200C', kind: 'soon', days: 3 },
  { id: 'r', name: 'Rohit Menon', i: 'RM', remedy: 'Nux vomica 30C', kind: 'soon', days: 5 },
]
interface B { id: string; name: string; i: string; remedy: string; when: string; fresh?: boolean }
const BOOKED: B[] = [
  { id: 'm', name: 'Meera Iyer', i: 'MI', remedy: 'Sepia 1M', when: 'Mon, 19 Oct' },
  { id: 'v', name: 'Vihanga Bhosale', i: 'VB', remedy: 'Arsenicum alb 200C', when: 'Wed, 21 Oct' },
  { id: 'h', name: 'Husaina Jalali', i: 'HJ', remedy: 'Sulphur 200C', when: 'Fri, 23 Oct' },
]
const QUICK = [7, 10, 15, 20, 30]

function course(q: Q) {
  return q.kind === 'overdue' ? `course ended ${q.days} day${q.days === 1 ? '' : 's'} ago` : `course ends in ${q.days} days`
}

export function FollowUpsLab() {
  const [queue, setQueue] = useState(QUEUE)
  const [booked, setBooked] = useState(BOOKED)
  const [extra, setExtra] = useState(23) // the rest of the booked list, not drawn
  const [toast, setToast] = useState<FrameToastData | null>(null)
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const book = (q: Q, days: number) => {
    const when = dayLabel(addDays(days))
    setQueue((cur) => cur.filter((x) => x.id !== q.id))
    setBooked((cur) => [{ id: q.id, name: q.name, i: q.i, remedy: q.remedy, when, fresh: true }, ...cur])
    setToast({
      id: Date.now(),
      title: `Booked · ${when}`,
      message: `${q.name} · 9:00 AM`,
      undo: () => {
        setBooked((cur) => cur.filter((b) => b.id !== q.id))
        setQueue((cur) => (cur.some((x) => x.id === q.id) ? cur : [...cur, q].sort((a, b) => QUEUE.findIndex((z) => z.id === a.id) - QUEUE.findIndex((z) => z.id === b.id))))
      },
    })
  }
  const overdue = queue.filter((q) => q.kind === 'overdue')
  const soon = queue.filter((q) => q.kind === 'soon')
  const reset = () => { setQueue(QUEUE); setBooked(BOOKED); setToast(null) }

  const card = (q: Q) => (
    <motion.div key={q.id} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
     <div className="pb-2.5">
      <Card className="px-3.5 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials={q.i} size={40} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] font-semibold text-ink">{q.name}</div>
            <div className="truncate text-[12px] text-muted">
              {q.remedy} · <span className={`font-semibold ${q.kind === 'overdue' ? 'text-danger' : 'text-amber-text'}`}>{course(q)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-label text-faint">Book the next visit in (days)</div>
          <div className="flex gap-1.5">
            {QUICK.map((d) => (
              <Chip key={d} onClick={() => book(q, d)} className="flex-1 !px-0 !py-1.5 text-center">{d}</Chip>
            ))}
            <Chip onClick={() => setSheetFor(q.id)} className="flex-1 !px-0 !py-1.5 text-center">•••</Chip>
          </div>
        </div>
      </Card>
     </div>
    </motion.div>
  )

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Recall queue" note="Tap a day count — it books and the card leaves the list. Undo is in the toast." height={820}>
        <div className="h-full overflow-y-auto px-[18px] pb-[110px] pt-[var(--app-top)] no-scrollbar">
          <div>
            <div className="font-display text-[20px] font-bold text-ink">Follow-ups</div>
            <div className="text-[13px] text-muted"><TickNumber value={queue.length} /> need a date · {booked.length + extra} booked</div>
          </div>
          <div className="mt-4">
            <AnimatePresence initial={false}>
              {overdue.length > 0 && (
                <motion.div key="h-over" layout exit={{ opacity: 0 }}>
                  <Label className="mb-2">Overdue · {overdue.length}</Label>
                </motion.div>
              )}
              {overdue.map(card)}
              {soon.length > 0 && (
                <motion.div key="h-soon" layout exit={{ opacity: 0 }} className="mt-4">
                  <Label className="mb-2">Ending this week · {soon.length}</Label>
                </motion.div>
              )}
              {soon.map(card)}
            </AnimatePresence>
            {queue.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="font-display text-[16px] font-semibold text-ink">Everyone has a date</div>
                <div className="mt-1 text-[13px] text-muted">Nothing waiting on you here.</div>
                <button onClick={reset} className="mt-3 text-[13px] font-semibold text-brand">Reset the demo</button>
              </div>
            )}
          </div>
          <div className="mt-5">
            <Label className="mb-2">Booked · {booked.length + extra}</Label>
            <Card className="overflow-hidden">
              {booked.slice(0, 4).map((b, i) => (
                <motion.div key={b.id} layout initial={b.fresh ? { backgroundColor: '#E9EEE1' } : false} animate={{ backgroundColor: 'rgba(252,251,246,0)' }} transition={{ duration: 1.6 }} className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Avatar initials={b.i} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[13.5px] font-semibold text-ink">{b.name}</div>
                    <div className="truncate text-[12px] text-muted">{b.remedy}</div>
                  </div>
                  <Badge tone="green">{b.when}</Badge>
                </motion.div>
              ))}
              <div className="border-t border-border px-3.5 py-2.5 text-center text-[13px] font-semibold text-brand">See all {booked.length + extra}</div>
            </Card>
          </div>
        </div>
        <FakeTabBar active="followups" />
        <FrameToast toast={toast} onClose={closeToast} />
        <FollowUpSheet
          open={sheetFor !== null}
          patientName={QUEUE.find((q) => q.id === sheetFor)?.name ?? ''}
          onClose={() => setSheetFor(null)}
          onSelect={(preset) => {
            const q = QUEUE.find((x) => x.id === sheetFor)
            const days = Number(preset.match(/\d+/)?.[0] ?? 0)
            setSheetFor(null)
            if (q && days) book(q, days)
          }}
        />
      </Phone>
      <div className="max-w-[330px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">Why this shape</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">Due-ness comes from the course.</span> "Course ended 20 days ago" is a clinical fact from the prescription; "Last seen today" told her nothing.</li>
          <li><span className="font-semibold text-ink">One tap books.</span> The chips are the same day counts as the new follow-up sheet; "•••" opens that sheet for anything else.</li>
          <li><span className="font-semibold text-ink">The list gets shorter as she works.</span> Booked patients leave the queue; the count rolls down.</li>
          <li><span className="font-semibold text-ink">Terracotta, not red.</span> Overdue uses the app's own danger tone; this week uses amber.</li>
          <li>The patients already booked sit quietly below.</li>
        </ul>
        <button onClick={reset} className="mt-4 rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-body">Reset the demo</button>
      </div>
    </div>
  )
}
