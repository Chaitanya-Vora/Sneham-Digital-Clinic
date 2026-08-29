import { useMemo, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  VideoCamera,
  MapPin,
} from '@phosphor-icons/react'
import { toISO } from '../core/day'
import { useClinic } from '../core/store'
import type { Appointment, Patient } from '../core/types'
import { Avatar, Badge, Card, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, listContainer, listItem } from '../design-system/motion'
import { PullToRefresh } from '../design-system/gestures'

// ── helpers ──

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday start
  const m = new Date(d)
  m.setDate(m.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatMonth(d: Date) {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Groups the real appointment list by calendar date. This screen previously
 *  synthesised 2-5 appointments per weekday from a sine function, cloning real
 *  patients into invented slots — so the doctor saw a week of consultations
 *  that did not exist. Nothing here is generated: a day with no appointments
 *  reads as empty, because it is. */
function groupByDate(appointments: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>()
  for (const a of appointments) {
    const list = map.get(a.date)
    if (list) list.push(a)
    else map.set(a.date, [a])
  }
  for (const list of map.values()) list.sort(byClockTime)
  return map
}

/** "9:30 AM" sorts before "10:00 AM" — string order would not. */
function byClockTime(a: Appointment, b: Appointment) {
  return minutesFromMidnight(a.time) - minutesFromMidnight(b.time)
}

function minutesFromMidnight(time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return 0
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h * 60 + Number(m[2])
}

// ── month grid helpers ──

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1 // Monday-based
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rows: (Date | null)[][] = []
  let row: (Date | null)[] = []

  for (let i = 0; i < startDay; i++) row.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(new Date(year, month, d))
    if (row.length === 7) { rows.push(row); row = [] }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return rows
}

const refresh = async () => {
  const s = useClinic.getState()
  if (s.userId) await s.hydrate(s.userId, '')
}

type ViewMode = 'week' | 'month'

// ── main export ──

export function CalendarScreen({ onOpenPatient }: { onOpenPatient: (patientId: string) => void }) {
  const appointments = useClinic((s) => s.appointments)
  const patients = useClinic((s) => s.patients)
  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>()
    patients.forEach((p) => m.set(p.id, p))
    return m
  }, [patients])

  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [view, setView] = useState<ViewMode>('week')
  const [weekDir, setWeekDir] = useState(0)
  const [monthDate, setMonthDate] = useState(today)

  // Build a full week of mock data anchored to the selected date's week
  const weekSchedule = useMemo(
    () => groupByDate(appointments),
    [appointments],
  )

  // Generate dots for month view — which days have appointments
  const monthDots = useMemo(() => {
    const dots = new Set<string>()
    for (const a of appointments) {
      if (a.date) dots.add(a.date)
    }
    return dots
  }, [appointments])

  const selectedKey = toISO(selectedDate)
  const dayAppointments = weekSchedule.get(selectedKey) ?? []

  const weekStart = startOfWeek(selectedDate)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart.getTime()])

  const shiftWeek = useCallback((dir: number) => {
    setWeekDir(dir)
    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + dir * 7)
      return next
    })
    haptic('tick')
  }, [])

  const goToday = useCallback(() => {
    setWeekDir(0)
    setSelectedDate(today)
    setMonthDate(today)
    haptic('tick')
  }, [today])

  const selectDay = useCallback((d: Date) => {
    setSelectedDate(d)
    haptic('tick')
  }, [])

  const shiftMonth = useCallback((dir: number) => {
    setMonthDate((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + dir)
      return next
    })
    haptic('tick')
  }, [])

  const monthTapDay = useCallback((d: Date) => {
    setSelectedDate(d)
    setMonthDate(d)
    setView('week')
    haptic('tick')
  }, [])

  return (
    <div className="flex h-full flex-col bg-screen">
      {/* header */}
      <div className="px-[18px] pb-1 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-[20px] font-bold text-ink">Calendar</div>
            <div className="text-[12px] text-muted">
              {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isSameDay(selectedDate, today) && (
              <Pressable hap="tick" onClick={goToday} className="rounded-pill bg-tint px-3 py-1.5 text-[12px] font-semibold text-brand">
                Today
              </Pressable>
            )}
          </div>
        </div>

        {/* segmented control */}
        <div className="relative mt-3 flex rounded-[12px] border border-border bg-surface p-[3px]">
          {(['week', 'month'] as const).map((v) => (
            <Pressable
              key={v}
              hap="tick"
              onClick={() => { setView(v); haptic('select') }}
              className={`relative z-10 flex-1 rounded-[10px] py-[7px] text-center text-[13px] font-semibold transition-colors ${view === v ? 'text-ink' : 'text-muted'}`}
            >
              {view === v && (
                <motion.span
                  layoutId="cal-segment"
                  className="absolute inset-0 rounded-[10px] bg-tint-pale shadow-sm"
                  transition={spring}
                />
              )}
              <span className="relative">{v === 'week' ? 'Week' : 'Month'}</span>
            </Pressable>
          ))}
        </div>
      </div>

      {/* view body */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          {view === 'week' ? (
            <motion.div
              key="week"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={springSoft}
            >
              {/* day strip */}
              <div className="px-[18px] pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <Pressable hap="tick" onClick={() => shiftWeek(-1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface">
                    <CaretLeft size={16} className="text-body" />
                  </Pressable>
                  <div className="text-[13px] font-semibold text-muted">
                    {weekDays[0].getDate()} {MONTH_NAMES_SHORT[weekDays[0].getMonth()]} – {weekDays[6].getDate()} {MONTH_NAMES_SHORT[weekDays[6].getMonth()]}
                  </div>
                  <Pressable hap="tick" onClick={() => shiftWeek(1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface">
                    <CaretRight size={16} className="text-body" />
                  </Pressable>
                </div>

                <div className="mt-3 flex gap-1">
                  {weekDays.map((d) => {
                    const selected = isSameDay(d, selectedDate)
                    const isToday = isSameDay(d, today)
                    return (
                      <Pressable
                        key={d.toISOString()}
                        hap="tick"
                        onClick={() => selectDay(d)}
                        className={`relative flex flex-1 flex-col items-center gap-1 rounded-[14px] py-2 transition-colors ${selected ? 'bg-brand' : ''}`}
                      >
                        <span className={`text-[11px] font-medium ${selected ? 'text-white/80' : isToday ? 'text-brand' : 'text-muted'}`}>
                          {DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                        </span>
                        <span className={`font-display text-[16px] font-bold ${selected ? 'text-white' : isToday ? 'text-brand' : 'text-ink'}`}>
                          {d.getDate()}
                        </span>
                        {/* dot for appointments */}
                        {!selected && (weekSchedule.get(toISO(d))?.length ?? 0) > 0 && (
                          <span className="h-[5px] w-[5px] rounded-full bg-brand" />
                        )}
                        {selected && (
                          <motion.span layoutId="day-pill" className="absolute inset-0 rounded-[14px] bg-brand" style={{ zIndex: -1 }} transition={spring} />
                        )}
                      </Pressable>
                    )
                  })}
                </div>
              </div>

              {/* appointments list */}
              <div className="flex-1 overflow-hidden">
                <PullToRefresh onRefresh={refresh} className="h-full px-[18px] pb-[120px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedKey}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={springSoft}
                    >
                      {dayAppointments.length === 0 ? (
                        <EmptyDay />
                      ) : (
                        <div className="space-y-1 pt-2">
                          <Label className="mb-2">{dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}</Label>
                          <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
                            {dayAppointments.map((a) => (
                              <motion.div key={a.id} variants={listItem}>
                                <AppointmentCard
                                  appointment={a}
                                  patient={patientMap.get(a.patientId)}
                                  onTap={() => onOpenPatient(a.patientId)}
                                />
                              </motion.div>
                            ))}
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </PullToRefresh>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="month"
              className="absolute inset-0 overflow-y-auto px-[18px] pb-[120px] pt-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={springSoft}
            >
              <MonthGrid
                monthDate={monthDate}
                today={today}
                selectedDate={selectedDate}
                dots={monthDots}
                onShift={shiftMonth}
                onTapDay={monthTapDay}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── month grid ──

function MonthGrid({
  monthDate, today, selectedDate, dots, onShift, onTapDay,
}: {
  monthDate: Date
  today: Date
  selectedDate: Date
  dots: Set<string>
  onShift: (dir: number) => void
  onTapDay: (d: Date) => void
}) {
  const grid = useMemo(
    () => getMonthGrid(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate.getFullYear(), monthDate.getMonth()],
  )

  return (
    <div>
      {/* month header */}
      <div className="flex items-center justify-between">
        <Pressable hap="tick" onClick={() => onShift(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
          <CaretLeft size={16} className="text-body" />
        </Pressable>
        <div className="font-display text-[17px] font-bold text-ink">{formatMonth(monthDate)}</div>
        <Pressable hap="tick" onClick={() => onShift(1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
          <CaretRight size={16} className="text-body" />
        </Pressable>
      </div>

      {/* day headers */}
      <div className="mt-4 grid grid-cols-7 gap-0">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-semibold text-muted">{d}</div>
        ))}
      </div>

      {/* date grid */}
      <div className="mt-1">
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-0">
            {row.map((d, ci) => {
              if (!d) return <div key={ci} className="py-2" />
              const key = toISO(d)
              const isToday = isSameDay(d, today)
              const isSelected = isSameDay(d, selectedDate)
              const hasDot = dots.has(key)
              return (
                <Pressable
                  key={ci}
                  hap="tick"
                  onClick={() => onTapDay(d)}
                  className="flex flex-col items-center gap-0.5 py-2"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold transition-colors ${
                      isSelected
                        ? 'bg-brand font-bold text-white'
                        : isToday
                          ? 'border-2 border-brand text-brand'
                          : 'text-ink'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {hasDot && !isSelected && (
                    <span className="h-[5px] w-[5px] rounded-full bg-brand" />
                  )}
                  {isSelected && <span className="h-[5px] w-[5px] rounded-full bg-transparent" />}
                  {!hasDot && !isSelected && <span className="h-[5px] w-[5px]" />}
                </Pressable>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[16px] border border-border bg-surface/50 px-4 py-3">
        <div className="text-[12px] text-muted">Tap any day to see appointments in week view</div>
      </div>
    </div>
  )
}

// ── appointment card ──

function AppointmentCard({
  appointment: a,
  patient: p,
  onTap,
}: {
  appointment: Appointment
  patient: Patient | undefined
  onTap: () => void
}) {
  const statusTone = a.status === 'In consult' ? 'green' : a.status === 'New' ? 'amber' : a.status === 'Seen' ? 'neutral' : a.status === 'Waiting' ? 'amber' : 'neutral'

  return (
    <Pressable
      as="div"
      hap="tick"
      scale={0.99}
      onClick={onTap}
      className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-border bg-surface px-3.5 py-3 shadow-card"
    >
      <div className="text-center">
        <div className="font-display text-[13px] font-bold text-ink">
          {a.time.replace(' AM', '').replace(' PM', '')}
        </div>
        <div className="text-[10px] text-faint">
          {a.time.includes('AM') ? 'AM' : 'PM'}
        </div>
      </div>
      <Avatar initials={p?.initials ?? '??'} size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[14px] font-semibold text-ink">
          {p?.name ?? 'Unknown'}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-0.5 text-[11px] text-muted">
            {a.type === 'Video' ? <VideoCamera size={11} weight="fill" /> : <MapPin size={11} weight="fill" />}
            {a.type}
          </span>
          <span className="text-[11px] text-faint">·</span>
          <span className="text-[11px] text-muted">{a.durationMin}m</span>
        </div>
        {(a.tag || a.reason) && (
          <div className="mt-0.5 truncate text-[12px] text-muted">{a.tag ?? a.reason}</div>
        )}
      </div>
      <Badge tone={statusTone}>{a.status}</Badge>
    </Pressable>
  )
}

// ── empty state ──

function EmptyDay() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-tint-pale">
        <CalendarBlank size={32} weight="thin" className="text-brand/40" />
      </div>
      <div className="mt-4 font-display text-[16px] font-semibold text-muted">No appointments</div>
      <div className="mt-1 text-[13px] text-faint">This day is free. Enjoy the quiet.</div>
    </div>
  )
}
