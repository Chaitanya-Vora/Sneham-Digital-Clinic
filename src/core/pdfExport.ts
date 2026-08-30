import { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'
import type { Prescription } from './types'
import { CLINIC_DETAILS, SNEHAM_LOGO_BASE64, NEHA_SIGNATURE_BASE64 } from './letterheadAssets'

const BRAND = '#41603C'
const INK = '#0F172A'
const MUTED = '#64748B'
const BORDER = '#d4d4d4'

/** Saves (web) or writes-to-cache-and-opens-native-share (native) a
 *  generated PDF. Shared by every export function in this file. */
async function savePdf(doc: jsPDF, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const base64 = doc.output('datauristring').split(',')[1]
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({ title: fileName, url: written.uri })
  } else {
    doc.save(fileName)
  }
}

/** Draws the real clinic letterhead (logo, name, address, website) at the
 *  top of a page and returns the y position to continue drawing from. */
function drawLetterhead(doc: jsPDF, pw: number, margin: number): number {
  let y = 10
  doc.setFillColor(BRAND)
  doc.rect(0, 0, pw, 2.5, 'F')

  const logoW = 26
  const logoH = logoW * (626 / 1042)
  doc.addImage(SNEHAM_LOGO_BASE64, 'PNG', margin, y, logoW, logoH)

  const textX = margin + logoW + 4
  let ty = y + 4
  doc.setFontSize(13)
  doc.setTextColor(BRAND)
  doc.text(CLINIC_DETAILS.clinicName, textX, ty)
  ty += 4.5
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  doc.text(CLINIC_DETAILS.tagline, textX, ty)
  y += logoH + 3

  doc.setFontSize(8.5)
  doc.setTextColor(INK)
  doc.text(CLINIC_DETAILS.doctorName, textX, ty + 3)

  y += 3
  doc.setFontSize(7)
  doc.setTextColor(MUTED)
  const addrLines = doc.splitTextToSize(
    `${CLINIC_DETAILS.credentials}, ${CLINIC_DETAILS.registrationNo}  ·  ${CLINIC_DETAILS.address}`,
    pw - margin * 2,
  )
  doc.text(addrLines, margin, y)
  y += addrLines.length * 3
  doc.text(CLINIC_DETAILS.website, margin, y)
  y += 4

  doc.setDrawColor(BRAND)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pw - margin, y)
  return y + 6
}

/** Draws the signature + doctor sign-off block, replacing the old
 *  "Signature: ____" placeholder line, and returns the y position after it. */
// Every official document is signed under Dr. Neha Tripathi, the clinic's
// registered principal practitioner — regardless of which practitioner
// (owner or assistant) actually published it in the app. The signature
// image is hers, so the printed name next to it always has to match.
function drawSignatureFooter(doc: jsPDF, pw: number, margin: number, y: number): number {
  const sigW = 22
  const sigH = sigW * (90 / 219)
  doc.addImage(NEHA_SIGNATURE_BASE64, 'JPEG', pw - margin - sigW, y - sigH + 2, sigW, sigH)

  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(CLINIC_DETAILS.doctorName, margin, y)
  let ty = y + 4
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  doc.text(`${CLINIC_DETAILS.credentials}, ${CLINIC_DETAILS.registrationNo}`, margin, ty)
  ty += 5
  doc.text(CLINIC_DETAILS.clinicName, margin, ty)
  doc.setFontSize(7)
  doc.text('Signature', pw - margin - sigW / 2, y + 3, { align: 'center' })
  return ty
}

export async function exportPrescriptionPdf(
  rx: Prescription,
  patientName: string,
  doctorName: string,
  _clinicName = 'Sneham Digital Clinic',
  doctorCredentials?: string,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const pw = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = drawLetterhead(doc, pw, margin)

  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  const dateStr = new Date(rx.publishedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  doc.text(`Date: ${dateStr}`, margin, y)
  doc.text(`Ref: ${rx.id.slice(0, 8).toUpperCase()}`, pw - margin, y, { align: 'right' })
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(`Patient: ${patientName}`, margin, y)
  y += 5
  doc.text(`Prescribing doctor: ${CLINIC_DETAILS.doctorName}`, margin, y)
  y += 12

  const boxW = pw - margin * 2
  let contentBottom: number

  if (rx.bodyText && rx.bodyText.trim()) {
    // Plain typed text, in the doctor's own words/shorthand — printed as-is,
    // the way it would look typed in a document and printed. No box, no
    // decoration: this is the actual prescription, not a UI summary of it.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(INK)
    const lines = doc.splitTextToSize(rx.bodyText, boxW)
    doc.text(lines, margin, y)
    contentBottom = y + lines.length * 5.5
  } else {
    // Older prescriptions with no freeform body: fall back to the
    // structured remedy/potency/dose card.
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(22)
    doc.setTextColor(BRAND)
    doc.text('Rx', margin, y)
    doc.setFont('helvetica', 'normal')
    y += 10

    doc.setDrawColor(BORDER)
    doc.setLineWidth(0.2)
    const boxTop = y - 2

    doc.setFontSize(16)
    doc.setTextColor(INK)
    doc.text(rx.remedy, margin + 6, y + 4)
    const remedyWidth = doc.getTextWidth(rx.remedy + '  ')

    doc.setFontSize(10)
    doc.setTextColor(BRAND)
    doc.text(rx.potency, margin + 6 + remedyWidth, y + 4)
    y += 12

    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    const details = [
      `${rx.doseGlobules} globules`,
      rx.repetition,
      rx.durationDays ? `${rx.durationDays} days` : 'Until settled',
    ].join('  ·  ')
    doc.text(details, margin + 6, y)
    y += 5

    if (rx.preparation) {
      y += 2
      doc.setFontSize(8)
      doc.setTextColor(MUTED)
      const prepLines = doc.splitTextToSize(rx.preparation, boxW - 12)
      doc.text(prepLines, margin + 6, y)
      y += prepLines.length * 3.5
    }

    const boxBottom = y + 4
    doc.roundedRect(margin, boxTop, boxW, boxBottom - boxTop, 3, 3, 'S')
    contentBottom = boxBottom
  }

  y = contentBottom + 14
  doc.setDrawColor(BORDER)
  doc.line(margin, y - 8, pw - margin, y - 8)
  drawSignatureFooter(doc, pw, margin, y)

  const fileName = `Rx_${rx.remedy.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdf(doc, fileName)
}

export interface InvoiceInput {
  id: string
  patientName: string
  patientCode?: string
  doctorName: string
  doctorCredentials?: string
  clinicName?: string
  date: string // ISO
  reason?: string
  fee: number
  paymentMode: string
  paymentStatus: 'paid' | 'unpaid' | 'waived'
}

export async function exportInvoicePdf(invoice: InvoiceInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const pw = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = drawLetterhead(doc, pw, margin)

  const dateStr = new Date(invoice.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(`Date: ${dateStr}`, margin, y)
  doc.text(`Invoice: ${invoice.id.slice(0, 8).toUpperCase()}`, pw - margin, y, { align: 'right' })
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(`Patient: ${invoice.patientName}${invoice.patientCode ? ` (${invoice.patientCode})` : ''}`, margin, y)
  y += 10

  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('Consultation Invoice', margin, y)
  y += 10

  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.2)
  const boxTop = y - 2
  const boxW = pw - margin * 2

  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text(invoice.reason || 'Consultation', margin + 6, y + 4)
  y += 12

  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(`Payment mode: ${invoice.paymentMode}`, margin + 6, y)
  y += 6
  doc.text(`Status: ${invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus === 'waived' ? 'Waived' : 'Unpaid'}`, margin + 6, y)
  y += 8

  doc.setFontSize(18)
  doc.setTextColor(BRAND)
  doc.text(`Rs. ${invoice.fee.toLocaleString('en-IN')}`, margin + 6, y)
  y += 8

  const boxBottom = y
  doc.roundedRect(margin, boxTop, boxW, boxBottom - boxTop, 3, 3, 'S')
  y = boxBottom + 14

  doc.setDrawColor(BORDER)
  doc.line(margin, y - 8, pw - margin, y - 8)
  drawSignatureFooter(doc, pw, margin, y)

  const fileName = `Invoice_${invoice.patientName.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdf(doc, fileName)
}
