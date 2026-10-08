import { useCallback, useState } from 'react'
import { CaretLeft, DotsThreeVertical, CalendarCheck, CalendarPlus, NotePencil, Prescription as RxIcon, ClipboardText, TestTube, CurrencyInr, CaretRight, UsersThree } from '@phosphor-icons/react'
import { Card, Avatar, Badge, Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { FollowUpSheet } from '../practitioner/FollowUpSheet'
import { Phone, FrameToast, addDays, dayLabel, type FrameToastData } from './kit'

// The patient profile as a cockpit. The two things that are easy to confuse —
// booking the NEXT visit and recording how THIS follow-up went — get plain,
// different names, and the state of the next visit is shown, not hidden behind
// a floating bar. Everything she can do is six equal tiles, with Prescribe
// as the one filled tile.
export function ProfileLab() {
  const [next, setNext] = useState<{ label: string; days: number } | null>(null)
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState<FrameToastData | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const tiles = [
    { label: 'Prescribe', icon: RxIcon, primary: true },
    { label: 'Case sheet', icon: NotePencil },
    { label: 'Record visit', icon: ClipboardText },
    { label: 'Book follow-up', icon: CalendarPlus, onClick: () => setSheet(true) },
    { label: 'Order tests', icon: TestTube },
    { label: 'Bill', icon: CurrencyInr },
  ]

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Patient cockpit" note="Tap 'Book follow-up' (or Book on the amber card) — the status line updates." height={820}>
        <div className="h-full overflow-y-auto px-[18px] pb-8 pt-[var(--app-top)] no-scrollbar">
          <div className="flex items-center justify-between">
            <Pressable ariaLabel="back" hap="tick" className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><CaretLeft size={18} className="text-body" /></Pressable>
            <Pressable ariaLabel="more" hap="tick" className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><DotsThreeVertical size={18} weight="bold" className="text-body" /></Pressable>
          </div>

          <div className="mt-4 flex items-center gap-3.5">
            <Avatar initials="AR" size={60} />
            <div className="min-w-0">
              <div className="font-display text-[22px] font-bold leading-tight text-ink">Ananya Rao</div>
              <div className="text-[13px] text-muted">34 yrs · Female · Chiplun</div>
              <div className="text-[12px] text-faint">#WS-1042</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="green">Sulphur 200C</Badge>
            <span className="text-[12px] text-muted">Last seen today</span>
          </div>

          {next ? (
            <Card className="mt-4 flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-tint text-brand"><CalendarCheck size={22} weight="fill" /></div>
              <div className="min-w-0 flex-1">
                <Label>Next visit</Label>
                <div className="font-display text-[15px] font-semibold text-ink">{next.label} · 9:00 AM</div>
                <div className="text-[12px] text-muted">in {next.days} days</div>
              </div>
              <CaretRight size={16} className="text-faint" />
            </Card>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-amber-border bg-amber-tint px-4 py-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/60 text-amber-text"><CalendarPlus size={22} weight="fill" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[14.5px] font-semibold text-amber-text">No follow-up booked</div>
                <div className="text-[12px] text-amber-text/80">Course ended 6 days ago</div>
              </div>
              <Pressable hap="tick" onClick={() => setSheet(true)} className="rounded-pill bg-brand px-4 py-2 text-[13px] font-semibold text-screen">Book</Pressable>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {tiles.map((t) => (
              <Pressable
                key={t.label}
                as="div"
                hap="tick"
                scale={0.96}
                onClick={t.onClick}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border px-1.5 py-3.5 shadow-card ${t.primary ? 'border-brand bg-brand' : 'border-border bg-surface'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-[13px] ${t.primary ? 'bg-white/15 text-screen' : 'bg-tint text-brand'}`}><t.icon size={21} weight={t.primary ? 'fill' : 'regular'} /></div>
                <div className={`text-center text-[12.5px] font-semibold leading-tight ${t.primary ? 'text-screen' : 'text-ink'}`}>{t.label}</div>
              </Pressable>
            ))}
          </div>

          <div className="mt-5 flex gap-5 border-b border-border text-[14px] font-semibold">
            <span className="border-b-2 border-brand pb-2 text-ink">Overview</span>
            <span className="pb-2 text-faint">History</span>
            <span className="pb-2 text-faint">Prescriptions</span>
          </div>
          <Card className="mt-4 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><UsersThree size={20} weight="fill" /></div>
              <div><div className="font-display text-[15px] font-semibold text-ink">Care team</div><div className="text-[12.5px] text-muted">Primary doctor: You</div></div>
            </div>
          </Card>
          <Card className="mt-3 px-4 py-3.5">
            <Label>Chief complaint</Label>
            <div className="mt-1 text-[14px] text-ink">Recurrent migraine with nausea, worse in sunlight</div>
          </Card>
        </div>
        <FrameToast toast={toast} onClose={closeToast} />
        <FollowUpSheet
          open={sheet}
          patientName="Ananya Rao"
          onClose={() => setSheet(false)}
          onSelect={(preset) => {
            const days = Number(preset.match(/\d+/)?.[0] ?? 0)
            setSheet(false)
            if (!days) return
            const prev = next
            const label = dayLabel(addDays(days))
            setNext({ label, days })
            setToast({ id: Date.now(), title: `Booked · ${label}`, message: 'Ananya Rao · 9:00 AM', undo: () => setNext(prev) })
          }}
        />
      </Phone>
      <div className="max-w-[330px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">Why this shape</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">Two follow-up actions, two plain names.</span> "Book follow-up" sets the next visit; "Record visit" is the review of how this one went.</li>
          <li><span className="font-semibold text-ink">The state is on screen.</span> A green "Next visit" card, or an amber "No follow-up booked" with a Book button — so the floating bar (which covered content) is gone.</li>
          <li><span className="font-semibold text-ink">Six tiles, one filled.</span> Prescribe is the one thing she does most from here; the rest are equal, labelled and 90 px wide — easy thumb targets.</li>
          <li>Amber is the app's own "needs attention" colour (the same as the web console's restock card).</li>
        </ul>
      </div>
    </div>
  )
}
