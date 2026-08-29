import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import type { Surface } from './types'

const VALID: Surface[] = ['web', 'practitioner', 'patient']

function fromHash(): Surface | null {
  if (typeof location === 'undefined') return null
  const h = location.hash.replace('#', '') as Surface
  if (VALID.includes(h)) return h
  const env = import.meta.env.VITE_DEFAULT_SURFACE as string | undefined
  if (env && VALID.includes(env as Surface) && Capacitor.isNativePlatform()) return env as Surface
  return null
}

interface ShellState {
  surface: Surface | null
  setSurface: (s: Surface | null) => void
}

export const useShell = create<ShellState>((set) => ({
  surface: fromHash(),
  setSurface: (surface) => {
    if (typeof location !== 'undefined') location.hash = surface ?? ''
    set({ surface })
  },
}))

// exit to the launcher (mobile) — used by the discreet in-app "switch" control
export const exitToLauncher = () => useShell.getState().setSurface(null)
