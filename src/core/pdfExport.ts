import { jsPDF } from 'jspdf'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { Capacitor } from '@capacitor/core'
import type { Prescription, Patient, InvestigationOrder, Invoice, Outcome } from './types'
import { CLINIC_DETAILS, SNEHAM_LOGO_BASE64, NEHA_SIGNATURE_BASE64, ROBOTO_REGULAR_URL, ROBOTO_BOLD_URL } from './letterheadAssets'
import { INVESTIGATION_CATALOG } from './investigations'
import { invoiceTotal, invoiceBalance, numberToWordsIndian, buildUpiLink } from './billing'
import prescriptionLetterheadUrl from '../assets/prescription-letterhead.pdf?url'

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Same save/share behavior as savePdf, for output produced by pdf-lib
 *  (a raw byte array) rather than jsPDF. */
async function savePdfBytes(bytes: Uint8Array, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const written = await Filesystem.writeFile({
      path: fileName,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    })
    await Share.share({ title: fileName, url: written.uri })
  } else {
    const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
}

// Fetched once per session and reused — every invoice after the first
// registers the font from this cache instead of re-fetching it.
let robotoBase64Cache: { regular: string; bold: string } | null = null
async function loadRobotoBase64() {
  if (robotoBase64Cache) return robotoBase64Cache
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(ROBOTO_REGULAR_URL).then((r) => r.arrayBuffer()),
    fetch(ROBOTO_BOLD_URL).then((r) => r.arrayBuffer()),
  ])
  robotoBase64Cache = {
    regular: bytesToBase64(new Uint8Array(regularBytes)),
    bold: bytesToBase64(new Uint8Array(boldBytes)),
  }
  return robotoBase64Cache
}

/** Registers the Roboto subset (see letterheadAssets.ts) as this jsPDF
 *  instance's default font, in place of the base14 "helvetica" — which has
 *  no ₹ glyph and silently substitutes a stray character for it. Font
 *  registration is per-instance, so this must run once per `new jsPDF()`. */
async function registerInvoiceFont(doc: jsPDF) {
  const { regular, bold } = await loadRobotoBase64()
  doc.addFileToVFS('Roboto-Regular.ttf', regular)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', bold)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
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

// Exact coordinates measured from the real letterhead file (pdftotext -bbox
// on prescription-letterhead.pdf), in that PDF's own page space (1190x1683pt
// — the original design at 2x, same proportions as A4). Top-down y, matching
// how they were measured; convert to pdf-lib's bottom-up y at draw time.
// The template itself is never redrawn or altered — only these values (and
// the body text below) get placed on top of it, at its own font size.
const RX_TEMPLATE_FONT_SIZE = 22.31 // the template's own placeholder-line size, read directly off its embedded font (not a theoretical 2x scale)
const RX_FIELDS = {
  // patientName/diagnosis carry a maxWidth: both are free-length text on a
  // fixed printed blank, so a long value shrinks to fit that blank instead
  // of running off the end of the line.
  patientName: { x: 255, yMax: 325.9, maxWidth: 232 },
  date: { x: 657, yMax: 325.9 },
  age: { x: 165, yMax: 370.9 },
  sex: { x: 721, yMax: 370.9 },
  diagnosis: { x: 220, yMax: 416.9, maxWidth: 187 },
}
const RX_FIELD_MIN_FONT_SIZE = 13 // never shrink small enough to look like a footnote
const RX_BODY_TOP = 470 // below "Diagnosis", well clear of the signature block near the bottom
const RX_BODY_LEFT = 116 // aligned with the left margin the placeholder labels use
const RX_BODY_RIGHT = 1074 // page width (1190) minus a matching right margin

// Shared by every document type printed on the real letterhead
// (prescriptions, investigation orders): load the immutable template and
// its own font, ready for placeholder text to be drawn on top.
async function loadLetterheadTemplate() {
  const templateBytes = await fetch(prescriptionLetterheadUrl).then((r) => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(templateBytes)
  const page = pdfDoc.getPages()[0]
  const { height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  return { pdfDoc, page, height, font }
}

// Patient Name / Date / Age / Sex / Diagnosis — the same five placeholders
// on the letterhead regardless of what kind of document is being printed.
function drawPatientInfoFields(
  page: import('pdf-lib').PDFPage,
  font: import('pdf-lib').PDFFont,
  height: number,
  patient: Patient,
  dateStr: string,
  diagnosisText: string,
) {
  const black = rgb(0, 0, 0)
  // yMax from pdftotext is the bottom edge of the label's bounding box in
  // top-down coordinates; nudging up lands on the baseline, sitting just
  // above the printed rule rather than resting on it.
  const toBaselineY = (yMax: number) => height - yMax + 8

  const put = (text: string, field: { x: number; yMax: number; maxWidth?: number }) => {
    let size = RX_TEMPLATE_FONT_SIZE
    if (field.maxWidth) {
      while (size > RX_FIELD_MIN_FONT_SIZE && font.widthOfTextAtSize(text, size) > field.maxWidth) {
        size -= 0.5
      }
      size = Math.max(size, RX_FIELD_MIN_FONT_SIZE)
    }
    page.drawText(text, { x: field.x, y: toBaselineY(field.yMax), size, font, color: black })
  }
  put(patient.name, RX_FIELDS.patientName)
  put(dateStr, RX_FIELDS.date)
  put(String(patient.age), RX_FIELDS.age)
  put(patient.sex, RX_FIELDS.sex)
  put(diagnosisText, RX_FIELDS.diagnosis)
}

// The free-form block below Diagnosis — word-wrapped at the template's own
// font size, one paragraph per '\n'-separated chunk of the input.
function drawWrappedBody(page: import('pdf-lib').PDFPage, font: import('pdf-lib').PDFFont, height: number, text: string) {
  const black = rgb(0, 0, 0)
  const maxWidth = RX_BODY_RIGHT - RX_BODY_LEFT
  const lineHeight = RX_TEMPLATE_FONT_SIZE * 1.35
  let by = height - RX_BODY_TOP
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(attempt, RX_TEMPLATE_FONT_SIZE) > maxWidth && line) {
        page.drawText(line, { x: RX_BODY_LEFT, y: by, size: RX_TEMPLATE_FONT_SIZE, font, color: black })
        by -= lineHeight
        line = word
      } else {
        line = attempt
      }
    }
    page.drawText(line, { x: RX_BODY_LEFT, y: by, size: RX_TEMPLATE_FONT_SIZE, font, color: black })
    by -= lineHeight
  }
}

const rxDateFormat = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export async function exportPrescriptionPdf(rx: Prescription, patient: Patient) {
  const { pdfDoc, page, height, font } = await loadLetterheadTemplate()
  const dateStr = rxDateFormat(rx.publishedAt ?? rx.createdAt)
  drawPatientInfoFields(page, font, height, patient, dateStr, patient.chiefComplaint || '—')

  // The prescription body — exactly what the doctor typed, verbatim, at the
  // same size/style as the rest of the letterhead. No box, no remedy name
  // forced in: whatever she wrote is what prints.
  const bodyText = (rx.bodyText && rx.bodyText.trim()) || `${rx.remedy} ${rx.potency} — ${rx.doseGlobules} globules, ${rx.repetition}`
  drawWrappedBody(page, font, height, bodyText)

  const bytes = await pdfDoc.save()
  const fileName = `Rx_${patient.name.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdfBytes(bytes, fileName)
}

// Investigation orders print on the same real letterhead as prescriptions
// (the practice has no separate format for these) — same placeholders,
// with the selected tests, grouped by category, filling the body instead
// of a remedy.
export async function exportInvestigationOrderPdf(order: InvestigationOrder, patient: Patient) {
  const { pdfDoc, page, height, font } = await loadLetterheadTemplate()
  const dateStr = rxDateFormat(order.createdAt)
  drawPatientInfoFields(page, font, height, patient, dateStr, order.notes.trim() || patient.chiefComplaint || '—')

  const selected = new Set(order.tests)
  const lines = INVESTIGATION_CATALOG
    .map((c) => ({ category: c.category, tests: c.tests.filter((t) => selected.has(t)) }))
    .filter((c) => c.tests.length > 0)
    .map((c) => `${c.category}: ${c.tests.join(', ')}`)
  drawWrappedBody(page, font, height, lines.join('\n') || '—')

  const bytes = await pdfDoc.save()
  const fileName = `Investigations_${patient.name.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdfBytes(bytes, fileName)
}

// Matches the format of the real invoices she already sends (a reference
// bill from her existing billing software) — itemized lines, totals, real
// bank/UPI payment details with a genuinely scannable QR code. Same
// letterhead-drawing helpers as every other PDF here; the bank/UPI/QR block
// and item table are new.
export async function exportInvoicePdf(invoice: Invoice, patient: Patient) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  await registerInvoiceFont(doc)
  const pw = doc.internal.pageSize.getWidth()
  const margin = 16
  const contentW = pw - margin * 2
  let y = drawLetterhead(doc, pw, margin)

  const dateStr = new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const total = invoiceTotal(invoice.items)
  const balance = invoiceBalance(invoice)
  const statusLabel = invoice.status === 'paid' ? 'Paid' : invoice.status === 'partial' ? 'Partially paid'
    : invoice.status === 'waived' ? 'Waived' : invoice.status === 'cancelled' ? 'Cancelled' : 'Unpaid'

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(BRAND)
  doc.text('Invoice', pw / 2, y + 4, { align: 'center' })
  y += 14

  if (invoice.status === 'cancelled') {
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(11)
    doc.setTextColor('#DC2626')
    doc.text('CANCELLED', pw / 2, y, { align: 'center' })
    y += 8
  }

  // Bill To / Invoice Details
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text('Bill To', margin, y)
  doc.text('Invoice Details', pw - margin, y, { align: 'right' })
  y += 5
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text(patient.name, margin, y)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text(`Invoice No.: ${invoice.invoiceNo}`, pw - margin, y, { align: 'right' })
  y += 5
  doc.text(`${patient.age}y · ${patient.sex} · ${patient.wsCode}`, margin, y)
  doc.text(`Date: ${dateStr}`, pw - margin, y, { align: 'right' })
  y += 10

  // Item table
  const col = { num: margin, item: margin + 10, qty: margin + 92, price: margin + 122, amount: margin + contentW }
  doc.setFillColor(BRAND)
  doc.rect(margin, y - 4.5, contentW, 7, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor('#FFFFFF')
  doc.text('#', col.num + 2, y)
  doc.text('Item name', col.item, y)
  doc.text('Quantity', col.qty, y, { align: 'right' })
  doc.text('Price/unit', col.price, y, { align: 'right' })
  doc.text('Amount', col.amount, y, { align: 'right' })
  y += 7

  doc.setFont('Roboto', 'normal')
  doc.setTextColor(INK)
  invoice.items.forEach((item, i) => {
    doc.text(String(i + 1), col.num + 2, y)
    doc.text(item.name, col.item, y)
    doc.text(String(item.qty), col.qty, y, { align: 'right' })
    doc.text(`₹ ${item.unitPrice.toLocaleString('en-IN')}`, col.price, y, { align: 'right' })
    doc.text(`₹ ${(item.qty * item.unitPrice).toLocaleString('en-IN')}`, col.amount, y, { align: 'right' })
    y += 6
    if (i < invoice.items.length - 1) {
      doc.setDrawColor(BORDER)
      doc.setLineWidth(0.15)
      doc.line(margin, y - 4.5, pw - margin, y - 4.5)
    }
  })
  y += 1
  doc.setDrawColor(INK)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pw - margin, y)
  y += 5
  doc.setFont('Roboto', 'bold')
  const totalQty = invoice.items.reduce((s, i) => s + i.qty, 0)
  doc.text('Total', col.item, y)
  doc.text(String(totalQty), col.qty, y, { align: 'right' })
  doc.text(`₹ ${total.toLocaleString('en-IN')}`, col.amount, y, { align: 'right' })
  y += 10

  // Two-column summary: words + terms (left) / sub-total..payment mode (right)
  const leftW = contentW * 0.55
  const rightX = margin + leftW + 8
  const rightW = contentW - leftW - 8
  const summaryTop = y

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text('Invoice Amount In Words', margin, y)
  y += 4.5
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  const wordsLines = doc.splitTextToSize(numberToWordsIndian(total), leftW)
  doc.text(wordsLines, margin, y)
  y += wordsLines.length * 4.2 + 4

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text('Terms And Conditions', margin, y)
  y += 4.5
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(INK)
  const terms = `Please scan the QR code to pay via UPI, or send to ${CLINIC_DETAILS.phone} on Google Pay / PhonePe. Please mention the patient's name with the payment.`
  const termsLines = doc.splitTextToSize(terms, leftW)
  doc.text(termsLines, margin, y)
  const leftBottom = y + termsLines.length * 3.8

  let ry = summaryTop
  const summaryRow = (label: string, value: string, opts?: { bold?: boolean; highlight?: boolean }) => {
    if (opts?.highlight) {
      doc.setFillColor(BRAND)
      doc.rect(rightX - 2, ry - 3.6, rightW + 2, 5.6, 'F')
      doc.setTextColor('#FFFFFF')
    } else {
      doc.setTextColor(INK)
    }
    doc.setFont('Roboto', opts?.bold || opts?.highlight ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.text(label, rightX, ry)
    doc.text(value, rightX + rightW, ry, { align: 'right' })
    ry += 6
  }
  summaryRow('Sub Total', `₹ ${total.toLocaleString('en-IN')}`)
  summaryRow('Total', `₹ ${total.toLocaleString('en-IN')}`, { highlight: true })
  summaryRow('Received', `₹ ${invoice.amountReceived.toLocaleString('en-IN')}`)
  summaryRow('Balance', `₹ ${balance.toLocaleString('en-IN')}`, { bold: true })
  summaryRow('Payment Mode', invoice.paymentMode)
  summaryRow('Status', statusLabel, { bold: true })

  y = Math.max(leftBottom, ry) + 10

  // Bank/UPI (left) + signature (right)
  const qrSize = 26
  try {
    const qrDataUrl = await QRCode.toDataURL(buildUpiLink(balance, invoice.invoiceNo), { margin: 0, width: 256 })
    doc.addImage(qrDataUrl, 'PNG', margin, y, qrSize, qrSize)
  } catch {
    // If QR generation fails for any reason, the bank details below still
    // let the patient pay manually — never block the whole invoice on it.
  }
  const bankX = margin + qrSize + 6
  let by = y + 4
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text('Pay To:', bankX, by)
  by += 5
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  const bankLines = [
    `Bank Name: ${CLINIC_DETAILS.bankName}`,
    `Account No.: ${CLINIC_DETAILS.bankAccountNo}`,
    `IFSC: ${CLINIC_DETAILS.bankIfsc}`,
    `Account Holder: ${CLINIC_DETAILS.bankAccountHolder}`,
    `UPI: ${CLINIC_DETAILS.phone}`,
  ]
  for (const line of bankLines) {
    const wrapped = doc.splitTextToSize(line, contentW * 0.55 - qrSize - 6)
    doc.text(wrapped, bankX, by)
    by += wrapped.length * 3.6
  }

  drawSignatureFooter(doc, pw, margin, y + qrSize + 6)

  const fileName = `Invoice_${invoice.invoiceNo}_${patient.name.replace(/\s/g, '_')}.pdf`
  await savePdf(doc, fileName)
}
// ── PATIENT HISTORY SUMMARY (for a second-opinion / referral export) ──
// One consolidated document a practitioner can hand to another doctor —
// real remedy names throughout (this is doctor-to-doctor, not the
// patient-facing prescription slip's bodyText-only convention). Cancelled
// prescriptions are included, clearly marked, for a complete clinical
// picture; drafts are excluded (never finalized). Built on the same
// general letterhead/font helpers exportInvoicePdf uses, not the
// prescription-slip-specific helpers, since this is its own multi-page,
// multi-section document.
function historyDateFmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// A section header with a thin brand-colored rule beneath it and a
// generous gap before — the visual device that gives this document real
// hierarchy instead of same-weight text stacked top to bottom.
function drawHistorySectionHeader(doc: jsPDF, margin: number, contentW: number, y: number, label: string): number {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(BRAND)
  doc.text(label.toUpperCase(), margin, y)
  doc.setDrawColor(BRAND)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, margin + contentW, y + 2)
  return y + 9
}

function drawHistoryDivider(doc: jsPDF, margin: number, contentW: number, y: number) {
  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.15)
  doc.line(margin, y, margin + contentW, y)
}

export async function exportPatientHistoryPdf(
  patient: Patient,
  prescriptions: Prescription[],
  investigationOrders: InvestigationOrder[],
  outcomes: Outcome[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  await registerInvoiceFont(doc)
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pw - margin * 2
  const pageBottom = ph - margin - 8

  const ensureRoom = (needed: number, y: number): number => {
    if (y + needed <= pageBottom) return y
    doc.addPage()
    return drawLetterhead(doc, pw, margin)
  }

  let y = drawLetterhead(doc, pw, margin)

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(BRAND)
  doc.text('Patient Summary', pw / 2, y + 5, { align: 'center' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text('Prepared for professional reference / clinical consultation', pw / 2, y + 11, { align: 'center' })
  y += 20

  // Patient info block — a real card, not just left-aligned text, so this
  // reads as the document's anchor rather than one more line of copy.
  const infoBoxH = 30
  doc.setFillColor('#F4F6F8')
  doc.setDrawColor('#E2E5E9')
  doc.setLineWidth(0.2)
  doc.roundedRect(margin, y, contentW, infoBoxH, 2.5, 2.5, 'FD')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text(patient.name, margin + 6, y + 8)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text(`${patient.age}y · ${patient.sex} · ${patient.wsCode} · ${patient.location}`, margin + 6, y + 13.5)

  const col2X = margin + contentW * 0.52
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8.2)
  doc.setTextColor(MUTED)
  doc.text('CHIEF COMPLAINT', margin + 6, y + 20)
  doc.text('CURRENT REMEDY', col2X, y + 20)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(patient.chiefComplaint || '—', margin + 6, y + 24.5, { maxWidth: contentW * 0.48 - 8 })
  doc.text(patient.currentRemedy || '—', col2X, y + 24.5, { maxWidth: contentW * 0.48 - 8 })
  y += infoBoxH + 5

  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.2)
  doc.setTextColor(MUTED)
  doc.text(`Allergies: ${patient.allergies || 'None recorded'}   ·   Regular medication: ${patient.regularMedication || 'None recorded'}`, margin, y)
  y += 10

  const sortedRx = [...prescriptions]
    .filter((r) => r.status !== 'draft')
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
  const sortedInvestigations = [...investigationOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const sortedOutcomes = [...outcomes].sort((a, b) => b.date.localeCompare(a.date))

  // Prescription history
  y = ensureRoom(20, y)
  y = drawHistorySectionHeader(doc, margin, contentW, y, 'Prescription history')
  if (sortedRx.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    doc.text('No prescriptions on record.', margin, y)
    y += 8
  } else {
    sortedRx.forEach((r, i) => {
      y = ensureRoom(13, y)
      const cancelled = r.status === 'cancelled'
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(cancelled ? MUTED : INK)
      const title = `${r.remedy} ${r.potency}`
      doc.text(title, margin, y)
      if (cancelled) {
        const w = doc.getTextWidth(title)
        doc.setDrawColor(MUTED)
        doc.setLineWidth(0.3)
        doc.line(margin, y - 1.3, margin + w, y - 1.3)
      }
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(MUTED)
      doc.text(historyDateFmt(r.publishedAt ?? r.createdAt), pw - margin, y, { align: 'right' })
      y += 4.8
      doc.setTextColor(cancelled ? MUTED : MUTED)
      doc.text(
        `${r.repetition} · ${r.doseGlobules} globules${r.durationDays ? ` · ${r.durationDays} days` : ' · until settled'}${cancelled ? '  ·  Cancelled — not an active prescription' : ''}`,
        margin, y,
      )
      y += 5
      if (i < sortedRx.length - 1) { drawHistoryDivider(doc, margin, contentW, y); y += 3.5 }
    })
    y += 4
  }

  // Investigation orders
  y = ensureRoom(20, y)
  y = drawHistorySectionHeader(doc, margin, contentW, y, 'Investigation orders')
  if (sortedInvestigations.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    doc.text('No investigations ordered.', margin, y)
    y += 8
  } else {
    sortedInvestigations.forEach((order, i) => {
      y = ensureRoom(16, y)
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(INK)
      doc.text(historyDateFmt(order.createdAt), margin, y)
      y += 4.8
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(INK)
      const testLines = doc.splitTextToSize(order.tests.join(', ') || '—', contentW)
      doc.text(testLines, margin, y)
      y += testLines.length * 4.2
      if (order.notes.trim()) {
        doc.setTextColor(MUTED)
        doc.setFontSize(8.5)
        const noteLines = doc.splitTextToSize(`Note: ${order.notes.trim()}`, contentW)
        doc.text(noteLines, margin, y)
        y += noteLines.length * 4
      }
      y += 2
      if (i < sortedInvestigations.length - 1) { drawHistoryDivider(doc, margin, contentW, y); y += 3.5 }
    })
    y += 4
  }

  // Outcomes / clinical assessments
  y = ensureRoom(20, y)
  y = drawHistorySectionHeader(doc, margin, contentW, y, 'Clinical outcomes')
  if (sortedOutcomes.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    doc.text('No outcomes recorded.', margin, y)
    y += 8
  } else {
    sortedOutcomes.forEach((o, i) => {
      y = ensureRoom(13, y)
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(INK)
      doc.text(`${o.outcome} — ${o.remedy}`, margin, y)
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(MUTED)
      doc.text(historyDateFmt(o.date), pw - margin, y, { align: 'right' })
      y += 4.8
      if (o.note.trim()) {
        doc.setTextColor(MUTED)
        const noteLines = doc.splitTextToSize(o.note.trim(), contentW)
        doc.text(noteLines, margin, y)
        y += noteLines.length * 4
      }
      y += 2
      if (i < sortedOutcomes.length - 1) { drawHistoryDivider(doc, margin, contentW, y); y += 3.5 }
    })
  }

  y = ensureRoom(20, y)
  drawSignatureFooter(doc, pw, margin, Math.min(y + 10, ph - margin - 2))

  const fileName = `Patient_Summary_${patient.name.replace(/\s/g, '_')}_${todayFileStamp()}.pdf`
  await savePdf(doc, fileName)
}

function todayFileStamp() {
  return new Date().toISOString().slice(0, 10)
}
