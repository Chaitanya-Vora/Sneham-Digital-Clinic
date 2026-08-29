// ─────────────────────────────────────────────────────────────
// Shared UI primitives — the Sneham design language, once.
// Used by all three surfaces. Pills, chips, toggles, cards, frames.
// ─────────────────────────────────────────────────────────────
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import type { ReactNode } from 'react'
import { Minus, Plus, UsersThree } from '@phosphor-icons/react'
import { haptic } from './haptics'

// ── Button ──
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'quiet' | 'danger'
const btnBase =
  'inline-flex items-center justify-center gap-2 font-display font-semibold rounded-pill transition active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap'
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-brand text-screen hover:bg-[#37522f] shadow-cta',
  accent: 'bg-accent text-white hover:bg-accent-deep shadow-float',
  ghost: 'bg-surface text-body border border-border hover:bg-surface-hover',
  quiet: 'bg-transparent text-brand hover:text-accent',
  danger: 'bg-danger text-white hover:brightness-95',
}
const btnSizes = {
  sm: 'text-[13px] px-3.5 py-2',
  md: 'text-[14px] px-5 py-2.5',
  lg: 'text-[15px] px-6 py-3',
}
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: {
  variant?: BtnVariant
  size?: keyof typeof btnSizes
  className?: string
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

// ── Card ──
export function Card({
  className = '',
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-border rounded-[20px] shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── Chip (selectable) ──
export function Chip({
  selected = false,
  onClick,
  children,
  className = '',
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill px-3.5 py-1.5 text-[13px] font-body font-medium border transition active:scale-95 ${
        selected
          ? 'bg-tint text-ink-deep border-green-border'
          : 'bg-surface text-muted border-border hover:bg-surface-hover'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// ── Badge ──
type BadgeTone = 'green' | 'amber' | 'purple' | 'neutral' | 'danger'
const badgeTones: Record<BadgeTone, string> = {
  green: 'bg-tint text-ink-deep',
  amber: 'bg-amber-tint text-amber-text',
  purple: 'bg-purple-tint text-purple',
  neutral: 'bg-screen text-muted',
  danger: 'bg-[#F6E2DC] text-danger',
}
export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold font-body ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

// ── Toggle ──
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[27px] w-[46px] rounded-pill transition ${
        on ? 'bg-accent' : 'bg-border-dash'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[21px] w-[21px] rounded-full bg-surface shadow-sm transition-all ${
          on ? 'left-[22px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

// ── Avatar (initials) ──
export function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-tint text-ink-deep font-display font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}

// ── Segmented control ──
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-pill bg-screen p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-pill px-3.5 py-1.5 text-[13px] font-body font-semibold transition ${
            value === o.value ? 'bg-brand text-screen shadow-sm' : 'text-muted hover:text-body'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Stepper ──
export function Stepper({
  value,
  min = 1,
  max = 8,
  onChange,
  suffix,
}: {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface py-1.5 pl-2 pr-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-screen text-body active:scale-90 disabled:opacity-30"
        disabled={value <= min}
        aria-label="decrease"
      >
        <Minus size={16} weight="bold" />
      </button>
      {/* Stepping is a shortcut, not the only way in — typing a value
          directly (e.g. a duration well past a quick few taps) works too. */}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value))
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className="w-12 border-none bg-transparent text-center font-display font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && <span className="shrink-0 font-display text-[13px] font-semibold text-muted">{suffix}</span>}
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-screen text-body active:scale-90 disabled:opacity-30"
        disabled={value >= max}
        aria-label="increase"
      >
        <Plus size={16} weight="bold" />
      </button>
    </div>
  )
}

// ── Micro label ──
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`text-[11px] font-semibold uppercase tracking-label text-faint font-body ${className}`}
    >
      {children}
    </div>
  )
}

// ── Stat tile ──
export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'neutral' | 'amber' | 'green'
}) {
  const subTone =
    tone === 'amber' ? 'text-amber-text' : tone === 'green' ? 'text-success' : 'text-faint'
  return (
    <Card className="px-4 py-3.5">
      <Label>{label}</Label>
      <div className="mt-1 font-display text-[26px] font-bold text-ink leading-none">{value}</div>
      {sub && <div className={`mt-1.5 text-[12px] font-body ${subTone}`}>{sub}</div>}
    </Card>
  )
}

// ── Phone frame (mobile surfaces) ──
export function PhoneFrame({
  children,
  dark = false,
}: {
  children: ReactNode
  dark?: boolean
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: 390,
        height: 844,
        borderRadius: 48,
        background: dark ? '#000' : '#F2F2F7',
        boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        // inside the demo frame, clear the drawn island / home indicator
        ['--app-top' as string]: '48px',
        ['--app-bottom' as string]: '22px',
      } as React.CSSProperties}
    >
      {/* dynamic island */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[24px] bg-black"
        style={{ top: 11, width: 120, height: 35, zIndex: 50 }}
      />
      {/* status bar */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between px-8 pt-4 text-[15px] font-semibold"
        style={{ zIndex: 40, color: dark ? '#fff' : '#000' }}
      >
        <span style={{ fontFamily: '-apple-system, system-ui' }}>9:41</span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span>●●●</span>
          <span>􀙇</span>
        </span>
      </div>
      <div className="h-full overflow-y-auto no-scrollbar">{children}</div>
      {/* home indicator */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2"
        style={{ zIndex: 60 }}
      >
        <div
          className="rounded-full"
          style={{ width: 139, height: 5, background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)' }}
        />
      </div>
    </div>
  )
}

// ── Bottom sheet (mobile modal) ──
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 520) {
      haptic('impact')
      onClose()
    }
  }
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-[70] flex items-end justify-center overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className="relative w-full touch-none rounded-t-[32px] bg-screen px-5 pb-8 pt-3 shadow-modal"
            style={{ maxHeight: '84%', overflowY: 'auto' }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-dash" />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── Patient not found ──
// Shared fallback for any patient-scoped screen (prescription, case sheet,
// follow-up, patient detail) opened with an id that no longer resolves —
// a deleted patient, a stale link, or navigation reached without picking
// one first. Renders instead of crashing on an undefined patient.
export function PatientNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tint text-brand">
        <UsersThree size={26} weight="fill" />
      </div>
      <div>
        <div className="font-display text-[16px] font-bold text-ink">Patient not found</div>
        <div className="mt-1 text-[13px] text-muted">This patient may have been removed, or no patient was selected.</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>Back to patients</Button>
    </div>
  )
}
