import { useMemo, useState, useCallback } from 'react'
import { CalendarPlus, CaretDown, Plus, Prohibit, XCircle, Check } from '@phosphor-icons/react'
import { toISO, todayISO, formatDayLabel, type ISODate } from '../core/day'
import { useClinic } from '../core/store'
import { addDaysTo, dayCapacity, isWorkingDay, shiftMonth, shiftWeek, type DayLoad } from '../core/calendarGrid'
import { formatDecimalTime, minutesFromMidnight } from '../core/clock'
import type { Appointment, Patient, TimeBlock } from '../core/types'
import { Avatar, BottomSheet, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { PullToRefresh } from '../design-system/gestures'
import { useToast } from '../design-system/toast'
import { PatientQuickView } from './PatientQuickView'
import { BlockTimeSheet } from './BlockTimeSheet'
import { CalendarCanvas, type CalendarMode } from './calendar/CalendarCanvas'
import { Agenda } from './calendar/Agenda'
import { useShallow } from 'zustand/react/shallow'

// ── helpers ──

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

/** Groups the real appointment list by calendar date, each day in clock order. Nothing here is
 *  generated: a day with no appointments reads as empty, because it is. */
function groupByDate(appointments: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>()
  for (const a of appointments) {
    const list = map.get(a.date)
    if (list) list.push(a)
    else map.set(a.date, [a])
  }
  // "9:30 AM" sorts before "10:00 AM" — string order would not.
  for (const list of map.values()) list.sort((a, b) => minutesFromMidnight(a.time) - minutesFromMidnight(b.time))
  return map
}

const refresh = async () => {
  const s = useClinic.getState()
  if (s.userId) await s.hydrate(s.userId, '')
}

// The Calendar tab. Week and month are ONE grid (calendar/CalendarCanvas): the month unfolds from the
// week strip and folds back, a bar under every date shows how full the day is, and the agenda below
// follows whichever day is selected — without leaving the view she is in.
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
  const team = useClinic(useShallow((s) => s.practitioners.filter((p) => p.status === 'active')))
  const hours = useClinic((s) => s.practitionerSettings)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const updateAppointment = useClinic((s) => s.updateAppointment)
  const updateAppointmentStatus = useClinic((s) => s.updateAppointmentStatus)
  const cancelAppointment = useClinic((s) => s.cancelAppointment)
  const dismissNotification = useClinic((s) => s.dismissNotification)
  const allTimeBlocks = useClinic((s) => s.timeBlocks)
  const addTimeBlock = useClinic((s) => s.addTimeBlock)
  const removeTimeBlock = useClinic((s) => s.removeTimeBlock)
  const toast = useToast()
  const [peekPatientId, setPeekPatientId] = useState<string | null>(null)
  const [addChooserOpen, setAddChooserOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [doctorOpen, setDoctorOpen] = useState(false)

  // Whose schedule is showing — null means "mine". Only the Owner gets the switcher
  // (matches Today's Mine/Everyone, which is Owner-only too).
  const [viewPractitionerId, setViewPractitionerId] = useState<string | null>(null)
  const scopedPractitionerId = role === 'Owner' && viewPractitionerId ? viewPractitionerId : ME
  const appointments = useMemo(() => allAppointments.filter((a) => a.practitionerId === scopedPractitionerId), [allAppointments, scopedPractitionerId])
  const timeBlocks = useMemo(() => allTimeBlocks.filter((b) => b.practitionerId === scopedPractitionerId), [allTimeBlocks, scopedPractitionerId])

  const todayKey = todayISO() // re-reads on every render, so a screen left open overnight moves on
  const today = useMemo(() => new Date(), [todayKey])
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<CalendarMode>('week')

  // Add / edit / cancel an appointment — the one place in the app that changes the schedule itself,
  // deliberately kept off the Today tab (Today is for acting on what is already booked).
  const [bookOpen, setBookOpen] = useState(false)
  const [editingApptId, setEditingApptId] = useState<string | null>(null)
  const [bookPatientId, setBookPatientId] = useState<string | null>(null)
  const [bookQuery, setBookQuery] = useState('')
  const [bookDate, setBookDate] = useState(todayISO())
  const [bookHour, setBookHour] = useState(9)
  const [bookType, setBookType] = useState<'In person' | 'Video'>('In person')
  const [bookReason, setBookReason] = useState('')
  const [cancelApptId, setCancelApptId] = useState<string | null>(null)

  const byDate = useMemo(() => groupByDate(appointments), [appointments])
  const blocksByDate = useMemo(() => {
    const m = new Map<string, TimeBlock[]>()
    for (const b of timeBlocks) m.set(b.date, [...(m.get(b.date) ?? []), b])
    return m
  }, [timeBlocks])

  // What each date's bar shows (for the visible month and a week either side).
  const loads = useMemo(() => {
    const m = new Map<ISODate, DayLoad>()
    const from = addDaysTo(new Date(selected.getFullYear(), selected.getMonth(), 1), -7)
    const to = addDaysTo(new Date(selected.getFullYear(), selected.getMonth() + 1, 1), 7)
    for (let d = from; d < to; d = addDaysTo(d, 1)) {
      const iso = toISO(d)
      const live = (byDate.get(iso) ?? []).filter((a) => a.status !== 'Cancelled')
      const cap = dayCapacity(d, hours, blocksByDate.get(iso) ?? [])
      m.set(iso, { count: live.length, done: live.filter((a) => a.status === 'Seen').length, blocked: live.length === 0 && cap.slots === 0, capacity: cap.slots })
    }
    return m
  }, [byDate, blocksByDate, hours, selected.getFullYear(), selected.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedKey = toISO(selected)
  const dayAppointments = byDate.get(selectedKey) ?? []
  const dayBlocks = blocksByDate.get(selectedKey) ?? []
  const cap = dayCapacity(selected, hours, dayBlocks)
  const liveCount = dayAppointments.filter((a) => a.status !== 'Cancelled').length

  const page = useCallback((dir: -1 | 1) => {
    setSelected((s) => (mode === 'week' ? shiftWeek(s, dir) : shiftMonth(s, dir)))
    haptic('tick')
  }, [mode])

  function openBookSheet() {
    setEditingApptId(null)
    setBookPatientId(null)
    setBookQuery('')
    setBookDate(selectedKey < todayISO() ? todayISO() : selectedKey)
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
    const appt = useClinic.getState().appointments.find((a) => a.id === apptId)
    const undo = cancelAppointment(apptId)
    haptic('impact')
    toast({
      title: 'Appointment cancelled',
      message: `${patientMap.get(appt?.patientId ?? '')?.name ?? 'The patient'} has been told.`,
      ...(undo ? { action: { label: 'Undo', onClick: () => { updateAppointmentStatus(apptId, undo.previousStatus); dismissNotification(undo.notificationId) } } } : {}),
    })
    setCancelApptId(null)
  }

  // Owner, looking at a colleague's day, taking one of their appointments onto her own schedule — e.g. covering while they're out.
  function handleReassignToMe(a: Appointment) {
    if (!ME) return
    updateAppointment(a.id, { practitionerId: ME })
    haptic('success')
    toast({ title: 'Reassigned to you', message: `${patientMap.get(a.patientId)?.name ?? 'The'} appointment is now on your schedule.` })
  }

  function handleRemoveBlock(b: TimeBlock) {
    removeTimeBlock(b.id)
    haptic('tick')
    toast({
      title: 'Block removed',
      message: `${b.reason} · ${formatDayLabel(b.date)}`,
      action: { label: 'Undo', onClick: () => addTimeBlock({ practitionerId: b.practitionerId, date: b.date, startHour: b.startHour, durationMin: b.durationMin, reason: b.reason, color: b.color }) },
    })
  }

  const viewing = team.find((p) => p.id === scopedPractitionerId)
  const showDoctorChip = role === 'Owner' && team.length > 1

  return (
    <PullToRefresh onRefresh={refresh} className="h-full">
      <div className={`z-20 px-[18px] pb-1 pt-1 ${mode === 'week' ? 'sticky top-0 bg-screen/95 backdrop-blur-md' : 'relative'}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-label text-faint">Schedule</div>
          <div className="flex items-center gap-2">
            {showDoctorChip && (
              <Pressable hap="tick" onClick={() => setDoctorOpen(true)} ariaLabel="Whose schedule" className="relative tap-pad-y flex items-center gap-1.5 rounded-pill border border-border bg-surface py-1 pl-1 pr-2.5 text-[12.5px] font-semibold text-body">
                <Avatar initials={viewing?.initials ?? '??'} size={22} /> {scopedPractitionerId === ME ? 'You' : (viewing?.name ?? '').replace(/^Dr\.?\s*/i, '')} <CaretDown size={12} weight="bold" className="text-faint" />
              </Pressable>
            )}
            <Pressable ariaLabel="Add" hap="tick" onClick={() => setAddChooserOpen(true)} className="relative tap-pad flex h-9 w-9 items-center justify-center rounded-full bg-brand text-screen shadow-float">
              <Plus size={17} weight="bold" />
            </Pressable>
          </div>
        </div>
        <CalendarCanvas
          selected={selected}
          today={today}
          mode={mode}
          loads={loads}
          capacity={14}
          isOpenDay={(d) => isWorkingDay(d, hours)}
          onSelect={(d) => { setSelected(d); haptic('tick') }}
          onMode={(m) => { setMode(m); haptic('select') }}
          onPage={page}
          onToday={() => { setSelected(today); haptic('tick') }}
        />
      </div>

      <div className="px-[18px] pb-[130px] pt-2">
        <Agenda
          date={selected}
          today={today}
          appts={dayAppointments}
          blocks={dayBlocks}
          patients={patientMap}
          viewingColleague={scopedPractitionerId !== ME}
          load={{ count: liveCount, capacity: cap.slots, working: cap.working, closed: cap.working && cap.slots === 0 && liveCount === 0 }}
          onOpen={onOpenPatient}
          onPeek={setPeekPatientId}
          onEdit={openEditSheet}
          onCancel={(a) => setCancelApptId(a.id)}
          onReassign={handleReassignToMe}
          onRemoveBlock={handleRemoveBlock}
          onBook={openBookSheet}
        />
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

      <BottomSheet open={doctorOpen} onClose={() => setDoctorOpen(false)}>
        <div className="font-display text-[17px] font-bold text-ink">Whose schedule</div>
        <div className="mt-3 space-y-2">
          {team.map((p) => {
            const isMe = p.id === ME
            const on = isMe ? !viewPractitionerId : viewPractitionerId === p.id
            return (
              <Pressable key={p.id} as="div" hap="select" scale={0.98} onClick={() => { setViewPractitionerId(isMe ? null : p.id); setDoctorOpen(false) }} className={`flex cursor-pointer items-center gap-3 rounded-[16px] border px-4 py-3 ${on ? 'border-green-border bg-tint' : 'border-border bg-surface'}`}>
                <Avatar initials={p.initials} size={36} />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">{isMe ? 'You' : p.name}</div>
                  <div className="text-[12px] text-muted">{p.specialty}</div>
                </div>
                {on && <Check size={18} weight="bold" className="text-brand" />}
              </Pressable>
            )
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={addChooserOpen} onClose={() => setAddChooserOpen(false)}>
        <div className="font-display text-[17px] font-bold text-ink">
          {selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
        <div className="mt-3 space-y-2">
          <Pressable as="div" hap="tick" scale={0.98} onClick={() => { setAddChooserOpen(false); openBookSheet() }} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><CalendarPlus size={20} weight="fill" /></div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-ink">Book appointment</div>
              <div className="text-[12px] text-muted">A patient visit</div>
            </div>
            <span className="text-faint">&rsaquo;</span>
          </Pressable>
          <Pressable as="div" hap="tick" scale={0.98} onClick={() => { setAddChooserOpen(false); setBlockOpen(true) }} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-amber-tint text-amber-text"><Prohibit size={20} weight="fill" /></div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-ink">Block time</div>
              <div className="text-[12px] text-muted">Personal or business — visible to the whole team</div>
            </div>
            <span className="text-faint">&rsaquo;</span>
          </Pressable>
        </div>
      </BottomSheet>

      <BlockTimeSheet
        open={blockOpen}
        existingBlocks={dayBlocks}
        existingAppts={dayAppointments}
        onClose={() => setBlockOpen(false)}
        onConfirm={(input) => {
          addTimeBlock({ practitionerId: scopedPractitionerId, date: selectedKey, ...input })
          haptic('success')
          toast({ title: `${input.reason} blocked · ${formatDayLabel(selectedKey)}` })
          setBlockOpen(false)
        }}
      />
    </PullToRefresh>
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
                <Chip key={h} selected={hour === h} onClick={() => onHourChange(h)} className="text-[12px]">{fmtHour(h)}</Chip>
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
        <div className="mt-2 px-4 text-[12.5px] leading-relaxed text-muted">The slot becomes free again and {patient?.name?.split(' ')[0] ?? 'the patient'} is told in the app.</div>
        <div className="mt-4 flex w-full gap-2">
          <Pressable hap="tick" onClick={onClose} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Keep it</Pressable>
          <Pressable hap="impact" onClick={onConfirm} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Cancel it</Pressable>
        </div>
      </div>
    </BottomSheet>
  )
}
