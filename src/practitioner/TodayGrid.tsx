import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Play,
  Stop,
  XCircle,
  VideoCamera,
  Timer,
  Clock,
  CalendarPlus,
  NotePencil,
  Prescription as RxIcon,
  Check,
  Prohibit,
  Coffee,
  Briefcase,
  User as UserIcon,
  DotsSixVertical,
  Warning,
  CalendarBlank,
} from '@phosphor-icons/react'
import { todayISO, toISO, formatDayLabel, firstAvailableMorningSlot, isPastISO, isTodayISO } from '../core/day'
import { useClinic } from '../core/store'
import type { Appointment, TimeBlock } from '../core/types'
import { Avatar, Badge, BottomSheet, Card, Chip, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { haptic } from '../design-system/haptics'
import { springSoft, listContainer, listItem } from '../design-system/motion'
import { useToast } from '../design-system/toast'

// ME is resolved from store's currentPractitionerId inside the component
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM – 7 PM
const HOUR_HEIGHT = 56 // px per hour row
const HALF_HOUR_HEIGHT = HOUR_HEIGHT / 2

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function parseTime(time: string): number {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 9
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h + min / 60
}

function formatDecimalTime(t: number): string {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

type DayView = 'day' | 'list'

export function TodayGrid({
  openCase,
  goRx,
  startVideo,
}: {
  openCase: (id: string) => void
  goRx: () => void
  startVideo?: (appointmentId: string) => void
}) {
  const dbError = useClinic((s) => s.dbError)
  const appts = useClinic((s) => s.appointments)
  const patients = useClinic((s) => s.patients)
  const timeBlocks = useClinic((s) => s.timeBlocks)
  const checkIns = useClinic((s) => s.checkIns)
  const doseReminders = useClinic((s) => s.doseReminders)
  const startConsult = useClinic((s) => s.startConsult)
  const endConsult = useClinic((s) => s.endConsult)
  const markNoShow = useClinic((s) => s.markNoShow)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const rescheduleAppointment = useClinic((s) => s.rescheduleAppointment)
  const addTimeBlock = useClinic((s) => s.addTimeBlock)
  const removeTimeBlock = useClinic((s) => s.removeTimeBlock)
  const ME = useClinic((s) => s.currentPractitionerId)
  const pFind = (id: string) => patients.find((p) => p.id === id)
  const toast = useToast()

  const [view, setView] = useState<DayView>('day')
  const [endConsultSheet, setEndConsultSheet] = useState<string | null>(null)
  const [followUpSheet, setFollowUpSheet] = useState<string | null>(null)
  const [noShowSheet, setNoShowSheet] = useState<string | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockStartHour, setBlockStartHour] = useState(13)
  const [blockDuration, setBlockDuration] = useState('1 hour')
  const [blockReason, setBlockReason] = useState('Lunch')
  const [selectedAppt, setSelectedAppt] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<number | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)

  const activeAppt = appts.find((a) => a.status === 'In consult')
  const activePatient = activeAppt ? pFind(activeAppt.patientId) : null
  const activeCheckIn = activeAppt ? checkIns.find((c) => c.patientId === activeAppt.patientId) : null
  const activeDoses = activeAppt ? doseReminders.filter((d) => d.patientId === activeAppt.patientId) : []
  const adherencePct = activeDoses.length > 0 ? Math.round((activeDoses.filter((d) => d.loggedToday).length / activeDoses.length) * 100) : null

  const todayOnlyAppts = appts.filter((a) => isTodayISO(a.date))
  const todayAppts = appts.filter((a) => !isPastISO(a.date))
  const seen = todayOnlyAppts.filter((a) => a.status === 'Seen').length
  const waiting = todayAppts.filter((a) => a.status === 'Waiting' || a.status === 'New').length
  const upcoming = todayAppts.filter((a) => a.status === 'Upcoming').length

  // consult timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStart = useRef(Date.now())
  const startTimer = useCallback(() => {
    timerStart.current = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - timerStart.current) / 1000)), 1000)
  }, [])
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setElapsed(0)
  }, [])
  const timerStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

  // if active consult, start timer
  useMemo(() => {
    if (activeAppt && !timerRef.current) startTimer()
    if (!activeAppt && timerRef.current) stopTimer()
  }, [!!activeAppt])

  // stop the interval if this view unmounts mid-consult, so it doesn't keep
  // ticking (and updating state) against a component that's gone
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function handleEndConsult(apptId: string) {
    endConsult(apptId)
    stopTimer()
    haptic('success')
    toast({ title: 'Consult ended' })
    setEndConsultSheet(null)
    const appt = appts.find((a) => a.id === apptId)
    if (appt) setFollowUpSheet(appt.patientId)
  }

  function handleScheduleFollowUp(patientId: string, preset: string) {
    const now = new Date()
    const addDays = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() + d); return toISO(dt) }
    const dayMap: Record<string, string> = {
      '1 week': addDays(7),
      '2 weeks': addDays(14),
      '1 month': addDays(30),
    }
    const date = dayMap[preset] ?? preset
    const time = firstAvailableMorningSlot(appts, date)
    scheduleFollowUp({ patientId, practitionerId: ME, time, date, type: 'In person', reason: 'Follow-up' })
    haptic('success')
    toast({ title: `Follow-up scheduled · ${formatDayLabel(date)} · ${time}` })
    setFollowUpSheet(null)
  }

  function handleNoShow(apptId: string) {
    markNoShow(apptId)
    haptic('impact')
    toast({ title: 'No-show recorded' })
    setNoShowSheet(null)
    const appt = appts.find((a) => a.id === apptId)
    if (appt) setFollowUpSheet(appt.patientId)
  }

  function handleBlockTime() {
    const durMap: Record<string, number> = { '30 min': 30, '1 hour': 60, '2 hours': 120 }
    addTimeBlock({ practitionerId: ME, date: todayISO(), startHour: blockStartHour, durationMin: durMap[blockDuration] ?? 60, reason: blockReason })
    haptic('success')
    toast({ title: `${blockReason} blocked · ${fmtHour(blockStartHour)}` })
    setBlockOpen(false)
  }

  function handleDrop(apptId: string, targetHour: number) {
    const newTime = formatDecimalTime(targetHour)
    rescheduleAppointment(apptId, newTime)
    haptic('success')
    toast({ title: `Rescheduled to ${newTime}` })
    setDragTarget(null)
    setSelectedAppt(null)
  }

  // grid tap handler — only active in drag-reschedule mode; a stray tap on
  // the grid background otherwise does nothing (Block time is opened only
  // via its explicit button below)
  function handleGridTap(hour: number, half: 'top' | 'bottom') {
    if (!selectedAppt) return
    const targetTime = half === 'top' ? hour : hour + 0.5
    handleDrop(selectedAppt, targetTime)
  }

  const stats: [string, number, string][] = [
    ['Seen', seen, 'neutral'],
    ['Waiting', waiting, 'amber'],
    ['Upcoming', upcoming, 'neutral'],
  ]

  return (
    <div className="space-y-3 pb-20">
      {dbError && (
        <div className="flex items-center gap-2 rounded-[12px] border border-danger/30 bg-danger/8 px-3.5 py-2.5">
          <Warning size={16} weight="fill" className="shrink-0 text-danger" />
          <span className="text-[13px] font-medium text-danger">Could not reach the database — data below may be incomplete</span>
        </div>
      )}
      {/* header row: stats + view toggle */}
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-2">
          {stats.map(([l, v, tone]) => (
            <div key={l} className={`rounded-[14px] border border-border bg-surface px-2.5 py-2 text-center ${tone === 'amber' && v > 0 ? 'border-amber/40 bg-amber-tint/30' : ''}`}>
              <div className={`font-display text-[18px] font-bold ${tone === 'amber' && v > 0 ? 'text-amber-text' : 'text-ink'}`}>{v}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-faint">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 rounded-[10px] border border-border bg-surface">
          {(['day', 'list'] as const).map((v) => (
            <Pressable
              key={v}
              hap="tick"
              onClick={() => setView(v)}
              className={`px-3.5 py-2 text-[12.5px] font-semibold capitalize transition ${view === v ? 'bg-brand text-screen' : 'text-body'} ${v === 'day' ? 'rounded-l-[10px]' : 'rounded-r-[10px]'}`}
            >
              {v === 'day' ? 'Grid' : 'List'}
            </Pressable>
          ))}
        </div>
      </div>

      {/* active consult card */}
      {activeAppt && activePatient && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={springSoft} className="rounded-[22px] p-4 text-white shadow-float" style={{ background: 'linear-gradient(135deg,#5A7C4E,#41603C)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] opacity-90">
              <span className="h-2 w-2 animate-breathe rounded-full bg-white" /> In consult now
            </div>
            <div className="flex items-center gap-1.5 rounded-pill bg-white/20 px-2.5 py-1 text-[12px] font-semibold">
              <Timer size={13} weight="bold" /> {timerStr}
            </div>
          </div>
          <div className="mt-2 font-display text-[18px] font-bold">{activePatient.name}</div>
          <div className="text-[13px] opacity-90">{activeAppt.time} · {activeAppt.reason ?? activePatient.chiefComplaint}</div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {activePatient.currentRemedy && <Badge tone="green" className="!bg-white/20 !text-white">{activePatient.currentRemedy}</Badge>}
            {activeCheckIn && <Badge tone="amber" className="!bg-white/25 !text-white">Check-in: {activeCheckIn.marked}</Badge>}
            {adherencePct !== null && <Badge tone="green" className="!bg-white/20 !text-white">{adherencePct}% adherence</Badge>}
            {activeAppt.type === 'Video' && <Badge tone="green" className="!bg-white/20 !text-white"><VideoCamera size={12} weight="fill" className="mr-1 inline" />Video</Badge>}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {activeAppt.type === 'Video' && startVideo && (
              <Pressable hap="impact" onClick={() => startVideo(activeAppt.id)} className="flex items-center gap-1.5 rounded-pill bg-white/95 px-4 py-2 text-[13px] font-semibold text-brand"><VideoCamera size={16} weight="fill" /> Join video</Pressable>
            )}
            <Pressable hap="impact" onClick={() => openCase(activePatient.id)} className={`flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] font-semibold ${activeAppt.type === 'Video' ? 'border border-white/40' : 'bg-white/95 text-brand'}`}><NotePencil size={16} weight="fill" /> Case sheet</Pressable>
            <Pressable hap="tick" onClick={goRx} className="flex items-center gap-1.5 rounded-pill border border-white/40 px-4 py-2 text-[13px] font-semibold"><RxIcon size={16} weight="fill" /> Prescribe</Pressable>
            <Pressable hap="tick" onClick={() => setEndConsultSheet(activeAppt.id)} className="flex items-center gap-1.5 rounded-pill border border-white/40 px-4 py-2 text-[13px] font-semibold"><Stop size={14} weight="fill" /> End</Pressable>
          </div>
        </motion.div>
      )}

      {/* reschedule mode indicator */}
      <AnimatePresence>
        {selectedAppt && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center justify-between rounded-[14px] border border-amber/40 bg-amber-tint/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-text">
              <DotsSixVertical size={16} weight="bold" /> Tap a time slot to reschedule
            </div>
            <Pressable hap="tick" onClick={() => setSelectedAppt(null)} className="text-[12px] font-semibold text-muted">Cancel</Pressable>
          </motion.div>
        )}
      </AnimatePresence>

      {/* views */}
      {view === 'day' ? (
        <DayGridView
          appts={todayOnlyAppts}
          timeBlocks={timeBlocks}
          patients={patients}
          activeAppt={activeAppt ?? null}
          selectedAppt={selectedAppt}
          dragTarget={dragTarget}
          onStartConsult={(id) => { startConsult(id); startTimer(); haptic('success'); const a = appts.find((x) => x.id === id); toast({ title: `Consult started · ${pFind(a?.patientId ?? '')?.name}` }); if (a?.type === 'Video' && startVideo) startVideo(id) }}
          onEndConsult={(id) => setEndConsultSheet(id)}
          onNoShow={(id) => setNoShowSheet(id)}
          onOpenCase={openCase}
          onSelectForReschedule={(id) => setSelectedAppt(id)}
          onGridTap={handleGridTap}
          onRemoveBlock={removeTimeBlock}
        />
      ) : (
        <ListView
          appts={todayOnlyAppts}
          patients={patients}
          activeAppt={activeAppt ?? null}
          onStartConsult={(id) => { startConsult(id); startTimer(); haptic('success'); const a = appts.find((x) => x.id === id); toast({ title: `Consult started · ${pFind(a?.patientId ?? '')?.name}` }); if (a?.type === 'Video' && startVideo) startVideo(id) }}
          onNoShow={(id) => setNoShowSheet(id)}
          onOpenCase={openCase}
          onSelectForReschedule={(id) => setSelectedAppt(id)}
        />
      )}

      {/* block time action */}
      <Pressable
        hap="tick"
        onClick={() => { setBlockStartHour(13); setBlockReason('Lunch'); setBlockDuration('1 hour'); setBlockOpen(true) }}
        className="flex w-full items-center justify-center gap-2 rounded-pill border border-dashed border-border-dash py-2.5 text-[13px] font-semibold text-muted"
      >
        <Prohibit size={15} /> Block time
      </Pressable>

      {/* bottom sheets */}
      <EndConsultSheet open={endConsultSheet !== null} timerStr={timerStr} onClose={() => setEndConsultSheet(null)} onConfirm={() => endConsultSheet && handleEndConsult(endConsultSheet)} />
      <FollowUpSheet open={followUpSheet !== null} patientName={followUpSheet ? pFind(followUpSheet)?.name ?? 'patient' : ''} onClose={() => setFollowUpSheet(null)} onSelect={(p) => followUpSheet && handleScheduleFollowUp(followUpSheet, p)} />
      <NoShowSheet open={noShowSheet !== null} appts={appts} pFind={pFind} noShowId={noShowSheet} onClose={() => setNoShowSheet(null)} onConfirm={() => noShowSheet && handleNoShow(noShowSheet)} />
      <BlockTimeSheet open={blockOpen} startHour={blockStartHour} duration={blockDuration} reason={blockReason} onStartHourChange={setBlockStartHour} onDurationChange={setBlockDuration} onReasonChange={setBlockReason} onClose={() => setBlockOpen(false)} onConfirm={handleBlockTime} />
    </div>
  )
}

// ── DAY GRID VIEW ──
function DayGridView({ appts, timeBlocks, patients, activeAppt, selectedAppt, onStartConsult, onEndConsult, onNoShow, onOpenCase, onSelectForReschedule, onGridTap, onRemoveBlock }: {
  appts: Appointment[]
  timeBlocks: TimeBlock[]
  patients: { id: string; name: string; initials: string }[]
  activeAppt: Appointment | null
  selectedAppt: string | null
  dragTarget: number | null
  onStartConsult: (id: string) => void
  onEndConsult: (id: string) => void
  onNoShow: (id: string) => void
  onOpenCase: (id: string) => void
  onSelectForReschedule: (id: string) => void
  onGridTap: (hour: number, half: 'top' | 'bottom') => void
  onRemoveBlock: (id: string) => void
}) {
  const pFind = (id: string) => patients.find((p) => p.id === id)

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative">
        {/* now line */}
        {nowHour >= 8 && nowHour <= 20 && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
            style={{ top: `${(nowHour - 8) * HOUR_HEIGHT}px` }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-danger" />
            <span className="h-[1.5px] flex-1 bg-danger/60" />
          </div>
        )}

        {/* hour rows */}
        {HOURS.map((h) => {
          const hourAppts = appts.filter((a) => {
            const t = parseTime(a.time)
            return Math.floor(t) === h
          })
          const hourBlocks = timeBlocks.filter((b) => {
            return b.startHour <= h && (b.startHour + b.durationMin / 60) > h
          })

          return (
            <div key={h} className="flex border-b border-border last:border-b-0" style={{ minHeight: `${HOUR_HEIGHT}px` }}>
              {/* time label */}
              <div className="flex w-[54px] shrink-0 items-start justify-end border-r border-border px-2 pt-1.5 text-[10px] font-medium text-faint">
                {fmtHour(h)}
              </div>

              {/* slot area */}
              <div
                className="relative flex-1"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const half = y < HOUR_HEIGHT / 2 ? 'top' : 'bottom'
                  onGridTap(h, half)
                }}
              >
                {/* time blocks */}
                {hourBlocks.map((b) => {
                  const startOffset = Math.max(0, (h - b.startHour)) * HOUR_HEIGHT
                  const blockHeight = (b.durationMin / 60) * HOUR_HEIGHT
                  const visibleHeight = Math.min(blockHeight - startOffset, HOUR_HEIGHT)
                  const isStart = h === b.startHour
                  const blockIcons: Record<string, typeof Coffee> = { Lunch: Coffee, Admin: Briefcase, Personal: UserIcon }
                  const Icon = blockIcons[b.reason] ?? Prohibit

                  return isStart ? (
                    <div
                      key={b.id}
                      className="absolute inset-x-1 z-10 flex items-center gap-2 rounded-[10px] border border-dashed border-faint/40 bg-raised/60 px-2.5"
                      style={{ top: 0, height: `${blockHeight}px` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon size={14} className="text-faint" />
                      <span className="text-[11px] font-medium text-faint">{b.reason}</span>
                      <span className="flex-1" />
                      <Pressable hap="tick" onClick={() => onRemoveBlock(b.id)} className="text-faint/60 hover:text-danger">
                        <XCircle size={14} />
                      </Pressable>
                    </div>
                  ) : null
                })}

                {/* appointments */}
                {hourAppts.map((a) => {
                  const p = pFind(a.patientId)
                  if (!p) return null
                  const t = parseTime(a.time)
                  const minuteOffset = (t - h) * HOUR_HEIGHT
                  const blockH = (a.durationMin / 60) * HOUR_HEIGHT
                  const isActive = activeAppt?.id === a.id
                  const isSelected = selectedAppt === a.id
                  const canStart = (a.status === 'Waiting' || a.status === 'New' || a.status === 'Upcoming') && !activeAppt
                  const isSeen = a.status === 'Seen'

                  return (
                    <motion.div
                      key={a.id}
                      layout
                      className={`absolute inset-x-1 z-10 overflow-hidden rounded-[12px] border ${
                        isActive ? 'border-brand bg-tint shadow-card' :
                        isSelected ? 'border-amber bg-amber-tint/40 shadow-card' :
                        isSeen ? 'border-border/60 bg-raised/50 opacity-60' :
                        'border-border bg-surface shadow-card hover:border-green-border'
                      }`}
                      style={{ top: `${minuteOffset}px`, height: `${Math.max(blockH, 36)}px` }}
                      onClick={(e) => { e.stopPropagation(); onOpenCase(p.id) }}
                    >
                      <div className="flex h-full items-center gap-2 px-2.5">
                        <Avatar initials={p.initials} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[12px] font-semibold text-ink">{p.name}</span>
                            {a.type === 'Video' && <VideoCamera size={11} weight="fill" className="shrink-0 text-brand" />}
                          </div>
                          <div className="truncate text-[10px] text-muted">{a.time} · {a.reason ?? ''}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {canStart && (
                            <Pressable hap="impact" onClick={() => onStartConsult(a.id)} className="flex items-center gap-0.5 rounded-pill bg-brand px-2 py-1 text-[10px] font-semibold text-screen">
                              <Play size={9} weight="fill" /> Start
                            </Pressable>
                          )}
                          {isActive && (
                            <Pressable hap="tick" onClick={() => onEndConsult(a.id)} className="flex items-center gap-0.5 rounded-pill bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger">
                              <Stop size={9} weight="fill" /> End
                            </Pressable>
                          )}
                          {!isSeen && !isActive && (
                            <Pressable hap="tick" onClick={() => onSelectForReschedule(a.id)} className="rounded-full p-1 text-faint hover:bg-raised">
                              <DotsSixVertical size={13} weight="bold" />
                            </Pressable>
                          )}
                        </div>
                      </div>
                    </motion.div>
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

// ── LIST VIEW (simplified, same as old TodayScreen list) ──
function ListView({
  appts,
  patients,
  activeAppt,
  onStartConsult,
  onNoShow,
  onOpenCase,
  onSelectForReschedule,
}: {
  appts: Appointment[]
  patients: { id: string; name: string; initials: string }[]
  activeAppt: Appointment | null
  onStartConsult: (id: string) => void
  onNoShow: (id: string) => void
  onOpenCase: (id: string) => void
  onSelectForReschedule: (id: string) => void
}) {
  const pFind = (id: string) => patients.find((p) => p.id === id)
  const restOfDay = appts.filter((a) => a.status !== 'In consult')

  if (restOfDay.length === 0) {
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

  return (
    <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
      {restOfDay.map((a) => {
        const p = pFind(a.patientId)
        if (!p) return null
        const canStart = (a.status === 'Waiting' || a.status === 'New' || a.status === 'Upcoming') && !activeAppt
        const isSeen = a.status === 'Seen'
        return (
          <motion.div key={a.id} variants={listItem}>
            <Pressable as="div" hap="tick" scale={0.99} onClick={() => onOpenCase(p.id)} className={`flex cursor-pointer items-center gap-3 rounded-[20px] border border-border bg-surface px-3.5 py-3 shadow-card ${isSeen ? 'opacity-60' : ''}`}>
              <div className="text-center">
                <div className="font-display text-[13px] font-bold text-ink">{a.time.replace(' AM', '').replace(' PM', '')}</div>
                <div className="text-[10px] text-faint">{a.durationMin}m</div>
              </div>
              <Avatar initials={p.initials} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[14px] font-semibold text-ink">{p.name}</div>
                <div className="flex items-center gap-1.5 truncate text-[12px] text-muted">
                  {a.type === 'Video' && <VideoCamera size={12} weight="fill" className="text-brand" />}
                  {a.tag ?? a.reason}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                <Badge tone={a.status === 'In consult' ? 'green' : a.status === 'New' ? 'amber' : a.status === 'Waiting' ? 'amber' : 'neutral'}>{a.status}</Badge>
                {canStart && (
                  <Pressable hap="impact" onClick={() => onStartConsult(a.id)} className="flex items-center gap-1 rounded-pill bg-brand px-2.5 py-1 text-[11px] font-semibold text-screen">
                    <Play size={10} weight="fill" /> Start
                  </Pressable>
                )}
                {canStart && (
                  <Pressable hap="tick" onClick={() => onNoShow(a.id)} className="text-[11px] font-medium text-faint">No-show</Pressable>
                )}
              </div>
            </Pressable>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// ── BOTTOM SHEETS ──
function EndConsultSheet({ open, timerStr, onClose, onConfirm }: { open: boolean; timerStr: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tint text-brand"><Check size={28} weight="bold" /></div>
        <div className="mt-3 font-display text-[17px] font-bold text-ink">End consult?</div>
        <div className="mt-1 text-[13px] text-muted">Duration: {timerStr}</div>
        <div className="mt-4 flex w-full gap-2">
          <Pressable hap="tick" onClick={onClose} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Cancel</Pressable>
          <Pressable hap="success" onClick={onConfirm} className="flex-1 rounded-pill bg-brand py-2.5 text-center text-[14px] font-semibold text-screen">End &amp; follow-up</Pressable>
        </div>
      </div>
    </BottomSheet>
  )
}

function FollowUpSheet({ open, patientName, onClose, onSelect }: { open: boolean; patientName: string; onClose: () => void; onSelect: (preset: string) => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-3">
        <div className="font-display text-[17px] font-bold text-ink">Schedule follow-up</div>
        <div className="text-[12.5px] text-muted">For {patientName}</div>
        <div className="space-y-2">
          {['1 week', '2 weeks', '1 month'].map((preset) => (
            <Pressable key={preset} as="div" hap="tick" scale={0.98} onClick={() => onSelect(preset)} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><CalendarPlus size={20} weight="fill" /></div>
              <div className="flex-1 text-[14px] font-semibold text-ink">In {preset}</div>
              <span className="text-faint">&rsaquo;</span>
            </Pressable>
          ))}
        </div>
        <Pressable hap="tick" onClick={onClose} className="w-full rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Skip for now</Pressable>
      </div>
    </BottomSheet>
  )
}

function NoShowSheet({ open, appts, pFind, noShowId, onClose, onConfirm }: { open: boolean; appts: Appointment[]; pFind: (id: string) => any; noShowId: string | null; onClose: () => void; onConfirm: () => void }) {
  const a = noShowId ? appts.find((ap) => ap.id === noShowId) : null
  const p = a ? pFind(a.patientId) : null
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><XCircle size={28} weight="fill" /></div>
        <div className="mt-3 font-display text-[17px] font-bold text-ink">Mark no-show?</div>
        <div className="mt-1 text-[13px] text-muted">{p?.name} · {a?.time}</div>
        <div className="mt-4 flex w-full gap-2">
          <Pressable hap="tick" onClick={onClose} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Cancel</Pressable>
          <Pressable hap="impact" onClick={onConfirm} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Confirm no-show</Pressable>
        </div>
      </div>
    </BottomSheet>
  )
}

function BlockTimeSheet({ open, startHour, duration, reason, onStartHourChange, onDurationChange, onReasonChange, onClose, onConfirm }: {
  open: boolean
  startHour: number
  duration: string
  reason: string
  onStartHourChange: (h: number) => void
  onDurationChange: (d: string) => void
  onReasonChange: (r: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const timeSlots = HOURS.map((h) => ({ value: h, label: fmtHour(h) }))
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-display text-[17px] font-bold text-ink">Block time</div>
      <div className="mt-3">
        <Label>Start time</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {timeSlots.map(({ value, label }) => (
            <Chip key={value} selected={startHour === value} onClick={() => { haptic('select'); onStartHourChange(value) }} className="text-[11px]">{label}</Chip>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <Label>Duration</Label>
        <div className="mt-2 flex gap-2">
          {['30 min', '1 hour', '2 hours'].map((d) => (
            <Chip key={d} selected={duration === d} onClick={() => { haptic('select'); onDurationChange(d) }} className="flex-1 text-center">{d}</Chip>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <Label>Reason</Label>
        <div className="mt-2 flex gap-2">
          {['Lunch', 'Admin', 'Personal'].map((r) => (
            <Chip key={r} selected={reason === r} onClick={() => { haptic('select'); onReasonChange(r) }} className="flex-1 text-center">{r}</Chip>
          ))}
        </div>
      </div>
      <Pressable hap="success" onClick={onConfirm} className="mt-4 flex w-full items-center justify-center rounded-pill bg-accent py-3 font-display text-[15px] font-semibold text-white shadow-float">
        Block
      </Pressable>
    </BottomSheet>
  )
}
