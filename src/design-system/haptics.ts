import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export type Hap = 'tick' | 'select' | 'impact' | 'success' | 'warn' | 'error' | 'none'

const isNative = Capacitor.isNativePlatform()

const PATTERNS: Record<Hap, number | number[]> = {
  tick: 7,
  select: 11,
  impact: 18,
  success: [12, 40, 22],
  warn: [22, 60, 22],
  error: [30, 45, 30, 45, 30],
  none: 0,
}

export function haptic(kind: Hap = 'tick') {
  if (kind === 'none') return

  if (isNative) {
    try {
      if (kind === 'success') Haptics.notification({ type: NotificationType.Success })
      else if (kind === 'warn') Haptics.notification({ type: NotificationType.Warning })
      else if (kind === 'error') Haptics.notification({ type: NotificationType.Error })
      else if (kind === 'impact') Haptics.impact({ style: ImpactStyle.Medium })
      else Haptics.impact({ style: ImpactStyle.Light })
    } catch { /* ignore */ }
    return
  }

  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch { /* ignore */ }
}
