import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

// Real external-share links (WhatsApp/SMS/Email), replacing what used to be
// pure UI state — selecting a channel toggled a tag on the record but never
// actually opened anything. Same open-external pattern already proven
// elsewhere in this app (patient app's Share/Export-my-data buttons).
function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) void Browser.open({ url }).catch(() => {})
  else window.open(url, '_blank', 'noopener,noreferrer')
}

// Patients' phone numbers are free-text ("+91 98765 43210", "9876543210",
// etc.) — normalise to a bare 91-prefixed number wa.me/sms: links expect.
function normalizeIndianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits.length >= 10 ? digits : null
}

export function shareViaWhatsApp(phone: string | undefined, message: string): boolean {
  const target = phone ? normalizeIndianPhone(phone) : null
  if (!target) return false
  openExternal(`https://wa.me/${target}?text=${encodeURIComponent(message)}`)
  return true
}

// No specific recipient on file (or none needed) — opens WhatsApp's own
// contact/chat picker with the message pre-filled, letting the sender pick
// who to send it to. Used for the instant-meeting link, which by design
// goes to someone who isn't necessarily a registered patient.
export function shareTextViaWhatsApp(message: string) {
  openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`)
}

export function shareViaSms(phone: string | undefined, message: string): boolean {
  const target = phone ? normalizeIndianPhone(phone) : null
  if (!target) return false
  openExternal(`sms:${target}?body=${encodeURIComponent(message)}`)
  return true
}

// Patients have no email field on file today — opens a blank-recipient
// compose window pre-filled with subject/body, which is still useful (she
// picks the recipient) rather than refusing to do anything.
export function shareViaEmail(email: string | undefined, subject: string, body: string) {
  openExternal(`mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
}
