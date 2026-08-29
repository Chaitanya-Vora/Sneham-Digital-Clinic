import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowsClockwise, Sparkle } from '@phosphor-icons/react'
import { useShake } from './useShake'
import { haptic } from './haptics'

export function UpdatePrompt() {
  const [checking, setChecking] = useState(false)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  const checkForUpdate = useCallback(async () => {
    if (checking) return
    setChecking(true)
    haptic('tick')

    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) {
        await reg.update()
        if (reg.waiting) {
          setHasUpdate(true)
          setShowBanner(true)
          haptic('success')
        } else {
          setShowBanner(true)
          setTimeout(() => setShowBanner(false), 2000)
        }
      }
    } catch {
      // offline or no SW
    }
    setChecking(false)
  }, [checking])

  useShake(checkForUpdate)

  const applyUpdate = () => {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      reg?.waiting?.postMessage('SKIP_WAITING')
      window.location.reload()
    })
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed left-4 right-4 top-[calc(var(--app-top)+4px)] z-[200] flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-float"
        >
          {hasUpdate ? (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tint text-brand">
                <Sparkle size={20} weight="fill" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">Update available</div>
                <div className="text-[12px] text-muted">A new version is ready</div>
              </div>
              <button
                onClick={applyUpdate}
                className="rounded-pill bg-brand px-4 py-2 text-[13px] font-semibold text-white"
              >
                Update
              </button>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tint text-brand">
                <ArrowsClockwise size={20} weight="bold" className={checking ? 'animate-spin' : ''} />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">
                  {checking ? 'Checking...' : 'You\'re up to date'}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
