import { useMemo, useState } from 'react'
import { Stethoscope, Prescription, Heartbeat, NotePencil, TestTube, CurrencyInr, ChatCircleText, Lock, CaretRight } from '@phosphor-icons/react'
import { Badge, Label } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'
import { formatDayLabel } from '../../core/day'
import type { JourneyEvent, JourneyKind } from '../../core/journey'

// A patient's whole story, newest first, with what is still ahead above "now".
// Solid node = happened, dashed node = planned — the app's usual language.
const ICON: Record<JourneyKind, typeof Stethoscope> = {
  visit: Stethoscope, rx: Prescription, outcome: Heartbeat, case: NotePencil, tests: TestTube, bill: CurrencyInr, checkin: ChatCircleText,
}
const monthOf = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

export function JourneyTimeline({ events, onOpen, limit = 12 }: { events: JourneyEvent[]; onOpen?: (ref: NonNullable<JourneyEvent['ref']>) => void; limit?: number }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? events : events.slice(0, limit)
  const rows = useMemo(() => {
    const out: ({ type: 'head'; text: string; key: string } | { type: 'now'; key: string } | { type: 'ev'; ev: JourneyEvent; last: boolean; key: string })[] = []
    let month = ''
    let prevPlanned = false
    let sawPlanned = false
    shown.forEach((ev, i) => {
      if (ev.planned && !sawPlanned) { out.push({ type: 'head', text: 'Coming up', key: 'h-plan' }); sawPlanned = true }
      if (!ev.planned && prevPlanned) out.push({ type: 'now', key: 'now' })
      if (!ev.planned && !ev.now) {
        const m = monthOf(ev.date)
        if (m !== month) { out.push({ type: 'head', text: m, key: 'h-' + m }); month = m }
      }
      out.push({ type: 'ev', ev, last: i === shown.length - 1, key: ev.id })
      prevPlanned = ev.planned
    })
    return out
  }, [shown])

  if (events.length === 0) {
    return <div className="py-12 text-center text-[13px] text-muted">Nothing here yet — visits, prescriptions and bills will appear as they happen.</div>
  }
  return (
    <div>
      {rows.map((r) => {
        if (r.type === 'head') return <Label key={r.key} className="mb-2 mt-5 first:mt-1">{r.text}</Label>
        if (r.type === 'now') {
          return (
            <div key={r.key} className="my-2 flex items-center gap-3">
              <span className="rounded-pill bg-brand px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-label text-screen">Today</span>
              <span className="h-px flex-1 bg-border-dash" />
            </div>
          )
        }
        const { ev } = r
        const Icon = ICON[ev.kind]
        const node = ev.now ? 'bg-brand text-screen' : ev.planned ? 'border-2 border-dashed border-brand/55 bg-surface text-brand' : 'bg-tint text-brand'
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-semibold leading-snug text-ink">{ev.title}</div>
              {ev.subtitle && <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{ev.subtitle}</div>}
              {ev.hiddenFromPatient && <div className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-faint"><Lock size={11} weight="fill" /> Name hidden from patient</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11.5px] font-medium text-faint">{formatDayLabel(ev.date)}</div>
              {ev.badge && <Badge tone={ev.badge.tone} className="mt-1">{ev.badge.label}</Badge>}
            </div>
          </>
        )
        return (
          <div key={r.key} className={`relative pb-4 pl-[48px] ${ev.dimmed ? 'opacity-55' : ''}`}>
            <div className={`absolute left-0 top-0 z-[1] flex h-9 w-9 items-center justify-center rounded-full ${node} ${ev.now ? 'animate-breathe' : ''}`}><Icon size={17} weight={ev.planned ? 'regular' : 'fill'} /></div>
            {!r.last && <div aria-hidden="true" className={`absolute left-[17px] top-9 bottom-0 w-0 border-l ${ev.planned ? 'border-dashed border-brand/40' : 'border-border-dash'}`} />}
            {ev.ref && onOpen ? (
              <Pressable as="div" hap="tick" scale={0.99} onClick={() => onOpen(ev.ref!)} className="-mt-0.5 flex cursor-pointer items-start gap-3 rounded-[14px] py-0.5">{body}<CaretRight size={14} className="mt-1 shrink-0 text-faint" /></Pressable>
            ) : (
              <div className="flex items-start gap-3 py-0.5">{body}</div>
            )}
          </div>
        )
      })}
      {!showAll && events.length > limit && (
        <Pressable hap="tick" onClick={() => setShowAll(true)} className="mx-auto mt-1 block rounded-pill border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-body">Show earlier ({events.length - limit})</Pressable>
      )}
    </div>
  )
}
