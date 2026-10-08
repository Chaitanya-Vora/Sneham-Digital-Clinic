// Run: node scripts/test-refill-and-private-visits.mjs
// The doctor's own refill-reminder day, and visits she keeps to herself.
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'refill-'))
const entry = join(dir, 'entry.ts')
const root = process.cwd()
writeFileSync(entry, `
export * from '${root}/src/core/day'
export * from '${root}/src/core/restockReminders'
export * from '${root}/src/core/restockChoice'
export * from '${root}/src/core/visitPrivacy'
export { restockDaysColumns, visitPrivacyColumns, rxPrivacyColumns } from '${root}/src/core/db'
`)
const out = join(dir, 'bundle.mjs')
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent',
  define: { 'import.meta.env.VITE_SUPABASE_URL': '"https://example.supabase.co"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"x"', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_DEFAULT_SURFACE': '"web"' },
})
const m = await import(pathToFileURL(out).href)

let failed = 0
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) console.log(`      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`); t(name, ok) }

// ── the day a refill reminder appears ──
eq('the usual day is 21', m.RESTOCK_REMINDER_DAYS, 21)
eq('no choice = the usual day', m.restockDaysOf({}), 21)
eq('her own day is used', m.restockDaysOf({ restockReminderDays: 30 }), 30)
eq('a stored 0 is pulled up to 1', m.restockDaysOf({ restockReminderDays: 0 }), 1)
eq('a huge stored value is capped', m.restockDaysOf({ restockReminderDays: 9999 }), 180)
eq('a non-number falls back to the usual day', m.clampRestockDays('abc'), 21)
eq('decimals are rounded', m.clampRestockDays(13.6), 14)

const today = new Date(2026, 9, 30) // 30 Oct 2026
const published = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return d.toISOString() }
t('21-day reminder is not due on day 20', !m.isRestockDue(published(20), today))
t('21-day reminder is due on day 21', m.isRestockDue(published(21), today))
t('30-day reminder is not due on day 21', !m.isRestockDue(published(21), today, 30))
t('30-day reminder is due on day 30', m.isRestockDue(published(30), today, 30))
t('it stays for 14 days after its day (21 + 14)', m.isRestockDue(published(35), today) && !m.isRestockDue(published(36), today))
t('a custom day keeps the same 14-day window (30 + 14)', m.isRestockDue(published(44), today, 30) && !m.isRestockDue(published(45), today, 30))
t('a 7-day reminder is due on day 7', m.isRestockDue(published(7), today, 7))

const rx = (over = {}) => ({ id: 'a', patientId: 'p1', remedy: 'Sulphur', status: 'published', publishedAt: published(30), restockReminderEnabled: true, ...over })
eq('due list honours each prescription’s own day', m.restockRemindersDue([rx({ id: 'a', restockReminderDays: 30 }), rx({ id: 'b', patientId: 'p2', restockReminderDays: 45 }), rx({ id: 'c', patientId: 'p3' })], today).map((r) => r.id), ['a', 'c'])
eq('not opted in = never due', m.restockRemindersDue([rx({ restockReminderEnabled: false })], today), [])
eq('a newer prescription of the same remedy resolves it', m.restockRemindersDue([rx({ id: 'old' }), rx({ id: 'new', publishedAt: published(2) })], today).map((r) => r.id), [])
eq('cancelled/draft are ignored', m.restockRemindersDue([rx({ status: 'cancelled' }), rx({ status: 'draft' })], today), [])

// ── what gets saved ──
eq('default day writes nothing (works before the update)', m.restockDaysColumns({ restockReminderEnabled: true, restockReminderDays: 21 }), {})
eq('no day writes nothing', m.restockDaysColumns({ restockReminderEnabled: true }), {})
eq('a custom day is written', m.restockDaysColumns({ restockReminderEnabled: true, restockReminderDays: 30 }), { restock_reminder_days: 30 })
eq('reminder off writes nothing', m.restockDaysColumns({ restockReminderEnabled: false, restockReminderDays: 30 }), {})
eq('going back to the usual day clears an earlier custom one', m.restockDaysColumns({ restockReminderEnabled: true, restockReminderDays: 21 }, true), { restock_reminder_days: null })
eq('turning it off clears an earlier custom day', m.restockDaysColumns({ restockReminderEnabled: false }, true), { restock_reminder_days: null })

// ── the date shown in the editor ──
eq('first appearance date', m.restockFirstDate(30, '2026-10-08'), '2026-11-07')
t('date label has a weekday', /^Sat, 7 Nov$/.test(m.restockDateLabel('2026-11-07')))
t('chips include the usual 21', m.RESTOCK_DAY_CHIPS.includes(21))
eq('last choice defaults to 21 with no storage', m.lastRestockDays(), 21)

// ── visits she keeps to herself ──
const visits = [
  { id: '1', patientId: 'p1' },
  { id: '2', patientId: 'p1', hiddenFromPatient: true },
  { id: '3', patientId: 'p1', hiddenFromPatient: false },
  { id: '4', patientId: 'p2' },
]
eq('the patient sees only ordinary visits', m.visitsForPatient(visits, 'p1').map((v) => v.id), ['1', '3'])
eq('a patient with none sees none', m.visitsForPatient(visits, 'p9'), [])
t('a missing flag means visible (every row from before the feature)', m.isVisibleToPatient({}))
t('hidden is not visible', !m.isVisibleToPatient({ hiddenFromPatient: true }))
eq('an ordinary visit writes no extra column', m.visitPrivacyColumns({}), {})
eq('a private visit writes the flag', m.visitPrivacyColumns({ hiddenFromPatient: true }), { hidden_from_patient: true })
eq('sharing a private visit clears the flag', m.visitPrivacyColumns({ hiddenFromPatient: false }, true), { hidden_from_patient: false })
eq('an unchanged ordinary visit writes nothing', m.visitPrivacyColumns({ hiddenFromPatient: false }, false), {})

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
