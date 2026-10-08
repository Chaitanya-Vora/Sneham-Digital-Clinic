import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CaretLeft, CaretRight, CaretDown, Plus, DotsThree, Check, XCircle, CalendarBlank, NotePencil } from '@phosphor-icons/react'
import { Card, Avatar, Badge, BottomSheet, Label } from '../design-system/ui'
import { DayProgress } from '../design-system/DayProgress'
import { Pressable } from '../design-system/Pressable'
import { Phone, FakeTabBar } from './kit'

// The Calendar tab as a calm agenda. The title collapses as the list scrolls,
// the week is a plain strip (no box, no arrows — swipe), the owner's doctor
// filter is one small chip, and the day is ONE card of hairline-separated rows
// instead of a tall card per appointment.
type Status = 'Upcoming' | 'In consult' | 'Seen' | 'Cancelled'
interface A { id: string; time: string; ap: string; name: string; i: string; meta: string; status: Status }
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const THU: A[] = [
  { id: '1', time: '9:00', ap: 'AM', name: 'Aruna Sawant', i: 'AS', meta: 'In person · 30 min · Follow-up', status: 'Seen' },
  { id: '2', time: '9:30', ap: 'AM', name: 'Kavya Madressa', i: 'KM', meta: 'In person · 30 min · Follow-up', status: 'Cancelled' },
  { id: '3', time: '11:00', ap: 'AM', name: 'Nilofer Kaskar', i: 'NK', meta: 'Video · 30 min · Tell dose', status: 'In consult' },
  { id: '4', time: '11:00', ap: 'AM', name: 'Tasneem Jawadwala', i: 'TJ', meta: 'Video · 30 min · FU', status: 'Cancelled' },
  { id: '5', time: '12:00', ap: 'PM', name: 'Nilesh Irakshetti', i: 'NI', meta: 'In person · 30 min · Follow-up', status: 'Upcoming' },
  { id: '6', time: '7:00', ap: 'PM', name: 'Vishwa Bhalekar', i: 'VB', meta: 'In person · 30 min · FU', status: 'Upcoming' },
]
const FRI: A[] = [
  { id: '7', time: '10:00', ap: 'AM', name: 'Meera Iyer', i: 'MI', meta: 'In person · 30 min · Follow-up', status: 'Upcoming' },
  { id: '8', time: '6:00', ap: 'PM', name: 'Rohit Menon', i: 'RM', meta: 'In person · 30 min · FU', status: 'Upcoming' },
]
const MON: A[] = [{ id: '9', time: '10:30', ap: 'AM', name: 'Husaina Jalali', i: 'HJ', meta: 'Video · 30 min · FU', status: 'Upcoming' }]

export function CalendarLab() {
  const today = new Date()
  const monday = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }, [])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d }), [monday])
  const todayIdx = (today.getDay() + 6) % 7
  const [sel, setSel] = useState(todayIdx)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [collapsed, setCollapsed] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [menuFor, setMenuFor] = useState<A | null>(null)
  const [confirmFor, setConfirmFor] = useState<A | null>(null)

  const byIdx = (i: number): A[] => (i === todayIdx ? THU : i === (todayIdx + 1) % 7 ? FRI : i === 0 ? MON : [])
  const agenda = byIdx(sel)
  const live = agenda.filter((a) => a.status !== 'Cancelled')
  const cancelled = agenda.filter((a) => a.status === 'Cancelled')
  const d = days[sel]

  const row = (a: A, first: boolean, dim = false) => (
    <div key={a.id} className={`flex items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-border'} ${a.status === 'In consult' ? 'bg-tint-pale' : ''} ${dim ? 'opacity-55' : ''}`}>
      <div className="w-[46px] shrink-0">
        <div className="font-display text-[14px] font-bold leading-none text-ink">{a.time}</div>
        <div className="mt-0.5 text-[10.5px] font-medium text-faint">{a.ap}</div>
      </div>
      <Avatar initials={a.i} size={36} />
      <div className="min-w-0 flex-1">
        <div className={`font-display text-[14px] font-semibold text-ink ${dim ? 'line-through' : ''}`}>{a.name}</div>
        <div className="truncate text-[12px] text-muted">{a.meta}</div>
      </div>
      {a.status === 'In consult' && <Badge tone="green"><span className="h-1.5 w-1.5 animate-breathe rounded-full bg-brand" />In consult</Badge>}
      {a.status === 'Seen' && <span className="flex items-center gap-1 text-[12px] font-semibold text-success"><Check size={14} weight="bold" />Seen</span>}
      {a.status === 'Upcoming' && (
        <Pressable ariaLabel={`Actions for ${a.name}`} hap="tick" onClick={() => setMenuFor(a)} className="relative tap-pad flex h-8 w-8 items-center justify-center rounded-full text-faint">
          <DotsThree size={22} weight="bold" />
        </Pressable>
      )}
    </div>
  )

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Calm agenda" note="Scroll the list: the title collapses. Tap a day, tap ⋯ on a row." height={820}>
        <div className="h-full overflow-y-auto no-scrollbar" onScroll={(e) => setCollapsed(e.currentTarget.scrollTop > 10)}>
          <div className="sticky top-0 z-20 bg-screen/95 px-[18px] pb-2 pt-[var(--app-top)] backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-display font-bold leading-tight text-ink transition-all duration-200 ${collapsed ? 'text-[17px]' : 'text-[26px]'}`}>Calendar</div>
                <div className={`overflow-hidden text-[13px] text-muted transition-all duration-200 ${collapsed ? 'max-h-0 opacity-0' : 'max-h-6 opacity-100'}`}>
                  {d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-pill border border-border bg-surface py-1 pl-1 pr-2.5 text-[12.5px] font-semibold text-body">
                  <Avatar initials="NB" size={22} /> You <CaretDown size={12} weight="bold" className="text-faint" />
                </button>
                <Pressable ariaLabel="Add" hap="tick" className="relative tap-pad flex h-9 w-9 items-center justify-center rounded-full bg-brand text-screen shadow-float">
                  <Plus size={17} weight="bold" />
                </Pressable>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="inline-flex rounded-pill border border-border bg-surface p-0.5">
                {(['week', 'month'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`rounded-pill px-3.5 py-1 text-[12.5px] font-semibold transition ${view === v ? 'bg-brand text-screen' : 'text-muted'}`}>{v === 'week' ? 'Week' : 'Month'}</button>
                ))}
              </div>
              <div className="flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                <CaretLeft size={14} weight="bold" className="text-faint" />
                {days[0].getDate()} {days[0].toLocaleDateString('en-IN', { month: 'short' })} – {days[6].getDate()} {days[6].toLocaleDateString('en-IN', { month: 'short' })}
                <CaretRight size={14} weight="bold" className="text-faint" />
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              {days.map((dd, i) => {
                const on = i === sel
                const isToday = i === todayIdx
                const list = byIdx(i).filter((a) => a.status !== 'Cancelled')
                return (
                  <Pressable key={i} hap="tick" onClick={() => setSel(i)} className={`relative flex flex-1 flex-col items-center gap-1 rounded-[14px] py-2 transition-colors ${on ? 'bg-brand' : ''}`}>
                    <span className={`text-[11px] font-medium ${on ? 'text-white/80' : isToday ? 'text-brand' : 'text-muted'}`}>{DAY_NAMES[i]}</span>
                    <span className={`font-display text-[16px] font-bold ${on ? 'text-white' : isToday ? 'text-brand' : 'text-ink'}`}>{dd.getDate()}</span>
                    {list.length > 0 ? <DayProgress done={list.filter((a) => a.status === 'Seen').length} total={list.length} onDark={on} className="w-5" /> : <span className="h-[5px]" />}
                  </Pressable>
                )
              })}
            </div>
          </div>

          <div className="px-[18px] pb-[130px] pt-3">
            {agenda.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint"><CalendarBlank size={24} className="text-faint" /></div>
                <div className="mt-4 font-display text-[16px] font-semibold text-ink">A free day</div>
                <div className="mt-1 text-[13px] text-muted">Nothing booked for this day.</div>
              </div>
            ) : (
              <>
                <Label className="mb-2">{live.length} appointment{live.length === 1 ? '' : 's'}{cancelled.length ? ` · ${cancelled.length} cancelled` : ''}</Label>
                <Card className="overflow-hidden">{live.map((a, i) => row(a, i === 0))}</Card>
                {cancelled.length > 0 && (
                  <div className="mt-3">
                    <button onClick={() => setShowCancelled((v) => !v)} className="mx-auto flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                      {showCancelled ? 'Hide' : 'Show'} {cancelled.length} cancelled <CaretDown size={12} weight="bold" className={showCancelled ? 'rotate-180' : ''} />
                    </button>
                    {showCancelled && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2"><Card className="overflow-hidden">{cancelled.map((a, i) => row(a, i === 0, true))}</Card></motion.div>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <FakeTabBar active="calendar" />

        <BottomSheet open={menuFor !== null} onClose={() => setMenuFor(null)}>
          <div className="flex items-center gap-3">
            <Avatar initials={menuFor?.i ?? ''} size={40} />
            <div>
              <div className="font-display text-[16px] font-bold text-ink">{menuFor?.name}</div>
              <div className="text-[12.5px] text-muted">{menuFor?.time} {menuFor?.ap} · {dayLabelFor(d)}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[{ label: 'Reschedule', icon: CalendarBlank }, { label: 'Edit details', icon: NotePencil }].map((x) => (
              <Pressable key={x.label} as="div" hap="tick" scale={0.98} onClick={() => setMenuFor(null)} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><x.icon size={20} /></div>
                <div className="flex-1 text-[14px] font-semibold text-ink">{x.label}</div>
              </Pressable>
            ))}
            <Pressable as="div" hap="tick" scale={0.98} onClick={() => { setConfirmFor(menuFor); setMenuFor(null) }} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-danger/10 text-danger"><XCircle size={20} /></div>
              <div className="flex-1 text-[14px] font-semibold text-danger">Cancel appointment</div>
            </Pressable>
          </div>
        </BottomSheet>
        <BottomSheet open={confirmFor !== null} onClose={() => setConfirmFor(null)}>
          <div className="flex flex-col items-center py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><XCircle size={28} weight="fill" /></div>
            <div className="mt-3 font-display text-[17px] font-bold text-ink">Cancel appointment?</div>
            <div className="mt-1 text-[13px] text-muted">{confirmFor?.name} · {confirmFor?.time} {confirmFor?.ap}</div>
            <div className="mt-4 flex w-full gap-2">
              <Pressable hap="tick" onClick={() => setConfirmFor(null)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Keep it</Pressable>
              <Pressable hap="impact" onClick={() => setConfirmFor(null)} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Cancel it</Pressable>
            </div>
          </div>
        </BottomSheet>
      </Phone>
      <div className="max-w-[330px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">Why this shape</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">The header shrinks from ≈45% of the screen to ≈20%</span> — and to a single title line once she scrolls.</li>
          <li><span className="font-semibold text-ink">One card, hairline rows.</span> Each appointment is about 64 px instead of 95, so five or six fit on screen.</li>
          <li><span className="font-semibold text-ink">Status appears only when it matters</span> (in consult, seen). No "Upcoming" pill on every row.</li>
          <li><span className="font-semibold text-ink">Cancelled ones fold away</span> under "Show 2 cancelled".</li>
          <li><span className="font-semibold text-ink">Edit and Cancel live behind ⋯</span> — a 44 px target — and Cancel keeps the app's own confirmation.</li>
          <li>The doctor filter (owner only) is one chip; the week arrows are a swipe.</li>
        </ul>
      </div>
    </div>
  )
}

function dayLabelFor(d: Date) { return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }
