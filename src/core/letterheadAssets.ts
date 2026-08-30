// Real clinic branding, pulled from the practice's actual letterhead file
// (CLINIC LETTERHEAD.docx) rather than the text-only placeholder used before.
// Single source of truth for every PDF export — prescriptions, invoices,
// lab test orders — so the branding only needs to be right in one place.
//
// Images are imported with Vite's `?inline` suffix so Vite itself reads the
// file bytes and encodes them to a base64 data URI — no hand-transcribed
// base64 string that could get silently corrupted in the process.
import logoUrl from '../assets/sneham-logo.png?inline'
import signatureUrl from '../assets/neha-signature.jpeg?inline'

export const CLINIC_DETAILS = {
  doctorName: 'Dr. Neha Bharadwajan Tripathi',
  credentials: 'M.D (Homoeopathy)',
  registrationNo: 'Reg: 64691',
  address: 'Flat No 1, Siddhakala apartment, Opp. Kotak Mahindra Bank, Kaviltali, Chiplun- 415605',
  website: 'www.snehamclinic.com',
  clinicName: 'Sneham Digital Clinic',
  tagline: 'Healing with compassion',
}

export const SNEHAM_LOGO_BASE64 = logoUrl
export const NEHA_SIGNATURE_BASE64 = signatureUrl
