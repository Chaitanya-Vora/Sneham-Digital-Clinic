import { isOneOffRepetition, type Repetition } from './types'

// "Don't reveal the remedy" — the rules in one place.
//
// The doctor always records the real remedy (it drives reminders, restock calls,
// history and follow-ups). A prescription can be marked hidden; then everything the
// PATIENT is given uses the doctor's own wording instead: the printed slip, the
// WhatsApp / e-mail text, the patient app, the "new prescription" notification and
// the daily dose reminder. Her own screens always show the real name.
//
// Every surface goes through these functions, so they cannot disagree.

/** The fields these rules need — a Prescription has them all. */
export interface NamedRx {
  remedy: string
  potency: string
  hideRemedy?: boolean
  slipLabel?: string
}

export interface DoseFields {
  doseGlobules: number
  repetition: Repetition
  durationDays: number | null
}

export const SLIP_LABEL_MAX = 40
export const SLIP_LABEL_PRESETS = ['Pills No. 1', 'Bottle A', 'As discussed']

/** What the slip says when the doctor writes nothing and the name is hidden. */
export const NO_NAME_ON_BOX = 'As per instructions below'

/** Tidy what she typed: one line, single spaces, not absurdly long. */
export function cleanSlipLabel(raw: string | undefined | null): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SLIP_LABEL_MAX)
}

export const isHidden = (rx: Pick<NamedRx, 'hideRemedy'>): boolean => rx.hideRemedy === true

/** "Sulphur 200C" — the real, complete name (potency included), for the doctor. */
export const realRemedyLabel = (rx: Pick<NamedRx, 'remedy' | 'potency'>): string => `${rx.remedy} ${rx.potency}`.trim()

/** The medicine the way the PATIENT may see it. '' when it is hidden and she wrote no label. */
export function remedyForPatient(rx: NamedRx): string {
  return isHidden(rx) ? cleanSlipLabel(rx.slipLabel) : realRemedyLabel(rx)
}

/** The same, but never empty — for places that need a noun ("Your medicine"). */
export function remedyForPatientOr(rx: NamedRx, fallback = 'Your medicine'): string {
  return remedyForPatient(rx) || fallback
}

/** "4 globules, once daily · night, 14 days" — dose and timing, the wording the printed slip falls back to. */
export function doseSummary(f: DoseFields): string {
  return isOneOffRepetition(f.repetition)
    ? `${f.doseGlobules} globules, ${f.repetition.toLowerCase()}`
    : `${f.doseGlobules} globules, ${f.repetition}${f.durationDays ? `, ${f.durationDays} days` : ''}`
}

/**
 * The line the editor fills in for the slip until she writes her own words:
 * "Sulphur 200C — 4 globules, …", "Pills No. 1 — 4 globules, …", or just "4 globules, …".
 */
export function slipLine(rx: NamedRx & DoseFields): string {
  return [remedyForPatient(rx), doseSummary(rx)].filter(Boolean).join(' — ')
}

/** What the REMEDY box on the printed slip says (and the POTENCY box, which is blank when hidden). */
export function boxContent(rx: NamedRx): { remedy: string; potency: string } {
  if (!isHidden(rx)) return { remedy: rx.remedy, potency: String(rx.potency ?? '') }
  return { remedy: cleanSlipLabel(rx.slipLabel) || NO_NAME_ON_BOX, potency: '' }
}

/** The text of the patient's "new prescription" notification. */
export function newRxNotification(doctorName: string, rx: NamedRx, remindersOn: boolean): string {
  const tail = remindersOn ? ' Dose reminders are on.' : ''
  if (!isHidden(rx)) return `${doctorName} prescribed ${realRemedyLabel(rx)}.${tail}`.trim()
  const label = cleanSlipLabel(rx.slipLabel)
  return `${doctorName} sent you a new prescription${label ? ` — ${label}` : ''}.${tail}`.trim()
}

/** What a dose reminder row stores (and the patient app shows) as the remedy and potency. */
export function reminderNaming(rx: NamedRx): { remedy: string; potency: string } {
  if (!isHidden(rx)) return { remedy: rx.remedy, potency: rx.potency }
  return { remedy: remedyForPatientOr(rx, 'Your medicine'), potency: '' }
}

/** What goes into "Prescription from Dr X for Y:" when she has written no text of her own. */
export function messageFallback(rx: NamedRx & DoseFields): string {
  return isHidden(rx) ? (remedyForPatient(rx) || 'Your prescription') : realRemedyLabel(rx)
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * Does the text she wrote for the patient still give the remedy away? Returns the word
 * that matched (to show her), or null. A safety net, not a guarantee: it knows the full
 * name and any word of five letters or more — not her private shorthand ("SU").
 */
export function mentionsRemedy(text: string, remedy: string): string | null {
  const t = ` ${norm(text)} `
  const name = norm(remedy)
  if (!name || t.trim() === '') return null
  if (t.includes(` ${name} `)) return remedy.trim()
  for (const word of name.split(' ')) {
    if (word.length >= 5 && t.includes(` ${word} `)) return word
  }
  return null
}

// ── The patient's own app ───────────────────────────────────────────────

interface PatientRx extends NamedRx {
  patientId: string
  status: 'draft' | 'published' | 'cancelled'
  publishedAt?: string
  createdAt: string
}

/** Real label ("Sulphur 200C", lower-cased) → what the patient may be shown for it. */
function hiddenLabels(prescriptions: PatientRx[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const rx of prescriptions) if (isHidden(rx)) out.set(realRemedyLabel(rx).toLowerCase(), cleanSlipLabel(rx.slipLabel))
  return out
}

/**
 * A line of text that is (or starts with) a remedy label the doctor recorded — a visit's
 * remedy, an outcome's — made safe for the patient. If it names a hidden prescription the
 * doctor's own label is shown instead (or nothing, as null, when she wrote none).
 */
export function remedyTextForPatient(text: string | null | undefined, prescriptions: PatientRx[]): string | null {
  if (!text) return null
  const hidden = hiddenLabels(prescriptions)
  const key = text.trim().toLowerCase()
  if (hidden.has(key)) return hidden.get(key) || null
  for (const [real, label] of hidden) if (key.includes(real)) return label || null
  return text
}

/**
 * A copy of a prescription that is safe to hand to the patient's screens, exports and PDFs:
 * when it is hidden, `remedy` is only her label (or a neutral noun) and the potency is gone.
 */
export function patientSafeRx<T extends NamedRx>(rx: T): T {
  if (!isHidden(rx)) return rx
  return { ...rx, remedy: remedyForPatientOr(rx, 'Your prescription'), potency: '' }
}

/** The same for a dose reminder row, looked up by the prescription it belongs to. */
export function patientSafeDose<D extends { prescriptionId: string; remedy: string; potency: string }>(d: D, prescriptions: (NamedRx & { id: string })[]): D {
  const rx = prescriptions.find((r) => r.id === d.prescriptionId)
  return rx && isHidden(rx) ? { ...d, ...reminderNaming(rx) } : d
}

/** "Current remedy" on the patient's profile: the latest published prescription, as she may see it. */
export function currentRemedyForPatient(currentRemedy: string | null, prescriptions: PatientRx[]): string | null {
  const latest = prescriptions
    .filter((r) => r.status === 'published')
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))[0]
  if (latest && isHidden(latest)) return remedyForPatient(latest) || 'As prescribed by your doctor'
  return currentRemedy
}

// ── Remembering the last label on this phone ────────────────────────────
const LABEL_KEY = 'sneham-slip-label'

export function lastSlipLabel(): string {
  try { return cleanSlipLabel(localStorage.getItem(LABEL_KEY)) || SLIP_LABEL_PRESETS[0] } catch { return SLIP_LABEL_PRESETS[0] }
}

export function rememberSlipLabel(label: string) {
  try { localStorage.setItem(LABEL_KEY, cleanSlipLabel(label)) } catch { /* storage unavailable */ }
}
