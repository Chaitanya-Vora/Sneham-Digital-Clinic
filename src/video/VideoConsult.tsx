import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { JitsiMeeting } from '@jitsi/react-sdk'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import {
  PhoneDisconnect,
  Clock,
  User,
  VideoCamera,
  ArrowLeft,
} from '@phosphor-icons/react'

interface Props {
  patientName: string
  practitionerName: string
  appointmentId: string
  onEnd: (summary: { duration: number }) => void
}

export function VideoConsult({ patientName, practitionerName, appointmentId, onEnd }: Props) {
  const [stage, setStage] = useState<'waiting' | 'live' | 'ended'>('waiting')
  const [elapsed, setElapsed] = useState(0)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const apiRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const startTimeRef = useRef(0)

  const roomName = `sneham-consult-${appointmentId.replace(/[^a-zA-Z0-9]/g, '')}`
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    if (isNative) {
      Browser.open({ url: `https://meet.jit.si/${roomName}` }).catch(() => {})
      setStage('live')
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    }
    return () => {
      clearInterval(timerRef.current)
    }
  }, [isNative, roomName])

  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const handleCallEnd = useCallback(() => {
    clearInterval(timerRef.current)
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)
    setStage('ended')
    onEndRef.current({ duration: Math.max(duration, 0) })
  }, [])

  const handleApiReady = useCallback((api: any) => {
    apiRef.current = api

    api.addListener('videoConferenceJoined', () => {
      setStage('live')
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    })

    api.addListener('videoConferenceLeft', () => {
      handleCallEnd()
    })

    api.addListener('readyToClose', () => {
      handleCallEnd()
    })
  }, [handleCallEnd])

  const endCall = () => {
    setShowEndConfirm(false)
    apiRef.current?.executeCommand('hangup')
    handleCallEnd()
  }

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (stage === 'ended') {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-[#1a1a1a]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Clock size={32} weight="fill" className="text-white/60" />
          </div>
          <p className="mt-4 font-display text-[18px] font-semibold text-white">Call ended</p>
          <p className="mt-1 text-[14px] text-white/50">Duration: {fmtTime(elapsed)}</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-[#1a1a1a]">
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--app-top) + 4px)' }}>
        <button
          onClick={() => setShowEndConfirm(true)}
          className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/80 backdrop-blur"
        >
          <ArrowLeft size={14} weight="bold" /> Back
        </button>
        {stage === 'live' && (
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-[13px] font-semibold text-white">{fmtTime(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Jitsi meeting embed */}
      <div className="flex-1">
        {stage === 'waiting' && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <User size={40} weight="fill" className="text-white/50" />
            </div>
            <p className="mt-4 font-display text-[18px] font-semibold text-white">{patientName}</p>
            <p className="mt-1 text-[14px] text-white/40">Connecting to video call...</p>
            <div className="mt-4 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          </div>
        )}
        <div className={`h-full w-full ${stage === 'waiting' ? 'absolute inset-0 opacity-0' : ''}`}>
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomName}
            configOverwrite={{
              startWithAudioMuted: false,
              startWithVideoMuted: false,
              prejoinPageEnabled: false,
              disableThirdPartyRequests: true,
              disableDeepLinking: true,
              enableClosePage: false,
              hideConferenceSubject: true,
              subject: `Consult · ${patientName}`,
            }}
            interfaceConfigOverwrite={{
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              SHOW_BRAND_WATERMARK: false,
              MOBILE_APP_PROMO: false,
              SHOW_CHROME_EXTENSION_BANNER: false,
              TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'chat', 'hangup',
                'fullscreen', 'tileview', 'settings',
              ],
              DEFAULT_BACKGROUND: '#1a1a1a',
            }}
            userInfo={{
              displayName: practitionerName,
              email: '',
            }}
            onApiReady={handleApiReady}
            getIFrameRef={(iframe) => {
              iframe.style.height = '100%'
              iframe.style.width = '100%'
              iframe.style.border = 'none'
            }}
          />
        </div>
      </div>

      {/* Floating end-call button */}
      {stage === 'live' && (
        <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center">
          <button
            onClick={() => setShowEndConfirm(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white shadow-lg transition hover:brightness-90"
          >
            <PhoneDisconnect size={24} weight="fill" />
          </button>
        </div>
      )}

      {/* End call confirmation */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-6 w-full max-w-[320px] rounded-2xl bg-[#2a2a2a] p-6 text-center"
            >
              <p className="font-display text-[18px] font-semibold text-white">End this call?</p>
              {elapsed > 0 && <p className="mt-2 text-[14px] text-white/50">Duration: {fmtTime(elapsed)}</p>}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 rounded-xl bg-white/10 py-3 text-[14px] font-semibold text-white transition hover:bg-white/20"
                >
                  Continue
                </button>
                <button
                  onClick={endCall}
                  className="flex-1 rounded-xl bg-danger py-3 text-[14px] font-semibold text-white transition hover:brightness-90"
                >
                  End call
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
