// Tests the course / follow-up queue rules (src/core/course.ts) without a phone.
//   node scripts/test-course.mjs
import { build } from 'esbuild'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(os.tmpdir(), `course-${process.pid}.mjs`)
await build({ entryPoints: [path.join(root, 'src/core/course.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { courseOf, courseNote, followUpQueue, latestPublishedByPatient } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }

const TODAY = new Date(2026, 9, 8, 12, 0, 0) // 8 Oct 2026
const daysAgo = (n) => new Date(2026, 9, 8 - n, 10, 0, 0).toISOString()
const iso = (n) => { const d = new Date(2026, 9, 8 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const rx = (o) => ({ id: 'r' + Math.random(), patientId: 'p1', status: 'published', repetition: 'Once daily · night', durationDays: 14, remedy: 'Sulphur', potency: '200C', publishedAt: daysAgo(0), createdAt: daysAgo(0), ...o })

// ── one prescription
t('nothing published -> none', courseOf(null, TODAY).state === 'none' && courseOf(rx({ status: 'draft' }), TODAY).state === 'none' && courseOf(rx({ status: 'cancelled' }), TODAY).state === 'none')
let c = courseOf(rx({ publishedAt: daysAgo(0) }), TODAY)
t('published today, 14 days -> day 1, 13 left, ongoing', c.state === 'ongoing' && c.dayNumber === 1 && c.daysLeft === 13)
c = courseOf(rx({ publishedAt: daysAgo(8) }), TODAY)
t('9th day of 14 -> day 9, 5 left, ends soon', c.state === 'endsSoon' && c.dayNumber === 9 && c.daysLeft === 5)
c = courseOf(rx({ publishedAt: daysAgo(13) }), TODAY)
t('day 14 of 14 -> last day today', c.state === 'endsSoon' && c.daysLeft === 0 && courseNote(c) === 'last day today')
c = courseOf(rx({ publishedAt: daysAgo(12) }), TODAY)
t('13th day -> ends tomorrow', c.daysLeft === 1 && courseNote(c) === 'ends tomorrow')
c = courseOf(rx({ publishedAt: daysAgo(14) }), TODAY)
t('the day after the last day -> ended 1 day ago', c.state === 'ended' && c.endedDaysAgo === 1 && courseNote(c) === 'course ended 1 day ago')
c = courseOf(rx({ publishedAt: daysAgo(34) }), TODAY)
t('14-day course from 34 days ago -> ended 21 days ago', c.state === 'ended' && c.endedDaysAgo === 21 && c.dayNumber === 14)
c = courseOf(rx({ publishedAt: daysAgo(2), durationDays: 30 }), TODAY)
t('long course far from the end -> ongoing "day 3 of 30"', c.state === 'ongoing' && courseNote(c) === 'day 3 of 30')
c = courseOf(rx({ durationDays: null, publishedAt: daysAgo(34) }), TODAY)
t('until settled -> open, no end date, "prescribed 34 days ago"', c.state === 'open' && c.endedDaysAgo === null && courseNote(c) === 'prescribed 34 days ago')
c = courseOf(rx({ repetition: 'Once only today', durationDays: 14, publishedAt: daysAgo(5) }), TODAY)
t('a single dose has no course even if a duration is stored', c.state === 'open')
t('"prescribed today / yesterday" wording', courseNote(courseOf(rx({ durationDays: null, publishedAt: daysAgo(0) }), TODAY)) === 'prescribed today' && courseNote(courseOf(rx({ durationDays: null, publishedAt: daysAgo(1) }), TODAY)) === 'prescribed yesterday')

// ── latest prescription per patient
const old = rx({ id: 'old', publishedAt: daysAgo(40) }); const mid = rx({ id: 'mid', publishedAt: daysAgo(20) }); const cancelled = rx({ id: 'can', status: 'cancelled', publishedAt: daysAgo(1) })
t('the newest PUBLISHED one wins; cancelled and drafts are ignored', latestPublishedByPatient([old, mid, cancelled, rx({ id: 'dr', status: 'draft', publishedAt: daysAgo(0) })]).get('p1').id === 'mid')

// ── the queue
const pat = (id, extra = {}) => ({ id, name: id.toUpperCase(), currentRemedy: 'Sulphur 200C', archivedAt: null, ...extra })
const appt = (patientId, date, o = {}) => ({ id: 'a' + Math.random(), patientId, date, time: '9:00 AM', status: 'Upcoming', ...o })
const patients = [pat('a'), pat('b'), pat('c'), pat('d'), pat('e'), pat('f', { currentRemedy: '' }), pat('g', { archivedAt: '2026-09-01' }), pat('h')]
const rxs = [
  rx({ id: '1', patientId: 'a', publishedAt: daysAgo(34) }), // ended 21 days ago
  rx({ id: '2', patientId: 'b', publishedAt: daysAgo(20) }), // ended 7 days ago
  rx({ id: '3', patientId: 'c', publishedAt: daysAgo(11) }), // 2 left -> soon
  rx({ id: '4', patientId: 'd', publishedAt: daysAgo(3), durationDays: 30 }), // ongoing -> later
  rx({ id: '5', patientId: 'e', publishedAt: daysAgo(60), durationDays: null }), // open -> later
  rx({ id: '6', patientId: 'h', publishedAt: daysAgo(30) }), // ended, but has a booking
]
const appts = [appt('h', iso(5)), appt('b', iso(-3)) /* stale, nobody closed it */, appt('c', iso(2), { status: 'Cancelled' })]
const q = followUpQueue(patients, appts, rxs, TODAY)
t('only active patients on a remedy are listed (f has none, g archived)', q.needs.length + q.booked.length === 6)
t('a future booking moves the patient to "booked"', q.booked.length === 1 && q.booked[0].patient.id === 'h')
t('a stale or cancelled booking does not count', q.needs.some((r) => r.patient.id === 'b') && q.needs.some((r) => r.patient.id === 'c'))
t('order: longest overdue, then ending soonest, then oldest prescription', q.needs.map((r) => r.patient.id).join('') === 'abced' && q.needs.map((r) => r.bucket).join(',') === 'overdue,overdue,soon,later,later')
t('"later" is oldest prescription first (e before d)', q.needs.map((r) => r.patient.id).slice(3).join('') === 'ed')
t('booked is sorted by date then clock time', followUpQueue([pat('a'), pat('b')], [appt('a', iso(3), { time: '10:00 AM' }), appt('b', iso(3), { time: '9:30 AM' })], [], TODAY).booked.map((r) => r.patient.id).join('') === 'ba')

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
