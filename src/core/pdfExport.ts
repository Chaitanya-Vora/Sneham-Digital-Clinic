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

// ₹ amounts: whole rupees stay plain ("₹ 950"), anything with paise always
// shows two decimals ("₹ 950.50", never "₹ 950.5").
const inrFmt = (amount: number) => {
  const n = Math.round(amount * 100) / 100 // kills float noise like 1050.0000000000002
  return `₹ ${Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Colors for the prescription/investigation-request design (distinct from
// the invoice's own green masthead — this is its own print identity,
// matched to the reference design, not the app's web UI palette). First-
// pass values reasoned from the reference design, not pixel-sampled —
// expect to nudge these once real printed output is next to it.
const RX2_NAVY = '#2E4A6B'
const RX2_ROSE = '#B23A5A'
const RX2_LABEL = '#8A8F98'
const RX2_BOX_BG = '#F4F6F8'
const RX2_AVOID_BG = '#FBEBEC'
const RX2_AVOID_BORDER = '#F0C9CE'

/** Saves (web) or writes-to-cache-and-opens-native-share (native) a
 *  generated PDF. Shared by every export function in this file. */
async function savePdf(doc: jsPDF, fileName: string, shareText?: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const base64 = doc.output('datauristring').split(',')[1]
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })
    // `text` rides along as the message/caption next to the attached PDF.
    await Share.share({ title: fileName, ...(shareText ? { text: shareText } : {}), url: written.uri })
  } else {
    doc.save(fileName)
  }
}

/** Same native share behavior as savePdf, but on web opens the PDF inline
 *  in a new tab instead of silently downloading it — matching how an
 *  uploaded document already opens (db.ts's getDocumentUrl + window.open).
 *  Used for invoices specifically, since "click to preview" is the whole
 *  point of a bill; other exports still download via savePdf. */
async function previewPdf(doc: jsPDF, fileName: string) {
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
    const url = doc.output('bloburl') as unknown as string
    window.open(url, '_blank', 'noopener,noreferrer')
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

// What the embedded Roboto subset can draw: printable ASCII, Latin-1 and
// Latin Extended-A (accents, °, ½, ×, µ …), typographic quotes/dashes/bullet/
// ellipsis, ₹ € ™ − . jsPDF silently DROPS any other character, which on a
// prescription turns "½ tab" into " tab" — so anything outside this set is
// printed as a visible "?" instead of vanishing.
const EXTRA_GLYPHS = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2022, 0x2026, 0x2032, 0x2033, 0x2039, 0x203a, 0x20ac, 0x20b9, 0x2122, 0x2212])
const isDrawable = (cp: number) => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0x17f) || EXTRA_GLYPHS.has(cp)
export function toPrintable(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    const cp = ch.codePointAt(0)!
    if (ch === '\n' || isDrawable(cp)) out += ch
    else if (cp === 0x09) out += ' '
    else if (cp === 0xad || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfe0f || cp === 0xfeff || cp < 0x20) continue // invisible
    else if (cp >= 0x1f000) continue // emoji — no clinical meaning, drop quietly
    else out += '?'
  }
  return out
}
const printable = (t: unknown): unknown => (Array.isArray(t) ? t.map(printable) : typeof t === 'string' ? toPrintable(t) : t)

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
  // Every string passed to this document — names, diagnoses, instructions,
  // invoice lines — goes through toPrintable, for drawing and measuring alike.
  const d = doc as unknown as Record<string, (...a: unknown[]) => unknown>
  for (const fn of ['text', 'splitTextToSize', 'getTextWidth']) {
    const orig = d[fn].bind(doc)
    d[fn] = (t: unknown, ...rest: unknown[]) => orig(printable(t), ...rest)
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
  doc.addImage(SNEHAM_LOGO_BASE64, 'PNG', margin, y, logoW, logoH, undefined, 'FAST')

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
  doc.text(`${CLINIC_DETAILS.website}  ·  Phone: ${CLINIC_DETAILS.phone}  ·  ${CLINIC_DETAILS.email}`, margin, y)
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

// ── Prescription (redesigned) — fully code-drawn, like the invoice, rather
// than text overlaid on a static template image. See pdfExport's own
// history for why: a free-length instructions block with no page-break or
// overflow handling is exactly the kind of thing that silently breaks on
// the one patient whose case notes run long. Every section's height here
// is computed from its own content, and a genuine overflow starts a new
// page instead of running off the printable area.

/** A *bold*-marked word, tokenized for mixed-weight word-wrapping. The
 *  doctor's own instructions text already uses single asterisks as an
 *  informal "make this bold" marker (see rxInstructions.ts) — this is the
 *  first place that's actually honored instead of printed as literal
 *  asterisk characters. */
function tokenizeRich(text: string): { word: string; bold: boolean }[] {
  const tokens: { word: string; bold: boolean }[] = []
  text.split('*').forEach((part, i) => {
    const bold = i % 2 === 1
    for (const word of part.split(/\s+/).filter(Boolean)) tokens.push({ word, bold })
  })
  return tokens
}

/** Word-wraps mixed bold/normal text (paragraphs separated by '\n', blank
 *  lines get half a line of extra space), drawing as it goes and starting a
 *  new page whenever the next line would run past `pageBottom`. Returns
 *  {y, pageBroke} — pageBroke lets the caller know the signature footer
 *  needs to land on a fresh page rather than colliding with this block. */
function drawRichParagraphs(
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  color: string,
  pageBottom: number,
  topMargin: number,
  onNewPage?: () => void,
): { y: number; pageBroke: boolean } {
  let y = startY
  let pageBroke = false
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(fontSize)
  const spaceWidth = doc.getTextWidth(' ')

  const newPageIfNeeded = () => {
    if (y + lineHeight > pageBottom) {
      doc.addPage()
      onNewPage?.()
      y = topMargin
      pageBroke = true
    }
  }

  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { y += lineHeight * 0.5; continue }
    const tokens = tokenizeRich(paragraph)
    let line: { word: string; bold: boolean }[] = []
    let lineWidth = 0
    const flush = () => {
      newPageIfNeeded()
      let cx = x
      for (const tok of line) {
        doc.setFont('Roboto', tok.bold ? 'bold' : 'normal')
        doc.setTextColor(color)
        doc.text(tok.word, cx, y)
        cx += doc.getTextWidth(tok.word) + spaceWidth
      }
      y += lineHeight
      line = []
      lineWidth = 0
    }
    for (const tok of tokens) {
      doc.setFont('Roboto', tok.bold ? 'bold' : 'normal')
      doc.setFontSize(fontSize)
      const w = doc.getTextWidth(tok.word)
      const prospective = lineWidth + (line.length > 0 ? spaceWidth : 0) + w
      if (prospective > maxWidth && line.length > 0) {
        flush()
        line.push(tok)
        lineWidth = w
      } else {
        line.push(tok)
        lineWidth = prospective
      }
    }
    if (line.length > 0) flush()
  }
  return { y, pageBroke }
}

/** Shrinks a single-line value (down to `minSize`) until it fits `maxW`, and
 *  only then cuts it with an ellipsis — so a long name or remedy never runs
 *  into the next column. Leaves the font size set to what it used. */
function fitSingleLine(doc: jsPDF, text: string, maxW: number, size: number, minSize: number): string {
  let s = size
  doc.setFontSize(s)
  while (s > minSize && doc.getTextWidth(text) > maxW) { s -= 0.5; doc.setFontSize(s) }
  if (doc.getTextWidth(text) <= maxW) return text
  let cut = text
  while (cut.length > 1 && doc.getTextWidth(cut + '…') > maxW) cut = cut.slice(0, -1)
  return cut.trimEnd() + '…'
}

/** Top of every page after the first, so a prescription that runs onto a
 *  second sheet is never an unlabelled page. */
function drawContinuationHeader(doc: jsPDF, pw: number, margin: number, patientName: string, dateStr: string) {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(INK)
  doc.text(`Prescription · ${patientName}`, margin, margin)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  doc.text(`${dateStr} · continued`, pw - margin, margin, { align: 'right' })
  doc.setDrawColor(RX2_NAVY)
  doc.setLineWidth(0.3)
  doc.line(margin, margin + 3, pw - margin, margin + 3)
}

/** Two-column masthead matching the reference design exactly: brand
 *  block top-left, doctor identity + address right-aligned, a rule below
 *  both. Distinct from the invoice's own drawLetterhead — a different
 *  reference document with its own composition, not a shared web-UI
 *  header. */
function drawPrescriptionMasthead(doc: jsPDF, pw: number, margin: number): number {
  let y = 14
  // sneham-logo.png is a complete lockup — mark, "Sneham Digital Clinic"
  // wordmark, and tagline are all already baked into the image. Drawing
  // clinic name/tagline as separate text next to it duplicated what the
  // logo already says — sized wide enough here for its own wordmark to
  // read on its own, nothing else drawn beside it.
  const logoW = 42
  const logoH = logoW * (626 / 1042)
  doc.addImage(SNEHAM_LOGO_BASE64, 'PNG', margin, y, logoW, logoH, undefined, 'FAST')

  const rightX = pw - margin
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text(CLINIC_DETAILS.doctorName, rightX, y + 3, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  doc.text(`${CLINIC_DETAILS.credentials} · ${CLINIC_DETAILS.registrationNo}`, rightX, y + 8, { align: 'right' })
  const addrLines = doc.splitTextToSize(`${CLINIC_DETAILS.address} · ${CLINIC_DETAILS.website}`, 90)
  doc.text(addrLines, rightX, y + 12.5, { align: 'right' })

  y += Math.max(logoH, 12.5 + addrLines.length * 3.4) + 5
  doc.setDrawColor(RX2_NAVY)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pw - margin, y)
  return y + 8
}

/** "• Prescription" title + Date, then Patient Name / Age / Sex, then
 *  Diagnosis — each a label above a ruled line, value sitting just above
 *  the rule. Returns the y position to continue drawing from. */
function drawPrescriptionFields(doc: jsPDF, pw: number, margin: number, contentW: number, y: number, patient: Patient, dateStr: string, diagnosisText: string): number {
  doc.setFillColor(RX2_ROSE)
  doc.circle(margin + 1, y - 1.3, 1, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(INK)
  doc.text('Prescription', margin + 5, y)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(RX2_LABEL)
  doc.text('Date', pw - margin - 45, y - 3)
  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.2)
  doc.line(pw - margin - 32, y - 3, pw - margin, y - 3)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(dateStr, pw - margin - 30, y - 4)
  y += 8

  const col = [margin, margin + contentW * 0.55, margin + contentW * 0.8]
  const colW = [contentW * 0.5, contentW * 0.2, contentW * 0.2]
  const fieldRow = (labels: string[], values: string[]) => {
    labels.forEach((label, i) => {
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(RX2_LABEL)
      doc.text(label, col[i], y)
      doc.setFont('Roboto', 'normal')
      doc.setTextColor(INK)
      doc.text(fitSingleLine(doc, values[i], colW[i] - 5, 9.5, 7), col[i], y + 5)
      doc.setDrawColor(BORDER)
      doc.setLineWidth(0.2)
      doc.line(col[i], y + 6.5, col[i] + colW[i] - 4, y + 6.5)
    })
    y += 12
  }
  fieldRow(['PATIENT NAME', 'AGE', 'SEX'], [patient.name, String(patient.age), patient.sex])
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(RX2_LABEL)
  doc.text('DIAGNOSIS / CASE', margin, y)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(INK)
  const diagLines = doc.splitTextToSize(diagnosisText, contentW)
  doc.text(diagLines, margin, y + 5)
  y += 5 + diagLines.length * 4.5 + 3
  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.2)
  doc.line(margin, y, pw - margin, y)
  return y + 8
}

/** The boxed ℞ area: remedy + potency as their own labeled fields, not
 *  buried in the instructions paragraph. */
function drawRemedyBox(doc: jsPDF, pw: number, margin: number, contentW: number, y: number, remedy: string, potency: string): number {
  const fieldX = margin + 26
  const potencyX = margin + contentW * 0.62
  // A long remedy name wraps (and the box grows) instead of running into the potency.
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  const remedyLines: string[] = doc.splitTextToSize(remedy || '—', potencyX - fieldX - 6)
  const boxH = 20 + (remedyLines.length - 1) * 5
  doc.setFillColor(RX2_BOX_BG)
  doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F')
  // The Roboto subset embedded for this doc doesn't carry the real ℞
  // (U+211E) glyph — it prints as tofu/blank. Drawing it by hand instead:
  // a bold R plus the diagonal tail-stroke through its leg that makes it
  // read as the prescription symbol rather than a plain letter.
  const rxX = margin + 8
  const rxBaseline = y + boxH / 2 + 4
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(RX2_NAVY)
  doc.text('R', rxX, rxBaseline)
  doc.setDrawColor(RX2_NAVY)
  doc.setLineWidth(0.9)
  doc.line(rxX + 3.5, rxBaseline - 2.5, rxX + 8, rxBaseline + 4.5)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(RX2_LABEL)
  doc.text('REMEDY PRESCRIBED', fieldX, y + 7)
  doc.text('POTENCY', potencyX, y + 7)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text(remedyLines, fieldX, y + 15)
  doc.text(fitSingleLine(doc, potency || '—', margin + contentW - potencyX - 4, 11, 8), potencyX, y + 15)
  return y + boxH + 10
}

/** Splits the free-text instructions on the doctor's own "TO AVOID" marker
 *  (already present verbatim in her standard boilerplate) so it can be
 *  drawn in its own callout box instead of running into the same paragraph
 *  as everything else. Absent in a prescription with no avoid-list — the
 *  box simply doesn't appear. */
function splitToAvoid(text: string): { main: string; avoid: string | null } {
  const idx = text.search(/TO AVOID/i)
  if (idx === -1) return { main: text, avoid: null }
  return { main: text.slice(0, idx).trim(), avoid: text.slice(idx).trim() }
}

/** This design's own footer: a muted disclaimer bottom-left, and — bottom-
 *  right only, no repeated clinic name — the real signature image over a
 *  rule over doctor name/credentials. A different composition from the
 *  invoice's drawSignatureFooter (which puts doctor identity on the left),
 *  so it gets its own function rather than a forced reuse. `bottomY` is
 *  where the LAST line of this block should land. */
function drawPrescriptionSignature(doc: jsPDF, pw: number, margin: number, bottomY: number, disclaimer: string) {
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  doc.text(disclaimer, margin, bottomY)

  const sigW = 26
  const sigH = sigW * (90 / 219)
  const blockRight = pw - margin
  const ruleY = bottomY - 9
  doc.addImage(NEHA_SIGNATURE_BASE64, 'JPEG', blockRight - sigW, ruleY - sigH - 1, sigW, sigH)
  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.2)
  doc.line(blockRight - sigW, ruleY, blockRight, ruleY)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(INK)
  doc.text(CLINIC_DETAILS.doctorName, blockRight, ruleY + 4, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(MUTED)
  doc.text(`${CLINIC_DETAILS.credentials} · ${CLINIC_DETAILS.registrationNo}`, blockRight, ruleY + 8, { align: 'right' })
}

export async function exportPrescriptionPdf(rx: Prescription, patient: Patient, opts?: { shareText?: string }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  await registerInvoiceFont(doc)
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pw - margin * 2
  const footerReserve = 26
  const pageBottom = ph - margin - footerReserve
  const dateStr = rxDateFormat(rx.publishedAt ?? rx.createdAt)

  let y = drawPrescriptionMasthead(doc, pw, margin)
  y = drawPrescriptionFields(doc, pw, margin, contentW, y, patient, dateStr, patient.chiefComplaint || '—')
  y = drawRemedyBox(doc, pw, margin, contentW, y, rx.remedy, rx.potency)

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(RX2_NAVY)
  doc.text('•  MEDICINE INSTRUCTIONS  •', pw / 2, y, { align: 'center' })
  y += 8

  // Falls back to the structured dose fields only when there's no written
  // instructions — the remedy/potency already have their own box above, so
  // the fallback here shouldn't repeat them a second time.
  const bodyText = (rx.bodyText && rx.bodyText.trim())
    || `${rx.doseGlobules} globules, ${rx.repetition}${rx.durationDays ? ` for ${rx.durationDays} days` : ''}`
  const { main, avoid } = splitToAvoid(bodyText)

  // Pages after the first carry a slim identifying header (see below).
  const continuation = () => drawContinuationHeader(doc, pw, margin, patient.name, dateStr)
  const topOfNewPage = margin + 10

  const mainResult = drawRichParagraphs(doc, main, margin, y, contentW, 9.5, 5, INK, pageBottom, topOfNewPage, continuation)
  y = mainResult.y + 4

  if (avoid) {
    // Measure the avoid box's own height first (a dry run at the same
    // width/size, off-page) so the page-break decision below is exact
    // rather than a guess — a light-pink box that gets cut mid-sentence at
    // a page boundary would look worse than the plain text it's replacing.
    const probe = new jsPDF({ unit: 'mm', format: 'a4' })
    await registerInvoiceFont(probe)
    const dry = drawRichParagraphs(probe, avoid, 0, 0, contentW - 10, 8.5, 4.3, INK, 10000, 0)
    const avoidH = dry.y + 6

    if (y + avoidH > pageBottom) {
      doc.addPage()
      continuation()
      y = topOfNewPage
    }
    doc.setFillColor(RX2_AVOID_BG)
    doc.setDrawColor(RX2_AVOID_BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, contentW, avoidH, 2, 2, 'FD')
    const avoidResult = drawRichParagraphs(doc, avoid, margin + 5, y + 6, contentW - 10, 8.5, 4.3, INK, pageBottom, topOfNewPage, continuation)
    y = Math.max(avoidResult.y, y + avoidH) + 8
  }

  if (y + footerReserve > ph - margin) {
    doc.addPage()
    continuation()
  }
  drawPrescriptionSignature(doc, pw, margin, ph - margin - 2, 'Follow-up as advised. Do not repeat the remedy without consulting the clinic.')

  // "Page 2 of 3" only when there's more than one page.
  const pages = doc.getNumberOfPages()
  if (pages > 1) {
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(MUTED)
      doc.text(`Page ${i} of ${pages}`, pw / 2, ph - 8, { align: 'center' })
    }
  }

  const fileName = `Rx_${patient.name.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdf(doc, fileName, opts?.shareText)
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
  doc.setTextColor(INK)
  doc.text(fitSingleLine(doc, patient.name, contentW * 0.58, 11, 8), margin, y)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(MUTED)
  doc.text(`Invoice No.: ${invoice.invoiceNo}`, pw - margin, y, { align: 'right' })
  y += 5
  doc.text(`${patient.age}y · ${patient.sex} · ${patient.wsCode}`, margin, y)
  doc.text(`Date: ${dateStr}`, pw - margin, y, { align: 'right' })
  y += 10

  // Item table
  const ph = doc.internal.pageSize.getHeight()
  const col = { num: margin, item: margin + 10, qty: margin + 92, price: margin + 122, amount: margin + contentW }
  const itemW = col.qty - col.item - 16
  const drawTableHeader = () => {
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
  }
  // A new page for anything that would run past the bottom; later pages say
  // whose invoice they are.
  const newInvoicePage = () => {
    doc.addPage()
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(INK)
    doc.text(`Invoice ${invoice.invoiceNo} · ${patient.name}`, margin, margin)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(MUTED)
    doc.text('continued', pw - margin, margin, { align: 'right' })
    doc.setDrawColor(BRAND)
    doc.setLineWidth(0.3)
    doc.line(margin, margin + 3, pw - margin, margin + 3)
    y = margin + 12
  }
  const ensureRoom = (needed: number) => { if (y + needed > ph - margin) newInvoicePage() }

  drawTableHeader()
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  invoice.items.forEach((item, i) => {
    // Long item names wrap inside their column instead of running into Quantity.
    const nameLines: string[] = doc.splitTextToSize(item.name, itemW)
    const rowH = Math.max(6, nameLines.length * 4.2 + 1.8)
    if (y + rowH > ph - margin - 12) { newInvoicePage(); drawTableHeader(); doc.setFont('Roboto', 'normal'); doc.setFontSize(9); doc.setTextColor(INK) }
    doc.text(String(i + 1), col.num + 2, y)
    doc.text(nameLines, col.item, y)
    doc.text(String(item.qty), col.qty, y, { align: 'right' })
    doc.text(inrFmt(item.unitPrice), col.price, y, { align: 'right' })
    doc.text(inrFmt(item.qty * item.unitPrice), col.amount, y, { align: 'right' })
    y += rowH
    if (i < invoice.items.length - 1) {
      doc.setDrawColor(BORDER)
      doc.setLineWidth(0.15)
      doc.line(margin, y - 4.5, pw - margin, y - 4.5)
    }
  })
  ensureRoom(70)
  y += 1
  doc.setDrawColor(INK)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pw - margin, y)
  y += 5
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(9)
  const totalQty = invoice.items.reduce((s, i) => s + i.qty, 0)
  doc.text('Total', col.item, y)
  doc.text(String(totalQty), col.qty, y, { align: 'right' })
  doc.text(inrFmt(total), col.amount, y, { align: 'right' })
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

  // Payment instructions only while something is still owed.
  const amountDue = balance > 0 && invoice.status !== 'cancelled' && invoice.status !== 'waived'
  let leftBottom = y
  if (amountDue) {
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
    leftBottom = y + termsLines.length * 3.8
  }

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
  summaryRow('Sub Total', inrFmt(total))
  summaryRow('Total', inrFmt(total), { highlight: true })
  summaryRow('Received', inrFmt(invoice.amountReceived))
  summaryRow('Balance', inrFmt(balance), { bold: true })
  summaryRow('Payment Mode', invoice.paymentMode)
  summaryRow('Status', statusLabel, { bold: true })

  y = Math.max(leftBottom, ry) + 10
  ensureRoom(46)

  // Bank/UPI (left) + signature (right). Only when something is still owed —
  // a QR code asking for ₹0 on a settled bill is just confusing.
  const qrSize = 26
  if (amountDue) {
    try {
      const qrDataUrl = await QRCode.toDataURL(buildUpiLink(balance, invoice.invoiceNo), { margin: 0, width: 256 })
      doc.addImage(qrDataUrl, 'PNG', margin, y, qrSize, qrSize, undefined, 'FAST')
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
  } else {
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(invoice.status === 'cancelled' ? '#DC2626' : BRAND)
    doc.text(invoice.status === 'cancelled' ? 'This invoice has been cancelled.' : invoice.status === 'waived' ? 'Fees waived — nothing is due.' : 'Payment received in full — thank you.', margin, y + 8)
  }

  drawSignatureFooter(doc, pw, margin, y + qrSize + 6)

  const fileName = `Invoice_${invoice.invoiceNo}_${patient.name.replace(/\s/g, '_')}.pdf`
  await previewPdf(doc, fileName)
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
  doc.setTextColor(RX2_LABEL)
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
      doc.setTextColor(cancelled ? RX2_LABEL : INK)
      const title = `${r.remedy} ${r.potency}`
      doc.text(title, margin, y)
      if (cancelled) {
        const w = doc.getTextWidth(title)
        doc.setDrawColor(RX2_LABEL)
        doc.setLineWidth(0.3)
        doc.line(margin, y - 1.3, margin + w, y - 1.3)
      }
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(MUTED)
      doc.text(historyDateFmt(r.publishedAt ?? r.createdAt), pw - margin, y, { align: 'right' })
      y += 4.8
      doc.setTextColor(cancelled ? RX2_LABEL : MUTED)
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
