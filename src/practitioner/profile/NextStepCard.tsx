import type { ReactNode } from 'react'
import { CalendarCheck, CalendarPlus, Stethoscope, Prescription } from '@phosphor-icons/react'
import { Card } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'

// One card that answers "what now?" for this patient. It replaces the old
// floating "Schedule follow-up" bar and the separate "Next appointment" card:
// the state of the next visit is on screen, and the one button that moves it
// forward sits right on it.
export type NextStepView =
  | { kind: 'inConsult'; detail: string; onContinue: () => void }
  | { kind: 'today'; title: string; detail: string; onStart: () => void }
  | { kind: 'booked'; title: string; detail: string }
  | { kind: 'needs'; urgent: boolean; detail: string; onBook: () => void }
  | { kind: 'noRx'; onPrescribe: () => void }

function Tile({ tone, children }: { tone: 'brand' | 'tint' | 'amber'; children: ReactNode }) {
  const cls = tone === 'brand' ? 'bg-brand text-screen' : tone === 'amber' ? 'bg-white/60 text-amber-text' : 'bg-tint text-brand'
  return <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${cls}`}>{children}</div>
}
const Cta = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <Pressable hap="impact" onClick={onClick} className="min-h-[44px] shrink-0 rounded-pill bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-screen shadow-float">{children}</Pressable>
)
const Eyebrow = ({ children }: { children: ReactNode }) => <div className="text-[11px] font-semibold uppercase tracking-label text-faint">{children}</div>

export function NextStepCard({ step }: { step: NextStepView }) {
  if (step.kind === 'needs' && step.urgent) {
    return (
      <div className="relative z-10 -mt-6 flex items-center gap-3.5 rounded-[22px] border border-amber-border bg-amber-tint px-4 py-3.5 shadow-card-lg">
        <Tile tone="amber"><CalendarPlus size={24} weight="fill" /></Tile>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-label text-amber-text/70">Next step</div>
          <div className="font-display text-[15px] font-semibold leading-snug text-amber-text">No follow-up booked</div>
          <div className="text-[12.5px] text-amber-text/85">{step.detail[0].toUpperCase() + step.detail.slice(1)}</div>
        </div>
        <Cta onClick={step.onBook}>Book</Cta>
      </div>
    )
  }
  return (
    <Card className="relative z-10 -mt-6 flex items-center gap-3.5 !rounded-[22px] px-4 py-3.5 shadow-card-lg">
      {step.kind === 'inConsult' && (<>
        <Tile tone="brand"><Stethoscope size={24} weight="fill" /></Tile>
        <div className="min-w-0 flex-1"><Eyebrow>Next step</Eyebrow><div className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-ink"><span className="h-2 w-2 animate-breathe rounded-full bg-brand" />In consult</div><div className="text-[12.5px] text-muted">{step.detail}</div></div>
        <Cta onClick={step.onContinue}>Continue</Cta>
      </>)}
      {step.kind === 'today' && (<>
        <Tile tone="brand"><Stethoscope size={24} weight="fill" /></Tile>
        <div className="min-w-0 flex-1"><Eyebrow>Next step</Eyebrow><div className="font-display text-[15px] font-semibold text-ink">{step.title}</div><div className="truncate text-[12.5px] text-muted">{step.detail}</div></div>
        <Cta onClick={step.onStart}>Start</Cta>
      </>)}
      {step.kind === 'booked' && (<>
        <Tile tone="tint"><CalendarCheck size={24} weight="fill" /></Tile>
        <div className="min-w-0 flex-1"><Eyebrow>Next visit</Eyebrow><div className="font-display text-[15px] font-semibold text-ink">{step.title}</div><div className="truncate text-[12.5px] text-muted">{step.detail}</div></div>
      </>)}
      {step.kind === 'needs' && (<>
        <Tile tone="tint"><CalendarPlus size={24} weight="fill" /></Tile>
        <div className="min-w-0 flex-1"><Eyebrow>Next step</Eyebrow><div className="font-display text-[15px] font-semibold text-ink">Follow-up not booked</div><div className="truncate text-[12.5px] text-muted">{step.detail[0].toUpperCase() + step.detail.slice(1)}</div></div>
        <Cta onClick={step.onBook}>Book</Cta>
      </>)}
      {step.kind === 'noRx' && (<>
        <Tile tone="tint"><Prescription size={24} weight="fill" /></Tile>
        <div className="min-w-0 flex-1"><Eyebrow>Next step</Eyebrow><div className="font-display text-[15px] font-semibold text-ink">No prescription yet</div><div className="text-[12.5px] text-muted">Nothing prescribed for this patient.</div></div>
        <Cta onClick={step.onPrescribe}>Prescribe</Cta>
      </>)}
    </Card>
  )
}
