import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CaretDown, Plus, DotsThree, Check, XCircle, CalendarBlank, CalendarPlus, NotePencil, Prohibit } from '@phosphor-icons/react'
import { Card, Avatar, Badge, BottomSheet, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { CalendarCanvas, type CalendarMode } from '../practitioner/calendar/CalendarCanvas'
import { EMPTY_LOAD, addDaysTo, sameDay, shiftMonth, shiftWeek, type DayLoad } from '../core/calendarGrid'
import { toISO, type ISODate } from '../core/day'
import { Phone, FakeTabBar, FrameToast, type FrameToastData } from './kit'

// Calendar v2: week and month are ONE grid. Month view folds out of the week
// strip (and back), the bar under each date shows how full the day is, and the
// agenda below follows whichever day is selected — without leaving month view.
type Status = 'Upcoming' | 'In consult' | 'Seen' | 'Cancelled'
interface A { id: string; time: string; ap: string; name: string; i: string; meta: string; status: Status }
interface Closure { reason: string }

const PEOPLE = ['Aruna Sawant', 'Kavya Madressa', 'Nilofer Kaskar', 'Tasneem Jawadwala', 'Nilesh Irakshetti', 'Vishwa Bhalekar', 'Meera Iyer', 'Rohit Menon', 'Husaina Jalali', 'Sana Qureshi', 'Dev Patil', 'Anjali Rao']
const TIMES: [string, string][] = [['9:00', 'AM'], ['9:30', 'AM'], ['10:00', 'AM'], ['10:30', 'AM'], ['11:00', 'AM'], ['12:00', 'PM'], ['4:00', 'PM'], ['4:30', 'PM'], ['5:00', 'PM'], ['6:00', 'PM'], ['7:00', 'PM']]
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('')
const CAPACITY = 8

function buildDay(d: Date, today: Date): { list: A[]; closure?: Closure } {
  const dow = d.getDay()
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)
  if (diff === 4) return { list: [], closure: { reason: 'Clinic closed · Diwali' } }
  if (dow === 0) return { list: [] }
  const seed = d.getDate() * 7 + d.getMonth() * 13
  let n = ((seed * 37) % 7) + 1
  if (diff === 1) n = 10
  if (diff === 2 || diff === 9) n = 0
  if (diff > 14 && seed % 3 === 0) n = 0
  const list: A[] = Array.from({ length: n }, (_, k) => {
    const [time, ap] = TIMES[(k + seed) % TIMES.length]
    const name = PEOPLE[(seed + k * 5) % PEOPLE.length]
    const status: Status = diff < 0 ? (k === 2 ? 'Cancelled' : 'Seen') : diff === 0 ? (k === 0 ? 'Seen' : k === 1 ? 'In consult' : 'Upcoming') : 'Upcoming'
    return { id: `${toISO(d)}-${k}`, time, ap, name, i: initials(name), meta: `${k % 3 === 1 ? 'Video' : 'In person'} · 30 min · ${k % 4 === 0 ? 'First visit' : 'Follow-up'}`, status }
  })
  const clock = (a: A) => ((Number(a.time.split(':')[0]) % 12) + (a.ap === 'PM' ? 12 : 0)) * 60 + Number(a.time.split(':')[1])
  list.sort((a, b) => clock(a) - clock(b))
  return { list }
}

export function CalendarLab() {
  const today = useMemo(() => new Date(), [])
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<CalendarMode>('week')
  const [showCancelled, setShowCancelled] = useState(false)
  const [menuFor, setMenuFor] = useState<A | null>(null)
  const [confirmFor, setConfirmFor] = useState<A | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState<FrameToastData | null>(null)
  const closeToast = useCallback(() => setToast(null), [])
  const say = (title: string, message?: string) => setToast({ id: Date.now(), title, message })

  // The loads for the visible month and its neighbours (what the grid shows).
  const loads = useMemo(() => {
    const m = new Map<ISODate, DayLoad>()
    for (let d = addDaysTo(new Date(selected.getFullYear(), selected.getMonth(), 1), -7); d < addDaysTo(new Date(selected.getFullYear(), selected.getMonth() + 1, 1), 7); d = addDaysTo(d, 1)) {
      const { list, closure } = buildDay(d, today)
      const live = list.filter((a) => a.status !== 'Cancelled')
      m.set(toISO(d), { count: live.length, done: live.filter((a) => a.status === 'Seen').length, blocked: !!closure })
    }
    return m
  }, [selected, today])

  const { list, closure } = useMemo(() => buildDay(selected, today), [selected, today])
  const live = list.filter((a) => a.status !== 'Cancelled')
  const cancelled = list.filter((a) => a.status === 'Cancelled')
  const isPast = toISO(selected) < toISO(today)
  const load = loads.get(toISO(selected)) ?? EMPTY_LOAD

  const page = (dir: -1 | 1) => setSelected((s) => (mode === 'week' ? shiftWeek(s, dir) : shiftMonth(s, dir)))
  const pick = (d: Date) => { setSelected(d) }

  const row = (a: A, first: boolean, dim = false) => (
    <div key={a.id} className={`flex items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-border'} ${a.status === 'In consult' ? 'bg-tint-pale' : ''} ${dim ? 'opacity-55' : ''}`}>
      <div className="w-[46px] shrink-0">
        <div className="font-display text-[14px] font-bold leading-none text-ink">{a.time}</div>
        <div className="mt-0.5 text-[11px] font-medium text-faint">{a.ap}</div>
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

  const dayName = selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const rel = sameDay(selected, today) ? 'Today' : sameDay(selected, addDaysTo(today, 1)) ? 'Tomorrow' : sameDay(selected, addDaysTo(today, -1)) ? 'Yesterday' : null

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Calendar v2 — week ⇄ month" note="Tap the month name, the handle, or drag the handle. Tap any day; swipe sideways." height={820}>
        <div className="h-full overflow-y-auto no-scrollbar">
          <div className={`z-20 px-[18px] pb-1 pt-[var(--app-top)] ${mode === 'week' ? 'sticky top-0 bg-screen/95 backdrop-blur-md' : 'relative'}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-[13px] font-semibold uppercase tracking-label text-faint">Schedule</div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-pill border border-border bg-surface py-1 pl-1 pr-2.5 text-[12.5px] font-semibold text-body">
                  <Avatar initials="NB" size={22} /> You <CaretDown size={12} weight="bold" className="text-faint" />
                </button>
                <Pressable ariaLabel="Add" hap="tick" onClick={() => setAddOpen(true)} className="relative tap-pad flex h-9 w-9 items-center justify-center rounded-full bg-brand text-screen shadow-float">
                  <Plus size={17} weight="bold" />
                </Pressable>
              </div>
            </div>
            <CalendarCanvas selected={selected} today={today} mode={mode} loads={loads} capacity={CAPACITY} onSelect={pick} onMode={setMode} onPage={page} onToday={() => setSelected(today)} />
          </div>

          <div className="px-[18px] pb-[130px] pt-2">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <div className="font-display text-[17px] font-bold text-ink">{rel ?? dayName.split(',')[0]}{rel && <span className="font-body text-[13px] font-normal text-muted"> · {dayName}</span>}{!rel && <span className="font-body text-[13px] font-normal text-muted"> · {selected.getDate()} {selected.toLocaleDateString('en-IN', { month: 'short' })}</span>}</div>
              </div>
              <div className="text-[12.5px] font-semibold text-muted">{load.count > CAPACITY ? <span className="text-amber-text">{load.count} visits · over capacity</span> : load.count > 0 ? `${load.count} visit${load.count === 1 ? '' : 's'}` : ''}</div>
            </div>

            {closure && (
              <div className="mb-3 flex items-center gap-3 rounded-[18px] border border-dashed border-border-dash bg-surface px-4 py-3.5">
                <div className="hatch flex h-10 w-10 items-center justify-center rounded-[12px] text-faint"><span className="flex h-full w-full items-center justify-center rounded-[12px] bg-surface/70 text-ink"><Prohibit size={18} /></span></div>
                <div>
                  <div className="font-display text-[14px] font-semibold text-ink">{closure.reason}</div>
                  <div className="text-[12px] text-muted">Blocked all day — nobody can book it</div>
                </div>
              </div>
            )}

            {list.length === 0 && !closure ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint"><CalendarBlank size={24} className="text-faint" /></div>
                <div className="mt-4 font-display text-[16px] font-semibold text-ink">{isPast ? 'No visits that day' : selected.getDay() === 0 ? 'Sunday — clinic day off' : 'A free day'}</div>
                <div className="mt-1 text-[13px] text-muted">{isPast ? 'Nothing was booked.' : 'Nothing booked yet.'}</div>
                {!isPast && (
                  <Pressable hap="tick" onClick={() => say('Book a visit', `${dayName} — opens the booking sheet`)} className="mt-4 flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-screen shadow-float"><CalendarPlus size={16} weight="bold" /> Book a visit on this day</Pressable>
                )}
              </div>
            ) : list.length > 0 && (
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
        <FrameToast toast={toast} onClose={closeToast} />

        <BottomSheet open={addOpen} onClose={() => setAddOpen(false)}>
          <div className="mb-3 font-display text-[16px] font-bold text-ink">Add to {selected.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          {[{ label: 'Book a visit', icon: CalendarPlus }, { label: 'Block time', icon: Prohibit }].map((x) => (
            <Pressable key={x.label} as="div" hap="tick" scale={0.98} onClick={() => { setAddOpen(false); say(x.label, 'Opens for the selected day') }} className="mb-2 flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><x.icon size={20} /></div>
              <div className="flex-1 text-[14px] font-semibold text-ink">{x.label}</div>
            </Pressable>
          ))}
        </BottomSheet>
        <BottomSheet open={menuFor !== null} onClose={() => setMenuFor(null)}>
          <div className="flex items-center gap-3">
            <Avatar initials={menuFor?.i ?? ''} size={40} />
            <div>
              <div className="font-display text-[16px] font-bold text-ink">{menuFor?.name}</div>
              <div className="text-[12.5px] text-muted">{menuFor?.time} {menuFor?.ap} · {selected.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
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
              <Pressable hap="impact" onClick={() => { setConfirmFor(null); say('Appointment cancelled') }} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Cancel it</Pressable>
            </div>
          </div>
        </BottomSheet>
      </Phone>

      <div className="max-w-[340px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">How week and month fit together</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">One grid, two sizes.</span> Month view is the same strip, unfolded: the other weeks slide open under the selected one and fold away again. The selected day never moves.</li>
          <li><span className="font-semibold text-ink">Tapping a day stays put.</span> In month view the agenda below changes to that day — no jump to another screen. (The old month grid sent you back to week view.)</li>
          <li><span className="font-semibold text-ink">A bar under every date</span> shows how full the day is: empty = nothing, green = booked, <span className="font-semibold text-amber-text">amber = more visits than a day holds</span>, hatched = clinic closed. Find a free day at a glance.</li>
          <li><span className="font-semibold text-ink">Arrows / swipe</span> go a week at a time in week view and a month at a time in month view (31 Jan → 28 Feb handled). <span className="font-semibold text-ink">Today</span> appears whenever you've wandered away.</li>
          <li><span className="font-semibold text-ink">Month footer:</span> "N visits this month · M free days ahead".</li>
          <li><span className="font-semibold text-ink">Free day → one button:</span> "Book a visit on this day". Past days say so instead.</li>
          <li>In week view the strip stays pinned while the agenda scrolls; in month view it scrolls away, giving the agenda the screen.</li>
        </ul>
        <p className="mt-5 text-[12.5px] text-muted">Try: tap October, then tap a Sunday, tomorrow (amber — 10 visits), and the hatched day four days from now.</p>
      </div>
    </div>
  )
}
