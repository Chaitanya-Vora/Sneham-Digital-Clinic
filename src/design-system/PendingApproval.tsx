import { useState } from 'react'
import { HourglassMedium, Prohibit, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { useClinic } from '../core/store'
import { haptic } from './haptics'
import { SnehamMark } from './Logo'

// Shown in place of the real app for any practitioner whose signup hasn't
// been approved by the clinic Owner yet (see migration_v19_practitioner_approval_gate.sql
// and the "Pending approval" card in web Settings). RLS already denies them
// any patient data regardless — this is just the honest, visible reason why
// the screen behind it would otherwise look empty.
//
// The code field is the other way in: the Owner mints a one-time code for
// this specific request (migration_v38_invite_code_system.sql) and shares
// it out of band — entering it here is the only way this account's status
// can flip to active without the Owner acting directly in Settings.
export function PendingApproval({ name }: { name: string }) {
  const { signOut } = useAuth()
  const redeemInviteCode = useClinic((s) => s.redeemInviteCode)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!code.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    const ok = await redeemInviteCode(code)
    setSubmitting(false)
    if (!ok) {
      haptic('warn')
      setError("That code didn't work — check it and try again.")
      return
    }
    haptic('success')
    const s = useClinic.getState()
    if (s.userId) await s.hydrate(s.userId, '')
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-8 text-center">
      <SnehamMark />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tint text-brand">
        <HourglassMedium size={26} weight="fill" />
      </div>
      <div>
        <div className="font-display text-[19px] font-bold text-ink">Waiting for approval</div>
        <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-muted">
          Hi {name.replace(/^Dr\.?\s*/i, '')} — your account is ready, but the clinic owner needs to approve it before you can see any patient records. Check back shortly, or ask them directly.
        </p>
      </div>

      <div className="mt-1 w-full max-w-[280px]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Have a code from them?</div>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="Enter code"
            className="min-w-0 flex-1 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-center font-mono text-[15px] font-bold uppercase tracking-[0.15em] text-ink outline-none focus:border-green-border"
          />
          <button
            onClick={handleSubmit}
            disabled={!code.trim() || submitting}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-brand text-screen disabled:opacity-40"
          >
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
        {error && <div className="mt-1.5 text-[12px] font-medium text-danger">{error}</div>}
      </div>

      <button onClick={signOut} className="mt-2 text-[13px] font-semibold text-danger">Sign out</button>
    </div>
  )
}

// Shown for an account whose status is 'inactive' — someone the clinic
// Owner has removed (a former colleague, a stray/unused account). Same RLS
// backstop as PendingApproval (see internal.can_access_patient), same
// honest-reason-behind-the-empty-screen role, distinct copy: this isn't
// "not yet approved", it's "no longer has access".
export function AccessRemoved({ name }: { name: string }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-8 text-center">
      <SnehamMark />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <Prohibit size={26} weight="fill" />
      </div>
      <div>
        <div className="font-display text-[19px] font-bold text-ink">Access removed</div>
        <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-muted">
          Hi {name.replace(/^Dr\.?\s*/i, '')} — this account no longer has access to the clinic. If you think this is a mistake, contact the clinic directly.
        </p>
      </div>
      <button onClick={signOut} className="mt-2 text-[13px] font-semibold text-danger">Sign out</button>
    </div>
  )
}
