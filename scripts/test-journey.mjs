// Tests the patient journey builder (src/core/journey.ts).
//   node scripts/test-journey.mjs
import { build } from 'esbuild'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(os.tmpdir(), `journey-${process.pid}.mjs`)
await build({ entryPoints: [path.join(root, 'src/core/journey.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { buildJourney } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }
const TODAY = new Date(2026, 9, 8, 12, 0, 0)
const iso = (n, h = 10) => new Date(2026, 9, 8 + n, h, 0, 0).toISOString()
const day = (n) => { const d = new Date(2026, 9, 8 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const empty = { appointments: [], prescriptions: [], outcomes: [], caseVisits: [], investigationOrders: [], invoices: [], checkIns: [] }

const input = {
  appointments: [
    { id: 'a1', date: day(-10), time: '9:00 AM', status: 'Seen', type: 'In person', reason: 'First visit' },
    { id: 'a2', date: day(-3), time: '11:00 AM', status: 'Cancelled', type: 'Video' },
    { id: 'a3', date: day(5), time: '10:00 AM', status: 'Upcoming', type: 'In person', reason: 'Follow-up' },
    { id: 'a4', date: day(-1), time: '9:00 AM', status: 'Upcoming', type: 'In person' }, // stale, never closed
    { id: 'a5', date: day(0), time: '4:00 PM', status: 'Upcoming', type: 'Video', reason: 'FU' },
  ],
  prescriptions: [
    { id: 'r1', status: 'published', remedy: 'Sulphur', potency: '200C', repetition: 'Once daily · night', durationDays: 14, publishedAt: iso(-10), createdAt: iso(-10) },
    { id: 'r2', status: 'cancelled', remedy: 'Nux vomica', potency: '30C', repetition: 'Twice daily', durationDays: null, publishedAt: iso(-20), createdAt: iso(-20) },
    { id: 'r3', status: 'draft', remedy: 'X', potency: '1M', repetition: 'Weekly', durationDays: 7, createdAt: iso(-1) },
    { id: 'r4', status: 'published', remedy: 'Pulsatilla', potency: '1M', repetition: 'Weekly', durationDays: 28, publishedAt: iso(-30), createdAt: iso(-30), hideRemedy: true },
  ],
  outcomes: [{ id: 'o1', date: iso(-4), remedy: 'Sulphur 200C', outcome: 'Clear improvement', note: 'Sleeping better' }],
  caseVisits: [{ id: 'c1', date: iso(-10), template: 'acute', isRetake: false }, { id: 'c2', date: iso(-9), template: 'chronic', remedy: 'Sulphur', isRetake: true }],
  investigationOrders: [{ id: 't1', createdAt: iso(-9), tests: ['CBC', 'ESR', 'HbA1c', 'Vitamin D'] }],
  invoices: [{ id: 'i1', date: day(-10), invoiceNo: 41, status: 'paid', items: [{ name: 'Consultation fee', qty: 1, unitPrice: 800 }, { name: 'Remedy', qty: 1, unitPrice: 450 }] }, { id: 'i2', date: day(-3), invoiceNo: 44, status: 'cancelled', items: [{ name: 'Consultation fee', qty: 1, unitPrice: 800 }] }],
  checkIns: [{ id: 'k1', submittedAt: iso(-2), marked: 'better', freeText: 'Much better', changeChips: [] }],
}
const j = buildJourney(input, TODAY)
const ids = j.map((e) => e.id)

t('drafts and cancelled appointments are left out', !ids.includes('rr3') && !ids.includes('r' + 'r3') && !ids.includes('aa2'))
t('a stale "Upcoming" from yesterday is not shown as a plan', !ids.includes('aa4'))
t('what is ahead sits first, nearest last (just above "now")', ids.slice(0, 2).join() === 'aa3,aa5' && j[0].planned && j[1].planned)
t('then the past, newest first', j.slice(2).every((e, i, arr) => i === 0 || arr[i - 1].sortKey >= e.sortKey))
t('planned events are marked planned; past ones are not', j.filter((e) => e.planned).length === 2 && j.filter((e) => !e.planned).length === j.length - 2)
t('today\'s booking reads "Today at 4:00 PM"', j.find((e) => e.id === 'aa5').title === 'Today at 4:00 PM')
t('a cancelled prescription is shown, dimmed and badged', (() => { const r = j.find((e) => e.id === 'rr2'); return r && r.dimmed && r.badge.label === 'Cancelled' })())
t('a hidden-remedy prescription is flagged for the doctor', j.find((e) => e.id === 'rr4').hiddenFromPatient === true && !j.find((e) => e.id === 'rr1').hiddenFromPatient)
t('outcome carries the right tone', j.find((e) => e.id === 'oo1').badge.tone === 'green')
t('retake is badged', j.find((e) => e.id === 'cc2').badge?.label === 'Retake' && !j.find((e) => e.id === 'cc1').badge)
t('tests are summarised "+1 more"', j.find((e) => e.id === 'tt1').subtitle === 'CBC, ESR, HbA1c +1 more')
t('invoice shows total in rupees and status; cancelled is dimmed', j.find((e) => e.id === 'ii1').title === '₹1,250' && j.find((e) => e.id === 'ii1').badge.label === 'Paid' && j.find((e) => e.id === 'ii2').dimmed)
t('case and invoice events can be opened', j.find((e) => e.id === 'cc1').ref.type === 'case' && j.find((e) => e.id === 'ii1').ref.type === 'invoice')
t('a consult in progress is "now", between plans and history', (() => { const k = buildJourney({ ...empty, appointments: [{ id: 'n', date: day(0), time: '12:00 PM', status: 'In consult', type: 'In person' }, { id: 'f', date: day(3), time: '9:00 AM', status: 'Upcoming', type: 'In person' }, { id: 'p', date: day(-2), time: '9:00 AM', status: 'Seen', type: 'In person' }] }, TODAY); return k.map((e) => e.id).join() === 'af,an,ap' && k[1].now })())
t('empty patient -> empty journey', buildJourney(empty, TODAY).length === 0)

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
