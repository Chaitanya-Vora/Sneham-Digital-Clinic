import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { ShareNetwork } from '@phosphor-icons/react'
import { Pressable } from '../design-system/Pressable'
import { useToast } from '../design-system/toast'
import { getDiagnosticsText, diag } from '../core/diagnostics'

declare const __APP_BUILD__: { version: string; sha: string; date: string }

function prettyDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Which build is this phone actually running? — plus a way to hand over what
// the app recorded when something odd happened, with one tap.
export function AppInfoRow() {
  const toast = useToast()
  const b = __APP_BUILD__

  async function shareDiagnostics() {
    const text = getDiagnosticsText()
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Sneham diagnostics', text })
      } else {
        await navigator.clipboard.writeText(text)
        toast({ title: 'Diagnostics copied', message: 'Paste them wherever you need to send them.' })
      }
      diag('diagnostics', 'shared')
    } catch {
      // The user closing the share sheet rejects the promise — nothing to do.
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-label text-muted">App version</div>
          <div className="mt-1 text-[13px] text-body">{b.version} · {prettyDate(b.date)} · {b.sha}</div>
        </div>
        <Pressable
          hap="tick"
          onClick={() => void shareDiagnostics()}
          ariaLabel="share diagnostics"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-body"
        >
          <ShareNetwork size={15} className="text-brand" /> Diagnostics
        </Pressable>
      </div>
      <div className="mt-1.5 text-[11.5px] text-faint">If something feels off, tap Diagnostics and send it over — it holds timings and screen names only, never patient information.</div>
    </div>
  )
}
