import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Microphone, Play, Pause, X, WarningCircle } from '@phosphor-icons/react'
import { VoiceRecorder } from '../design-system/VoiceRecorder'
import { Label } from '../design-system/ui'
import { useToast } from '../design-system/toast'
import { haptic } from '../design-system/haptics'
import { compressImage } from '../core/media'
import { getOutcomeAttachmentUrls, type AttachmentDraft } from '../core/db'
import type { OutcomeAttachment } from '../core/types'

export const MAX_ATTACHMENTS = 8
const MAX_BYTES = 9 * 1024 * 1024 // bucket cap is 10 MB; stay safely under it

const addBtn =
  'flex h-11 lg:h-10 items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 text-[13px] font-medium text-body transition hover:bg-surface-hover active:scale-[0.98] disabled:opacity-50'

function fmtSecs(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`
}

function AudioChip({ src, seconds, onRemove }: { src?: string; seconds?: number; onRemove?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <div className="flex h-10 items-center gap-2 rounded-pill border border-border bg-surface pl-1.5 pr-3">
      <button
        type="button"
        disabled={!src}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        onClick={() => {
          const a = ref.current
          if (!a) return
          if (a.paused) { void a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
        }}
        className="relative tap-pad flex h-7 w-7 items-center justify-center rounded-full bg-tint text-brand disabled:opacity-40"
      >
        {playing ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
      </button>
      <Microphone size={13} className="text-faint" />
      <span className="text-[12px] font-semibold tabular-nums text-body">{seconds != null ? fmtSecs(seconds) : 'Voice note'}</span>
      {onRemove && (
        <button type="button" aria-label="Remove voice note" onClick={onRemove} className="ml-0.5 text-faint hover:text-danger">
          <X size={13} weight="bold" />
        </button>
      )}
      {src && <audio ref={ref} src={src} preload="none" onEnded={() => setPlaying(false)} className="hidden" />}
    </div>
  )
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <img src={src} alt="Follow-up attachment" className="max-h-full max-w-full rounded-[14px] object-contain" />
      <button type="button" aria-label="Close" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
        <X size={18} weight="bold" />
      </button>
    </div>
  )
}

// Controlled by the screen that owns the follow-up — nothing is uploaded
// until she actually saves the outcome, so abandoning the screen leaves no
// stray files behind.
export function AttachmentComposer({ drafts, onChange, disabled }: { drafts: AttachmentDraft[]; onChange: (next: AttachmentDraft[]) => void; disabled?: boolean }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef(new Map<string, string>())
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const urls = urlsRef.current
  const live = new Set(drafts.map((d) => d.id))
  for (const d of drafts) if (!urls.has(d.id)) urls.set(d.id, URL.createObjectURL(d.blob))
  for (const [id, u] of urls) if (!live.has(id)) { URL.revokeObjectURL(u); urls.delete(id) }
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current.clear() }, [])

  const room = MAX_ATTACHMENTS - drafts.length
  const [preview, setPreview] = useState<string | null>(null)

  async function addImages(files: FileList | null) {
    if (!files || files.length === 0) return
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(room, 0))
    if (files.length > picked.length) toast({ title: `Up to ${MAX_ATTACHMENTS} per follow-up` })
    if (picked.length === 0) return
    setBusy(true)
    const next: AttachmentDraft[] = []
    for (const f of picked) {
      const blob = await compressImage(f)
      if (blob.size > MAX_BYTES) { toast({ title: 'Photo too large', message: `${f.name} is over 9 MB.` }); continue }
      next.push({ id: crypto.randomUUID(), kind: 'image', blob, name: f.name || 'Photo', mime: blob.type || 'image/jpeg' })
    }
    setBusy(false)
    if (next.length) { haptic('tick'); onChange([...draftsRef.current, ...next]) }
    if (fileRef.current) fileRef.current.value = ''
  }

  function addAudio(seconds: number, blob: Blob) {
    if (draftsRef.current.length >= MAX_ATTACHMENTS) { toast({ title: `Up to ${MAX_ATTACHMENTS} per follow-up` }); return }
    if (blob.size > MAX_BYTES) { toast({ title: 'Voice note too long', message: 'Keep it under about 10 minutes.' }); return }
    haptic('tick')
    onChange([...draftsRef.current, { id: crypto.randomUUID(), kind: 'audio', blob, name: 'Voice note', mime: blob.type || 'audio/webm', seconds }])
    setRecorderOpen(false)
  }

  const remove = (id: string) => { haptic('tick'); onChange(drafts.filter((d) => d.id !== id)) }

  return (
    <div>
      <Label>Photos &amp; voice notes <span className="font-normal normal-case tracking-normal">· optional</span></Label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={addBtn} disabled={disabled || busy || room <= 0} onClick={() => fileRef.current?.click()}>
          <ImageIcon size={16} className="text-brand" /> {busy ? 'Preparing…' : 'Add photo'}
        </button>
        <button type="button" className={addBtn} disabled={disabled || room <= 0} onClick={() => setRecorderOpen((v) => !v)}>
          <Microphone size={16} className="text-brand" /> Voice note
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addImages(e.target.files)} />
      </div>

      {recorderOpen && (
        <div className="mt-2.5">
          <VoiceRecorder onAttach={addAudio} />
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {drafts.map((d) =>
            d.kind === 'image' ? (
              <div key={d.id} className="relative">
                <button type="button" aria-label="View photo" onClick={() => setPreview(urls.get(d.id) ?? null)}>
                  <img src={urls.get(d.id)} alt={d.name} className="h-14 w-14 rounded-[12px] border border-border object-cover" />
                </button>
                <button
                  type="button"
                  aria-label="Remove photo"
                  disabled={disabled}
                  onClick={() => remove(d.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white shadow-card"
                >
                  <X size={10} weight="bold" />
                </button>
              </div>
            ) : (
              <AudioChip key={d.id} src={urls.get(d.id)} seconds={d.seconds} onRemove={disabled ? undefined : () => remove(d.id)} />
            ),
          )}
        </div>
      )}
      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

// Read-only view of what was saved. File links are only requested once the
// block scrolls into view, so a long history doesn't fire a burst of requests.
export function AttachmentList({ attachments }: { attachments?: OutcomeAttachment[] }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [urls, setUrls] = useState<Record<string, string> | null>(null)
  const [failed, setFailed] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const items = attachments ?? []

  useEffect(() => {
    const el = hostRef.current
    if (!el || items.length === 0) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [items.length])

  useEffect(() => {
    if (!visible || items.length === 0) return
    let cancelled = false
    void getOutcomeAttachmentUrls(items.map((a) => a.path)).then((u) => {
      if (cancelled) return
      if (Object.keys(u).length === 0) setFailed(true)
      setUrls(u)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (items.length === 0) return null
  return (
    <div ref={hostRef} className="mt-2 flex flex-wrap items-center gap-2">
      {items.map((a) => {
        const src = urls?.[a.path]
        if (a.kind === 'audio') return <AudioChip key={a.id} src={src} seconds={a.seconds} />
        if (!urls) return <div key={a.id} className="h-12 w-12 animate-pulse rounded-[10px] bg-tint" />
        if (!src) return (
          <div key={a.id} className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-tint text-faint" title="Couldn't load this photo">
            <WarningCircle size={16} />
          </div>
        )
        return (
          <button key={a.id} type="button" aria-label="View photo" onClick={() => setPreview(src)}>
            <img src={src} alt={a.name} loading="lazy" className="h-12 w-12 rounded-[10px] border border-border object-cover" />
          </button>
        )
      })}
      {failed && <span className="text-[12px] lg:text-[11px] text-faint">Couldn't load attachments — check your connection.</span>}
      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
