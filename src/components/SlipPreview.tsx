import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatCircleText, DeviceMobile, Lock, LockOpen, Receipt } from '@phosphor-icons/react'
import { Card } from '../design-system/ui'
import { RxGlyph } from './RxGlyph'
import { boxContent, doseSummary, isHidden, remedyForPatientOr, reminderNaming, type DoseFields, type NamedRx } from '../core/rxPrivacy'

// What the patient will be given, as the doctor is writing it: the printed slip, the
// patient app, and the message — three views of the same prescription, all driven by
// the privacy rules, so what she sees here is what leaves the clinic.
export type SlipView = 'slip' | 'app' | 'msg'

interface Common {
  rx: NamedRx & DoseFields
  /** The written instructions, exactly as they will print. */
  instructions: string
}

/** The boxed ℞ area of the printed slip, with the first lines of the instructions. */
export function SlipBox({ rx, instructions, clamp = 2, showInstructions = true }: Common & { clamp?: number; showInstructions?: boolean }) {
  const box = boxContent(rx)
  const empty = !rx.remedy.trim()
  return (
    <Card className="border-green-border bg-tint-pale px-4 py-3">
      <div className="flex items-start gap-3">
        <RxGlyph width={22} className="mt-1 shrink-0 text-brand" />
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-label text-faint">Remedy prescribed</div>
            <div className={`truncate font-display text-[16px] font-semibold leading-snug ${empty ? 'text-faint' : 'text-ink-deep'}`}>{empty ? 'Choose a remedy' : box.remedy}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-label text-faint">Potency</div>
            <div className="font-display text-[16px] font-semibold leading-snug text-ink-deep">{empty ? '' : box.potency || '—'}</div>
          </div>
        </div>
      </div>
      {showInstructions && (
        <div className="mt-2.5 border-t border-green-border pt-2.5 text-[13px] leading-snug text-body">
          <div className={`whitespace-pre-line ${clamp === 2 ? 'line-clamp-2' : clamp === 3 ? 'line-clamp-3' : ''}`}>{instructions.trim() || <span className="text-faint">Instructions appear here.</span>}</div>
        </div>
      )}
    </Card>
  )
}

function AppCard({ rx }: Common) {
  const name = remedyForPatientOr(rx, 'Your prescription')
  const hidden = isHidden(rx)
  const reminder = reminderNaming(rx)
  const times = rx.repetition === 'Twice daily' ? '8:00 AM and 8:00 PM' : '8:00 PM'
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-label text-faint">Your medicine</div>
      <div className="mt-0.5 font-display text-[17px] font-bold leading-snug text-ink">{rx.remedy.trim() ? name : 'Choose a remedy'}</div>
      <div className="text-[13px] text-muted">{doseSummary(rx)}</div>
      <div className="mt-1.5 text-[12px] text-faint">Reminder at {times} — “Time for {hidden ? remedyForPatientOr(rx, 'your medicine') : `${reminder.remedy} ${reminder.potency}`.trim()}”</div>
    </Card>
  )
}

function MessageBubble({ rx, instructions, doctorName, patientName, note }: Common & { doctorName: string; patientName: string; note?: string }) {
  const text = instructions.trim() || (isHidden(rx) ? remedyForPatientOr(rx, 'Your prescription') : `${rx.remedy} ${rx.potency}`.trim())
  return (
    <div className="rounded-[16px] rounded-tl-[3px] bg-[#d9f4d4] px-3.5 py-2.5 text-[13px] leading-snug text-ink">
      <div className="line-clamp-4 whitespace-pre-line">
        Prescription from {doctorName} for {patientName}:{'\n'}{text}{note?.trim() ? `\nPreparation: ${note.trim()}` : ''}
      </div>
    </div>
  )
}

const TABS: { id: SlipView; label: string; icon: typeof Receipt }[] = [
  { id: 'slip', label: 'Slip', icon: Receipt },
  { id: 'app', label: 'App', icon: DeviceMobile },
  { id: 'msg', label: 'Message', icon: ChatCircleText },
]

export function SlipPreview({ rx, instructions, doctorName, patientName, note }: Common & { doctorName: string; patientName: string; note?: string }) {
  const [view, setView] = useState<SlipView>('slip')
  const hidden = isHidden(rx)
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-label text-faint">
          {hidden ? <Lock size={12} weight="fill" className="shrink-0" /> : <LockOpen size={12} className="shrink-0" />}
          <span className="truncate">Patient will see</span>
        </div>
        <div role="tablist" aria-label="Preview" className="inline-flex shrink-0 rounded-pill border border-border bg-surface p-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`relative tap-pad-y4 flex items-center gap-1 rounded-pill px-2.5 py-1.5 text-[12px] font-semibold transition ${view === id ? 'bg-brand text-screen' : 'text-muted'}`}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
            {view === 'slip' && <SlipBox rx={rx} instructions={instructions} />}
            {view === 'app' && <AppCard rx={rx} instructions={instructions} />}
            {view === 'msg' && <MessageBubble rx={rx} instructions={instructions} doctorName={doctorName} patientName={patientName} note={note} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
