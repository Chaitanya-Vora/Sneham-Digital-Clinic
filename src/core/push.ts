import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

// Registers this device for real OS-level push (the notification-shade
// kind, not the in-app toast/inbox kind) and saves the resulting token so
// the server knows where to send one. Native-only — there's no web
// equivalent, and this is never called on the web build anyway.
export async function registerForPushNotifications(userId: string, surface: 'practitioner' | 'patient') {
  if (!Capacitor.isNativePlatform()) return

  try {
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      const { error } = await supabase.from('push_tokens').upsert(
        { id: crypto.randomUUID(), user_id: userId, token: token.value, surface },
        { onConflict: 'user_id,token', ignoreDuplicates: true },
      )
      if (error) console.error('Saving push token failed:', error.message)
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration failed:', err.error)
    })
  } catch (e) {
    // Never let a push-setup failure block the rest of the app from loading.
    console.error('registerForPushNotifications:', e)
  }
}
