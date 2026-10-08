import { Prohibit, Lock } from '@phosphor-icons/react'
import { Badge, Card } from '../../design-system/ui'
import { DayProgress } from '../../design-system/DayProgress'
import { Pressable } from '../../design-system/Pressable'
import { courseNote, type CourseStatus } from '../../core/course'
import type { Prescription } from '../../core/types'

// The prescriptions tab. The doctor always sees the real remedy; a small lock
// shows when it is hidden from the patient. A published course shows how far
// through it the patient is.
export interface RxRow { rx: Prescription; course: CourseStatus | null; isLatest: boolean }

export function RxList({ rows, patientFirstName, onCancel }: { rows: RxRow[]; patientFirstName: string; onCancel: (rx: Prescription) => void }) {
  if (rows.length === 0) return <div className="py-12 text-center text-[13px] text-muted">No prescriptions yet.</div>
  return (
    <div className="space-y-2.5">
      {rows.map(({ rx, course, isLatest }) => {
        const cancelled = rx.status === 'cancelled'
        const draft = rx.status === 'draft'
        const when = new Date(rx.publishedAt ?? rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        return (
          <Card key={rx.id} className={`px-4 py-3 ${cancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`font-display text-[15px] font-semibold text-ink ${cancelled ? 'line-through' : ''}`}>{rx.remedy}</div>
                <div className="mt-0.5 text-[12.5px] text-muted">{rx.repetition} · {rx.durationDays ? `${rx.durationDays} days` : 'until settled'}</div>
              </div>
              <Badge tone={cancelled ? 'danger' : 'green'}>{rx.potency}</Badge>
            </div>
            {rx.hideRemedy && (
              <div className="mt-2 flex items-center gap-1.5 rounded-[10px] bg-screen px-2.5 py-1.5 text-[12px] text-muted">
                <Lock size={12} weight="fill" className="shrink-0 text-faint" />
                <span>Hidden from {patientFirstName}{rx.slipLabel ? <> · slip says <span className="font-semibold text-ink">{rx.slipLabel}</span></> : ' · slip names no remedy'}</span>
              </div>
            )}
            {isLatest && course && course.state !== 'none' && course.state !== 'open' && !cancelled && (
              <div className="mt-2.5">
                <DayProgress done={course.state === 'ended' ? course.durationDays ?? 0 : course.dayNumber ?? 0} total={course.durationDays ?? 1} className="!block w-full" />
                <div className={`mt-1 text-[11.5px] font-semibold ${course.state === 'ended' ? 'text-danger' : 'text-muted'}`}>{courseNote(course)[0].toUpperCase() + courseNote(course).slice(1)}</div>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-[11.5px] text-faint">{draft ? 'Saved (not yet published)' : cancelled ? 'Cancelled' : 'Published'} {when}</div>
              {!cancelled && (
                <Pressable hap="tick" ariaLabel={draft ? 'discard draft' : 'cancel prescription'} onClick={() => onCancel(rx)} className="relative tap-pad-lg flex shrink-0 items-center gap-1 text-[12px] font-medium text-danger/80">
                  <Prohibit size={13} /> {draft ? 'Discard' : 'Cancel'}
                </Pressable>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
