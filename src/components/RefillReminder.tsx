import { Warning } from '@phosphor-icons/react'
import { Chip, Label, Stepper, Toggle } from '../design-system/ui'
import { RESTOCK_REMINDER_DAYS, RESTOCK_REMINDER_MAX_DAYS, RESTOCK_REMINDER_MIN_DAYS } from '../core/day'
import { RESTOCK_DAY_CHIPS, RESTOCK_WINDOW_LABEL, restockDateLabel, restockFirstDate } from '../core/restockChoice'

// "Remind me about a refill" — the doctor's own choice of how many days after prescribing the
// nudge appears on Today. The usual choices are one tap, any other number a tap of + / − or typed
// in, and the date it will first appear is on screen. Used by the phone editor and the web writer.
export interface RefillReminderProps {
  on: boolean
  onToggle: (on: boolean) => void
  days: number
  onDays: (days: number) => void
  // null = not known yet (treated as available); false = the database lacks the v50 column.
  supported: boolean | null
}

export function RefillReminder({ on, onToggle, days, onDays, supported }: RefillReminderProps) {
  const unavailable = supported === false
  const shown = unavailable ? RESTOCK_REMINDER_DAYS : days
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[15px] font-semibold text-ink">Remind me about a refill</div>
          <div className="text-[12px] leading-snug text-muted">
            {on
              ? `Shows on Today from ${restockDateLabel(restockFirstDate(shown))} — day ${shown}.`
              : 'A nudge on Today to call the patient about a refill.'}
          </div>
        </div>
        <Toggle on={on} onChange={onToggle} label="Remind me about a refill" />
      </div>

      {on && (
        <div className="mt-3 border-t border-border pt-3">
          <Label>Days after prescribing</Label>
          {unavailable ? (
            <div className="mt-2 flex items-start gap-2 rounded-[12px] border border-amber-border bg-amber-tint px-3 py-2.5 text-[12.5px] leading-snug text-amber-text">
              <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
              <span>Choosing the day needs a one-time database update that has not been applied yet, so day {RESTOCK_REMINDER_DAYS} is used for now.</span>
            </div>
          ) : (
            <>
              <div className="mt-2 flex gap-2">
                {RESTOCK_DAY_CHIPS.map((d) => <Chip key={d} selected={days === d} onClick={() => onDays(d)} className="flex-1 !px-0 text-center">{d}</Chip>)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-muted">Or any number</span>
                <Stepper value={days} min={RESTOCK_REMINDER_MIN_DAYS} max={RESTOCK_REMINDER_MAX_DAYS} onChange={onDays} suffix="days" />
              </div>
              <div className="mt-2.5 text-[12px] leading-snug text-muted">It stays for {RESTOCK_WINDOW_LABEL}, or until you prescribe this again.</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
