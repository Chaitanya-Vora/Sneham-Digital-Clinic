import { useState } from 'react'
import { CalendarPlus, Bell, ChatCircleDots, CurrencyInr, CaretRight, DotsThree, VideoCamera, Plus } from '@phosphor-icons/react'
import { Card, Avatar, Badge, StatTile } from '../design-system/ui'
import { TickNumber } from '../design-system/feedback'

// The web "Today": the schedule on the left, and on the right the things that
// are waiting on her — numbers the app already works out (follow-ups with no
// date, refill reminders, unread messages, payments due) but never gathered in
// one place. The two money tiles say what they measure.
const APPTS = [
  { t: '9:00 AM', n: 'Aruna Sawant', i: 'AS', r: 'Follow-up', type: 'In person' },
  { t: '11:00 AM', n: 'Nilofer Kaskar', i: 'NK', r: 'Tell dose', type: 'Video' },
  { t: '12:00 PM', n: 'Nilesh Irakshetti', i: 'NI', r: 'Follow-up', type: 'In person' },
  { t: '7:00 PM', n: 'Vishwa Bhalekar', i: 'VB', r: 'FU', type: 'In person' },
]

export function DashboardLab() {
  const [mode, setMode] = useState<'mine' | 'everyone'>('mine')
  const [att, setAtt] = useState({ followups: 6, refills: 3, messages: 2, payments: 26 })
  const rows: { key: keyof typeof att; label: string; sub: string; icon: typeof Bell; tone: 'amber' | 'green' }[] = [
    { key: 'followups', label: 'Follow-ups with no date', sub: 'On a remedy, nothing booked', icon: CalendarPlus, tone: 'amber' },
    { key: 'refills', label: 'Refill reminders', sub: 'Day 21 from the last prescription', icon: Bell, tone: 'green' },
    { key: 'messages', label: 'Unread messages', sub: 'From patients', icon: ChatCircleDots, tone: 'green' },
    { key: 'payments', label: 'Payments due', sub: 'Across all patients', icon: CurrencyInr, tone: 'amber' },
  ]
  return (
    <div className="overflow-x-auto pb-4">
      <div className="w-[1120px] rounded-[28px] border border-border-dash bg-screen p-7 shadow-card-lg">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-[24px] font-bold text-ink">Good morning, Dr. Neha</div>
            <div className="text-[14px] text-muted">Thursday, 8 October 2026 · 4 appointments</div>
          </div>
          <div className="rounded-pill border border-border bg-surface px-4 py-2 text-[13px] text-faint">Search patients, cases, invoices   ⌘K</div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3.5">
          <StatTile label="Today's appointments" value={4} sub="4 remaining" />
          <StatTile label="Patients seen" value={0} sub="of 4 today" />
          <StatTile label="Collected today" value="₹800" sub="1 bill paid" />
          <StatTile label="Avg per paid bill" value="₹800" sub="from 1 bill" tone="green" />
        </div>

        <div className="mt-4 grid grid-cols-[1.75fr_1fr] gap-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-ink">Today's schedule</h2>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-body"><CurrencyInr size={14} weight="bold" /> Quick bill</button>
                <button className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-body"><VideoCamera size={14} weight="bold" /> Instant meeting</button>
                <button className="flex items-center gap-1.5 rounded-pill border border-green-border bg-tint px-3 py-1.5 text-[12px] font-semibold text-ink-deep"><Plus size={14} weight="bold" /> Walk-in</button>
                <div className="inline-flex rounded-pill bg-screen p-0.5">
                  {(['mine', 'everyone'] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`rounded-pill px-3 py-1.5 text-[12px] font-semibold transition ${mode === m ? 'bg-brand text-screen' : 'text-muted'}`}>{m === 'mine' ? 'Mine' : 'Everyone'}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {APPTS.map((a) => (
                <div key={a.t} className="flex items-center gap-3.5 rounded-[16px] border border-border bg-surface px-4 py-3 transition hover:-translate-y-px hover:shadow-card">
                  <div className="w-[76px] font-display text-[14px] font-bold text-ink">{a.t}</div>
                  <Avatar initials={a.i} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[14.5px] font-semibold text-ink">{a.n}</div>
                    <div className="text-[12.5px] text-muted">{a.r}</div>
                  </div>
                  {a.type === 'Video' ? (
                    <button className="flex items-center gap-1.5 rounded-pill bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-screen shadow-float"><VideoCamera size={14} weight="fill" /> Join call</button>
                  ) : (
                    <Badge tone="green">{a.type}</Badge>
                  )}
                  <button aria-label="More" className="flex h-9 w-9 items-center justify-center rounded-full text-faint hover:bg-screen"><DotsThree size={22} weight="bold" /></button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="h-fit p-5">
            <h2 className="mb-3 font-display text-[16px] font-bold text-ink">Needs attention</h2>
            <div className="space-y-1">
              {rows.map((r) => (
                <button key={r.key} onClick={() => setAtt((cur) => ({ ...cur, [r.key]: Math.max(0, cur[r.key] - 1) }))} className="flex w-full items-center gap-3.5 rounded-[16px] px-2 py-2.5 text-left transition hover:bg-screen">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-display text-[20px] font-bold ${r.tone === 'amber' && att[r.key] > 0 ? 'bg-amber-tint text-amber-text' : 'bg-tint text-ink-deep'}`}>
                    <TickNumber value={att[r.key]} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[14px] font-semibold text-ink">{r.label}</div>
                    <div className="text-[12.5px] text-muted">{r.sub}</div>
                  </div>
                  <CaretRight size={16} className="text-faint" />
                </button>
              ))}
            </div>
            <div className="mt-2 px-2 text-[12px] text-faint">Demo: click a row and its number counts down, as it would when she clears one.</div>
          </Card>
        </div>
      </div>
      <div className="mt-5 max-w-[760px] text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">Why this shape</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">The empty half now has a job.</span> Follow-ups with no date, refill reminders, unread messages and payments due — all already computed in the app, now in one panel.</li>
          <li><span className="font-semibold text-ink">The tiles tell the truth.</span> "Avg consult value ₹800 · no consults yet" is replaced by "Avg per paid bill · from 1 bill" — the number was always an average of bills, only the caption was wrong.</li>
          <li><span className="font-semibold text-ink">No bare X.</span> Cancel is behind ⋯ and uses the confirmation from problem 3.</li>
          <li>On a narrow window the right panel simply drops below the schedule.</li>
        </ul>
      </div>
    </div>
  )
}
