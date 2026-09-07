import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CaretLeft,
  CaretRight,
  CalendarBlank,
  Clock,
  VideoCamera,
  Plus,
  Play,
  Stop,
} from '@phosphor-icons/react'
import { toISO } from '../core/day'
import { useClinic } from '../core/store'
import type { Appointment } from '../core/types'
import { Avatar, Badge, Card, Label } from '../design-system/ui'
import { easeCalm } from '../design-system/motion'
import { useToast } from '../design-system/toast'

type CalView = 'day' | 'week' | 'month'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getWeekDates(base: Date): Date[] {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d)
    dd.setDate(d.getDate() + i)
    return dd
  })
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

// Decimal hour — "9:30 AM" → 9.5 — so grid positioning can place a block
// at its actual start time, not just round down to the top of the hour.
function parseHour(time: string): number {
  const m = time.match(/(\d+):?(\d*)\s*(AM|PM)/i)
  if (!m) return 9
  let h = parseInt(m[1]) % 12
  const min = m[2] ? parseInt(m[2]) : 0
  if (m[3].toUpperCase() === 'PM') h += 12
  return h + min / 60
}

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function isToday(d: Date): boolean {
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

function apptsForDate(date: Date, allAppts: Appointment[]): Appointment[] {
  const iso = toISO(date)
  return allAppts.filter((a) => a.date === iso)
}

export function WebCalendar({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  const seedAppts = useClinic((s) => s.appointments)
  const patients = useClinic((s) => s.patients)
  const timeBlocks = useClinic((s) => s.timeBlocks)
  const toast = useToast()

  const [view, setView] = useState<CalView>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate.toDateString()])
  const monthGrid = useMemo(() => getMonthGrid(selectedDate.getFullYear(), selectedDate.getMonth()), [selectedDate.getFullYear(), selectedDate.getMonth()])

  const dayAppts = useMemo(
    () => apptsForDate(selectedDate, seedAppts),
    [selectedDate.toDateString(), seedAppts],
  )

  function shift(delta: number) {
    const d = new Date(selectedDate)
    if (view === 'day') d.setDate(d.getDate() + delta)
    else if (view === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setSelectedDate(d)
  }

  function goToday() {
    setSelectedDate(new Date())
  }

  const headerLabel = view === 'day'
    ? fmtDate(selectedDate)
    : view === 'week'
      ? `${weekDates[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-[22px] font-bold text-ink">Calendar</div>
          <div className="text-[13px] text-muted">{headerLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="rounded-[10px] border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-surface-hover">
            Today
          </button>
          <div className="flex items-center rounded-[10px] border border-border bg-surface">
            <button onClick={() => shift(-1)} className="px-2.5 py-1.5 text-body transition hover:bg-surface-hover"><CaretLeft size={14} /></button>
            <button onClick={() => shift(1)} className="px-2.5 py-1.5 text-body transition hover:bg-surface-hover"><CaretRight size={14} /></button>
          </div>
          <div className="flex rounded-[10px] border border-border bg-surface">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[12px] font-semibold capitalize transition ${view === v ? 'bg-brand text-screen' : 'text-body hover:bg-surface-hover'} ${v === 'day' ? 'rounded-l-[10px]' : v === 'month' ? 'rounded-r-[10px]' : ''}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* views */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: easeCalm }}
        >
          {view === 'day' && <DayView appts={dayAppts} patients={patients} onOpen={onOpenPatient} />}
          {view === 'week' && (
            <WeekView
              dates={weekDates}
              allAppts={seedAppts}
              timeBlocks={timeBlocks}
              patients={patients}
              onSelectDay={(d) => { setSelectedDate(d); setView('day') }}
              onOpenPatient={onOpenPatient}
            />
          )}
          {view === 'month' && <MonthView grid={monthGrid} selectedDate={selectedDate} onSelectDay={(d) => { setSelectedDate(d); setView('day') }} allAppts={seedAppts} patients={patients} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── DAY VIEW ──
function DayView({ appts, patients, onOpen }: { appts: Appointment[]; patients: { id: string; name: string; initials: string }[]; onOpen: (id: string) => void }) {
  const pFind = (id: string) => patients.find((p) => p.id === id)
  const statusTone = (s: Appointment['status']) => s === 'In consult' ? 'green' : s === 'New' || s === 'Waiting' ? 'amber' : 'neutral'

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative">
        {HOURS.map((h) => {
          const label = h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
          const hourAppts = appts.filter((a) => Math.floor(parseHour(a.time)) === h)
          return (
            <div key={h} className="flex min-h-[64px] border-b border-border last:border-b-0">
              <div className="flex w-[72px] shrink-0 items-start justify-end border-r border-border px-2.5 pt-2 text-[11px] text-faint">
                {h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
              </div>
              <div className="flex-1 px-2 py-1">
                {hourAppts.map((a) => {
                  const p = pFind(a.patientId)
                  if (!p) return null
                  return (
                    <button
                      key={a.id}
                      onClick={() => onOpen(a.patientId)}
                      className="group mb-1 flex w-full items-center gap-3 rounded-[12px] border border-border bg-surface px-3 py-2 text-left transition hover:border-green-border hover:shadow-card"
                    >
                      <Avatar initials={p.initials} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted">
                          {a.type === 'Video' && <VideoCamera size={11} weight="fill" className="text-brand" />}
                          {a.time} · {a.durationMin}m
                          {a.reason && <> · {a.reason}</>}
                        </div>
                      </div>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── WEEK VIEW ──
const WEEK_HOUR_HEIGHT = 52

function WeekView({ dates, allAppts, timeBlocks, patients, onSelectDay, onOpenPatient }: {
  dates: Date[]
  allAppts: Appointment[]
  timeBlocks: { id: string; practitionerId: string; date: string; startHour: number; durationMin: number; reason: string }[]
  patients: { id: string; name: string; initials: string }[]
  onSelectDay: (d: Date) => void
  onOpenPatient: (id: string) => void
}) {
  const isoDates = dates.map((d) => toISO(d))
  const weekBlocks = timeBlocks.filter((b) => isoDates.includes(b.date))

  return (
    <Card className="overflow-hidden p-0">
      {weekBlocks.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-raised px-3.5 py-2 text-[12px] text-muted">
          <Clock size={13} className="shrink-0 text-faint" />
          <span className="truncate">
            {weekBlocks.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ' · '}
                {fmtDate(new Date(b.date + 'T00:00:00')).split(',')[0].slice(0, 3)} {fmtHour(b.startHour)} blocked for {b.reason}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* day header */}
      <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-border">
        <div />
        {dates.map((d) => {
          const today = isToday(d)
          return (
            <button
              key={d.toDateString()}
              onClick={() => onSelectDay(d)}
              className="flex flex-col items-center gap-0.5 border-l border-border py-2 transition hover:bg-surface-hover"
            >
              <span className="text-[10.5px] font-medium text-faint">{DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${today ? 'bg-brand text-screen' : 'text-ink'}`}>
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* hourly grid */}
      <div className="relative">
        {HOURS.map((h) => (
          <div key={h} className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-border last:border-b-0" style={{ minHeight: WEEK_HOUR_HEIGHT }}>
            <div className="flex items-start justify-end border-r border-border px-2 pt-1 text-[10px] text-faint">{fmtHour(h)}</div>
            {dates.map((d) => {
              const iso = toISO(d)
              const dayAppts = apptsForDate(d, allAppts).filter((a) => Math.floor(parseHour(a.time)) === h)
              const dayBlocks = weekBlocks.filter((b) => b.date === iso && b.startHour === h)
              return (
                <div key={d.toDateString() + h} className="relative border-l border-border">
                  {dayBlocks.map((b) => (
                    <div
                      key={b.id}
                      className="absolute inset-x-0.5 z-[5] flex items-center justify-center overflow-hidden rounded-[6px] border border-dashed border-border-dash bg-raised/60 px-1 text-[9px] font-medium text-faint"
                      style={{ top: 1, height: Math.max((b.durationMin / 60) * WEEK_HOUR_HEIGHT - 2, WEEK_HOUR_HEIGHT - 2) }}
                    >
                      {b.reason}
                    </div>
                  ))}
                  {dayAppts.map((a) => {
                    const p = patients.find((pt) => pt.id === a.patientId)
                    const start = parseHour(a.time)
                    const topOffset = (start - h) * WEEK_HOUR_HEIGHT
                    const blockHeight = Math.max((a.durationMin / 60) * WEEK_HOUR_HEIGHT, 22)
                    const isVideo = a.type === 'Video'
                    return (
                      <button
                        key={a.id}
                        onClick={() => onOpenPatient(a.patientId)}
                        className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-[6px] px-1.5 py-0.5 text-left transition hover:brightness-95 ${isVideo ? 'bg-amber-tint text-amber-text' : 'bg-tint text-brand'}`}
                        style={{ top: topOffset, height: blockHeight }}
                      >
                        <div className="truncate text-[10px] font-semibold">{isVideo ? 'Video' : 'Consult'}</div>
                        {blockHeight > 32 && <div className="truncate text-[9.5px] opacity-80">{p?.name ?? 'Patient'}</div>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── MONTH VIEW ──
function MonthView({ grid, selectedDate, onSelectDay, allAppts, patients }: {
  grid: (Date | null)[][]
  selectedDate: Date
  onSelectDay: (d: Date) => void
  allAppts: Appointment[]
  patients: { id: string; name: string; initials: string }[]
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS.map((d) => (
          <div key={d} className="border-r border-border px-2 py-2 text-center text-[11px] font-semibold text-faint last:border-r-0">{d}</div>
        ))}
      </div>
      {grid.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {row.map((cell, ci) => {
            if (!cell) return <div key={ci} className="min-h-[80px] border-r border-border bg-raised/30 last:border-r-0" />
            const today = isToday(cell)
            const appts = apptsForDate(cell, allAppts)
            return (
              <button
                key={ci}
                onClick={() => onSelectDay(cell)}
                className="min-h-[80px] border-r border-border p-1.5 text-left transition last:border-r-0 hover:bg-surface-hover"
              >
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${today ? 'bg-brand text-screen' : 'text-ink'}`}>
                  {cell.getDate()}
                </div>
                {appts.length > 0 && (
                  <div className="space-y-0.5">
                    {appts.slice(0, 2).map((a) => {
                      const p = patients.find((pt) => pt.id === a.patientId)
                      return (
                        <div key={a.id} className="truncate rounded-[4px] bg-tint-pale px-1 py-0.5 text-[9px] font-medium text-brand">
                          {a.time.replace(' AM', '').replace(' PM', '')} {p?.name?.split(' ')[0]}
                        </div>
                      )
                    })}
                    {appts.length > 2 && <div className="text-[9px] text-faint">+{appts.length - 2}</div>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </Card>
  )
}
