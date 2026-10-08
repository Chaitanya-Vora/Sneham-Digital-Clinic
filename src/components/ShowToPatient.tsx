import { Lock, Warning } from '@phosphor-icons/react'
import { Toggle } from '../design-system/ui'

// "Show to patient" — whether a visit she books is announced to the patient and listed in their
// app, or kept for her own reference. Used by the phone booking sheet and the web window alike
// (core/visitPrivacy.ts is the rule every patient-facing list follows).
export interface ShowToPatientProps {
  shown: boolean
  onChange: (shown: boolean) => void
  /** The visit is already in the patient's app: it can't be quietly taken back — she cancels it instead. */
  locked?: boolean
  /** Editing a visit that was private and is now being shared: the patient will be told on save. */
  willAnnounce?: boolean
  // null = not known yet (treated as available); false = the database lacks the v50 column.
  supported: boolean | null
}

export function ShowToPatient({ shown, onChange, locked = false, willAnnounce = false, supported }: ShowToPatientProps) {
  const unavailable = supported === false
  const sub = locked
    ? 'Already in their app — cancel the visit to take it back.'
    : shown
      ? willAnnounce ? 'They will be told about it when you save.' : 'It appears in their app and they are told.'
      : 'Only you can see this — not in their app, and they are not told.'
  return (
    <div className="rounded-[14px] border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-display text-[14.5px] font-semibold text-ink">
            {!shown && <Lock size={13} weight="fill" className="shrink-0 text-faint" />}Show to patient
          </div>
          <div className="text-[12px] leading-snug text-muted">{sub}</div>
        </div>
        <Toggle on={shown} onChange={onChange} disabled={locked || (unavailable && shown)} label="Show to patient" />
      </div>
      {unavailable && (
        <div className="mt-2.5 flex items-start gap-2 rounded-[12px] border border-amber-border bg-amber-tint px-3 py-2.5 text-[12.5px] leading-snug text-amber-text">
          <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
          <span>Keeping a visit private needs a one-time database update that has not been applied yet, so it is shown for now.</span>
        </div>
      )}
    </div>
  )
}

/** The small lock on a doctor-side visit row that the patient has not been told about. */
export function OnlyYouMark({ size = 12, className = '' }: { size?: number; className?: string }) {
  return <Lock size={size} weight="fill" aria-label="Only you can see this visit" role="img" className={`inline shrink-0 align-[-1px] text-faint ${className}`} />
}
