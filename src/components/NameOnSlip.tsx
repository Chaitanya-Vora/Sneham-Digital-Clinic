import { Lock, Warning } from '@phosphor-icons/react'
import { Chip, Label } from '../design-system/ui'
import { SLIP_LABEL_MAX, SLIP_LABEL_PRESETS } from '../core/rxPrivacy'

// "Name on the slip: Show / Hide" — the doctor's choice about what the patient is
// told. The remedy is always recorded privately; hiding it means the slip, the
// messages, the patient app and the reminders use her own wording instead
// (core/rxPrivacy.ts). Used by the phone editor and the web writer alike.
export interface NameOnSlipProps {
  hide: boolean
  onHide: (hide: boolean) => void
  label: string
  onLabel: (label: string) => void
  // null = not known yet (treated as available); false = the database lacks the v49 columns.
  supported: boolean | null
  /** Recent labels used on this device, shown after the presets. */
  extraLabels?: string[]
}

export function NameOnSlip({ hide, onHide, label, onLabel, supported, extraLabels = [] }: NameOnSlipProps) {
  const unavailable = supported === false
  const options = [...SLIP_LABEL_PRESETS, ...extraLabels.filter((l) => !SLIP_LABEL_PRESETS.includes(l))]
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[15px] font-semibold text-ink">Name on the slip</div>
          <div className="text-[12px] text-muted">{hide ? 'The patient is not told the remedy.' : 'The remedy and potency are written on the slip.'}</div>
        </div>
        <div role="group" aria-label="Name on the slip" className="inline-flex shrink-0 rounded-pill bg-screen p-1">
          {([[false, 'Show'], [true, 'Hide']] as const).map(([value, text]) => (
            <button
              key={text}
              type="button"
              aria-pressed={hide === value}
              disabled={value && unavailable}
              onClick={() => onHide(value)}
              className={`relative tap-pad-y rounded-pill px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-40 ${hide === value ? 'bg-brand text-screen shadow-sm' : 'text-muted'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {unavailable && (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-border bg-amber-tint px-3 py-2.5 text-[12.5px] leading-snug text-amber-text">
          <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
          <span>Hiding the name needs a one-time database update that has not been applied yet, so the name is shown for now.</span>
        </div>
      )}

      {hide && (
        <div className="mt-3 border-t border-border pt-3">
          <Label>Written on the slip as</Label>
          <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-border bg-screen px-3.5 focus-within:border-green-border">
            <Lock size={14} weight="fill" className="shrink-0 text-faint" />
            <input
              value={label}
              maxLength={SLIP_LABEL_MAX}
              onChange={(e) => onLabel(e.target.value)}
              placeholder="e.g. Pills No. 1 — or leave blank"
              aria-label="Written on the slip as"
              data-selectable="true"
              className="w-full bg-transparent py-3 text-[14px] text-ink outline-none placeholder:text-faint"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((l) => <Chip key={l} selected={label === l} onClick={() => onLabel(l)}>{l}</Chip>)}
            <Chip selected={label.trim() === ''} onClick={() => onLabel('')}>Instructions only</Chip>
          </div>
          <div className="mt-2.5 text-[12px] leading-snug text-muted">Reminders, the patient app and messages use this too. Your own screens always show the real remedy.</div>
        </div>
      )}
    </div>
  )
}
