import type { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { Capacitor } from '@capacitor/core'
import type { Prescription, Patient, InvestigationOrder, Invoice, Outcome } from './types'
import { CLINIC_DETAILS } from './letterheadAssets'
import { invoiceTotal, invoiceBalance, numberToWordsIndian, buildUpiLink } from './billing'
import { boxContent } from './rxPrivacy'
import {
  COLOR, LEFT, RIGHT, CONTENT_W, PAGE_W, PAGE_H, RX_LAYOUT, FORM_LAYOUT, type Layout,
  createDesignDoc, drawRxSign, setFace, put, textWidth, hline, box, drawMasthead, drawTitle, drawDate, drawField, drawFooter,
  contentBottom, parseParagraphs, layoutParagraphs, flowHeight, drawFlow, type FlowStyle,
} from './pdfDesign'

export { toPrintable } from './pdfDesign'

// All four documents are drawn with the kit in pdfDesign.ts, to the formats the
// doctor supplied (Design.pdf). This file decides what goes on each one.

// ₹ amounts: whole rupees stay plain ("₹ 950"), anything with paise always
// shows two decimals ("₹ 950.50", never "₹ 950.5").
const numFmt = (amount: number) => {
  const n = Math.round(amount * 100) / 100 // kills float noise like 1050.0000000000002
  return Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const inrFmt = (amount: number) => `₹ ${numFmt(amount)}`

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

const rxDateFormat = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const ageText = (p: Patient) => (Number.isFinite(p.age) ? String(p.age) : '')

/** "Page 2 of 3" at the foot of each page — only when there's more than one. */
function drawPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  if (pages < 2) return
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    setFace(doc, 'body', 6.7, COLOR.faint)
    put(doc, `Page ${i} of ${pages}`, PAGE_W / 2, PAGE_H - 14, { align: 'center' })
  }
}

/** The footers (and signature, on the last page) go on once every page exists. */
function finishDocument(doc: jsPDF, L: Layout, footer: { note: string; signerName?: string; signerRole?: string }) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    drawFooter(doc, L, { ...footer, signed: i === pages })
  }
  drawPageNumbers(doc)
}

// ── Prescription ─────────────────────────────────────────────────────────

/** The boxed ℞ area: remedy + potency as their own labelled fields. Returns
 *  the y of the box's bottom edge. */
function drawRemedyBox(doc: jsPDF, top: number, remedy: string, potency: string): number {
  // A long remedy wraps (and the box grows) instead of running into the potency.
  setFace(doc, 'semi', 10.5, COLOR.ink)
  const lines = (doc.splitTextToSize(remedy || '', 252) as string[]).slice(0, 4)
  const extra = Math.max(0, lines.length - 1) * 12.5
  const h = 46.5 + extra
  box(doc, LEFT, top, CONTENT_W, h, COLOR.rxFill, COLOR.rxBorder, 8)

  drawRxSign(doc, 57.6, top + 29.4, COLOR.blue)

  setFace(doc, 'semi', 7, COLOR.label)
  put(doc, 'REMEDY PRESCRIBED', 84, top + 15, { track: 0.3 })
  put(doc, 'POTENCY', 353.5, top + 15, { track: 0.3 })

  setFace(doc, 'semi', 10.5, COLOR.ink)
  lines.forEach((ln, i) => put(doc, ln, 84.5, top + 31.5 + i * 12.5))
  const potencyText = potency ? String(potency) : ''
  if (potencyText) put(doc, potencyText, 353.5, top + 31.5)
  const lineY = top + 36.25 + extra
  hline(doc, 84, 341, lineY)
  hline(doc, 353, 536.5, lineY)
  return top + h
}

/** Splits the free-text instructions on the doctor's own "TO AVOID" marker
 *  (present verbatim in her standard text) so it can be drawn in its own pink
 *  box. Absent in a prescription with no avoid-list — the box simply doesn't appear. */
function splitToAvoid(text: string): { main: string; avoid: string | null } {
  const idx = text.search(/TO AVOID/i)
  if (idx === -1) return { main: text, avoid: null }
  const avoid = text.slice(idx).replace(/^TO AVOID\s*[-–—:]*\s*/i, '').trim()
  return { main: text.slice(0, idx).trim(), avoid: avoid || null }
}

const INSTRUCTION_FLOW: FlowStyle = { size: 8.2, lineH: 12, gap: 7, headingExtra: 3.5, tight: 1.6, color: COLOR.body, boldColor: COLOR.rose }
const AVOID_FLOW: FlowStyle = { size: 7.87, lineH: 12, gap: 6, headingExtra: 0, tight: 0, color: COLOR.pinkText, boldColor: COLOR.pinkHead }
const AVOID_X = 57
const AVOID_W = 480.5

export async function exportPrescriptionPdf(rx: Prescription, patient: Patient, opts?: { shareText?: string }) {
  const doc = await createDesignDoc()
  const L = RX_LAYOUT
  const dateStr = rxDateFormat(rx.publishedAt ?? rx.createdAt)
  const bottom = contentBottom(L)

  const startPage = (continued: boolean) => {
    drawMasthead(doc, L)
    drawTitle(doc, L, 'Prescription', continued ? 'continued' : undefined)
    drawDate(doc, L, dateStr)
  }
  startPage(false)

  drawField(doc, { label: 'PATIENT NAME', value: patient.name, x1: 45, x2: 287, labelBase: 145, lineY: 164.5, track: L.labelTrack })
  drawField(doc, { label: 'AGE', value: ageText(patient), x1: 297.5, x2: 418.5, labelBase: 145, lineY: 164.5, track: L.labelTrack })
  drawField(doc, { label: 'SEX', value: patient.sex, x1: 429, x2: RIGHT, labelBase: 145, lineY: 164.5, track: L.labelTrack })
  const diagLine = drawField(doc, { label: 'DIAGNOSIS / CASE', value: patient.chiefComplaint || '', x1: 45, x2: RIGHT, labelBase: 179.4, lineY: 199, track: L.labelTrack })

  // When the doctor has chosen not to reveal the remedy, the box carries only her own wording.
  const named = boxContent(rx)
  const boxBottom = drawRemedyBox(doc, diagLine + 12.5, named.remedy, named.potency)

  setFace(doc, 'head', 9.2, COLOR.blue)
  const headBase = boxBottom + 20.5
  put(doc, '• MEDICINE INSTRUCTIONS •', (LEFT + RIGHT) / 2 - 0.5, headBase, { align: 'center', track: 0.78 })

  // Falls back to the structured dose fields only when there's no written
  // instructions — the remedy/potency already have their own box above.
  const bodyText = (rx.bodyText && rx.bodyText.trim())
    || `${rx.doseGlobules} globules, ${rx.repetition}${rx.durationDays ? ` for ${rx.durationDays} days` : ''}`
  const { main, avoid } = splitToAvoid(bodyText)

  const newPage = () => {
    doc.addPage()
    startPage(true)
    return 172
  }
  const laidMain = layoutParagraphs(doc, parseParagraphs(main), CONTENT_W, INSTRUCTION_FLOW)
  const y = laidMain.length ? drawFlow(doc, laidMain, LEFT, headBase + 19, INSTRUCTION_FLOW, bottom, newPage) : headBase

  if (avoid) {
    const laidAvoid = layoutParagraphs(doc, parseParagraphs(avoid), AVOID_W, AVOID_FLOW)
    const boxH = 31.7 + flowHeight(laidAvoid, AVOID_FLOW) + 14.3
    if (boxH > bottom - 190) {
      // Longer than a page could hold in a box: it runs on like the rest of the instructions.
      const laid = layoutParagraphs(doc, parseParagraphs(`*TO AVOID –*\n${avoid}`), CONTENT_W, INSTRUCTION_FLOW)
      drawFlow(doc, laid, LEFT, y + INSTRUCTION_FLOW.lineH + INSTRUCTION_FLOW.gap + INSTRUCTION_FLOW.headingExtra, INSTRUCTION_FLOW, bottom, newPage)
    } else {
      let top = y + 14.7
      if (top + boxH > bottom) { top = newPage() - 12 }
      box(doc, LEFT, top, CONTENT_W, boxH, COLOR.pinkFill, COLOR.pinkBorder, 8)
      setFace(doc, 'head', 8.3, COLOR.pinkHead)
      put(doc, 'TO AVOID', AVOID_X, top + 17.5)
      drawFlow(doc, laidAvoid, AVOID_X, top + 31.7, AVOID_FLOW, Infinity, () => 0)
    }
  }

  finishDocument(doc, L, { note: 'Follow-up as advised. Do not repeat the remedy without consulting the clinic.' })

  const fileName = `Rx_${patient.name.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdf(doc, fileName, opts?.shareText)
}

// ── Investigation request ────────────────────────────────────────────────
// The request is a printed form: twelve common tests as tick-boxes in two
// columns, then an "Other / specify" area ruled for writing. The tests the
// doctor selected in the app arrive ticked; anything that isn't one of the
// twelve is written out under "Other / specify".

interface FormSlot { label: string; keys: string[]; useTestName?: boolean }
const FORM_COLUMNS: [FormSlot[], FormSlot[]] = [
  [
    { label: 'Complete Blood Count (CBC)', keys: ['cbc', 'completebloodcount'] },
    { label: 'Serum Vitamin D3', keys: ['vitamind', 'vitamind3', 'serumvitamind3', 'serumvitamind'] },
    { label: 'Thyroid Profile (T3, T4, TSH)', keys: ['t3t4tsh', 'thyroidprofile', 'thyroidprofilet3t4tsh'] },
    { label: 'Kidney Function Test (KFT)', keys: ['kft', 'kidneyfunctiontest', 'kidneyfunctiontestkft', 'renalfunctiontest', 'renalfunctiontests', 'rft'] },
    { label: 'Lipid Profile', keys: ['lipidprofile'] },
    { label: 'X-Ray', keys: ['xray'] },
  ],
  [
    { label: 'ESR', keys: ['esr'] },
    { label: 'Serum Vitamin B12', keys: ['vitaminb12', 'serumvitaminb12'] },
    { label: 'Liver Function Test (LFT)', keys: ['lft', 'liverfunctiontest', 'liverfunctiontests', 'liverfunctiontestlft'] },
    { label: 'Urine Routine & Microscopy', keys: ['urineroutinemicroscopy'] },
    { label: 'HbA1c', keys: ['hba1c'] },
    // "USG Abdomen & Pelvis" is a different scan from "USG Abdomen" — it keeps its own name.
    { label: 'USG Abdomen', keys: ['usgabdomen', 'usgabdomenpelvis'], useTestName: true },
  ],
]
// Test names are compared ignoring case, spacing and punctuation ("Urine Routine & Microscopy" ≡ "urine routine microscopy").
const testKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')

function drawCheckbox(doc: jsPDF, x: number, y: number, size: number, ticked: boolean) {
  doc.setLineWidth(1)
  doc.setDrawColor(ticked ? COLOR.blue : COLOR.hair)
  doc.setFillColor(ticked ? '#EAF2FB' : '#FFFFFF')
  doc.roundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 2.5, 2.5, 'FD')
  if (ticked) {
    doc.setDrawColor(COLOR.blue)
    doc.setLineWidth(1.5)
    doc.setLineCap('round')
    doc.setLineJoin('round')
    const k = size / 12
    doc.lines([[2.2 * k, 2.4 * k], [4.6 * k, -5.2 * k]], x + 2.9 * k, y + 6.4 * k, [1, 1], 'S')
    doc.setLineCap('butt')
    doc.setLineJoin('miter')
  }
}

export async function exportInvestigationOrderPdf(order: InvestigationOrder, patient: Patient) {
  const doc = await createDesignDoc()
  const L = FORM_LAYOUT
  const dateStr = rxDateFormat(order.createdAt)
  const bottom = contentBottom(L)
  const TITLE = 'Investigation request'

  const startPage = (continued: boolean) => {
    drawMasthead(doc, L)
    drawTitle(doc, L, TITLE, continued ? 'continued' : undefined)
    drawDate(doc, L, dateStr)
  }
  startPage(false)

  drawField(doc, { label: 'PATIENT NAME', value: patient.name, x1: 45, x2: 375, labelBase: 151, lineY: 174.25, track: L.labelTrack })
  drawField(doc, { label: 'AGE / SEX', value: [ageText(patient), patient.sex].filter(Boolean).join(' / '), x1: 385.5, x2: RIGHT, labelBase: 151, lineY: 174.25, track: L.labelTrack })

  setFace(doc, 'head', 8.94, COLOR.blue)
  put(doc, 'Kindly arrange the following investigations', 45.5, 200.2)

  // Which of the twelve are ticked, and what is left over for "Other".
  const remaining = order.tests.map((t) => ({ t, key: testKey(t) }))
  const take = (slot: FormSlot): string | null => {
    const hit = remaining.findIndex((r) => slot.keys.includes(r.key))
    if (hit === -1) return null
    const [{ t }] = remaining.splice(hit, 1)
    return t
  }
  const colX = [45, 306.5]
  FORM_COLUMNS.forEach((slots, c) => {
    slots.forEach((slot, r) => {
      const matched = take(slot)
      const top = 212 + r * 20.2
      drawCheckbox(doc, colX[c], top, 12, matched !== null)
      setFace(doc, 'body', 8.9, COLOR.ink)
      put(doc, matched !== null && slot.useTestName ? matched : slot.label, colX[c] + 19.3, top + 8.6)
    })
  })

  // "Other / specify" — the leftovers, written on the ruled lines.
  setFace(doc, 'body', 7.44, COLOR.label)
  put(doc, 'Other / specify:', 45.5, 349.6)
  // Packed onto the ruled lines, separated by a dot — test names can hold commas themselves.
  setFace(doc, 'body', 9.2, COLOR.ink)
  const otherLines: string[] = []
  for (const r of remaining) {
    const pieces = doc.splitTextToSize(r.t, CONTENT_W - 2) as string[]
    const last = otherLines.length - 1
    if (pieces.length === 1 && last >= 0 && doc.getTextWidth(`${otherLines[last]}  ·  ${r.t}`) <= CONTENT_W - 2) otherLines[last] += `  ·  ${r.t}`
    else otherLines.push(...pieces)
  }
  const ruleCount = Math.max(2, otherLines.length)
  let rulesEndY = 376
  let ruleY = 376
  for (let i = 0; i < ruleCount; i++) {
    if (ruleY > bottom) { doc.addPage(); startPage(true); ruleY = 190 } // long lists carry on over the page
    hline(doc, LEFT, RIGHT, ruleY, COLOR.rule)
    if (otherLines[i]) { setFace(doc, 'body', 9.2, COLOR.ink); put(doc, otherLines[i], LEFT + 0.5, ruleY - 4.5) }
    rulesEndY = ruleY
    ruleY += 28
  }

  // The doctor's own note (fasting sample, urgency …), when there is one.
  const note = order.notes.trim()
  if (note) {
    const st: FlowStyle = { size: 8.9, lineH: 12, gap: 6, headingExtra: 0, tight: 0, color: COLOR.body, boldColor: COLOR.rose }
    const laid = layoutParagraphs(doc, parseParagraphs(note), CONTENT_W - 24, st)
    const boxH = 15 + 11 + flowHeight(laid, st) + 12
    let top = rulesEndY + 18
    if (top + boxH > bottom) { doc.addPage(); startPage(true); top = 172 }
    box(doc, LEFT, top, CONTENT_W, boxH, COLOR.rxFill, COLOR.rxBorder, 8)
    setFace(doc, 'semi', 7, COLOR.label)
    put(doc, 'NOTE', LEFT + 12, top + 15, { track: 0.3 })
    drawFlow(doc, laid, LEFT + 12, top + 30, st, Infinity, () => 0)
  }

  finishDocument(doc, L, { note: 'Please share reports with the clinic before the next visit.' })

  const fileName = `Investigations_${patient.name.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`
  await savePdf(doc, fileName)
}

// ── Receipt / invoice ────────────────────────────────────────────────────
// A paid bill prints as the clinic's "Receipt"; one with something still owed
// prints as an "Invoice" on the same form, with the amount due and a UPI QR.
const COL = { num: 45.5, numValue: 46.5, desc: 83.5, descValue: 77.7, qty: 368, rate: 454.5, amount: 542.5 }
const ROW_H = 27

function drawReceiptNumberAndDate(doc: jsPDF, L: Layout, label: string, no: string, date: string) {
  const base = L.dateBase
  // Built from the right edge inward so a longer number or date still fits.
  setFace(doc, 'body', 8.6, COLOR.ink)
  const dateW = Math.max(39, textWidth(doc, date) + 5)
  const noW = Math.max(31, textWidth(doc, no) + 5)
  setFace(doc, 'semi', 8, COLOR.muted)
  const dateLabelW = textWidth(doc, 'Date')
  const noLabelW = textWidth(doc, label)
  let x = RIGHT
  hline(doc, x - dateW, x, base - 0.75)
  setFace(doc, 'body', 8.6, COLOR.ink)
  put(doc, date, x - dateW + 3, base - 2.6)
  x -= dateW + 4
  setFace(doc, 'semi', 8, COLOR.muted)
  put(doc, 'Date', x - dateLabelW, base)
  x -= dateLabelW + 5
  doc.setFillColor(COLOR.hair)
  doc.circle(x - 1, base - 3, 0.7, 'F')
  x -= 6
  hline(doc, x - noW, x, base - 0.75)
  setFace(doc, 'body', 8.6, COLOR.ink)
  put(doc, no, x - noW + 3, base - 2.6)
  x -= noW + 3
  setFace(doc, 'semi', 8, COLOR.muted)
  put(doc, label, x - noLabelW, base)
}

function drawTableHeader(doc: jsPDF, base: number) {
  setFace(doc, 'semi', 7, COLOR.label)
  put(doc, '#', COL.num, base, { track: 0.6 })
  put(doc, 'DESCRIPTION', COL.desc, base, { track: 0.6 })
  put(doc, 'QTY', COL.qty, base, { align: 'right', track: 0.6 })
  put(doc, 'RATE (₹)', COL.rate, base, { align: 'right', track: 0.6 })
  put(doc, 'AMOUNT (₹)', COL.amount, base, { align: 'right', track: 0.6 })
  hline(doc, LEFT, RIGHT, base + 8.5, COLOR.blue, 1)
  return base + 8.5
}

export async function exportInvoicePdf(invoice: Invoice, patient: Patient) {
  const doc = await createDesignDoc()
  const L = FORM_LAYOUT
  const bottom = contentBottom(L)

  const total = invoiceTotal(invoice.items)
  const balance = invoiceBalance(invoice)
  const cancelled = invoice.status === 'cancelled'
  const waived = invoice.status === 'waived'
  const amountDue = balance > 0 && !cancelled && !waived
  const isReceipt = !amountDue && !cancelled
  const title = isReceipt ? 'Receipt' : 'Invoice'
  const dateStr = new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const startPage = (continued: boolean) => {
    drawMasthead(doc, L)
    drawTitle(doc, L, title, continued ? 'continued' : undefined)
    drawReceiptNumberAndDate(doc, L, `${title} no.`, String(invoice.invoiceNo), dateStr)
  }
  startPage(false)

  drawField(doc, { label: isReceipt ? 'RECEIVED FROM' : 'BILLED TO', value: patient.name, x1: 45, x2: 375, labelBase: 154, lineY: 177.25, track: L.labelTrack })
  drawField(doc, { label: 'PHONE', value: patient.phone ?? '', x1: 385.5, x2: RIGHT, labelBase: 154, lineY: 177.25, track: L.labelTrack })
  if (cancelled) {
    setFace(doc, 'head', 9, COLOR.danger)
    put(doc, 'CANCELLED', RIGHT, 191, { align: 'right', track: 1 })
  }

  // Item table: at least four ruled rows, as in the form; more when needed.
  let lineY = drawTableHeader(doc, 202.5)
  const rows = Math.max(4, invoice.items.length)
  for (let i = 0; i < rows; i++) {
    const item = invoice.items[i]
    setFace(doc, 'body', 9.2, COLOR.ink)
    const nameLines = item ? (doc.splitTextToSize(item.name, COL.qty - 22 - COL.descValue) as string[]) : []
    const rowH = Math.max(ROW_H, 15.5 + Math.max(0, nameLines.length - 1) * 11 + 11.5)
    if (lineY + rowH > bottom - 30) {
      doc.addPage()
      startPage(true)
      lineY = drawTableHeader(doc, 170)
    }
    const base = lineY + 16
    setFace(doc, 'body', 9.2, COLOR.label)
    put(doc, String(i + 1), COL.numValue, base)
    if (item) {
      setFace(doc, 'body', 9.2, COLOR.ink)
      nameLines.forEach((ln, k) => put(doc, ln, COL.descValue, base + k * 11))
      put(doc, String(item.qty), COL.qty, base, { align: 'right' })
      put(doc, numFmt(item.unitPrice), COL.rate, base, { align: 'right' })
      put(doc, numFmt(item.qty * item.unitPrice), COL.amount, base, { align: 'right' })
    }
    lineY += rowH
    hline(doc, LEFT, RIGHT, lineY, COLOR.rule)
  }

  // Everything below the table has to fit together; start a new page for it if not.
  const received = Math.min(invoice.amountReceived, total)
  const showDue = amountDue || (balance > 0 && received > 0)
  const needed = 24.5 + 19.5 + 27 + 17.75 + (showDue ? 34 : 0) + 21.3 + 25.5 + 14 + (amountDue ? 130 : 0)
  if (lineY + needed > bottom) {
    doc.addPage()
    startPage(true)
    lineY = 140
  }

  // Totals, right-aligned under the table.
  const TX = 377.5
  const discount = waived ? total : 0
  const payable = total - discount
  let base = lineY + 24.1
  setFace(doc, 'body', 8.7, COLOR.muted)
  put(doc, 'Subtotal', TX, base)
  put(doc, inrFmt(total), RIGHT, base, { align: 'right' })
  base += 19.5
  put(doc, 'Discount', TX, base)
  put(doc, inrFmt(discount), RIGHT, base, { align: 'right' })
  hline(doc, 377, RIGHT, base + 7.75, COLOR.rule)
  base += 25.5
  setFace(doc, 'head', 10.7, COLOR.blue)
  put(doc, 'Total', TX - 0.5, base)
  setFace(doc, 'bold', 10.7, COLOR.blue)
  put(doc, inrFmt(payable), RIGHT, base, { align: 'right' })
  if (showDue) {
    base += 17
    setFace(doc, 'body', 8.7, COLOR.muted)
    put(doc, 'Received', TX, base)
    put(doc, inrFmt(received), RIGHT, base, { align: 'right' })
    base += 17
    setFace(doc, 'bold', 8.7, COLOR.rose)
    put(doc, 'Balance due', TX, base)
    put(doc, inrFmt(balance), RIGHT, base, { align: 'right' })
  }

  // Amount in words, then the payment mode as three tick-boxes (a fourth
  // option, "Other"/"Bank transfer", is written out).
  base += 22
  setFace(doc, 'body', 7.44, COLOR.label)
  put(doc, 'Amount in words:', LEFT + 0.5, base)
  const wordsX = LEFT + 0.5 + textWidth(doc, 'Amount in words:') + 4
  setFace(doc, 'body', 8.7, COLOR.ink)
  put(doc, numberToWordsIndian(payable), wordsX, base)

  base += 24.8
  setFace(doc, 'semi', 7, COLOR.muted)
  put(doc, 'PAYMENT MODE', LEFT + 0.5, base, { track: 0.6 })
  const modes: { label: string; at: number }[] = [{ label: 'Cash', at: 118.5 }, { label: 'UPI', at: 170 }, { label: 'Card', at: 216 }]
  const paidSomething = invoice.amountReceived > 0 && !cancelled
  const chosen = invoice.paymentMode
  modes.forEach((m) => {
    drawCheckbox(doc, m.at, base - 8.3, 11.5, paidSomething && chosen === m.label)
    setFace(doc, 'body', 8.6, COLOR.ink)
    put(doc, m.label, m.at + 17, base)
  })
  if (paidSomething && chosen !== 'Cash' && chosen !== 'UPI' && chosen !== 'Card') {
    setFace(doc, 'body', 8.6, COLOR.ink)
    put(doc, chosen, 262, base)
  }

  // Something still owed: how to pay it. The QR carries the amount due.
  if (amountDue) {
    const top = base + 22
    const h = 100
    box(doc, LEFT, top, CONTENT_W, h, COLOR.rxFill, COLOR.rxBorder, 8)
    try {
      const qr = await QRCode.toDataURL(buildUpiLink(balance, invoice.invoiceNo), { margin: 1, width: 320 })
      doc.addImage(qr, 'PNG', LEFT + 12, top + 12, 76, 76, undefined, 'FAST')
    } catch {
      // If QR generation fails for any reason, the bank details beside it still
      // let the patient pay manually — never block the whole bill on it.
    }
    const bx = LEFT + 106
    setFace(doc, 'semi', 7, COLOR.label)
    put(doc, 'PAY BY UPI OR BANK TRANSFER', bx, top + 20, { track: 0.3 })
    setFace(doc, 'body', 8.4, COLOR.body)
    const bank = [
      `${CLINIC_DETAILS.bankAccountHolder}  ·  ${CLINIC_DETAILS.bankName}`,
      `A/c ${CLINIC_DETAILS.bankAccountNo}  ·  IFSC ${CLINIC_DETAILS.bankIfsc}`,
      `UPI / Google Pay / PhonePe: ${CLINIC_DETAILS.phone}`,
    ]
    bank.forEach((ln, i) => put(doc, ln, bx, top + 36 + i * 13))
    setFace(doc, 'body', 7.4, COLOR.label)
    put(doc, "Scan the code to pay the amount due. Please mention the patient's name with the payment.", bx, top + 82)
  }

  finishDocument(doc, L, {
    note: 'Thank you for choosing homoeopathic care with us.',
    signerName: `For ${CLINIC_DETAILS.clinicName}`,
    signerRole: 'Authorised signatory',
  })

  const fileName = `${title}_${invoice.invoiceNo}_${patient.name.replace(/\s/g, '_')}.pdf`
  await previewPdf(doc, fileName)
}

// ── Patient summary (for a second-opinion / referral export) ─────────────
// One consolidated document a practitioner can hand to another doctor — real
// remedy names throughout (this is doctor-to-doctor, not the patient-facing
// prescription's bodyText convention). Cancelled prescriptions are included,
// clearly marked, for a complete clinical picture; drafts are excluded (never
// finalized). Same masthead, typefaces and footer as the other documents.
function historyDateFmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export async function exportPatientHistoryPdf(
  patient: Patient,
  prescriptions: Prescription[],
  investigationOrders: InvestigationOrder[],
  outcomes: Outcome[],
) {
  const doc = await createDesignDoc()
  const L = FORM_LAYOUT
  const bottom = contentBottom(L)
  const todayStr = rxDateFormat(new Date().toISOString())
  const TITLE = 'Patient summary'

  const startPage = (continued: boolean) => {
    drawMasthead(doc, L)
    drawTitle(doc, L, TITLE, continued ? 'continued' : undefined)
    drawDate(doc, L, todayStr)
    return continued ? 165 : 160
  }
  let y = startPage(false)
  const ensureRoom = (needed: number) => {
    if (y + needed > bottom) { doc.addPage(); y = startPage(true) }
  }

  // Patient card — the document's anchor.
  const cardH = 92
  box(doc, LEFT, y, CONTENT_W, cardH, COLOR.rxFill, COLOR.rxBorder, 8)
  setFace(doc, 'head', 13, COLOR.ink)
  put(doc, patient.name, LEFT + 14, y + 25)
  setFace(doc, 'body', 8.4, COLOR.muted)
  put(doc, [`${ageText(patient)}y`, patient.sex, patient.wsCode, patient.location].filter(Boolean).join(' · '), LEFT + 14, y + 39)
  const col2 = LEFT + CONTENT_W * 0.52
  setFace(doc, 'semi', 7, COLOR.label)
  put(doc, 'CHIEF COMPLAINT', LEFT + 14, y + 56, { track: 0.3 })
  put(doc, 'CURRENT REMEDY', col2, y + 56, { track: 0.3 })
  setFace(doc, 'body', 9, COLOR.ink)
  const colW = CONTENT_W * 0.48 - 20
  const complaint = (doc.splitTextToSize(patient.chiefComplaint || '—', colW) as string[]).slice(0, 2)
  const remedy = (doc.splitTextToSize(patient.currentRemedy || '—', colW) as string[]).slice(0, 2)
  complaint.forEach((ln, i) => put(doc, ln, LEFT + 14, y + 69 + i * 11))
  remedy.forEach((ln, i) => put(doc, ln, col2, y + 69 + i * 11))
  y += cardH + 14

  setFace(doc, 'body', 8.2, COLOR.muted)
  const allergy = `Allergies: ${patient.allergies || 'None recorded'}   ·   Regular medication: ${patient.regularMedication || 'None recorded'}`
  const allergyLines = doc.splitTextToSize(allergy, CONTENT_W) as string[]
  allergyLines.forEach((ln, i) => put(doc, ln, LEFT + 0.5, y + i * 11))
  y += allergyLines.length * 11 + 16

  const sortedRx = [...prescriptions]
    .filter((r) => r.status !== 'draft')
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
  const sortedInvestigations = [...investigationOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const sortedOutcomes = [...outcomes].sort((a, b) => b.date.localeCompare(a.date))

  const sectionHeader = (label: string) => {
    ensureRoom(56)
    setFace(doc, 'head', 9.2, COLOR.blue)
    put(doc, label.toUpperCase(), LEFT + 0.5, y, { track: 0.78 })
    hline(doc, LEFT, RIGHT, y + 6, COLOR.rule)
    y += 22
  }
  const divider = () => { hline(doc, LEFT, RIGHT, y, COLOR.rule); y += 11 }
  const emptyNote = (text: string) => { setFace(doc, 'body', 9, COLOR.muted); put(doc, text, LEFT + 0.5, y); y += 20 }
  const wrapped = (text: string, size: number, color: string, lineH: number) => {
    setFace(doc, 'body', size, color)
    for (const ln of doc.splitTextToSize(text, CONTENT_W) as string[]) { ensureRoom(lineH + 4); setFace(doc, 'body', size, color); put(doc, ln, LEFT + 0.5, y); y += lineH }
  }

  // Prescription history
  sectionHeader('Prescription history')
  if (sortedRx.length === 0) emptyNote('No prescriptions on record.')
  else sortedRx.forEach((r, i) => {
    ensureRoom(36)
    const cancelled = r.status === 'cancelled'
    const rxTitle = `${r.remedy} ${r.potency}`
    setFace(doc, 'bold', 10, cancelled ? COLOR.label : COLOR.ink)
    put(doc, rxTitle, LEFT + 0.5, y)
    if (cancelled) hline(doc, LEFT + 0.5, LEFT + 0.5 + textWidth(doc, rxTitle), y - 3, COLOR.label, 0.8)
    setFace(doc, 'body', 8.4, COLOR.muted)
    put(doc, historyDateFmt(r.publishedAt ?? r.createdAt), RIGHT, y, { align: 'right' })
    y += 13
    setFace(doc, 'body', 8.4, cancelled ? COLOR.label : COLOR.muted)
    put(doc, `${r.repetition} · ${r.doseGlobules} globules${r.durationDays ? ` · ${r.durationDays} days` : ' · until settled'}${cancelled ? '  ·  Cancelled — not an active prescription' : ''}`, LEFT + 0.5, y)
    y += 11
    if (i < sortedRx.length - 1) divider()
  })
  y += 18

  // Investigation orders
  sectionHeader('Investigation orders')
  if (sortedInvestigations.length === 0) emptyNote('No investigations ordered.')
  else sortedInvestigations.forEach((order, i) => {
    ensureRoom(40)
    setFace(doc, 'bold', 9.5, COLOR.ink)
    put(doc, historyDateFmt(order.createdAt), LEFT + 0.5, y)
    y += 13
    wrapped(order.tests.join(', ') || '—', 9, COLOR.ink, 11.5)
    if (order.notes.trim()) wrapped(`Note: ${order.notes.trim()}`, 8.4, COLOR.muted, 11)
    y += 4
    if (i < sortedInvestigations.length - 1) divider()
  })
  y += 18

  // Outcomes / clinical assessments
  sectionHeader('Clinical outcomes')
  if (sortedOutcomes.length === 0) emptyNote('No outcomes recorded.')
  else sortedOutcomes.forEach((o, i) => {
    ensureRoom(32)
    setFace(doc, 'bold', 10, COLOR.ink)
    put(doc, `${o.outcome} — ${o.remedy}`, LEFT + 0.5, y)
    setFace(doc, 'body', 8.4, COLOR.muted)
    put(doc, historyDateFmt(o.date), RIGHT, y, { align: 'right' })
    y += 13
    if (o.note.trim()) wrapped(o.note.trim(), 8.4, COLOR.muted, 11)
    y += 4
    if (i < sortedOutcomes.length - 1) divider()
  })

  finishDocument(doc, L, { note: 'Prepared for professional reference / clinical consultation.' })

  const fileName = `Patient_Summary_${patient.name.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  await savePdf(doc, fileName)
}
