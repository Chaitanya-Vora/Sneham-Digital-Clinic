import type { Invoice, InvoiceLineItem } from './types'
import { CLINIC_DETAILS } from './letterheadAssets'

// Single source of truth for the default consult fee — this used to be the
// bare literal 1500 duplicated independently in four places (two billing
// forms, two revenue stats), so a real fee change meant editing four files
// and easily missing one.
export const DEFAULT_CONSULT_FEE = 950

export function invoiceTotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
}

export function invoiceBalance(invoice: Pick<Invoice, 'items' | 'amountReceived'>): number {
  return Math.max(0, invoiceTotal(invoice.items) - invoice.amountReceived)
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigitWords(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ` ${ONES[o]}` : '')
}

function threeDigitWords(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h === 0) return twoDigitWords(rest)
  return `${ONES[h]} Hundred${rest ? ` and ${twoDigitWords(rest)}` : ''}`
}

// Indian numbering (thousand / lakh / crore groups), matching the exact
// phrasing her current billing software prints — e.g. 1920 becomes "One
// Thousand Nine Hundred and Twenty Rupees only".
export function numberToWordsIndian(amount: number): string {
  const n = Math.max(0, Math.round(amount))
  if (n === 0) return 'Zero Rupees only'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor(n / 100000) % 100
  const thousand = Math.floor(n / 1000) % 100
  const hundredRest = n % 1000
  const parts: string[] = []
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`)
  if (hundredRest) parts.push(threeDigitWords(hundredRest))
  return `${parts.join(' ')} Rupees only`
}

// A real, scannable UPI payment link — same VPA and link shape as her
// actual current bills (decoded directly from a reference invoice's QR
// code), asking for the outstanding balance rather than always the full
// total, so a reprinted partially-paid invoice doesn't double-request what
// she's already received.
export function buildUpiLink(amountDue: number, invoiceNo: number): string {
  const amount = Math.max(0, amountDue).toFixed(2)
  const payee = encodeURIComponent(CLINIC_DETAILS.clinicName)
  return `upi://pay?pa=${CLINIC_DETAILS.upiVpa}&pn=${payee}&am=${amount}&tn=${invoiceNo}&cu=INR`
}
