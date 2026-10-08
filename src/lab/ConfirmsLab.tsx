import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, CalendarX, XCircle, UserMinus, CaretRight, CheckCircle } from '@phosphor-icons/react'
import { Card, Avatar, BottomSheet, Button } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { Phone, FrameToast, type FrameToastData } from './kit'

// The nine browser pop-ups, matched to how risky each action really is.
// Reversible things happen at once with an Undo (the app's toast already has an
// action slot); things that change another person's day get the app's own
// confirmation — the phone's existing sheet, and the same look as a web dialog.
export function ConfirmsLab() {
  const [toast, setToast] = useState<FrameToastData | null>(null)
  const [archived, setArchived] = useState(false)
  const [fuCancelled, setFuCancelled] = useState(false)
  const [apptSheet, setApptSheet] = useState(false)
  const [apptCancelled, setApptCancelled] = useState(false)
  const [dialog, setDialog] = useState(true)
  const [webToast, setWebToast] = useState<string | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Phone" note="Try the three rows." height={640}>
        <div className="px-[18px] pt-[var(--app-top)]">
          <div className="font-display text-[20px] font-bold text-ink">Kabir Shah</div>
          <div className="text-[13px] text-muted">34 y · Male · #WS-2210</div>
          <Card className="mt-5 overflow-hidden">
            <Pressable as="div" hap="tick" scale={0.99} onClick={() => { if (archived) return; setArchived(true); setToast({ id: Date.now(), title: 'Kabir Shah archived', message: 'Hidden from your active roster.', undo: () => setArchived(false) }) }} className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><Archive size={20} /></div>
              <div className="flex-1"><div className="text-[14px] font-semibold text-ink">{archived ? 'Archived' : 'Archive patient'}</div><div className="text-[12px] text-muted">Done at once · Undo for 6 seconds</div></div>
              {!archived && <CaretRight size={16} className="text-faint" />}
            </Pressable>
            <Pressable as="div" hap="tick" scale={0.99} onClick={() => { if (fuCancelled) return; setFuCancelled(true); setToast({ id: Date.now(), title: 'Follow-up cancelled', message: 'Fri, 23 Oct · 9:00 AM', undo: () => setFuCancelled(false) }) }} className="flex cursor-pointer items-center gap-3 border-t border-border px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-brand"><CalendarX size={20} /></div>
              <div className="flex-1"><div className="text-[14px] font-semibold text-ink">{fuCancelled ? 'Follow-up cancelled' : 'Cancel follow-up'}</div><div className="text-[12px] text-muted">Done at once · Undo for 6 seconds</div></div>
              {!fuCancelled && <CaretRight size={16} className="text-faint" />}
            </Pressable>
            <Pressable as="div" hap="tick" scale={0.99} onClick={() => setApptSheet(true)} className="flex cursor-pointer items-center gap-3 border-t border-border px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-danger/10 text-danger"><XCircle size={20} /></div>
              <div className="flex-1"><div className="text-[14px] font-semibold text-danger">{apptCancelled ? 'Appointment cancelled' : 'Cancel appointment'}</div><div className="text-[12px] text-muted">Asks first — it changes the patient's day</div></div>
              {!apptCancelled && <CaretRight size={16} className="text-faint" />}
            </Pressable>
          </Card>
        </div>
        <FrameToast toast={toast} onClose={closeToast} />
        <BottomSheet open={apptSheet} onClose={() => setApptSheet(false)}>
          <div className="flex flex-col items-center py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><XCircle size={28} weight="fill" /></div>
            <div className="mt-3 font-display text-[17px] font-bold text-ink">Cancel appointment?</div>
            <div className="mt-1 text-[13px] text-muted">Kabir Shah · Thu, 9:00 AM</div>
            <div className="mt-4 flex w-full gap-2">
              <Pressable hap="tick" onClick={() => setApptSheet(false)} className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-center text-[14px] font-semibold text-body">Keep it</Pressable>
              <Pressable hap="impact" onClick={() => { setApptSheet(false); setApptCancelled(true) }} className="flex-1 rounded-pill bg-danger py-2.5 text-center text-[14px] font-semibold text-white">Cancel it</Pressable>
            </div>
          </div>
        </BottomSheet>
      </Phone>

      <div>
        <div className="mb-2 px-1">
          <div className="font-display text-[14px] font-semibold text-ink">Web console</div>
          <div className="text-[12px] text-muted">The same look as the phone sheet, as a dialog that says what will happen.</div>
        </div>
        <div className="relative h-[430px] w-[620px] overflow-hidden rounded-[24px] border border-border-dash bg-screen shadow-card-lg">
          <div className="space-y-3 p-6 opacity-70">
            <div className="h-6 w-48 rounded-md bg-border" />
            <div className="grid grid-cols-3 gap-3"><div className="h-20 rounded-[16px] bg-surface" /><div className="h-20 rounded-[16px] bg-surface" /><div className="h-20 rounded-[16px] bg-surface" /></div>
            <div className="h-40 rounded-[20px] bg-surface" />
          </div>
          <AnimatePresence>
            {dialog && (
              <motion.div className="absolute inset-0 flex items-center justify-center bg-ink/25 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className="w-[380px] rounded-[24px] border border-border bg-surface p-6 text-center shadow-modal">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><UserMinus size={26} weight="fill" /></div>
                  <div className="mt-3 font-display text-[18px] font-bold text-ink">Remove Dr. Ishwari from the team?</div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Her 12 upcoming appointments move to you, and she loses access straight away.</p>
                  <div className="mt-5 flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setDialog(false)}>Keep her</Button>
                    <button onClick={() => { setDialog(false); setWebToast('Dr. Ishwari removed from the team') }} className="flex-1 rounded-pill bg-danger px-4 py-2.5 text-[14px] font-semibold text-white">Remove</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {webToast && (
              <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-4 top-4 flex w-[300px] items-start gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5 shadow-modal">
                <div className="mt-0.5 text-accent"><CheckCircle size={22} weight="fill" /></div>
                <div className="flex-1"><div className="font-display text-[14px] font-semibold text-ink">{webToast}</div></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => { setDialog(true); setWebToast(null) }} className="mt-3 rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-body">Show the dialog again</button>
      </div>

      <div className="max-w-[420px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">All nine, by how risky they are</p>
        <Card className="mt-3 overflow-hidden text-[13px]">
          {[
            ['Archive patient (phone, web ×2)', 'Undo toast'],
            ['Cancel a follow-up (web)', 'Undo toast'],
            ['Grant / remove a permission (web)', 'Undo toast'],
            ['Cancel appointment (web ×2)', 'Confirm — same sheet as the phone'],
            ['Remove a team member (web)', 'Confirm — says what will happen'],
          ].map(([a, b], i) => (
            <div key={a} className={`flex justify-between gap-4 px-3.5 py-2.5 ${i ? 'border-t border-border' : ''}`}>
              <span className="text-ink">{a}</span><span className="shrink-0 font-semibold text-brand">{b}</span>
            </div>
          ))}
        </Card>
        <p className="mt-3">The phone already has the right confirmation (the sheet above); the web console was the one still using the browser's pop-up.</p>
        <div className="mt-3 flex items-center gap-2 text-faint"><Avatar initials="NB" size={22} /><span className="text-[12px]">Open question: cancelling doesn't tell the patient today — offer to?</span></div>
      </div>
    </div>
  )
}
