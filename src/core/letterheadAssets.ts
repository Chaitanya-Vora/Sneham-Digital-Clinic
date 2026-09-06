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
// jsPDF's base14 "helvetica" has no ₹ (Rupee) glyph — it silently prints a
// tofu substitute instead of erroring, which is how the invoice PDF's ₹
// signs came out as stray superscript digits. Roboto (Apache-2.0, Google's
// own font) does have it. Subset down to just the glyphs the invoice PDF
// actually uses — printable ASCII plus ₹ · — via fonttools, so this stays a
// few KB instead of a full ~170KB family.
// `?inline` only base64-inlines image types in this Vite version, not fonts
// (confirmed: it still emits a separate asset + a URL reference even in a
// production build) — so these are plain `?url` references, fetched and
// base64-encoded at runtime in pdfExport.ts, same as the prescription
// letterhead PDF template already is.
import robotoRegularUrl from '../assets/roboto-regular.ttf?url'
import robotoBoldUrl from '../assets/roboto-bold.ttf?url'

export const CLINIC_DETAILS = {
  doctorName: 'Dr. Neha Bharadwajan Tripathi',
  credentials: 'M.D (Homoeopathy)',
  registrationNo: 'Reg: 64691',
  address: 'Flat No 1, Siddhakala apartment, Opp. Kotak Mahindra Bank, Kaviltali, Chiplun- 415605',
  website: 'www.snehamclinic.com',
  clinicName: 'Sneham Digital Clinic',
  tagline: 'Healing with compassion',
  // Invoice-only fields — sourced from her actual current billing PDF, not
  // used by the prescription/investigation letterhead.
  phone: '9096745734',
  email: 'snehamdigitalclinic@gmail.com',
  bankName: 'Hdfc Bank, Mumbai - Colaba',
  bankAccountNo: '50100237586908',
  bankIfsc: 'HDFC0000085',
  bankAccountHolder: 'Dr. Neha Bharadwajan',
  upiVpa: 'dr.nehabharadwajan@okhdfcbank',
}

export const SNEHAM_LOGO_BASE64 = logoUrl
export const NEHA_SIGNATURE_BASE64 = signatureUrl
export const ROBOTO_REGULAR_URL = robotoRegularUrl
export const ROBOTO_BOLD_URL = robotoBoldUrl
