import { useMemo, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  VideoCamera,
  MapPin,
  Plus,
  XCircle,
} from '@phosphor-icons/react'
import { toISO, todayISO } from '../core/day'
import { useClinic } from '../core/store'
import type { Appointment, Patient } from '../core/types'
import { Avatar, Badge, BottomSheet, Card, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { spring, springSoft, listContainer, listItem } from '../design-system/motion'
import { PullToRefresh } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { PatientQuickView } from './PatientQuickView'

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

const BOOK_HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM – 7 PM

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function parseHour(time: string): number {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 9
  let h = parseInt(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h
}

function formatDecimalTime(t: number): string {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

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

export function CalendarScreen({ onOpenPatient, openCase, goRx }: { onOpenPatient: (patientId: string) => void; openCase: (patientId: string) => void; goRx: (patientId: string) => void }) {
  const allAppointments = useClinic((s) => s.appointments)
  const patients = useClinic((s) => s.patients)
  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>()
    patients.forEach((p) => m.set(p.id, p))
    return m
  }, [patients])

  const ME = useClinic((s) => s.currentPractitionerId)
  const role = useClinic((s) => s.role)
  const team = useClinic((s) => s.practitioners.filter((p) => p.status === 'active'))
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const updateAppointment = useClinic((s) => s.updateAppointment)
  const updateAppointmentStatus = useClinic((s) => s.updateAppointmentStatus)
  const toast = useToast()
  const [peekPatientId, setPeekPatientId] = useState<string | null>(null)

  // Whose schedule is showing — null means "mine". Only the Owner gets the
  // switcher (matches Today's Mine/Everyone, which is Owner-only too); a
  // practitioner's own calendar is always just their own day otherwise.
  const [viewPractitionerId, setViewPractitionerId] = useState<string | null>(null)
  const scopedPractitionerId = role === 'Owner' && viewPractitionerId ? viewPractitionerId : ME
  const appointments = useMemo(
    () => allAppointments.filter((a) => a.practitionerId === scopedPractitionerId),
    [allAppointments, scopedPractitionerId],
  )

  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [view, setView] = useState<ViewMode>('week')
  const [weekDir, setWeekDir] = useState(0)
  const [monthDate, setMonthDate] = useState(today)

  // Add / edit / cancel an appointment — the one place in the app that
  // changes the schedule itself, deliberately kept off the Today tab
  // (Today is for acting on what's already booked: start, end, join, collect).
  const [bookOpen, setBookOpen] = useState(false)
  const [editingApptId, setEditingApptId] = useState<string | null>(null)
  const [bookPatientId, setBookPatientId] = useState<string | null>(null)
  const [bookQuery, setBookQuery] = useState('')
  const [bookDate, setBookDate] = useState(todayISO())
  const [bookHour, setBookHour] = useState(9)
  const [bookType, setBookType] = useState<'In person' | 'Video'>('In person')
  const [bookReason, setBookReason] = useState('')
  const [cancelApptId, setCancelApptId] = useState<string | null>(null)

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

  function openBookSheet() {
    setEditingApptId(null)
    setBookPatientId(null)
    setBookQuery('')
    setBookDate(selectedKey)
    setBookHour(9)
    setBookType('In person')
    setBookReason('')
    setBookOpen(true)
  }

  function openEditSheet(appt: Appointment) {
    setEditingApptId(appt.id)
    setBookPatientId(appt.patientId)
    setBookQuery('')
    setBookDate(appt.date)
    setBookHour(parseHour(appt.time))
    setBookType(appt.type)
    setBookReason(appt.reason ?? '')
    setBookOpen(true)
  }

  function handleBookAppt() {
    if (!bookPatientId) return
    const time = formatDecimalTime(bookHour)
    if (editingApptId) {
      updateAppointment(editingApptId, { date: bookDate, time, type: bookType, reason: bookReason.trim() || 'Consultation' })
      haptic('success')
      toast({ title: 'Appointment updated', message: `${time} · ${patientMap.get(bookPatientId)?.name ?? 'Patient'}` })
    } else {
      if (!ME) return
      scheduleFollowUp({ patientId: bookPatientId, practitionerId: scopedPractitionerId, time, date: bookDate, type: bookType, reason: bookReason.trim() || 'Consultation' })
      haptic('success')
      toast({ title: 'Appointment booked', message: `${time} · ${patientMap.get(bookPatientId)?.name ?? 'Patient'}` })
    }
    setBookOpen(false)
  }

  function handleCancelAppt(apptId: string) {
    updateAppointmentStatus(apptId, 'Cancelled')
    haptic('impact')
    toast({ title: 'Appointment cancelled' })
    setCancelApptId(null)
  }

  // Owner, looking at a colleague's day, taking one of their appointments
  // onto her own schedule — e.g. covering while they're out.
  function handleReassignToMe(apptId: string, patientName?: string) {
    if (!ME) return
    updateAppointment(apptId, { practitionerId: ME })
    haptic('success')
    toast({ title: 'Reassigned to you', message: patientName ? `${patientName}'s appointment now on your schedule.` : 'Appointment now on your schedule.' })
  }

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
            <Pressable hap="tick" onClick={openBookSheet} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-screen">
              <Plus size={16} weight="bold" />
            </Pressable>
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

        {/* whose schedule — Owner only, so everyone's day can line up for
            comparison instead of everything blurring into one shared list */}
        {role === 'Owner' && team.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {team.map((p) => {
              const isMe = p.id === ME
              const selected = isMe ? !viewPractitionerId : viewPractitionerId === p.id
              return (
                <Pressable
                  key={p.id}
                  hap="select"
                  onClick={() => setViewPractitionerId(isMe ? null : p.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    selected ? 'border-brand bg-brand text-screen' : 'border-border bg-surface text-body'
                  }`}
                >
                  <Avatar initials={p.initials} size={18} />
                  {isMe ? 'You' : p.name.replace(/^Dr\.?\s*/i, '')}
                </Pressable>
              )
            })}
          </div>
        )}
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
                            {dayAppointments.map((a) => {
                              const canModify = a.status !== 'Seen' && a.status !== 'In consult' && a.status !== 'Cancelled'
                              return (
                                <motion.div key={a.id} variants={listItem}>
                                  <AppointmentCard
                                    appointment={a}
                                    patient={patientMap.get(a.patientId)}
                                    onTap={() => onOpenPatient(a.patientId)}
                                    onEdit={canModify ? () => openEditSheet(a) : undefined}
                                    onCancel={canModify ? () => setCancelApptId(a.id) : undefined}
                                    onPeekPatient={() => setPeekPatientId(a.patientId)}
                                    onReassign={canModify && viewPractitionerId && viewPractitionerId !== ME ? () => handleReassignToMe(a.id, patientMap.get(a.patientId)?.name) : undefined}
                                  />
                                </motion.div>
                              )
                            })}
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

      <BookApptSheet
        open={bookOpen}
        isEditing={editingApptId !== null}
        patients={patients}
        query={bookQuery}
        onQueryChange={setBookQuery}
        patientId={bookPatientId}
        onPickPatient={setBookPatientId}
        onClearPatient={() => setBookPatientId(null)}
        date={bookDate}
        onDateChange={setBookDate}
        hour={bookHour}
        onHourChange={setBookHour}
        apptType={bookType}
        onTypeChange={setBookType}
        reason={bookReason}
        onReasonChange={setBookReason}
        onClose={() => setBookOpen(false)}
        onConfirm={handleBookAppt}
      />
      <CancelApptSheet
        open={cancelApptId !== null}
        appt={cancelApptId ? appointments.find((a) => a.id === cancelApptId) ?? null : null}
        patient={cancelApptId ? patientMap.get(appointments.find((a) => a.id === cancelApptId)?.patientId ?? '') : undefined}
        onClose={() => setCancelApptId(null)}
        onConfirm={() => cancelApptId && handleCancelAppt(cancelApptId)}
      />
      <PatientQuickView patientId={peekPatientId} onClose={() => setPeekPatientId(null)} onOpenCase={openCase} onPrescribe={goRx} />
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
  onEdit,
  onCancel,
  onPeekPatient,
  onReassign,
}: {
  appointment: Appointment
  patient: Patient | undefined
  onTap: () => void
  onEdit?: () => void
  onCancel?: () => void
  onPeekPatient?: () => void
  onReassign?: () => void
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
        <div
          onClick={onPeekPatient ? (e) => { e.stopPropagation(); haptic('tick'); onPeekPatient() } : undefined}
          className={`truncate font-display text-[14px] font-semibold text-ink ${onPeekPatient ? 'underline decoration-border-dash decoration-1 underline-offset-2' : ''}`}
        >
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
      <div className="flex flex-col items-end gap-1.5">
        <Badge tone={statusTone}>{a.status}</Badge>
        <div className="flex items-center gap-2.5">
          {onEdit && (
            <Pressable
              hap="tick"
              onClick={(e) => { e?.stopPropagation(); onEdit() }}
              className="text-[11px] font-medium text-brand"
            >
              Edit
            </Pressable>
          )}
          {onCancel && (
            <Pressable
              hap="tick"
              onClick={(e) => { e?.stopPropagation(); onCancel() }}
              className="text-[11px] font-medium text-danger/70"
            >
              Cancel
            </Pressable>
          )}
          {onReassign && (
            <Pressable
              hap="tick"
              onClick={(e) => { e?.stopPropagation(); onReassign() }}
              className="text-[11px] font-medium text-brand"
            >
              Reassign to me
            </Pressable>
          )}
        </div>
      </div>
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

// ── book appointment sheet ──

function BookApptSheet({
  open, isEditing, patients, query, onQueryChange, patientId, onPickPatient, onClearPatient,
  date, onDateChange, hour, onHourChange, apptType, onTypeChange, reason, onReasonChange,
  onClose, onConfirm,
}: {
  open: boolean
  isEditing: boolean
  patients: Patient[]
  query: string
  onQueryChange: (q: string) => void
  patientId: string | null
  onPickPatient: (id: string) => void
  onClearPatient: () => void
  date: string
  onDateChange: (d: string) => void
  hour: number
  onHourChange: (h: number) => void
  apptType: 'In person' | 'Video'
  onTypeChange: (t: 'In person' | 'Video') => void
  reason: string
  onReasonChange: (r: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const picked = patientId ? patients.find((p) => p.id === patientId) : null
  const q = query.trim().toLowerCase()
  const filtered = (q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients).slice(0, 8)

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">{isEditing ? 'Edit appointment' : 'Book appointment'}</div>
      {!picked ? (
        <>
          <div className="mt-0.5 text-[12.5px] text-muted">Who is this for?</div>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search patients"
            autoFocus
            className="mt-3 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
          />
          <div className="mt-2 max-h-[260px] space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => onPickPatient(p.id)} className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-raised">
                <Avatar initials={p.initials} size={30} />
                <span className="text-[13.5px] font-medium text-ink">{p.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="py-4 text-center text-[12px] text-faint">No patients found</div>}
          </div>
        </>
      ) : (
        <>
          <div className="mt-0.5 flex items-center gap-2">
            <Avatar initials={picked.initials} size={24} />
            <span className="text-[13px] font-semibold text-ink">{picked.name}</span>
            {!isEditing && (
              <button onClick={onClearPatient} className="ml-auto text-[12px] font-semibold text-brand">Change</button>
            )}
          </div>
          <div className="mt-3">
            <Label>Date</Label>
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => onDateChange(e.target.value)}
              className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
            />
          </div>
          <div className="mt-3">
            <Label>Time</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BOOK_HOURS.map((h) => (
                <Chip key={h} selected={hour === h} onClick={() => onHourChange(h)} className="text-[11px]">{fmtHour(h)}</Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Label>Type</Label>
            <div className="mt-1.5 flex gap-2">
              {(['In person', 'Video'] as const).map((t) => (
                <Chip key={t} selected={apptType === t} onClick={() => onTypeChange(t)} className="flex-1 text-center">{t}</Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Label>Reason (optional)</Label>
            <input
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Consultation"
              className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none focus:border-green-border"
            />
          </div>
          <Pressable hap="success" onClick={onConfirm} className="mt-4 flex w-full items-center justify-center rounded-pill bg-brand py-3 font-display text-[15px] font-semibold text-screen shadow-float">
            {isEditing ? 'Save changes' : 'Book appointment'}
          </Pressable>
        </>
      )}
    </BottomSheet>
  )
}

// ── cancel appointment sheet ──

function CancelApptSheet({ open, appt, patient, onClose, onConfirm }: {
  open: boolean
  appt: Appointment | null
  patient: Patient | undefined
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><XCircle size={28} weight="fill" /></div>
        <div className="mt-3 font-display text-[17px] font-bold text-ink">Cancel appointment?</div>
        <div className="mt-1 text-[13px] text-muted">{patient?.name} · {appt?.time}</div>
        <div className="mt-4 flex w-full gap-2">
          <Pressable hap="tick" onClick={onClose} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Keep it</Pressable>
          <Pressable hap="impact" onClick={onConfirm} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Cancel it</Pressable>
        </div>
      </div>
    </BottomSheet>
  )
}
