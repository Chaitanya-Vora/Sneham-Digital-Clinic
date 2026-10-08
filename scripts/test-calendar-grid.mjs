// Run: node scripts/test-calendar-grid.mjs
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'calgrid-'))
const out = join(dir, 'bundle.mjs')
await build({ entryPoints: ['src/core/calendarGrid.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
const g = await import(pathToFileURL(out).href)
const { toISO } = await import(pathToFileURL((await (async () => { await build({ entryPoints: ['src/core/day.ts'], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'day.mjs'), logLevel: 'silent' }); return join(dir, 'day.mjs') })())).href)

let failed = 0
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }
const D = (y, m, d) => new Date(y, m - 1, d)
const iso = (d) => toISO(d)

// October 2026 starts on a Thursday and ends on a Saturday.
const oct = g.monthWeeks(2026, 9)
t('October 2026 spans 5 weeks', oct.length === 5)
t('every row is Monday to Sunday', oct.every((r) => r.length === 7 && r[0].getDay() === 1 && r[6].getDay() === 0))
t('first row starts on Mon 28 Sep', iso(oct[0][0]) === '2026-09-28')
t('last row ends on Sun 1 Nov', iso(oct[4][6]) === '2026-11-01')
t('rows are consecutive days', oct.flat().every((d, i, a) => i === 0 || (d - a[i - 1]) / 86400000 === 1))
// February 2027 starts on a Monday and has 28 days — exactly four rows.
t('Feb 2027 is exactly 4 weeks', g.monthWeeks(2027, 1).length === 4)
// A month that needs six rows: March 2025 starts on a Saturday and has 31 days.
t('Mar 2025 needs 6 weeks', g.monthWeeks(2025, 2).length === 6)

t('week of Thu 8 Oct 2026 is Mon 5 – Sun 11', (() => { const w = g.weekOf(D(2026, 10, 8)); return iso(w[0]) === '2026-10-05' && iso(w[6]) === '2026-10-11' })())
t('a Sunday belongs to the week that ends with it', iso(g.mondayOf(D(2026, 10, 11))) === '2026-10-05')
t('a Monday is its own week start', iso(g.mondayOf(D(2026, 10, 5))) === '2026-10-05')

t('shiftMonth clamps 31 Jan to 28 Feb', iso(g.shiftMonth(D(2027, 1, 31), 1)) === '2027-02-28')
t('shiftMonth goes back across a year', iso(g.shiftMonth(D(2027, 1, 15), -1)) === '2026-12-15')
t('shiftMonth forward past December', iso(g.shiftMonth(D(2026, 12, 20), 1)) === '2027-01-20')
t('shiftWeek keeps the weekday', iso(g.shiftWeek(D(2026, 10, 8), 1)) === '2026-10-15' && iso(g.shiftWeek(D(2026, 10, 8), -2)) === '2026-09-24')
t('addDaysTo crosses a month end', iso(g.addDaysTo(D(2026, 10, 31), 1)) === '2026-11-01')

t('empty day has no bar', g.loadBar(0, 8).fill === 0)
t('half-full day fills half', g.loadBar(4, 8).fill === 0.5 && !g.loadBar(4, 8).over)
t('exactly full is not over', g.loadBar(8, 8).fill === 1 && !g.loadBar(8, 8).over)
t('more than capacity is over and capped at full', g.loadBar(10, 8).over && g.loadBar(10, 8).fill === 1)
t('zero capacity never divides by zero', g.loadBar(3, 0).fill === 0)

const loads = new Map([
  ['2026-10-08', { count: 6, done: 2, blocked: false }],
  ['2026-10-09', { count: 9, done: 0, blocked: false }],
  ['2026-10-12', { count: 0, done: 0, blocked: true }],
])
const s = g.monthSummary(loads, 2026, 9, D(2026, 10, 8))
t('summary counts visits in the month', s.visits === 15)
t('summary finds the busiest day', s.busiest === '2026-10-09')
// Free = Mon–Sat, today or later, nothing booked, not blocked. Oct 8..31: 24 days; Sundays 11,18,25 (3) out; booked 8,9 out; blocked 12 out.
t('free days exclude Sundays, booked and blocked days, and the past', s.freeDays === 24 - 3 - 2 - 1)

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
