// Tests the live-update rules (src/core/liveUpdateRules.ts) without a phone.
//   node scripts/test-live-update-rules.mjs
import { build } from 'esbuild'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(os.tmpdir(), `lu-rules-${process.pid}.mjs`)
await build({ entryPoints: [path.join(root, 'src/core/liveUpdateRules.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { parseManifest, decideUpdate } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }
const SIG = 'A'.repeat(344)
const good = { build: 120, bundleId: 'b120', file: 'b120.zip', signature: SIG, minNativeVersionCode: 4 }

// ── manifest is untrusted input
t('accepts a well-formed manifest', parseManifest(good) !== null)
t('rejects null / non-object', parseManifest(null) === null && parseManifest('x') === null && parseManifest(5) === null)
t('rejects a missing field', parseManifest({ ...good, signature: undefined }) === null)
t('rejects non-integer build', parseManifest({ ...good, build: 12.5 }) === null && parseManifest({ ...good, build: '120' }) === null)
t('rejects build 0 / negative', parseManifest({ ...good, build: 0 }) === null && parseManifest({ ...good, build: -3 }) === null)
t('rejects odd bundleId', parseManifest({ ...good, bundleId: '../../x' }) === null && parseManifest({ ...good, bundleId: 'public' }) === null)
t('rejects path traversal / absolute URL in file', parseManifest({ ...good, file: '../b120.zip' }) === null && parseManifest({ ...good, file: 'https://evil.example/b.zip' }) === null && parseManifest({ ...good, file: 'a/b.zip' }) === null)
t('rejects a non-zip file name', parseManifest({ ...good, file: 'b120.js' }) === null)
t('rejects a signature that is not base64-sized', parseManifest({ ...good, signature: 'abc' }) === null && parseManifest({ ...good, signature: '!'.repeat(344) }) === null)
t('rejects minNativeVersionCode < 1', parseManifest({ ...good, minNativeVersionCode: 0 }) === null)

// ── what to do about it
const base = { manifest: good, runningBuild: 110, appVersionCode: 4, blockedBundleIds: [], downloadedBundleIds: [] }
t('newer + compatible -> download', decideUpdate(base).action === 'download' && decideUpdate(base).needsDownload === true)
t('already downloaded -> no re-download', decideUpdate({ ...base, downloadedBundleIds: ['b120'] }).needsDownload === false)
t('same build -> ignore', decideUpdate({ ...base, runningBuild: 120 }).action === 'ignore')
t('OLDER build never replaces newer code (fresh APK wins)', decideUpdate({ ...base, runningBuild: 150 }).action === 'ignore')
t('app too old for the update -> needs-new-app', decideUpdate({ ...base, appVersionCode: 3 }).action === 'needs-new-app')
t('exactly the minimum app version is fine', decideUpdate({ ...base, appVersionCode: 4 }).action === 'download')
t('rolled-back bundle is never retried', decideUpdate({ ...base, blockedBundleIds: ['b120'] }).action === 'ignore')
t('a different blocked bundle does not matter', decideUpdate({ ...base, blockedBundleIds: ['b99'] }).action === 'download')

// ── the manifest the publish script actually produced (if it has been run)
for (const surface of ['practitioner', 'patient']) {
  const f = path.join(root, 'ota-out', surface, 'manifest.json')
  if (fs.existsSync(f)) t(`real ${surface} manifest from release-ota.sh is accepted`, parseManifest(JSON.parse(fs.readFileSync(f, 'utf8'))) !== null)
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
