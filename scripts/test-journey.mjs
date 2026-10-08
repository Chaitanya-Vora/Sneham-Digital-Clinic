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
const { buildJourney, buildEpisodes } = await import(pathToFileURL(out).href)
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

// ── the story grouped by treatment ──
const at = (n, h, m = 0) => new Date(2026, 9, 8 + n, h, m, 0).toISOString()
const story = {
  appointments: [
    { id: 'a0', date: day(-80), time: '9:00 AM', status: 'Seen', type: 'In person', reason: 'First visit' },
    { id: 'a1', date: day(-70), time: '10:00 AM', status: 'Seen', type: 'In person', reason: 'Follow-up' },
    { id: 'a2', date: day(-55), time: '10:00 AM', status: 'Seen', type: 'In person', reason: 'Follow-up' },
    { id: 'a3', date: day(-40), time: '10:00 AM', status: 'Seen', type: 'In person', reason: 'Follow-up' },
    { id: 'a4', date: day(-8), time: '11:00 AM', status: 'Seen', type: 'In person', reason: 'Follow-up' },
    { id: 'a5', date: day(6), time: '9:00 AM', status: 'Upcoming', type: 'In person', reason: 'Follow-up' },
  ],
  prescriptions: [
    { id: 'r1', status: 'published', remedy: 'Natrum Muriaticum', potency: '30C', repetition: 'Twice daily', durationDays: 21, publishedAt: at(-70, 10, 30), createdAt: at(-70, 10, 30) },
    { id: 'r2x', status: 'cancelled', remedy: 'Sulphur', potency: '30C', repetition: 'Once daily · night', durationDays: 14, publishedAt: at(-40, 9, 0), createdAt: at(-40, 9, 0) },
    { id: 'r2', status: 'published', remedy: 'Sulphur', potency: '200C', repetition: 'Once daily · night', durationDays: 14, publishedAt: at(-40, 10, 30), createdAt: at(-40, 10, 30), hideRemedy: true },
    { id: 'r3', status: 'published', remedy: 'Pulsatilla', potency: '1M', repetition: 'Weekly', durationDays: 28, publishedAt: at(-8, 11, 30), createdAt: at(-8, 11, 30) },
    { id: 'r4', status: 'draft', remedy: 'Draft', potency: '6C', repetition: 'Weekly', durationDays: 7, createdAt: at(-1, 9) },
  ],
  outcomes: [
    { id: 'o1', date: at(-55, 10, 20), remedy: 'Natrum Muriaticum 30C', outcome: 'Partial', note: '' },
    { id: 'o2', date: at(-40, 9, 30), remedy: 'Natrum Muriaticum 30C', outcome: 'No change', note: '' }, // recorded just before the new remedy, same day
    { id: 'o3', date: at(-8, 9, 30), remedy: 'Sulphur 200C', outcome: 'Clear improvement', note: '' },
  ],
  caseVisits: [{ id: 'c1', date: at(-80, 9), template: 'chronic', isRetake: false }, { id: 'c2', date: at(-40, 10), template: 'chronic', isRetake: true }],
  investigationOrders: [{ id: 't1', createdAt: at(-80, 9, 40), tests: ['CBC'] }],
  invoices: [{ id: 'i1', date: day(-70), invoiceNo: 1, status: 'paid', items: [{ name: 'Consultation', qty: 1, unitPrice: 800 }] }],
  checkIns: [{ id: 'k1', submittedAt: at(-30, 20), marked: 'better', freeText: '', changeChips: ['Sleep'] }],
}
const ep = buildEpisodes(story, TODAY)
const byId = (id) => ep.episodes.find((e) => e.id === id)
const evIds = (id) => byId(id).events.map((e) => e.id).sort().join()
t('episodes run newest first, the intake last; drafts are not courses', ep.episodes.map((e) => e.id).join() === 'r3,r2,r2x,r1,intake')
t('the latest published course is current; earlier ones past; a retracted one cancelled', byId('r3').status === 'current' && byId('r2').status === 'past' && byId('r1').status === 'past' && byId('r2x').status === 'cancelled')
t('what happened before any remedy is the intake', byId('intake').title === 'Intake' && evIds('intake') === 'aa0,cc1,tt1')
t('a visit belongs to the course that started that day (the visit that led to it)', evIds('r1').includes('aa1') && evIds('r2').includes('aa3') && evIds('r3') === 'aa4')
t('a review is filed under the remedy it is about, even when recorded just before the next remedy', evIds('r1') === 'aa1,aa2,oo1,oo2' && evIds('r2').includes('oo3'))
t('the episode shows the latest review of its remedy', byId('r1').outcome.label === 'No change' && byId('r2').outcome.label === 'Clear improvement' && byId('r3').outcome === null)
t('check-ins and case notes sit inside their course', evIds('r2') === 'aa3,cc2,kk1,oo3')
t('bills stay out of the story (they have their own tab)', ep.episodes.every((e) => e.events.every((x) => x.kind !== 'bill')))
t('inside a course, newest first', byId('r1').events.map((e) => e.sortKey).every((k, i, a) => i === 0 || a[i - 1] >= k))
t('the hidden-remedy flag reaches the episode', byId('r2').hiddenFromPatient === true && byId('r1').hiddenFromPatient === false)
t('a course has its dates and length', byId('r1').startDate === day(-70) && byId('r1').endDate === day(-50) && byId('r1').subtitle === 'Twice daily · 21 days')
t('what is ahead is listed separately', ep.planned.map((e) => e.id).join() === 'aa5')
t('the remedy is named in full for the doctor', byId('r2').title === 'Sulphur 200C')
const noRx = buildEpisodes({ ...empty, appointments: [story.appointments[0]], caseVisits: [story.caseVisits[0]] }, TODAY)
t('a patient with no remedy yet has one open "First visit"', noRx.episodes.length === 1 && noRx.episodes[0].title === 'First visit' && noRx.episodes[0].status === 'current')
t('an empty patient has an empty story', buildEpisodes(empty, TODAY).episodes.length === 0)
const oneOff = buildEpisodes({ ...empty, prescriptions: [{ id: 'z', status: 'published', remedy: 'Arnica', potency: '200C', repetition: 'Once only today', durationDays: null, publishedAt: at(-1, 9), createdAt: at(-1, 9) }] }, TODAY)
t('a single dose has no end date and no "until settled"', oneOff.episodes[0].endDate === null && oneOff.episodes[0].subtitle === 'Once only today')
const open = buildEpisodes({ ...empty, prescriptions: [{ id: 'z', status: 'published', remedy: 'Arnica', potency: '200C', repetition: 'Twice daily', durationDays: null, publishedAt: at(-1, 9), createdAt: at(-1, 9) }] }, TODAY)
t('an open course says "until settled"', open.episodes[0].subtitle === 'Twice daily · until settled')

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
