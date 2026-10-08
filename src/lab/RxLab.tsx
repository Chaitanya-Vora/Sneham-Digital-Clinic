import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretLeft, Prescription as RxIcon } from '@phosphor-icons/react'
import { Card, Chip, Stepper, Toggle, Label, Avatar } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { Phone } from './kit'

// The prescription editor with a live "script" at the top that fills in as she
// chooses, and the publish bar always in reach. The tab bar steps aside while
// she is writing. The ℞ is the same sign the printed prescription uses.
const RX_GLYPH =
  'M 1.46875 0 L 1.46875 -14.625 L 6.9375 -14.625 C 9.90625 -14.625 11.390625 -13.414062 11.390625 -11 C 11.390625 -10.09375 11.132812 -9.269531 10.625 -8.53125 C 10.125 -7.789062 9.4375 -7.222656 8.5625 -6.828125 L 9.640625 -5.28125 L 10.796875 -6.84375 L 13.0625 -6.84375 L 10.71875 -3.734375 L 13.34375 0 L 10.15625 0 L 9.078125 -1.546875 L 7.921875 0 L 5.671875 0 L 7.984375 -3.09375 L 6 -5.984375 L 4.328125 -5.984375 L 4.328125 0 Z M 4.328125 -7.984375 L 5.03125 -7.984375 C 7.238281 -7.984375 8.34375 -8.875 8.34375 -10.65625 C 8.34375 -11.957031 7.359375 -12.609375 5.390625 -12.609375 L 4.328125 -12.609375 Z'

const REMEDIES = ['Sulphur', 'Nux Vomica', 'Arsenicum Album', 'Lycopodium', 'Natrum Mur', 'Pulsatilla', 'Phosphorus', 'Calcarea Carb']
const POTENCIES = ['6C', '12C', '30C', '200C', '1M', '10M']
const REPS = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed', 'Once only today']

export function RxLab() {
  const [remedy, setRemedy] = useState('Sulphur')
  const [potency, setPotency] = useState('200C')
  const [dose, setDose] = useState(4)
  const [duration, setDuration] = useState(14)
  const [rep, setRep] = useState('Once daily · night')
  const [standard, setStandard] = useState(true)
  const [refill, setRefill] = useState(false)
  const [published, setPublished] = useState(false)
  const ready = remedy.trim() !== ''
  const oneOff = rep === 'Once only today'

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Live script" note="Change anything — the script at the top follows. Publish stays at the bottom." height={820}>
        <div className="h-full overflow-y-auto no-scrollbar">
          <div className="sticky top-0 z-20 bg-screen/95 px-[18px] pb-3 pt-[var(--app-top)] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Pressable ariaLabel="back" hap="tick" className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><CaretLeft size={18} className="text-body" /></Pressable>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[18px] font-bold leading-tight text-ink">Prescription</div>
                <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><Avatar initials="AR" size={16} /> Ananya Rao · 34 yrs · #WS-1042</div>
              </div>
            </div>
            <Card className="mt-3 flex items-center gap-3.5 border-green-border bg-tint-pale px-4 py-3.5">
              <svg viewBox="1 -15 13 15.4" width="26" height="31" className="shrink-0 text-brand" aria-hidden="true"><path d={RX_GLYPH} fill="currentColor" /></svg>
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={remedy || 'none'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className={`font-display font-bold leading-tight ${remedy ? 'text-[20px] text-ink-deep' : 'text-[17px] text-faint'}`}>
                    {remedy || 'Choose a remedy'}
                  </motion.div>
                </AnimatePresence>
                <div className="mt-0.5 text-[13px] text-body">{potency} · {dose} globules · {rep}{oneOff ? '' : ` · ${duration} days`}</div>
              </div>
            </Card>
          </div>

          <div className="space-y-3 px-[18px] pb-[150px] pt-1">
            <Card className="px-4 py-3.5">
              <Label>Remedy</Label>
              <div className="mt-2 rounded-[12px] border border-border bg-screen px-3.5 py-2.5 text-[14px] text-faint">Type or pick a remedy</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {REMEDIES.map((r) => <Chip key={r} selected={remedy === r} onClick={() => setRemedy(r)}>{r}</Chip>)}
                <span className="rounded-pill border border-dashed border-border-dash px-3.5 py-2 text-[13px] font-medium text-faint">+23 more</span>
              </div>
            </Card>
            <Card className="px-4 py-3.5">
              <Label>Potency</Label>
              <div className="mt-2.5 flex flex-wrap gap-2">{POTENCIES.map((p) => <Chip key={p} selected={potency === p} onClick={() => setPotency(p)}>{p}</Chip>)}</div>
            </Card>
            <Card className="space-y-3 px-4 py-3.5">
              <div className="flex items-center justify-between"><Label>Dose</Label><Stepper value={dose} min={1} max={30} onChange={setDose} suffix="globules" /></div>
              {!oneOff && <div className="flex items-center justify-between"><Label>Duration</Label><Stepper value={duration} min={1} max={365} onChange={setDuration} suffix="days" /></div>}
            </Card>
            <Card className="px-4 py-3.5">
              <Label>How often</Label>
              <div className="mt-2.5 flex flex-wrap gap-2">{REPS.map((r) => <Chip key={r} selected={rep === r} onClick={() => setRep(r)}>{r}</Chip>)}</div>
            </Card>
            <Card className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div><div className="font-display text-[15px] font-semibold text-ink">Standard instructions</div><div className="text-[12px] text-muted">Printed under the remedy</div></div>
                <Toggle on={standard} onChange={setStandard} label="Standard instructions" />
              </div>
              {standard && (
                <div className="mt-3 rounded-[12px] bg-screen px-3.5 py-2.5 text-[12.5px] leading-relaxed text-body">
                  (1) Take 6 pills from small bottle <span className="font-semibold text-[#C23A66]">SU 1M</span>. Just once today… <span className="font-semibold text-brand">Edit</span>
                </div>
              )}
            </Card>
            <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div><div className="font-display text-[15px] font-semibold text-ink">Remind me about a refill</div><div className="text-[12px] text-muted">Shows on Today from day 21</div></div>
              <Toggle on={refill} onChange={setRefill} label="Refill reminder" />
            </Card>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 px-[18px] pt-3 backdrop-blur-xl" style={{ paddingBottom: 'var(--app-bottom)' }}>
          <Pressable hap="success" onClick={() => ready && setPublished(true)} className={`flex w-full items-center justify-center gap-2 rounded-pill py-3.5 font-display text-[15px] font-semibold text-screen shadow-cta transition ${ready ? 'bg-brand' : 'bg-brand/40'}`}>
            <RxIcon size={18} weight="fill" /> {ready ? 'Publish and share' : 'Choose a remedy to continue'}
          </Pressable>
        </div>
        <AnimatePresence>
          {published && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] flex items-center justify-center bg-ink/25 px-8 backdrop-blur-[2px]" onClick={() => setPublished(false)}>
              <div className="rounded-[24px] border border-border bg-surface p-6 text-center shadow-modal">
                <div className="font-display text-[17px] font-bold text-ink">Published</div>
                <div className="mt-1 text-[13px] text-muted">(demo — nothing was sent)</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Phone>
      <div className="max-w-[330px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">Why this shape</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">The script writes itself.</span> What she picks appears at once in the card at the top, in the same ℞ form as the printed slip, so she never has to scroll to check.</li>
          <li><span className="font-semibold text-ink">Publish never leaves the screen,</span> and says what is missing instead of going quiet.</li>
          <li><span className="font-semibold text-ink">Cards, not one long form.</span> Remedy, potency, amount, timing, instructions — each its own card, same look as the rest of the app.</li>
          <li><span className="font-semibold text-ink">Instructions are one switch.</span> She uses the standard text almost every time; it's on, shown in one line, editable. (If you'd rather it started off, it's a one-word change.)</li>
          <li>The tab bar steps aside while she's writing; the age reads "34 yrs".</li>
        </ul>
      </div>
    </div>
  )
}
