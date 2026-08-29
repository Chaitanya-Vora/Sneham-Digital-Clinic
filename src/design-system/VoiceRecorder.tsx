import { useEffect, useRef, useState } from 'react'
import { Microphone, Stop, Play, Pause, Trash, Paperclip } from '@phosphor-icons/react'

type Status = 'idle' | 'recording' | 'recorded' | 'denied'

// A genuinely working recorder: getUserMedia + MediaRecorder. Produces a
// playable clip. (Audio lives in-session — persistence arrives with Supabase.)
export function VoiceRecorder({ onAttach }: { onAttach?: (seconds: number) => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [seconds, setSeconds] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [attached, setAttached] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setUrl(URL.createObjectURL(blob))
        setStatus('recorded')
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mediaRef.current = mr
      setSeconds(0)
      setAttached(false)
      setStatus('recording')
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setStatus('denied')
    }
  }

  function stop() {
    mediaRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function reset() {
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    setSeconds(0)
    setStatus('idle')
    setPlaying(false)
    setAttached(false)
  }

  function togglePlay() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.play()
      setPlaying(true)
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(1, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="rounded-[16px] border border-border bg-surface px-4 py-3">
      {status === 'denied' ? (
        <div className="text-[12.5px] text-amber-text">
          Microphone access was blocked. Allow it in your browser to record a voice note.
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {status !== 'recorded' ? (
            <button
              onClick={status === 'recording' ? stop : start}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 ${
                status === 'recording' ? 'animate-breathe bg-danger text-white' : 'bg-tint text-brand'
              }`}
              aria-label={status === 'recording' ? 'stop recording' : 'record voice note'}
            >
              {status === 'recording' ? <Stop size={20} weight="fill" /> : <Microphone size={20} weight="fill" />}
            </button>
          ) : (
            <button
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-screen active:scale-90"
              aria-label={playing ? 'pause' : 'play'}
            >
              {playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
            </button>
          )}

          {/* waveform */}
          <div className="flex min-w-0 flex-1 items-center gap-[3px]">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`w-[3px] shrink-0 rounded-full ${
                  status === 'recording' ? 'bg-danger animate-breathe' : status === 'recorded' ? 'bg-accent' : 'bg-border-dash'
                }`}
                style={{
                  height: `${6 + Math.abs(Math.sin(i * 1.7)) * (status === 'idle' ? 6 : 22)}px`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>

          <span className="shrink-0 font-display text-[13px] font-semibold tabular-nums text-body">
            {mm}:{ss}
          </span>

          {status === 'recorded' && (
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={reset} className="flex h-9 w-9 items-center justify-center rounded-full text-faint hover:text-danger" aria-label="delete">
                <Trash size={16} />
              </button>
              <button
                onClick={() => {
                  setAttached(true)
                  onAttach?.(seconds)
                }}
                className={`flex h-9 items-center gap-1.5 rounded-pill px-3 text-[12.5px] font-semibold ${
                  attached ? 'bg-tint text-brand' : 'bg-brand text-screen'
                }`}
              >
                <Paperclip size={14} /> {attached ? 'Attached' : 'Attach'}
              </button>
            </div>
          )}
        </div>
      )}
      {url && <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />}
    </div>
  )
}
