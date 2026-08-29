import { useEffect, useRef, useCallback } from 'react'

const SHAKE_THRESHOLD = 25
const SHAKE_INTERVAL = 300

export function useShake(onShake: () => void) {
  const lastShake = useRef(0)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastZ = useRef(0)
  const cb = useRef(onShake)
  cb.current = onShake

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return

    const dx = Math.abs(acc.x - lastX.current)
    const dy = Math.abs(acc.y - lastY.current)
    const dz = Math.abs(acc.z - lastZ.current)

    lastX.current = acc.x
    lastY.current = acc.y
    lastZ.current = acc.z

    if ((dx > SHAKE_THRESHOLD || dy > SHAKE_THRESHOLD || dz > SHAKE_THRESHOLD)) {
      const now = Date.now()
      if (now - lastShake.current > SHAKE_INTERVAL) {
        lastShake.current = now
        cb.current()
      }
    }
  }, [])

  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') return

    const requestPermission = async () => {
      if ('requestPermission' in DeviceMotionEvent) {
        try {
          const perm = await (DeviceMotionEvent as any).requestPermission()
          if (perm !== 'granted') return
        } catch { return }
      }
      window.addEventListener('devicemotion', handleMotion)
    }

    requestPermission()
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [handleMotion])
}
