// Real clinic branding, pulled from the practice's actual letterhead file
// (CLINIC LETTERHEAD.docx) rather than the text-only placeholder used before.
// Single source of truth for every PDF export — prescriptions, invoices,
// lab test orders — so the branding only needs to be right in one place.
//
// Images are imported with Vite's `?inline` suffix so Vite itself reads the
// file bytes and encodes them to a base64 data URI — no hand-transcribed
// base64 string that could get silently corrupted in the process.
import logoUrl from '../assets/sneham-logo.png?inline'
import signatureUrl from '../assets/neha-signature.png?inline'
// The clinic's printed documents use Outfit + Source Sans 3 (the same pair the
// app uses), trimmed to Latin so each is ~40 KB. `?inline` only base64-inlines
// image types in this Vite version, not fonts — so these are plain `?url`
// references, fetched and base64-encoded at runtime in pdfDesign.ts.
import outfitSemiboldUrl from '../assets/outfit-semibold.ttf?url'
import outfitBoldUrl from '../assets/outfit-bold.ttf?url'
import sourceSansRegularUrl from '../assets/sourcesans3-regular.ttf?url'
import sourceSansSemiboldUrl from '../assets/sourcesans3-semibold.ttf?url'
import sourceSansBoldUrl from '../assets/sourcesans3-bold.ttf?url'

export const CLINIC_DETAILS = {
  doctorName: 'Dr. Neha Bharadwajan Tripathi',
  credentials: 'M.D. (Homoeopathy)',
  registrationNo: 'Reg. 64691',
  address: 'Flat No. 1, Siddhakala Apartment, Opp. Kotak Mahindra Bank, Kaviltali, Chiplun – 415605',
  // The masthead prints the address on two lines, split as in the clinic's own design.
  addressLines: ['Flat No. 1, Siddhakala Apartment, Opp. Kotak Mahindra Bank,', 'Kaviltali, Chiplun – 415605 · www.snehamclinic.com'] as [string, string],
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
// The two typefaces of the clinic's printed documents (Design.pdf): Outfit for
// headings, Source Sans 3 for everything else — the same pair the app uses.
export const DESIGN_FONT_URLS = {
  outfitSemibold: outfitSemiboldUrl,
  outfitBold: outfitBoldUrl,
  sourceSansRegular: sourceSansRegularUrl,
  sourceSansSemibold: sourceSansSemiboldUrl,
  sourceSansBold: sourceSansBoldUrl,
}
