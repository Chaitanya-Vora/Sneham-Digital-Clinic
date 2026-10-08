import { Fragment, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretDown, CaretRight, ChatCircleText, Check, Heartbeat, Lock, Minus, NotePencil, Prescription, Stethoscope, TestTube, Warning, X } from '@phosphor-icons/react'
import { Badge, Card, Label } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'
import { formatDayLabel, fromISO } from '../../core/day'
import type { Episode, JourneyEvent, JourneyKind, JourneyTone } from '../../core/journey'

// The patient's story, grouped by treatment — a homeopath's natural unit. Across the top, one
// dot per remedy shows how each one went at a glance; below, the current remedy is open and
// every earlier one is a single line that opens on tap. Long histories stay short.
const EVENT_ICON: Record<JourneyKind, typeof Stethoscope> = {
  visit: Stethoscope, rx: Prescription, outcome: Heartbeat, case: NotePencil, tests: TestTube, bill: Stethoscope, checkin: ChatCircleText,
}
const short = (iso: string) => fromISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const monthOf = (iso: string) => fromISO(iso).toLocaleDateString('en-IN', { month: 'short' })

type Mood = 'better' | 'partial' | 'same' | 'worse' | 'none'
function moodOf(tone: JourneyTone | undefined): Mood {
  return tone === 'green' ? 'better' : tone === 'amber' ? 'partial' : tone === 'danger' ? 'worse' : tone === 'neutral' ? 'same' : 'none'
}

function Dot({ ep, size = 20 }: { ep: Episode; size?: number }) {
  const mood = moodOf(ep.outcome?.tone)
  const base = 'flex items-center justify-center rounded-full'
  const style = { width: size, height: size }
  if (ep.status === 'cancelled') return <span style={style} className={`${base} border border-border-dash bg-screen text-faint`}><X size={10} weight="bold" /></span>
  if (mood === 'better') return <span style={style} className={`${base} bg-brand text-screen`}><Check size={11} weight="bold" /></span>
  if (mood === 'partial') return <span style={style} className={`${base} bg-amber text-white`}><Minus size={11} weight="bold" /></span>
  if (mood === 'worse') return <span style={style} className={`${base} bg-danger text-white`}><Warning size={11} weight="fill" /></span>
  if (mood === 'same') return <span style={style} className={`${base} bg-faint/70 text-white`}><Minus size={11} weight="bold" /></span>
  // no review yet: the current remedy breathes, an earlier one is just an empty ring
  return <span style={style} className={`${base} border-2 border-dashed ${ep.status === 'current' ? 'animate-breathe border-brand bg-surface' : 'border-border-dash bg-surface'}`} />
}

function Strip({ episodes, onPick }: { episodes: Episode[]; onPick: (id: string) => void }) {
  const courses = episodes.filter((e) => e.kind === 'course').slice().reverse() // oldest → newest, left to right
  if (courses.length < 2) return null
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <Label>Treatment so far</Label>
        <span className="text-[12px] text-muted">{courses.length} remedies</span>
      </div>
      <div className="no-scrollbar mt-3 flex items-start overflow-x-auto pb-0.5">
        {courses.map((ep, i) => (
          <Fragment key={ep.id}>
            {i > 0 && <span aria-hidden="true" className={`mt-[14px] min-w-[14px] flex-1 border-t-2 ${ep.status === 'current' ? 'border-dashed border-brand/50' : 'border-solid border-border-dash'}`} />}
            <Pressable hap="tick" scale={0.92} onClick={() => onPick(ep.id)} ariaLabel={`${ep.title}, ${ep.outcome?.label ?? (ep.status === 'cancelled' ? 'cancelled' : 'no review yet')}`} className="relative tap-pad-sm flex w-[46px] shrink-0 flex-col items-center gap-1 py-1">
              <Dot ep={ep} size={22} />
              <span className="text-[11px] font-medium text-faint">{monthOf(ep.startDate)}</span>
            </Pressable>
          </Fragment>
        ))}
      </div>
    </Card>
  )
}

function EventRow({ ev, first, onOpen }: { ev: JourneyEvent; first: boolean; onOpen?: (ref: NonNullable<JourneyEvent['ref']>) => void }) {
  const Icon = EVENT_ICON[ev.kind]
  const body = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-brand"><Icon size={15} weight="fill" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[13.5px] font-semibold text-ink">{ev.title}</span>
          {ev.badge && <Badge tone={ev.badge.tone} className="shrink-0">{ev.badge.label}</Badge>}
        </div>
        {ev.subtitle && <div className="line-clamp-2 text-[12px] leading-snug text-muted">{ev.subtitle}</div>}
      </div>
      <div className="shrink-0 text-[11.5px] font-medium text-faint">{formatDayLabel(ev.date)}</div>
      {ev.ref && onOpen && <CaretRight size={13} className="shrink-0 text-faint" />}
    </>
  )
  const cls = `flex items-start gap-3 px-4 py-2.5 ${first ? '' : 'border-t border-border'} ${ev.dimmed ? 'opacity-55' : ''}`
  return ev.ref && onOpen
    ? <Pressable as="div" hap="tick" scale={0.995} onClick={() => onOpen(ev.ref!)} className={`cursor-pointer ${cls}`}>{body}</Pressable>
    : <div className={cls}>{body}</div>
}

const EVENTS_SHOWN = 6

function EpisodeCard({ ep, open, onToggle, onOpen, cardRef }: { ep: Episode; open: boolean; onToggle: () => void; onOpen?: (ref: NonNullable<JourneyEvent['ref']>) => void; cardRef: (el: HTMLDivElement | null) => void }) {
  const [all, setAll] = useState(false)
  const mood = moodOf(ep.outcome?.tone)
  const bubble = ep.status === 'cancelled' ? 'bg-screen text-faint'
    : mood === 'better' ? 'bg-tint text-brand' : mood === 'partial' ? 'bg-amber-tint text-amber-text' : mood === 'worse' ? 'bg-danger/10 text-danger'
    : mood === 'same' ? 'bg-screen text-muted' : ep.status === 'current' ? 'bg-brand text-screen' : 'bg-screen text-faint'
  const range = ep.kind === 'course' ? `${short(ep.startDate)}${ep.endDate ? ` → ${short(ep.endDate)}` : ' →'}` : ''
  const shown = all ? ep.events : ep.events.slice(0, EVENTS_SHOWN)
  return (
    <div ref={cardRef}>
      <Card className={`overflow-hidden ${ep.status === 'cancelled' ? 'opacity-65' : ''}`}>
        <Pressable as="div" hap="tick" scale={0.995} onClick={onToggle} ariaLabel={`${ep.title}, ${open ? 'collapse' : 'expand'}`} className="flex cursor-pointer items-center gap-3 px-4 py-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${bubble}`}>
            {ep.kind === 'course' ? <Prescription size={20} weight="fill" /> : <Stethoscope size={20} weight="fill" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`truncate font-display text-[15px] font-semibold text-ink ${ep.status === 'cancelled' ? 'line-through' : ''}`}>{ep.title}</span>
              {ep.hiddenFromPatient && <Lock size={12} weight="fill" className="shrink-0 text-faint" aria-label="Hidden from the patient" />}
            </div>
            <div className="truncate text-[12px] text-muted">
              {ep.kind === 'course' ? `${range} · ${ep.duration}` : ep.subtitle}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {ep.status === 'cancelled' ? <Badge tone="danger">Cancelled</Badge>
              : ep.outcome ? <Badge tone={ep.outcome.tone}>{ep.outcome.label}</Badge>
              : ep.status === 'current' && ep.note ? <span className="text-[11.5px] font-semibold text-brand">{ep.note[0].toUpperCase() + ep.note.slice(1)}</span>
              : ep.kind === 'course' ? <span className="text-[11.5px] text-faint">No review yet</span> : null}
            <CaretDown size={13} weight="bold" className={`text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </div>
        </Pressable>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className="overflow-hidden">
              <div className="border-t border-border">
                {ep.kind === 'course' && <div className="bg-screen/70 px-4 py-2 text-[12px] text-muted">{ep.subtitle}{ep.hiddenFromPatient && <span className="ml-2 inline-flex items-center gap-1 font-medium text-faint"><Lock size={11} weight="fill" /> name hidden from patient</span>}</div>}
                {shown.length === 0 && <div className="px-4 py-3 text-[12.5px] text-muted">Nothing recorded yet for this remedy.</div>}
                {shown.map((ev, i) => <EventRow key={ev.id} ev={ev} first={i === 0 && ep.kind !== 'course'} onOpen={onOpen} />)}
                {!all && ep.events.length > EVENTS_SHOWN && (
                  <Pressable hap="tick" onClick={() => setAll(true)} className="w-full border-t border-border py-2.5 text-center text-[12.5px] font-semibold text-brand">Show {ep.events.length - EVENTS_SHOWN} more</Pressable>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}

const EPISODES_SHOWN = 4

export function EpisodeJourney({ episodes, onOpen }: { episodes: Episode[]; onOpen?: (ref: NonNullable<JourneyEvent['ref']>) => void }) {
  const first = episodes[0]?.id
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(first ? [first] : []))
  const [showAll, setShowAll] = useState(false)
  const cards = useRef(new Map<string, HTMLDivElement | null>())
  const pending = useRef<string | null>(null)

  // A new current remedy (just prescribed) opens by itself.
  useEffect(() => { if (first) setOpenIds((s) => (s.has(first) ? s : new Set(s).add(first))) }, [first])
  // After a dot is tapped the card opens first, then scrolls into view.
  useEffect(() => {
    if (!pending.current) return
    const el = cards.current.get(pending.current)
    pending.current = null
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })

  if (episodes.length === 0) {
    return <div className="py-12 text-center text-[13px] text-muted">Nothing here yet — visits, prescriptions and reviews will appear as they happen.</div>
  }
  const visible = showAll ? episodes : episodes.slice(0, EPISODES_SHOWN)
  const toggle = (id: string) => setOpenIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pick = (id: string) => {
    if (!showAll && episodes.findIndex((e) => e.id === id) >= EPISODES_SHOWN) setShowAll(true)
    setOpenIds((s) => new Set(s).add(id))
    pending.current = id
  }

  return (
    <div className="space-y-3">
      <Strip episodes={episodes} onPick={pick} />
      <div className="space-y-2.5">
        {visible.map((ep) => (
          <EpisodeCard key={ep.id} ep={ep} open={openIds.has(ep.id)} onToggle={() => toggle(ep.id)} onOpen={onOpen} cardRef={(el) => { cards.current.set(ep.id, el) }} />
        ))}
      </div>
      {!showAll && episodes.length > EPISODES_SHOWN && (
        <Pressable hap="tick" onClick={() => setShowAll(true)} className="mx-auto block rounded-pill border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-body">Show {episodes.length - EPISODES_SHOWN} earlier</Pressable>
      )}
    </div>
  )
}
