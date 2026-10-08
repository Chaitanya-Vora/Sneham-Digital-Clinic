import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Drop, Eye, EyeSlash, Spinner } from '@phosphor-icons/react'

// The look shared by every screen a person sees before they are signed in (sign in, create an
// account, reset a password) and by the patient's first-run form: a calm green welcome band,
// and a white card of fields that rises over it — the same language as the patient profile.
//
// NOTE: opacity-only entrance, no transform on anything that contains an input — a CSS
// transform on an ancestor of a text field corrupts Android WebView's native long-press paste
// popup into a blank box. Don't add a translate/scale here.

export type Audience = 'patient' | 'practitioner'
export const AUDIENCE: Audience = (import.meta.env.VITE_DEFAULT_SURFACE as string | undefined) === 'patient' ? 'patient' : 'practitioner'

export function Mark({ size = 44 }: { size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-[14px] bg-white/15 text-screen" style={{ width: size, height: size }}>
      <Drop size={size * 0.5} weight="fill" />
    </div>
  )
}

/** The welcome band + the card that rises over it. */
export function AuthShell({ title, subtitle, perks, tag, children, footer }: {
  title: string
  subtitle?: string
  perks?: { icon: ReactNode; label: string }[]
  tag?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-canvas sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[440px] bg-canvas sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-border sm:shadow-card-lg"
      >
        <div className="relative overflow-hidden rounded-b-[32px] bg-brand px-6 pb-16 pt-[calc(var(--app-top)+10px)] text-screen sm:pt-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full border border-dashed border-white/15" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full border border-dashed border-white/10" />
          <div className="relative flex items-center gap-3">
            <Mark />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="font-display text-[16px] font-bold">Sneham Digital Clinic</div>
              <div className="text-[12px] text-white/65">Healing with compassion</div>
            </div>
            {tag}
          </div>
          <h1 className="relative mt-8 font-display text-[28px] font-bold leading-tight">{title}</h1>
          {subtitle && <p className="relative mt-1.5 max-w-[34ch] text-[14.5px] leading-relaxed text-white/75">{subtitle}</p>}
          {perks && (
            <div className="relative mt-5 flex flex-wrap gap-2">
              {perks.map((p) => (
                <span key={p.label} className="flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-white/90">{p.icon}{p.label}</span>
              ))}
            </div>
          )}
        </div>
        <div className="relative z-10 -mt-9 px-5 pb-10">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-card-lg">{children}</div>
          {footer && <div className="mt-6 text-center text-[13px] text-muted">{footer}</div>}
        </div>
      </motion.div>
    </div>
  )
}

const inputBase = 'w-full rounded-[14px] border bg-screen px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-faint focus:bg-surface focus:ring-2'

/** A labelled input with its message (error first, then hint) underneath. */
export function AuthField({ label, optional, error, hint, right, id, className = '', ...rest }: {
  label: string
  optional?: boolean
  error?: string | null
  hint?: ReactNode
  right?: ReactNode
  id: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold uppercase tracking-label text-muted">
        {label}{optional && <span className="ml-1 font-normal normal-case tracking-normal text-faint">· optional</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          data-selectable="true"
          className={`${inputBase} ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border focus:border-accent focus:ring-accent/20'} ${right ? 'pr-12' : ''} ${className}`}
          {...rest}
        />
        {right}
      </div>
      {error ? <p id={`${id}-msg`} role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">{error}</p>
        : hint ? <p id={`${id}-msg`} className="mt-1.5 text-[12px] text-faint">{hint}</p> : null}
    </div>
  )
}

/** A password input with a show/hide eye. */
export function PasswordField({ id, label, error, hint, value, onChange, placeholder, autoComplete, autoFocus, onBlur }: {
  id: string; label: string; error?: string | null; hint?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; autoFocus?: boolean; onBlur?: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <AuthField
      id={id}
      label={label}
      error={error}
      hint={hint}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      right={
        <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-body">
          {show ? <EyeSlash size={19} /> : <Eye size={19} />}
        </button>
      }
    />
  )
}

// ── password strength ───────────────────────────────────────────────────
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (pw.length < 6) return { score: pw.length === 0 ? 0 : 1, label: pw.length === 0 ? '' : 'Too short' }
  let score = 1
  if (pw.length >= 10) score++
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score++
  if ((/[a-z]/.test(pw) && /[A-Z]/.test(pw)) || /[^a-zA-Z0-9]/.test(pw)) score++
  const s = Math.min(4, score) as 1 | 2 | 3 | 4
  return { score: s, label: ['', 'Weak', 'Okay', 'Good', 'Strong'][s] }
}

export function StrengthBar({ password }: { password: string }) {
  const { score, label } = passwordStrength(password)
  if (!password) return null
  const color = score <= 1 ? 'bg-danger' : score === 2 ? 'bg-amber' : 'bg-brand'
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? color : 'bg-border'}`} />)}
      </div>
      <span className={`w-[64px] text-right text-[12px] font-semibold ${score <= 1 ? 'text-danger' : score === 2 ? 'text-amber-text' : 'text-brand'}`}>{label}</span>
    </div>
  )
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

// ── buttons and notes ───────────────────────────────────────────────────
export function PrimaryButton({ busy, children, ...rest }: { busy?: boolean; children: ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-brand py-3.5 font-display text-[15.5px] font-semibold text-white shadow-cta transition hover:bg-accent-deep active:scale-[0.99] disabled:opacity-70"
    >
      {busy ? <Spinner size={20} className="animate-spin" /> : children}
    </button>
  )
}

export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-pill border border-border bg-surface py-3 text-[15px] font-semibold text-ink transition hover:bg-surface-hover active:scale-[0.99]">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335" />
      </svg>
      Continue with Google
    </button>
  )
}

export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-faint">
      <span className="h-px flex-1 bg-border" />{children}<span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="rounded-[14px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[13px] leading-snug text-danger">
      {children}
    </motion.div>
  )
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="font-semibold text-brand hover:text-accent-deep">{children}</button>
}
