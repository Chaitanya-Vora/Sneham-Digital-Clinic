import type { ReactNode } from 'react'
import { CaretLeft, DotsThreeVertical, Phone } from '@phosphor-icons/react'
import { CourseRing } from '../../design-system/CourseRing'
import { Pressable } from '../../design-system/Pressable'
import { TickNumber } from '../../design-system/feedback'
import { WhatsAppIcon } from '../../design-system/BrandIcons'
import type { CourseStatus } from '../../core/course'

// The top of a patient's profile: who she is, and where she is in treatment.
// Deep green like the chat header (the app's other full-bleed header), with a
// ring around the avatar that shows the course of medicine she is on.
export interface ProfileHeroProps {
  name: string
  initials: string
  meta: string          // "34 yrs · Female · Chiplun"
  idLabel: string       // "Patient ID 1042"
  phone?: string
  course: CourseStatus
  visits: number
  lastSeen: string
  adherence: number | null // % of doses logged this cycle, or null when there are none
  onBack: () => void
  onMore: () => void
  onCall?: () => void
  onWhatsApp?: () => void
}

export function ringOf(course: CourseStatus): { progress: number | null; ended: boolean; caption: string | null } {
  if (course.state === 'none') return { progress: null, ended: false, caption: null }
  if (course.state === 'open') return { progress: null, ended: false, caption: 'Until settled' }
  const done = course.state === 'ended' ? 1 : (course.dayNumber ?? 1) / (course.durationDays ?? 1)
  return { progress: done, ended: course.state === 'ended', caption: course.state === 'ended' ? 'Course ended' : `Day ${course.dayNumber} of ${course.durationDays}` }
}

function RoundBtn({ label, onClick, children, className = '' }: { label: string; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <Pressable ariaLabel={label} hap="tick" onClick={onClick} className={`relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full ${className}`}>
      {children}
    </Pressable>
  )
}

export function ProfileHero(p: ProfileHeroProps) {
  const ring = ringOf(p.course)
  return (
    <div className="relative overflow-hidden rounded-b-[32px] bg-brand px-[18px] pb-9 pt-[var(--app-top)] text-screen">
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full border border-dashed border-white/15" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full border border-dashed border-white/10" />

      <div className="relative flex items-center justify-between">
        <RoundBtn label="back" onClick={p.onBack} className="bg-white/15 text-screen"><CaretLeft size={18} weight="bold" /></RoundBtn>
        <RoundBtn label="more actions" onClick={p.onMore} className="bg-white/15 text-screen"><DotsThreeVertical size={18} weight="bold" /></RoundBtn>
      </div>

      <div className="relative mt-4 flex items-center gap-4">
        <div className="relative">
          <CourseRing size={96} progress={ring.progress} ended={ring.ended}>
            <div className="flex h-full w-full items-center justify-center bg-screen font-display text-[28px] font-bold text-ink-deep">{p.initials}</div>
          </CourseRing>
          {ring.caption && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-screen px-2.5 py-[3px] text-[11px] font-semibold text-brand shadow-card">{ring.caption}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[24px] font-bold leading-tight">{p.name}</div>
          <div className="truncate text-[13px] text-white/80">{p.meta}</div>
          <div className="text-[12px] text-white/60">{p.idLabel}</div>
          {p.phone && (
            <div className="mt-2 flex items-center gap-2">
              <RoundBtn label="call" onClick={p.onCall} className="bg-white/15 text-screen"><Phone size={16} weight="fill" /></RoundBtn>
              <RoundBtn label="message on whatsapp" onClick={p.onWhatsApp} className="bg-[#25D366]"><WhatsAppIcon size={18} color="#fff" /></RoundBtn>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-[1fr_1.3fr_1fr] gap-2">
        <Stat label="Visits" value={<TickNumber value={p.visits} />} />
        <Stat label="Last seen" value={p.lastSeen} small />
        <Stat label="Doses taken" value={p.adherence === null ? '—' : <><TickNumber value={p.adherence} />%</>} />
      </div>
    </div>
  )
}

function Stat({ label, value, small = false }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div className="rounded-[16px] bg-white/10 px-3 py-2.5">
      <div className={`truncate font-display font-bold leading-tight ${small ? 'text-[16px] pt-0.5' : 'text-[20px]'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-label text-white/60">{label}</div>
    </div>
  )
}
