// Run: node scripts/test-rx-privacy.mjs
// The "don't reveal the remedy" rules: what the patient may see, on every surface.
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'rxpriv-'))
const out = join(dir, 'bundle.mjs')
await build({ entryPoints: ['src/core/rxPrivacy.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
const p = await import(pathToFileURL(out).href)

let failed = 0
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }
const eq = (name, got, want) => { const ok = got === want; if (!ok) console.log(`      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`); t(name, ok) }

const shown = { remedy: 'Sulphur', potency: '200C', hideRemedy: false }
const hidden = { remedy: 'Sulphur', potency: '200C', hideRemedy: true, slipLabel: 'Pills No. 1' }
const hiddenNoLabel = { remedy: 'Sulphur', potency: '200C', hideRemedy: true, slipLabel: '' }
const dose = { doseGlobules: 4, repetition: 'Once daily · night', durationDays: 14 }

// ── what the patient may be told the medicine is ──
eq('shown: the full real name', p.remedyForPatient(shown), 'Sulphur 200C')
eq('hidden: only her label', p.remedyForPatient(hidden), 'Pills No. 1')
eq('hidden, no label: nothing', p.remedyForPatient(hiddenNoLabel), '')
eq('hidden, no label: a neutral noun when one is needed', p.remedyForPatientOr(hiddenNoLabel), 'Your medicine')
eq('a missing flag means shown (rows from before the feature)', p.remedyForPatient({ remedy: 'Nux Vomica', potency: '30C' }), 'Nux Vomica 30C')
eq('the label is tidied (spaces, length)', p.cleanSlipLabel('  Pills   No.\n 2 '), 'Pills No. 2')
t('the label is capped', p.cleanSlipLabel('x'.repeat(100)).length === p.SLIP_LABEL_MAX)

// ── the slip line the editor fills in ──
eq('shown line has the name', p.slipLine({ ...shown, ...dose }), 'Sulphur 200C — 4 globules, Once daily · night, 14 days')
eq('hidden line has the label, never the name', p.slipLine({ ...hidden, ...dose }), 'Pills No. 1 — 4 globules, Once daily · night, 14 days')
eq('hidden, no label: just the dose', p.slipLine({ ...hiddenNoLabel, ...dose }), '4 globules, Once daily · night, 14 days')
eq('single dose wording', p.slipLine({ ...hidden, doseGlobules: 6, repetition: 'Once only today', durationDays: null }), 'Pills No. 1 — 6 globules, once only today')
eq('open course has no day count', p.doseSummary({ doseGlobules: 4, repetition: 'Twice daily', durationDays: null }), '4 globules, Twice daily')
t('no hidden line ever contains the remedy or potency', ['Once daily · night', 'Twice daily', 'Weekly'].every((repetition) => { const s = p.slipLine({ ...hidden, doseGlobules: 3, repetition, durationDays: 7 }); return !/sulphur|200c/i.test(s) }))

// ── the printed ℞ box ──
eq('box shown: remedy', p.boxContent(shown).remedy, 'Sulphur')
eq('box shown: potency', p.boxContent(shown).potency, '200C')
eq('box hidden: her label', p.boxContent(hidden).remedy, 'Pills No. 1')
eq('box hidden: potency blank', p.boxContent(hidden).potency, '')
eq('box hidden, no label: a neutral line, not a blank form field', p.boxContent(hiddenNoLabel).remedy, p.NO_NAME_ON_BOX)

// ── notification ──
eq('notification shown (unchanged wording)', p.newRxNotification('Dr. Neha', shown, true), 'Dr. Neha prescribed Sulphur 200C. Dose reminders are on.')
eq('notification shown, no reminders', p.newRxNotification('Dr. Neha', shown, false), 'Dr. Neha prescribed Sulphur 200C.')
eq('notification hidden with label', p.newRxNotification('Dr. Neha', hidden, true), 'Dr. Neha sent you a new prescription — Pills No. 1. Dose reminders are on.')
eq('notification hidden, no label', p.newRxNotification('Dr. Neha', hiddenNoLabel, false), 'Dr. Neha sent you a new prescription.')
t('hidden notification never contains the name', !/sulphur|200c/i.test(p.newRxNotification('Dr. Neha', hidden, true) + p.newRxNotification('Dr. Neha', hiddenNoLabel, true)))

// ── dose reminders ──
eq('reminder shown keeps remedy', p.reminderNaming(shown).remedy, 'Sulphur')
eq('reminder shown keeps potency', p.reminderNaming(shown).potency, '200C')
eq('reminder hidden uses her label', p.reminderNaming(hidden).remedy, 'Pills No. 1')
eq('reminder hidden has no potency', p.reminderNaming(hidden).potency, '')
eq('reminder hidden, no label: neutral noun', p.reminderNaming(hiddenNoLabel).remedy, 'Your medicine')

// ── message fallback ──
eq('message fallback shown', p.messageFallback({ ...shown, ...dose }), 'Sulphur 200C')
eq('message fallback hidden', p.messageFallback({ ...hidden, ...dose }), 'Pills No. 1')
eq('message fallback hidden, no label', p.messageFallback({ ...hiddenNoLabel, ...dose }), 'Your prescription')

// ── does her own text give it away? ──
eq('full name found', p.mentionsRemedy('Take Sulphur at night', 'Sulphur'), 'Sulphur')
eq('case does not matter', p.mentionsRemedy('take SULPHUR at night', 'Sulphur'), 'Sulphur')
eq('a long word of a two-word name is found', p.mentionsRemedy('Take natrum daily', 'Natrum Muriaticum'), 'natrum')
eq('the whole two-word name is found', p.mentionsRemedy('Give Nux Vomica twice', 'Nux Vomica'), 'Nux Vomica')
eq('her shorthand is not a match', p.mentionsRemedy('Take 6 pills from bottle SU 1M', 'Sulphur'), null)
eq('a part of another word is not a match', p.mentionsRemedy('Sulphurous springs', 'Sulphur'), null)
eq('empty text', p.mentionsRemedy('', 'Sulphur'), null)
eq('empty remedy', p.mentionsRemedy('anything', ''), null)
eq('short words alone do not count (Nux)', p.mentionsRemedy('a nux of luck', 'Nux Vomica'), null)

// ── the patient's own app ──
const rxs = [
  { id: '1', patientId: 'p', status: 'published', createdAt: '2026-08-01T00:00:00Z', publishedAt: '2026-08-01T00:00:00Z', remedy: 'Natrum Muriaticum', potency: '30C' },
  { id: '2', patientId: 'p', status: 'published', createdAt: '2026-09-01T00:00:00Z', publishedAt: '2026-09-01T00:00:00Z', remedy: 'Sulphur', potency: '200C', hideRemedy: true, slipLabel: 'Pills No. 1' },
]
eq('current remedy hidden: her label', p.currentRemedyForPatient('Sulphur 200C', rxs), 'Pills No. 1')
eq('current remedy, latest shown: the real label', p.currentRemedyForPatient('Natrum Muriaticum 30C', [rxs[0]]), 'Natrum Muriaticum 30C')
eq('current remedy hidden with no label', p.currentRemedyForPatient('Sulphur 200C', [{ ...rxs[1], slipLabel: '' }]), 'As prescribed by your doctor')
eq('current remedy: nothing prescribed', p.currentRemedyForPatient(null, []), null)
eq('a cancelled hidden prescription does not decide', p.currentRemedyForPatient('Natrum Muriaticum 30C', [rxs[0], { ...rxs[1], status: 'cancelled' }]), 'Natrum Muriaticum 30C')
eq('a draft does not decide', p.currentRemedyForPatient('Natrum Muriaticum 30C', [rxs[0], { ...rxs[1], status: 'draft' }]), 'Natrum Muriaticum 30C')
eq('past-visit remedy for a hidden course: her label', p.remedyTextForPatient('Sulphur 200C', rxs), 'Pills No. 1')
eq('past-visit remedy matching is not case sensitive', p.remedyTextForPatient('sulphur 200c', rxs), 'Pills No. 1')
eq('past-visit remedy of a shown course: untouched', p.remedyTextForPatient('Natrum Muriaticum 30C', rxs), 'Natrum Muriaticum 30C')
eq('past-visit remedy hidden with no label: nothing', p.remedyTextForPatient('Sulphur 200C', [{ ...rxs[1], slipLabel: '' }]), null)
eq('a longer line that names a hidden remedy is masked', p.remedyTextForPatient('Sulphur 200C, continued', rxs), 'Pills No. 1')
eq('empty text stays empty', p.remedyTextForPatient(null, rxs), null)

// ── what the patient's own screens and exports receive ──
const safeHidden = p.patientSafeRx({ id: '2', remedy: 'Sulphur', potency: '200C', hideRemedy: true, slipLabel: 'Pills No. 1', repetition: 'Twice daily', bodyText: 'Take 6 pills' })
eq('safe copy: remedy is her label', safeHidden.remedy, 'Pills No. 1')
eq('safe copy: potency is gone', safeHidden.potency, '')
eq('safe copy: other fields untouched', safeHidden.repetition + '|' + safeHidden.bodyText, 'Twice daily|Take 6 pills')
t('safe copy keeps the privacy flag so the PDF still masks', safeHidden.hideRemedy === true)
eq('safe copy of a hidden rx with no label gets a neutral noun', p.patientSafeRx({ remedy: 'Sulphur', potency: '1M', hideRemedy: true }).remedy, 'Your prescription')
const shownRx = { id: '1', remedy: 'Natrum Muriaticum', potency: '30C' }
t('a shown prescription is returned as is', p.patientSafeRx(shownRx) === shownRx)
const doseRow = (id) => ({ id: 'd', prescriptionId: id, remedy: 'Sulphur', potency: '200C', time: '8:00 PM' })
eq('a dose of a hidden prescription is masked even if its row has the name', p.patientSafeDose(doseRow('2'), rxs).remedy, 'Pills No. 1')
eq('…and loses the potency', p.patientSafeDose(doseRow('2'), rxs).potency, '')
eq('a dose of a shown prescription is untouched', p.patientSafeDose(doseRow('1'), rxs).remedy, 'Sulphur')
eq('a dose with an unknown prescription is untouched', p.patientSafeDose(doseRow('zzz'), rxs).remedy, 'Sulphur')

// ── the last label is only a convenience (no storage in node) ──
eq('last label falls back to the first preset', p.lastSlipLabel(), p.SLIP_LABEL_PRESETS[0])

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
