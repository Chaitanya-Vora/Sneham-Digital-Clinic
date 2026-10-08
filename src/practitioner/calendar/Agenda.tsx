import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CalendarBlank, CalendarPlus, Check, DotsThree, CaretDown, MapPin, Prohibit, VideoCamera, XCircle } from '@phosphor-icons/react'
import { Avatar, Badge, BottomSheet, Card, Label } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'
import { formatDecimalTime, parseTime } from '../../core/clock'
import { sameDay, addDaysTo } from '../../core/calendarGrid'
import type { Appointment, Patient, TimeBlock } from '../../core/types'
import { blockColorStyle } from '../BlockTimeSheet'

// One day's agenda: a single card of hairline-separated rows (appointments and blocked time
// in clock order), cancelled visits folded away, every action behind one ⋯ (a 44px target).
export interface AgendaProps {
  date: Date
  today: Date
  appts: Appointment[]                // that day, any status
  blocks: TimeBlock[]
  patients: Map<string, Patient>
  viewingColleague: boolean           // the owner looking at someone else's day
  load: { count: number; capacity: number; working: boolean; closed: boolean }
  onOpen: (patientId: string) => void
  onPeek: (patientId: string) => void
  onEdit: (a: Appointment) => void
  onCancel: (a: Appointment) => void
  onReassign: (a: Appointment) => void
  onRemoveBlock: (b: TimeBlock) => void
  onBook: () => void
}

type Item = { kind: 'appt'; at: number; appt: Appointment } | { kind: 'block'; at: number; block: TimeBlock }

const timeParts = (t: string) => { const m = /^(\d{1,2}:\d{2})\s*(AM|PM)$/i.exec(t.trim()); return m ? [m[1], m[2].toUpperCase()] : [t, ''] }

export function Agenda(p: AgendaProps) {
  const [showCancelled, setShowCancelled] = useState(false)
  const [menuFor, setMenuFor] = useState<Appointment | null>(null)
  const live = p.appts.filter((a) => a.status !== 'Cancelled')
  const cancelled = p.appts.filter((a) => a.status === 'Cancelled')
  const items: Item[] = [
    ...live.map((appt) => ({ kind: 'appt' as const, at: parseTime(appt.time), appt })),
    ...p.blocks.map((block) => ({ kind: 'block' as const, at: block.startHour, block })),
  ].sort((a, b) => a.at - b.at)

  const isPast = p.date < new Date(p.today.getFullYear(), p.today.getMonth(), p.today.getDate())
  const rel = sameDay(p.date, p.today) ? 'Today' : sameDay(p.date, addDaysTo(p.today, 1)) ? 'Tomorrow' : sameDay(p.date, addDaysTo(p.today, -1)) ? 'Yesterday' : null
  const long = p.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const over = p.load.working && p.load.capacity > 0 && p.load.count > p.load.capacity

  const row = (a: Appointment, first: boolean, dim = false) => {
    const pt = p.patients.get(a.patientId)
    const [clock, ap] = timeParts(a.time)
    const detail = [a.type, `${a.durationMin} min`, a.tag ?? a.reason].filter(Boolean).join(' · ')
    return (
      <Pressable
        key={a.id}
        as="div"
        hap="tick"
        scale={0.995}
        onClick={() => p.onOpen(a.patientId)}
        className={`flex cursor-pointer items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-border'} ${a.status === 'In consult' ? 'bg-tint-pale' : ''} ${dim ? 'opacity-55' : ''}`}
      >
        <div className="w-[46px] shrink-0">
          <div className="font-display text-[14px] font-bold leading-none text-ink">{clock}</div>
          <div className="mt-0.5 text-[11px] font-medium text-faint">{ap}</div>
        </div>
        <Avatar initials={pt?.initials ?? '??'} size={36} />
        <div className="min-w-0 flex-1">
          <div className={`truncate font-display text-[14px] font-semibold text-ink ${dim ? 'line-through' : ''}`}>{pt?.name ?? 'Unknown'}</div>
          <div className="flex items-center gap-1 truncate text-[12px] text-muted">
            {a.type === 'Video' ? <VideoCamera size={11} weight="fill" className="shrink-0" /> : <MapPin size={11} weight="fill" className="shrink-0" />}
            <span className="truncate">{detail}</span>
          </div>
        </div>
        {a.status === 'In consult' && <Badge tone="green"><span className="h-1.5 w-1.5 animate-breathe rounded-full bg-brand" />In consult</Badge>}
        {a.status === 'Seen' && <span className="flex items-center gap-1 text-[12px] font-semibold text-success"><Check size={14} weight="bold" />Seen</span>}
        {(a.status === 'Waiting' || a.status === 'New') && <Badge tone="amber">{a.status}</Badge>}
        {!dim && (
          <Pressable ariaLabel={`Actions for ${pt?.name ?? 'appointment'}`} hap="tick" onClick={(e) => { e?.stopPropagation(); setMenuFor(a) }} className="relative tap-pad flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint">
            <DotsThree size={22} weight="bold" />
          </Pressable>
        )}
      </Pressable>
    )
  }

  const blockRow = (b: TimeBlock, first: boolean) => {
    const style = blockColorStyle(b.color)
    return (
      <div key={b.id} className={`flex items-center gap-3 border-dashed px-3.5 py-3 ${first ? '' : 'border-t'} ${style.border} ${style.bg}`}>
        <div className="w-[46px] shrink-0 text-center"><Prohibit size={18} className={style.text} /></div>
        <div className="min-w-0 flex-1">
          <div className={`text-[13.5px] font-semibold ${style.text}`}>{b.reason}</div>
          <div className={`text-[12px] opacity-80 ${style.text}`}>{formatDecimalTime(b.startHour)} – {formatDecimalTime(b.startHour + b.durationMin / 60)} · blocked</div>
        </div>
        <Pressable ariaLabel={`Remove ${b.reason} block`} hap="tick" onClick={() => p.onRemoveBlock(b)} className={`relative tap-pad flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.text}`}>
          <XCircle size={18} />
        </Pressable>
      </div>
    )
  }

  const menuAppt = menuFor
  const menuPatient = menuAppt ? p.patients.get(menuAppt.patientId) : undefined
  const canModify = !!menuAppt && menuAppt.status !== 'Seen' && menuAppt.status !== 'In consult' && menuAppt.status !== 'Cancelled'
  const menuRow = (label: string, icon: ReactNode, onClick: () => void, danger = false) => (
    <Pressable key={label} as="div" hap="tick" scale={0.98} onClick={() => { setMenuFor(null); onClick() }} className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${danger ? 'bg-danger/10 text-danger' : 'bg-tint text-brand'}`}>{icon}</div>
      <div className={`flex-1 text-[14px] font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{label}</div>
    </Pressable>
  )

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0 font-display text-[17px] font-bold text-ink">
          {rel ?? long.split(',')[0]}
          <span className="font-body text-[13px] font-normal text-muted"> · {rel ? long : `${p.date.getDate()} ${p.date.toLocaleDateString('en-IN', { month: 'short' })}`}</span>
        </div>
        <div className={`shrink-0 text-[12.5px] font-semibold ${over ? 'text-amber-text' : 'text-muted'}`}>
          {over ? `${p.load.count} visits · over capacity` : p.load.count > 0 ? `${p.load.count} visit${p.load.count === 1 ? '' : 's'}` : ''}
        </div>
      </div>

      {items.length === 0 && cancelled.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint"><CalendarBlank size={24} className="text-faint" /></div>
          <div className="mt-4 font-display text-[16px] font-semibold text-ink">
            {p.load.closed ? 'Blocked all day' : !p.load.working ? 'Day off' : isPast ? 'No visits that day' : 'A free day'}
          </div>
          <div className="mt-1 text-[13px] text-muted">
            {p.load.closed ? 'Nothing can be booked — the day is blocked.' : !p.load.working ? 'Not one of your working days.' : isPast ? 'Nothing was booked.' : 'Nothing booked yet.'}
          </div>
          {!isPast && !p.load.closed && (
            <Pressable hap="tick" onClick={p.onBook} className="mt-4 flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-screen shadow-float"><CalendarPlus size={16} weight="bold" /> Book a visit on this day</Pressable>
          )}
        </div>
      )}

      {items.length > 0 && (
        <>
          <Label className="mb-2">{live.length} appointment{live.length === 1 ? '' : 's'}{p.blocks.length ? ` · ${p.blocks.length} blocked` : ''}{cancelled.length ? ` · ${cancelled.length} cancelled` : ''}</Label>
          <Card className="overflow-hidden">
            {items.map((it, i) => (it.kind === 'appt' ? row(it.appt, i === 0) : blockRow(it.block, i === 0)))}
          </Card>
        </>
      )}

      {cancelled.length > 0 && (
        <div className="mt-3">
          <Pressable hap="tick" onClick={() => setShowCancelled((v) => !v)} className="relative tap-pad-y mx-auto flex items-center gap-1 py-2 text-[12.5px] font-semibold text-muted">
            {showCancelled ? 'Hide' : 'Show'} {cancelled.length} cancelled <CaretDown size={12} weight="bold" className={showCancelled ? 'rotate-180' : ''} />
          </Pressable>
          {showCancelled && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1"><Card className="overflow-hidden">{cancelled.map((a, i) => row(a, i === 0, true))}</Card></motion.div>}
        </div>
      )}

      <BottomSheet open={menuAppt !== null} onClose={() => setMenuFor(null)}>
        <div className="flex items-center gap-3">
          <Avatar initials={menuPatient?.initials ?? '??'} size={40} />
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] font-bold text-ink">{menuPatient?.name ?? 'Unknown'}</div>
            <div className="text-[12.5px] text-muted">{menuAppt?.time} · {p.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {menuAppt && menuRow('Quick view', <CalendarBlank size={20} />, () => p.onPeek(menuAppt.patientId))}
          {menuAppt && canModify && menuRow('Reschedule or edit', <CalendarPlus size={20} />, () => p.onEdit(menuAppt))}
          {menuAppt && canModify && p.viewingColleague && menuRow('Reassign to me', <Check size={20} />, () => p.onReassign(menuAppt))}
          {menuAppt && canModify && menuRow('Cancel appointment', <XCircle size={20} />, () => p.onCancel(menuAppt), true)}
        </div>
      </BottomSheet>
    </div>
  )
}
