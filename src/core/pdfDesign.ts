import { jsPDF } from 'jspdf'
import { CLINIC_DETAILS, SNEHAM_LOGO_BASE64, NEHA_SIGNATURE_BASE64, DESIGN_FONT_URLS } from './letterheadAssets'

// The clinic's printed documents — prescription, investigation request, receipt
// (and the patient summary) — are drawn here to match the formats the doctor
// supplied (Design.pdf) point for point: same typefaces (Outfit for headings,
// Source Sans 3 for everything else), the same palette and the same positions,
// measured off her file at 144 dpi. Everything is in points (A4 = 595 × 842).
//
// This file is only the drawing kit — fonts, masthead, fields, footer, and the
// flowing-paragraph engine. What goes on each document lives in pdfExport.ts.

export const COLOR = {
  blue: '#0B57A4',
  rose: '#C23A66',
  ink: '#232A1E',
  body: '#333A33',
  muted: '#5A6168',
  label: '#78808A',
  faint: '#98A0AA',
  hair: '#9AA1AA',
  rule: '#D7DBE1',
  rxFill: '#F3F7FC',
  rxBorder: '#DCE7F3',
  pinkFill: '#FDEEF3',
  pinkBorder: '#F0C3D6',
  pinkHead: '#7D2C4C',
  pinkText: '#5F3145',
  danger: '#DC2626',
}

export const PAGE_W = 595.28
export const PAGE_H = 841.89
export const LEFT = 45
export const RIGHT = 549.5
export const CONTENT_W = RIGHT - LEFT

// The prescription page and the two form pages are set a few points apart in
// the reference (title row, footer), so each keeps its own measured numbers.
export interface Layout {
  mast: number // shift of the whole masthead
  titleBase: number // baseline of the title
  titleSize: number
  dateBase: number // baseline of the Date label
  footRule: number // y of the rule above the footer
  sigLine: number // y of the signature line
  sigLineX: number
  sigNameBase: number
  sigRoleBase: number
  noteBase: number // baseline of the footer note
  labelTrack: number // letter-spacing of the small caps field labels
  addrDy: number // the address and credentials sit a touch lower on the form pages
  credDy: number
}
export const RX_LAYOUT: Layout = { mast: 0, titleBase: 126.4, titleSize: 13.8, dateBase: 127, footRule: 750, sigLine: 782.4, sigLineX: 422, sigNameBase: 793.8, sigRoleBase: 802.2, noteBase: 801.5, labelTrack: 0.3, addrDy: 0, credDy: 0 }
export const FORM_LAYOUT: Layout = { mast: 2.3, titleBase: 131.1, titleSize: 14.6, dateBase: 131.5, footRule: 742.5, sigLine: 779.4, sigLineX: 414.5, sigNameBase: 790.6, sigRoleBase: 799.2, noteBase: 798.5, labelTrack: 0.55, addrDy: 1, credDy: 0.5 }

// ── Fonts ────────────────────────────────────────────────────────────────
// Outfit ships only semibold/bold, Source Sans 3 regular/semibold/bold — the
// same files the app itself uses, trimmed to Latin so they stay ~40 KB each.
// Registered per document (jsPDF keeps fonts per instance).
type Face = 'head' | 'headBold' | 'body' | 'semi' | 'bold'
const FACE: Record<Face, [string, string]> = {
  head: ['Outfit', 'normal'],
  headBold: ['Outfit', 'bold'],
  body: ['SS', 'normal'],
  semi: ['SSSemi', 'normal'],
  bold: ['SS', 'bold'],
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

// Fetched once per session; every document after the first reuses these.
let fontCache: Record<keyof typeof DESIGN_FONT_URLS, string> | null = null
async function loadFonts() {
  if (fontCache) return fontCache
  const entries = await Promise.all(
    (Object.keys(DESIGN_FONT_URLS) as (keyof typeof DESIGN_FONT_URLS)[]).map(async (k) => {
      const buf = await fetch(DESIGN_FONT_URLS[k]).then((r) => r.arrayBuffer())
      return [k, bytesToBase64(new Uint8Array(buf))] as const
    }),
  )
  fontCache = Object.fromEntries(entries) as Record<keyof typeof DESIGN_FONT_URLS, string>
  return fontCache
}

// What the embedded fonts can draw: printable ASCII, Latin-1 and Latin
// Extended-A (accents, °, ½, ×, µ …), typographic quotes/dashes/bullet/
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

/** A fresh A4 document (points) with the clinic's fonts registered and every
 *  string passed to it — names, diagnoses, instructions — made printable, for
 *  drawing and measuring alike. */
export async function createDesignDoc(): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const f = await loadFonts()
  const add = (file: string, key: keyof typeof DESIGN_FONT_URLS, family: string, style: string) => {
    doc.addFileToVFS(file, f[key])
    doc.addFont(file, family, style)
  }
  add('Outfit-SemiBold.ttf', 'outfitSemibold', 'Outfit', 'normal')
  add('Outfit-Bold.ttf', 'outfitBold', 'Outfit', 'bold')
  add('SourceSans3-Regular.ttf', 'sourceSansRegular', 'SS', 'normal')
  add('SourceSans3-Bold.ttf', 'sourceSansBold', 'SS', 'bold')
  add('SourceSans3-SemiBold.ttf', 'sourceSansSemibold', 'SSSemi', 'normal')
  doc.setFont('SS', 'normal')
  const d = doc as unknown as Record<string, (...a: unknown[]) => unknown>
  for (const fn of ['text', 'splitTextToSize', 'getTextWidth']) {
    const orig = d[fn].bind(doc)
    d[fn] = (t: unknown, ...rest: unknown[]) => orig(printable(t), ...rest)
  }
  return doc
}

// ── Text and line primitives ─────────────────────────────────────────────
export function setFace(doc: jsPDF, face: Face, size: number, color: string) {
  doc.setFont(FACE[face][0], FACE[face][1])
  doc.setFontSize(size)
  doc.setTextColor(color)
}

/** Width of `s` in the current font, plus `track` points after every letter. */
export const textWidth = (doc: jsPDF, s: string, track = 0) => doc.getTextWidth(s) + track * s.length

interface PutOpts { align?: 'left' | 'right' | 'center'; track?: number }
/** Draws one line of text; `y` is the baseline. Letter-spacing is applied
 *  here (and alignment worked out by hand, since jsPDF ignores spacing when
 *  it aligns). */
export function put(doc: jsPDF, s: string, x: number, y: number, o: PutOpts = {}) {
  const track = o.track ?? 0
  const visible = textWidth(doc, s, track) - track // no spacing after the last letter
  const px = o.align === 'right' ? x - visible : o.align === 'center' ? x - visible / 2 : x
  if (track) doc.setCharSpace(track)
  doc.text(s, px, y)
  if (track) doc.setCharSpace(0)
}

export function hline(doc: jsPDF, x1: number, x2: number, y: number, color: string = COLOR.hair, w = 0.75) {
  doc.setDrawColor(color)
  doc.setLineWidth(w)
  doc.line(x1, y, x2, y)
}

/** Shrinks a single-line value (down to `minSize`) until it fits `maxW`, and
 *  only then cuts it with an ellipsis. Leaves the font size set to what it used. */
export function fitLine(doc: jsPDF, text: string, maxW: number, size: number, minSize: number): string {
  let s = size
  doc.setFontSize(s)
  while (s > minSize && doc.getTextWidth(text) > maxW) { s -= 0.25; doc.setFontSize(s) }
  if (doc.getTextWidth(text) <= maxW) return text
  let cut = text
  while (cut.length > 1 && doc.getTextWidth(cut + '…') > maxW) cut = cut.slice(0, -1)
  return cut.trimEnd() + '…'
}

// ── Masthead, title row, fields, footer ──────────────────────────────────
export const DOCTOR_LINE = `${CLINIC_DETAILS.credentials} · ${CLINIC_DETAILS.registrationNo}`

/** Logo top-left; doctor's name, credentials and address right-aligned; the
 *  blue rule beneath. Returns nothing — everything below is placed by the layout. */
export function drawMasthead(doc: jsPDF, L: Layout) {
  const dy = L.mast
  doc.addImage(SNEHAM_LOGO_BASE64, 'PNG', 39.3, 33.2 + dy, 107.9, 64.85, undefined, 'FAST')
  setFace(doc, 'head', 11.2, COLOR.ink)
  put(doc, CLINIC_DETAILS.doctorName, RIGHT, 54.3 + dy, { align: 'right' })
  setFace(doc, 'body', 7.8, COLOR.muted)
  put(doc, DOCTOR_LINE, RIGHT, 66.2 + dy + L.credDy, { align: 'right' })
  setFace(doc, 'body', 7.05, COLOR.label)
  put(doc, CLINIC_DETAILS.addressLines[0], RIGHT, 80.1 + dy + L.addrDy, { align: 'right' })
  put(doc, CLINIC_DETAILS.addressLines[1], RIGHT, 90.5 + dy + L.addrDy, { align: 'right' })
  hline(doc, LEFT, RIGHT, 103.25 + dy, COLOR.blue, 1.4)
}

/** The rose dot + page title on the left. `suffix` (e.g. "continued") follows in
 *  the label colour. */
export function drawTitle(doc: jsPDF, L: Layout, title: string, suffix?: string) {
  doc.setFillColor(COLOR.rose)
  doc.circle(47.75, L.dateBase - 3, 2.8, 'F')
  setFace(doc, 'head', L.titleSize, COLOR.ink)
  put(doc, title, 57.3, L.titleBase)
  if (suffix) {
    const w = textWidth(doc, title)
    setFace(doc, 'body', 8, COLOR.label)
    put(doc, suffix, 57.3 + w + 6, L.titleBase)
  }
}

/** "Date ______" at the right of the title row, with the date written on the line. */
export function drawDate(doc: jsPDF, L: Layout, value: string) {
  const labelX = L === RX_LAYOUT ? 435.5 : 428
  const lineX = L === RX_LAYOUT ? 459.5 : 452
  setFace(doc, 'semi', 8, COLOR.muted)
  put(doc, 'Date', labelX - 0.5, L.dateBase - 0.5)
  hline(doc, lineX, RIGHT, L.dateBase - 0.75)
  setFace(doc, 'body', 9, COLOR.ink)
  put(doc, value, lineX + 3, L.dateBase - 2.6)
}

/** A caps label with a ruled line beneath; the value sits just above the rule.
 *  Wrapped values push the rule down. Returns the y of the rule. */
export function drawField(
  doc: jsPDF,
  o: { label: string; value: string; x1: number; x2: number; labelBase: number; lineY: number; size?: number; maxLines?: number; track?: number },
): number {
  setFace(doc, 'semi', 7, COLOR.label)
  put(doc, o.label, o.x1 + 0.5, o.labelBase, { track: o.track ?? 0.3 })
  const size = o.size ?? 9.5
  const lineH = size * 1.25
  let lines: string[] = ['']
  if (o.value.trim()) {
    setFace(doc, 'body', size, COLOR.ink)
    lines = doc.splitTextToSize(o.value.trim(), o.x2 - o.x1 - 2) as string[]
    const cap = o.maxLines ?? 4
    if (lines.length > cap) lines = [...lines.slice(0, cap - 1), fitLine(doc, lines.slice(cap - 1).join(' '), o.x2 - o.x1 - 2, size, size)]
  }
  setFace(doc, 'body', size, COLOR.ink)
  lines.forEach((ln, i) => { if (ln) put(doc, ln, o.x1 + 0.5, o.lineY - 3.2 + i * lineH) })
  const y = o.lineY + (lines.length - 1) * lineH
  hline(doc, o.x1, o.x2, y)
  return y
}

/** Rounded filled box with a 1pt border. */
export function box(doc: jsPDF, x: number, y: number, w: number, h: number, fill: string, border: string, r = 8) {
  doc.setFillColor(fill)
  doc.setDrawColor(border)
  doc.setLineWidth(1)
  doc.roundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r, r, 'FD')
}

/** Footer: rule, note on the left, and the signature block on the right. The
 *  signature image is drawn only on the last page of a document (`signed`). */
export function drawFooter(doc: jsPDF, L: Layout, o: { note: string; signed: boolean; signerName?: string; signerRole?: string }) {
  hline(doc, LEFT, RIGHT, L.footRule, COLOR.rule)
  setFace(doc, 'body', 6.7, COLOR.faint)
  put(doc, o.note, LEFT + 0.5, L.noteBase)

  const cx = (L.sigLineX + RIGHT) / 2
  if (o.signed) {
    const h = 30
    const w = h * (219 / 90)
    doc.addImage(NEHA_SIGNATURE_BASE64, 'PNG', cx - w / 2, L.sigLine - 1 - h, w, h)
  }
  hline(doc, L.sigLineX, RIGHT, L.sigLine)
  setFace(doc, 'head', 8.17, COLOR.ink)
  put(doc, o.signerName ?? CLINIC_DETAILS.doctorName, cx, L.sigNameBase, { align: 'center' })
  setFace(doc, 'body', 6.7, COLOR.muted)
  put(doc, o.signerRole ?? DOCTOR_LINE, cx, L.sigRoleBase, { align: 'center' })
}

/** Lowest y that content may reach on a page before it must continue on the next. */
export const contentBottom = (L: Layout) => L.footRule - 14

// ── The ℞ sign ───────────────────────────────────────────────────────────
// None of the fonts carry ℞, so it is drawn from the outline used in the clinic's
// design (a 20 pt glyph; coordinates in points from its baseline-left origin).
const RX_GLYPH =
  'M 1.46875 0 L 1.46875 -14.625 L 6.9375 -14.625 C 9.90625 -14.625 11.390625 -13.414062 11.390625 -11 C 11.390625 -10.09375 11.132812 -9.269531 10.625 -8.53125 C 10.125 -7.789062 9.4375 -7.222656 8.5625 -6.828125 L 9.640625 -5.28125 L 10.796875 -6.84375 L 13.0625 -6.84375 L 10.71875 -3.734375 L 13.34375 0 L 10.15625 0 L 9.078125 -1.546875 L 7.921875 0 L 5.671875 0 L 7.984375 -3.09375 L 6 -5.984375 L 4.328125 -5.984375 L 4.328125 0 Z ' +
  'M 4.328125 -7.984375 L 5.03125 -7.984375 C 7.238281 -7.984375 8.34375 -8.875 8.34375 -10.65625 C 8.34375 -11.957031 7.359375 -12.609375 5.390625 -12.609375 L 4.328125 -12.609375 Z'

export function drawRxSign(doc: jsPDF, x: number, baseline: number, color: string) {
  const t = RX_GLYPH.split(/\s+/)
  doc.setFillColor(color)
  for (let i = 0; i < t.length;) {
    const c = t[i++]
    if (c === 'Z') { doc.close(); continue }
    const n = c === 'C' ? 6 : 2
    const v = t.slice(i, i + n).map((q, k) => Number(q) + (k % 2 === 0 ? x : baseline))
    i += n
    if (c === 'M') doc.moveTo(v[0], v[1])
    else if (c === 'L') doc.lineTo(v[0], v[1])
    else doc.curveTo(v[0], v[1], v[2], v[3], v[4], v[5])
  }
  doc.fill()
}

// ── Flowing paragraphs (instructions) ────────────────────────────────────
// The doctor writes her instructions in plain text, marking emphasis with
// *asterisks* — a pair makes bold. An asterisk with no partner (the "*Pills to
// be placed…" footnotes) is printed as it is.
interface Seg { t: string; bold: boolean }
export interface Para { segs: Seg[]; kind: 'normal' | 'heading' | 'note' }

function parseSegs(line: string): Seg[] {
  const segs: Seg[] = []
  let last = 0
  for (const m of line.matchAll(/\*([^*\n]+)\*/g)) {
    if (m.index! > last) segs.push({ t: line.slice(last, m.index), bold: false })
    segs.push({ t: m[1], bold: true })
    last = m.index! + m[0].length
  }
  if (last < line.length) segs.push({ t: line.slice(last), bold: false })
  return segs
}

export function parseParagraphs(text: string): Para[] {
  const paras: Para[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    let segs = parseSegs(line)
    // "(2) *Regular dose* -" — the numbered group titles: the number is bold
    // with the title, and a dash after them reads as an en dash.
    const heading = segs.length >= 2 && /^\(\d+\)\s*$/.test(segs[0].t) && segs[1].bold && segs.slice(2).every((s) => /^\s*[-–—]?\s*$/.test(s.t))
    if (heading) {
      segs[0] = { t: segs[0].t, bold: true }
      segs = segs.map((s) => (s.bold ? { t: s.t.replace(/\s*[-–]$/, ' –'), bold: true } : { t: s.t.replace(/^\s*-\s*$/, ' –'), bold: false }))
    }
    segs = segs.map((s) => ({ t: s.t.replace(/(^|\s)-(\s|$)/g, '$1–$2'), bold: s.bold }))
    // a line that opens with a lone * is a footnote ("*Pills to be placed …")
    const note = !heading && !segs[0].bold && segs[0].t.startsWith('*')
    paras.push({ segs, kind: heading ? 'heading' : note ? 'note' : 'normal' })
  }
  return paras
}

interface Tok { parts: Seg[]; spaceBefore: boolean }
function tokenize(segs: Seg[]): Tok[] {
  const toks: Tok[] = []
  let pendingSpace = false
  let cur: Tok | null = null
  for (const s of segs) {
    for (const m of s.t.matchAll(/(\s+)|(\S+)/g)) {
      if (m[1]) { pendingSpace = true; cur = null; continue }
      if (!cur || pendingSpace) { cur = { parts: [], spaceBefore: pendingSpace && toks.length > 0 }; toks.push(cur); pendingSpace = false }
      cur.parts.push({ t: m[2], bold: s.bold })
    }
  }
  return toks
}

export interface PlacedWord { t: string; bold: boolean; x: number }
export interface LaidPara { lines: PlacedWord[][]; kind: Para['kind'] }
export interface FlowStyle {
  size: number
  lineH: number
  gap: number // space between paragraphs
  headingExtra: number // extra space above a group title or the first footnote
  tight: number // a little less space after a group title, and between footnotes
  color: string
  boldColor: string
}

/** Space above paragraph `p` that follows `prev`, beyond one line. */
function gapBefore(prev: Para['kind'], p: Para['kind'], st: FlowStyle): number {
  let g = st.gap
  if (p === 'heading' || (p === 'note' && prev !== 'note')) g += st.headingExtra
  if (prev === 'heading' || (prev === 'note' && p === 'note')) g -= st.tight
  return g
}

/** Wraps every paragraph to `width` (measuring only — nothing is drawn). */
export function layoutParagraphs(doc: jsPDF, paras: Para[], width: number, st: FlowStyle): LaidPara[] {
  const widthOf = (t: string, bold: boolean) => { setFace(doc, bold ? 'bold' : 'body', st.size, st.color); return doc.getTextWidth(t) }
  setFace(doc, 'body', st.size, st.color)
  const space = doc.getTextWidth(' ')
  return paras.map((p) => {
    const lines: PlacedWord[][] = []
    let line: PlacedWord[] = []
    let x = 0
    for (const tok of tokenize(p.segs)) {
      const w = tok.parts.reduce((s, part) => s + widthOf(part.t, part.bold), 0)
      const lead = line.length > 0 && tok.spaceBefore ? space : 0
      if (line.length > 0 && x + lead + w > width) { lines.push(line); line = []; x = 0 }
      else x += lead
      for (const part of tok.parts) { line.push({ t: part.t, bold: part.bold, x }); x += widthOf(part.t, part.bold) }
    }
    if (line.length) lines.push(line)
    return { lines, kind: p.kind }
  })
}

/** Height from the first baseline to the last baseline of a laid-out block. */
export function flowHeight(laid: LaidPara[], st: FlowStyle): number {
  let h = 0
  laid.forEach((p, i) => {
    if (i > 0) h += st.lineH + gapBefore(laid[i - 1].kind, p.kind, st)
    h += (p.lines.length - 1) * st.lineH
  })
  return h
}

/** Draws laid-out paragraphs starting at the first baseline `y`, breaking to a
 *  new page (via `nextPage`, which returns the first baseline there) whenever
 *  the next line would pass `bottom`. A heading is never left alone at the
 *  foot of a page. Returns the baseline of the last line drawn. */
export function drawFlow(
  doc: jsPDF,
  laid: LaidPara[],
  x: number,
  y: number,
  st: FlowStyle,
  bottom: number,
  nextPage: () => number,
): number {
  laid.forEach((p, pi) => {
    p.lines.forEach((ln, li) => {
      if (pi > 0 || li > 0) y += st.lineH + (li === 0 ? gapBefore(laid[pi - 1].kind, p.kind, st) : 0)
      // a heading needs room for the line that follows it, too
      const keep = li === 0 && p.kind === 'heading' ? st.lineH + st.gap : 0
      if (y + keep > bottom) y = nextPage()
      for (const w of ln) {
        setFace(doc, w.bold ? 'bold' : 'body', st.size, w.bold ? st.boldColor : st.color)
        doc.text(w.t, x + w.x, y)
      }
    })
  })
  return y
}
