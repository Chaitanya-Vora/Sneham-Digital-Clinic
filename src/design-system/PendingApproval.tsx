import { HourglassMedium } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { SnehamMark } from './Logo'

// Shown in place of the real app for any practitioner whose signup hasn't
// been approved by the clinic Owner yet (see migration_v19_practitioner_approval_gate.sql
// and the "Pending approval" card in web Settings). RLS already denies them
// any patient data regardless — this is just the honest, visible reason why
// the screen behind it would otherwise look empty.
export function PendingApproval({ name }: { name: string }) {
  const { signOut } = useAuth()
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
      <button onClick={signOut} className="mt-2 text-[13px] font-semibold text-danger">Sign out</button>
    </div>
  )
}
