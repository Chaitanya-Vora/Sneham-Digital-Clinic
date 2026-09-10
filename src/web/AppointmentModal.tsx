import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, MagnifyingGlass } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import type { Appointment, ConsultType } from '../core/types'
import { todayISO, formatDayLabel } from '../core/day'
import { Avatar, Badge, Chip, Label } from '../design-system/ui'
import { useToast } from '../design-system/toast'

const BOOK_HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM – 7 PM

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function hourToTime(h: number): string {
  return fmtHour(h).replace(' AM', ':00 AM').replace(' PM', ':00 PM')
}

function parseHourFromTime(time: string): number {
  const m = time.match(/(\d+):?(\d*)\s*(AM|PM)/i)
  if (!m) return 9
  let h = parseInt(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h
}

export type AppointmentModalRequest =
  | { mode: 'add'; date: string; hour?: number }
  | { mode: 'edit'; appointment: Appointment }

export function AppointmentModal({ request, onClose }: { request: AppointmentModalRequest | null; onClose: () => void }) {
  const patients = useClinic((s) => s.patients)
  const currentPractitionerId = useClinic((s) => s.currentPractitionerId)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const updateAppointment = useClinic((s) => s.updateAppointment)
  const toast = useToast()

  const [patientId, setPatientId] = useState<string | null>(null)
  const [patientQuery, setPatientQuery] = useState('')
  const [date, setDate] = useState(todayISO())
  const [hour, setHour] = useState(9)
  const [apptType, setApptType] = useState<ConsultType>('In person')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!request) return
    if (request.mode === 'edit') {
      setPatientId(request.appointment.patientId)
      setDate(request.appointment.date)
      setHour(parseHourFromTime(request.appointment.time))
      setApptType(request.appointment.type)
      setReason(request.appointment.reason ?? '')
    } else {
      setPatientId(null)
      setPatientQuery('')
      setDate(request.date)
      setHour(request.hour ?? 9)
      setApptType('In person')
      setReason('')
    }
  }, [request])

  if (!request) return null

  const patient = patientId ? patients.find((p) => p.id === patientId) : null
  const results = patientQuery.trim()
    ? patients.filter((p) => p.name.toLowerCase().includes(patientQuery.trim().toLowerCase())).slice(0, 6)
    : []

  const onConfirm = () => {
    if (!patientId) return
    const time = hourToTime(hour)
    if (request.mode === 'edit') {
      updateAppointment(request.appointment.id, { date, time, type: apptType, reason: reason.trim() || request.appointment.reason || 'Consultation' })
      toast({ title: 'Appointment updated', message: `${formatDayLabel(date)} · ${time}` })
    } else {
      scheduleFollowUp({ patientId, practitionerId: currentPractitionerId ?? '', time, date, type: apptType, reason: reason.trim() || 'Consultation' })
      toast({ title: 'Appointment booked', message: `${patient?.name ?? 'Patient'} · ${formatDayLabel(date)} · ${time}` })
    }
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[440px] overflow-y-auto rounded-[20px] border border-border bg-surface p-6 shadow-modal"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-bold text-ink">{request.mode === 'edit' ? 'Edit appointment' : 'Add appointment'}</h2>
          <button onClick={onClose} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
        </div>

        {!patient ? (
          <div className="space-y-3">
            <div>
              <Label>Patient</Label>
              <div className="relative mt-1.5">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  autoFocus
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search patients by name…"
                  className="w-full rounded-[12px] border border-border bg-screen py-2.5 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-green-border"
                />
              </div>
            </div>
            {results.length > 0 && (
              <div className="max-h-[220px] space-y-1 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPatientId(p.id)}
                    className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition hover:bg-surface-hover"
                  >
                    <Avatar initials={p.initials} size={32} />
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                      <div className="text-[11.5px] text-faint">{p.age} {p.sex[0]} · {p.wsCode}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {patientQuery.trim() && results.length === 0 && (
              <p className="py-3 text-center text-[12.5px] text-faint">No patients match "{patientQuery}".</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[12px] bg-tint px-3 py-2.5">
              <Avatar initials={patient.initials} size={32} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink">{patient.name}</div>
                <div className="text-[11.5px] text-faint">{patient.age} {patient.sex[0]} · {patient.wsCode}</div>
              </div>
              {request.mode === 'add' && (
                <button onClick={() => setPatientId(null)} className="text-[12px] font-semibold text-brand">Change</button>
              )}
            </div>

            <div>
              <Label>Date</Label>
              <input
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-[12px] border border-border bg-screen px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-green-border"
              />
            </div>

            <div>
              <Label>Time</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {BOOK_HOURS.map((h) => (
                  <Chip key={h} selected={hour === h} onClick={() => setHour(h)}>{fmtHour(h)}</Chip>
                ))}
              </div>
            </div>

            <div>
              <Label>Type</Label>
              <div className="mt-1.5 flex gap-1.5">
                {(['In person', 'Video'] as const).map((t) => (
                  <Chip key={t} selected={apptType === t} onClick={() => setApptType(t)}>{t}</Chip>
                ))}
              </div>
            </div>

            <div>
              <Label>Reason</Label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Consultation"
                className="mt-1.5 w-full rounded-[12px] border border-border bg-screen px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-green-border"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-pill border border-border px-4 py-2.5 text-[13px] font-semibold text-body transition hover:bg-surface-hover">
                Cancel
              </button>
              <button onClick={onConfirm} className="flex-1 rounded-pill bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent-deep">
                {request.mode === 'edit' ? 'Save changes' : 'Book appointment'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
