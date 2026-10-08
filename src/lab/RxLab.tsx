import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretLeft, Lock, LockOpen, Prescription as RxIcon, Warning, ChatCircleText, DeviceMobile, Receipt } from '@phosphor-icons/react'
import { Card, Chip, Stepper, Toggle, Label, Avatar, Badge } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { Phone } from './kit'

// Prescription editor v2 — built around one fact: many homeopaths do not tell
// the patient which remedy it is. So the editor keeps two things apart:
//   · the RECORD (remedy, potency, dose) — always real, only the doctor sees it,
//     and it drives reminders, restock and history;
//   · the SLIP — what the patient is given: printed, sent on WhatsApp, shown in
//     the patient app. With "Hide name" on, nothing on the slip says the remedy.
// The card at the top is a live preview of the slip (printed / app / message),
// so she can see exactly what the patient will see before she publishes.
const RX_GLYPH =
  'M 1.46875 0 L 1.46875 -14.625 L 6.9375 -14.625 C 9.90625 -14.625 11.390625 -13.414062 11.390625 -11 C 11.390625 -10.09375 11.132812 -9.269531 10.625 -8.53125 C 10.125 -7.789062 9.4375 -7.222656 8.5625 -6.828125 L 9.640625 -5.28125 L 10.796875 -6.84375 L 13.0625 -6.84375 L 10.71875 -3.734375 L 13.34375 0 L 10.15625 0 L 9.078125 -1.546875 L 7.921875 0 L 5.671875 0 L 7.984375 -3.09375 L 6 -5.984375 L 4.328125 -5.984375 L 4.328125 0 Z M 4.328125 -7.984375 L 5.03125 -7.984375 C 7.238281 -7.984375 8.34375 -8.875 8.34375 -10.65625 C 8.34375 -11.957031 7.359375 -12.609375 5.390625 -12.609375 L 4.328125 -12.609375 Z'

const REMEDIES = ['Sulphur', 'Nux Vomica', 'Arsenicum Album', 'Lycopodium', 'Natrum Mur', 'Pulsatilla', 'Phosphorus', 'Calcarea Carb']
const POTENCIES = ['6C', '30C', '200C', '1M', '10M']
const REPS = ['Once daily · night', 'Twice daily', 'Alternate day', 'Weekly', 'As needed', 'Once only today']
const LABELS = ['Pills No. 1', 'Bottle A', 'As discussed']
const STANDARD = '(1) Take 6 pills from the small bottle. Just once today. (2) Keep 15 minutes away from food, tea or coffee.'

type Preview = 'slip' | 'app' | 'msg'

export function RxLab() {
  const [remedy, setRemedy] = useState('Sulphur')
  const [potency, setPotency] = useState('200C')
  const [dose, setDose] = useState(4)
  const [duration, setDuration] = useState(14)
  const [rep, setRep] = useState('Once daily · night')
  const [hide, setHide] = useState(true)
  const [label, setLabel] = useState('Pills No. 1')
  const [extra, setExtra] = useState('')
  const [standard, setStandard] = useState(false)
  const [refill, setRefill] = useState(false)
  const [view, setView] = useState<Preview>('slip')
  const [published, setPublished] = useState(false)

  const oneOff = rep === 'Once only today'
  const ready = remedy.trim() !== ''
  const how = `${dose} globules, ${rep.toLowerCase()}${oneOff ? '' : `, ${duration} days`}`
  // What the patient is given. Hidden → never the name or potency.
  const slipHead = hide ? label.trim() : `${remedy} ${potency}`.trim()
  const slipLine = useMemo(() => [slipHead, how].filter(Boolean).join(' — '), [slipHead, how])
  const note = [extra.trim(), standard ? STANDARD : ''].filter(Boolean).join('\n')

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Prescription v2 — the slip is separate from the record" note="Flip 'Name on slip' and watch the preview. Switch the preview between slip, app and message." height={820}>
        <div className="h-full overflow-y-auto no-scrollbar">
          <div className="sticky top-0 z-20 bg-screen/95 px-[18px] pb-3 pt-[var(--app-top)] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Pressable ariaLabel="back" hap="tick" className="relative tap-pad-sm flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><CaretLeft size={18} className="text-body" /></Pressable>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[18px] font-bold leading-tight text-ink">Prescription</div>
                <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><Avatar initials="AR" size={16} /> Ananya Rao · 34 yrs</div>
              </div>
              <Badge tone="amber"><Warning size={11} weight="fill" /> Penicillin</Badge>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-label text-faint">
                {hide ? <Lock size={12} weight="fill" /> : <LockOpen size={12} />} What {`Ananya`} will see
              </div>
              <div className="inline-flex rounded-pill border border-border bg-surface p-0.5">
                {([['slip', 'Slip', Receipt], ['app', 'App', DeviceMobile], ['msg', 'Message', ChatCircleText]] as const).map(([id, text, Icon]) => (
                  <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-semibold transition ${view === id ? 'bg-brand text-screen' : 'text-muted'}`}><Icon size={12} />{text}</button>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {view === 'slip' && (
                    <Card className="border-green-border bg-tint-pale px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <svg viewBox="1 -15 13 15.4" width="24" height="29" className="mt-0.5 shrink-0 text-brand" aria-hidden="true"><path d={RX_GLYPH} fill="currentColor" /></svg>
                        <div className="min-w-0 flex-1 whitespace-pre-line text-[14px] leading-snug text-ink-deep">
                          {slipLine || <span className="text-faint">Write the instructions below</span>}
                          {note && <div className="mt-1.5 text-[12.5px] text-body">{note}</div>}
                        </div>
                      </div>
                    </Card>
                  )}
                  {view === 'app' && (
                    <Card className="px-4 py-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-label text-faint">Your medicine</div>
                      <div className="mt-1 font-display text-[18px] font-bold text-ink">{hide ? (label.trim() || 'Your prescription') : `${remedy} ${potency}`}</div>
                      <div className="mt-0.5 text-[13px] text-muted">{how}</div>
                      <div className="mt-2 text-[12px] text-faint">Reminder: {rep === 'Twice daily' ? '8:00 AM and 8:00 PM' : '8:00 PM'} — “Time for {hide ? (label.trim() || 'your medicine') : remedy}”</div>
                    </Card>
                  )}
                  {view === 'msg' && (
                    <div className="rounded-[16px] rounded-tl-[3px] bg-[#d9f4d4] px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                      Prescription from Dr. Neha Kulkarni for Ananya Rao:<br />{slipLine || '—'}{note ? <><br />{note}</> : null}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-3 px-[18px] pb-[150px] pt-1">
            <Card className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <Label>Remedy</Label>
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-muted"><Lock size={11} weight="fill" /> Only you see this{hide ? '' : ' (name is currently shown)'}</span>
              </div>
              <div className="mt-2 rounded-[12px] border border-border bg-screen px-3.5 py-2.5 text-[14px] text-ink">{remedy}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {REMEDIES.map((r) => <Chip key={r} selected={remedy === r} onClick={() => setRemedy(r)}>{r}</Chip>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{POTENCIES.map((p) => <Chip key={p} selected={potency === p} onClick={() => setPotency(p)}>{p}</Chip>)}</div>
            </Card>

            <Card className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-[15px] font-semibold text-ink">Name on the slip</div>
                  <div className="text-[12px] text-muted">{hide ? 'The patient is not told the remedy.' : 'The remedy and potency are written on the slip.'}</div>
                </div>
                <div className="inline-flex shrink-0 rounded-pill bg-screen p-1">
                  {([[false, 'Show'], [true, 'Hide']] as const).map(([v, text]) => (
                    <button key={text} onClick={() => setHide(v)} className={`rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition ${hide === v ? 'bg-brand text-screen shadow-sm' : 'text-muted'}`}>{text}</button>
                  ))}
                </div>
              </div>
              {hide && (
                <div className="mt-3 border-t border-border pt-3">
                  <Label>Written on the slip as</Label>
                  <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-border bg-screen px-3.5 py-2.5 text-[14px]">
                    <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pills No. 1 — or leave blank" className="w-full bg-transparent text-ink outline-none placeholder:text-faint" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LABELS.map((l) => <Chip key={l} selected={label === l} onClick={() => setLabel(l)}>{l}</Chip>)}
                    <Chip selected={label === ''} onClick={() => setLabel('')}>Instructions only</Chip>
                  </div>
                  <div className="mt-2.5 text-[12px] leading-snug text-muted">Reminders, the patient app and the message use this too. Your own screens always show the real remedy.</div>
                </div>
              )}
            </Card>

            <Card className="space-y-3 px-4 py-3.5">
              <div className="flex items-center justify-between"><Label>Dose</Label><Stepper value={dose} min={1} max={30} onChange={setDose} suffix="globules" /></div>
              {!oneOff && <div className="flex items-center justify-between"><Label>Duration</Label><Stepper value={duration} min={1} max={365} onChange={setDuration} suffix="days" /></div>}
              <div>
                <Label>How often</Label>
                <div className="mt-2 flex flex-wrap gap-2">{REPS.map((r) => <Chip key={r} selected={rep === r} onClick={() => setRep(r)}>{r}</Chip>)}</div>
              </div>
            </Card>

            <Card className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div><div className="font-display text-[15px] font-semibold text-ink">Instructions</div><div className="text-[12px] text-muted">Added under the line, in your words</div></div>
                <Chip selected={standard} onClick={() => setStandard((v) => !v)}>Standard</Chip>
              </div>
              <div className="mt-2.5 rounded-[12px] border border-border bg-screen px-3.5 py-2.5 text-[13px] leading-relaxed">
                <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. Take at night, away from food" className="w-full bg-transparent text-body outline-none placeholder:text-faint" />
              </div>
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
          {ready && hide && <div className="mt-1.5 flex items-center justify-center gap-1 text-[11.5px] text-muted"><Lock size={11} weight="fill" /> Remedy name stays with you</div>}
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

      <div className="max-w-[350px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">The record and the slip are two things</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">The remedy is always recorded</span> — privately — because reminders, restock calls and her own history need it.</li>
          <li><span className="font-semibold text-ink">"Name on the slip: Hide"</span> stops anything the patient receives from naming it: the printed slip, the WhatsApp/e-mail text, the patient app (home, prescriptions, check-in, history), the notification and the daily reminder.</li>
          <li><span className="font-semibold text-ink">"Written on the slip as"</span> — she chooses the wording: "Pills No. 1", "Bottle A", her own code, or blank for instructions only. It remembers the last choice on this phone.</li>
          <li><span className="font-semibold text-ink">The preview is the slip</span> — switch to App or Message to see the other places the patient meets it. Nothing on this page contradicts what is hidden.</li>
          <li><span className="font-semibold text-ink">Her screens always show the real name</span>, with a small lock note: "Hidden from Ananya".</li>
          <li>The allergy chip sits in the header, so a clash is noticed before she publishes. The tab bar steps aside and Publish stays reachable.</li>
        </ul>
        <p className="mt-4 text-[12.5px] text-muted">One decision for her: should "Hide" start switched on (the usual case at her clinic?) or off? The app would remember the last choice either way.</p>
      </div>
    </div>
  )
}
