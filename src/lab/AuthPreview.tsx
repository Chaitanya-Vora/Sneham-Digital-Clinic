import { useState } from 'react'
import { AuthContext, type AuthCtx } from '../auth/AuthProvider'
import { SignupScreen } from '../auth/SignupScreen'
import { LoginScreen } from '../auth/LoginScreen'
import { ForgotPasswordScreen } from '../auth/ForgotPasswordScreen'
import { PatientSelfRegister } from '../patient/PatientApp'

// Dev-only: the real sign-in / sign-up screens with a fake auth (nothing is sent anywhere).
// Open lab.html#auth on a phone-sized window.
const fake = (over: Partial<AuthCtx> = {}): AuthCtx => ({
  user: null, session: null, loading: false, oauthError: null, passwordRecovery: false, justConfirmedSignup: false,
  signUp: async () => { await new Promise((r) => setTimeout(r, 600)); return { error: null } },
  signIn: async () => ({ error: 'Invalid login credentials' }),
  signInWithGoogle: async () => ({ error: null }), signOut: async () => {},
  resetPassword: async () => ({ error: null }), updatePassword: async () => ({ error: null }),
  cancelPasswordRecovery: () => {}, dismissSignupConfirmation: () => {}, ...over,
})

export function AuthPreview() {
  const [screen, setScreen] = useState<'signup' | 'login' | 'forgot'>((new URLSearchParams(location.search).get('screen') as 'signup') || 'signup')
  // The patient's first-run form, inside a phone-height frame (do NOT press Get started — that writes a real patient).
  if (new URLSearchParams(location.search).get('screen') === 'register') return <AuthContext.Provider value={fake()}><div className="h-[100dvh]"><PatientSelfRegister /></div></AuthContext.Provider>
  return (
    <AuthContext.Provider value={fake()}>
      {screen === 'signup' ? <SignupScreen onSwitch={setScreen} /> : screen === 'forgot' ? <ForgotPasswordScreen onSwitch={setScreen} /> : <LoginScreen onSwitch={setScreen} />}
    </AuthContext.Provider>
  )
}
