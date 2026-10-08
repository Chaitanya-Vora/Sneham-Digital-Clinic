import { useState } from 'react'
import { DotsThree, CaretLeft } from '@phosphor-icons/react'
import { Card } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { Section } from './kit'
import { FollowUpsLab } from './FollowUpsLab'
import { CalendarLab } from './CalendarLab'
import { ConfirmsLab } from './ConfirmsLab'
import { ProfileLab } from './ProfileLab'
import { RxLab } from './RxLab'
import { DashboardLab } from './DashboardLab'
import { SignUpLab } from './SignUpLab'

// Measured on the real phone screens in the preview (everything on screen a
// thumb can tap, counting the invisible tap-padding the app already adds).
const AUDIT: { screen: string; total: number; small: number; worst: string }[] = [
  { screen: 'Today', total: 19, small: 9, worst: 'grid drag handle 29×29 · Start 50×41 · Mine / Everyone 42 high' },
  { screen: 'Schedule', total: 31, small: 10, worst: 'Edit link 27×33 · doctor chips 33 high · two 40×40 buttons' },
  { screen: 'Follow-ups', total: 17, small: 1, worst: 'avatar button 38×38' },
  { screen: 'Rx', total: 18, small: 2, worst: 'avatar 38×38 · search box 36 high' },
  { screen: 'Inbox', total: 10, small: 3, worst: 'Chats / Alerts 42 high · avatar 38×38' },
]

function TapLab() {
  const [zones, setZones] = useState(true)
  const demo = (label: string, size: number, pad: boolean, icon: React.ReactNode) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-[60px] w-[60px] items-center justify-center">
        {zones && <div className="pointer-events-none absolute rounded-[10px] border border-dashed border-brand bg-brand/10" style={{ width: pad ? 44 : size, height: pad ? 44 : size }} />}
        <Pressable ariaLabel={label} hap="tick" className={`relative flex items-center justify-center rounded-full border border-border bg-surface text-body ${pad ? 'tap-pad' : ''}`}>
          <span className="flex items-center justify-center" style={{ width: size, height: size }}>{icon}</span>
        </Pressable>
      </div>
      <div className="max-w-[130px] text-center text-[12px] text-muted">{label}</div>
    </div>
  )
  return (
    <div className="flex flex-wrap items-start gap-10">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-6">
          <div className="font-display text-[15px] font-semibold text-ink">What a thumb can hit</div>
          <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={zones} onChange={(e) => setZones(e.target.checked)} /> show hit areas</label>
        </div>
        <div className="flex gap-8">
          {demo('Today: 32 px, hit area 32 px', 32, false, <CaretLeft size={16} />)}
          {demo('Fix: same 32 px look, hit area 44 px', 32, true, <CaretLeft size={16} />)}
          {demo('⋯ menu replacing Edit and Cancel links', 32, true, <DotsThree size={20} weight="bold" />)}
        </div>
        <p className="mt-4 max-w-[430px] text-[12.5px] leading-relaxed text-muted">The app already has the tool for this (<code>tap-pad</code>: an invisible ring around a control). It's applied to some buttons and not others — the fix is applying it everywhere, so nothing looks different and everything is easier to hit.</p>
      </Card>
      <Card className="p-6">
        <div className="mb-3 font-display text-[15px] font-semibold text-ink">Text floor</div>
        <table className="text-[13px]">
          <tbody>
            {[
              ['9 px', '4 uses', 'Retire'],
              ['10 px', '13 uses', 'Raise to 11'],
              ['11 px', '82 uses', 'Capital-letter labels only; anything read becomes 12'],
              ['12 px+', '—', 'Smallest size for content'],
            ].map(([a, b, c]) => (
              <tr key={a} className="border-t border-border first:border-0"><td className="py-1.5 pr-4 font-display font-semibold text-ink">{a}</td><td className="py-1.5 pr-4 text-faint">{b}</td><td className="py-1.5 text-body">{c}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-6">
        <div className="mb-1 font-display text-[15px] font-semibold text-ink">Measured on the real screens</div>
        <div className="mb-3 text-[12.5px] text-muted">25 of 95 tappable things are under 44 px — most by only 2–6 px.</div>
        <table className="text-[13px]">
          <tbody>
            {AUDIT.map((a, i) => (
              <tr key={a.screen} className={i ? 'border-t border-border' : ''}>
                <td className="py-1.5 pr-4 font-display font-semibold text-ink">{a.screen}</td>
                <td className="py-1.5 pr-4 text-faint">{a.small} of {a.total}</td>
                <td className="py-1.5 text-body">{a.worst}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 max-w-[460px] text-[12.5px] leading-relaxed text-muted">So this is a small, targeted pass on the few controls that really are small (Edit / Cancel links, the drag handle, the doctor chips) — not a sweep of 19 files, which is what a code search suggested.</p>
      </Card>
    </div>
  )
}

const NAV = [
  ['p1', '1 Follow-ups'], ['p2', '2 Calendar'], ['p3', '3 Confirmations'], ['p4', '4 Profile'],
  ['p5', '5 Tap targets'], ['p6', '6 Prescription'], ['p7', '7 Dashboard'], ['p8', '8 Sign-up'],
]

export function DesignLab() {
  return (
    <div className="min-h-screen bg-canvas px-10 pb-24 pt-10 font-body text-ink">
      <div className="mx-auto max-w-[1280px]">
        <div className="text-[12px] font-semibold uppercase tracking-label text-faint">Sneham · design lab (not part of the app)</div>
        <h1 className="mt-1 font-display text-[34px] font-bold text-ink">Eight screens, redesigned from how she works</h1>
        <div className="mt-4 grid max-w-[1000px] grid-cols-2 gap-x-10 gap-y-2 text-[14.5px] leading-relaxed text-body">
          <p><span className="font-semibold text-ink">One decision per card.</span> Actions sit where the eyes already are, so she doesn't open a sheet to do a one-tap thing.</p>
          <p><span className="font-semibold text-ink">Show the state, don't hide it.</span> "No follow-up booked", "Rx half-built" are on the screen, not behind buttons.</p>
          <p><span className="font-semibold text-ink">Undo beats asking.</span> Reversible things happen at once; only things that change someone's day ask first.</p>
          <p><span className="font-semibold text-ink">Calm and native.</span> Everything here is built from the app's own cards, chips, steppers, sheets and toast — same fonts, shadows, terracotta and amber. Every prototype is live: tap it.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-body shadow-card hover:border-green-border hover:text-brand">{label}</a>
          ))}
        </div>

        <div className="mt-10 space-y-16">
          <Section id="p1" n={1} title="Follow-ups tab" problem="It lists all 32 patients on a remedy, not who is due. The six with no booked visit are marked in red 'Last seen Today', every row says 'Compare →', and there is no way to book from the list." need="To see who is actually due (from the course she prescribed), book the next visit in one tap, and watch the list get shorter."><FollowUpsLab /></Section>
          <Section id="p2" n={2} title="Calendar tab" problem="The header takes about 45% of the screen; each appointment is a 95 px card with an 'Upcoming' pill, and cancelled ones look like the rest. Edit and Cancel are tiny text links side by side." need="Today's list and the week around it, with room for five or six appointments, and actions that can't be hit by accident."><CalendarLab /></Section>
          <Section id="p3" n={3} title="Confirmation pop-ups" problem="Nine browser pop-ups (web console, and 'Archive patient' on the phone) that look foreign and treat a reversible archive like a risky removal." need="Reversible things to just happen with an Undo; only the ones that change someone else's day to ask — in the app's own style."><ConfirmsLab /></Section>
          <Section id="p4" n={4} title="Patient profile (phone)" problem="Five equal buttons plus a floating 'Schedule follow-up' bar that covers content. 'Follow-up' and 'Schedule follow-up' sound alike and do different things." need="One obvious main action, the rest easy to find, and the state of the next visit visible."><ProfileLab /></Section>
          <Section id="p5" n={5} title="Small tap targets and tiny text" problem="On the five phone tabs, 25 of 95 tappable things are under 44 px (a few badly: an Edit link 27 px wide, a 29 px drag handle); and about 99 uses of 11 px text or smaller." need="Controls easy to hit one-handed between patients, and text she can read without squinting — without making the app look heavier."><TapLab /></Section>
          <Section id="p6" n={6} title="Prescription editor (phone)" problem="Publish is two or three screens down; the tab bar stays; the long form gives no sense of what she's building; two similar text boxes; age shows as a bare number." need="To see the prescription forming as she chooses, and to be able to publish from anywhere."><RxLab /></Section>
          <Section id="p7" n={7} title="Web dashboard" problem="One narrow schedule card with the lower half empty; an 'Avg consult value ₹800 · no consults yet' tile that contradicts itself; a bare X that cancels." need="A morning overview: today's schedule, and what is waiting on her."><DashboardLab /></Section>
          <Section id="p8" n={8} title="Patient sign-up" problem="Sex is pre-selected as Female; an empty City is silently saved as 'Mumbai'; the Continue button is dead without saying why." need="Records that only contain what the patient actually said."><SignUpLab /></Section>
        </div>
      </div>
    </div>
  )
}
