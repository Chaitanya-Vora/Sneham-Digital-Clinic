// The rules of live updating, free of any phone/network dependency so they can
// be tested directly (see scripts/test-live-update-rules.mjs).

export interface Manifest {
  build: number // always higher than the build it replaces
  bundleId: string
  file: string
  signature: string
  minNativeVersionCode: number
}

// Reject anything that isn't exactly the expected shape — the manifest is
// fetched over the network, so it is treated as untrusted input.
export function parseManifest(raw: unknown): Manifest | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const ok =
    Number.isInteger(m.build) && (m.build as number) > 0 &&
    typeof m.bundleId === 'string' && /^b[0-9]{1,9}$/.test(m.bundleId) &&
    typeof m.file === 'string' && /^[A-Za-z0-9._-]{1,80}\.zip$/.test(m.file) &&
    typeof m.signature === 'string' && /^[A-Za-z0-9+/=]{300,700}$/.test(m.signature) &&
    Number.isInteger(m.minNativeVersionCode) && (m.minNativeVersionCode as number) >= 1
  return ok ? (m as unknown as Manifest) : null
}

// What to do about a manifest, given what this phone is running. Pure, so every
// rule can be tested without a device.
export type UpdateDecision =
  | { action: 'ignore'; reason: string }
  | { action: 'needs-new-app'; reason: string }
  | { action: 'download'; needsDownload: boolean }

export function decideUpdate(input: {
  manifest: Manifest
  runningBuild: number // the build number of the code that is running right now
  appVersionCode: number // the APK's own version
  blockedBundleIds: string[]
  downloadedBundleIds: string[]
}): UpdateDecision {
  const { manifest, runningBuild, appVersionCode, blockedBundleIds, downloadedBundleIds } = input
  // Never replace newer code with older: a phone that got a fresh APK has a
  // higher build number than any bundle published before that APK was made.
  if (manifest.build <= runningBuild) return { action: 'ignore', reason: 'not newer' }
  if (appVersionCode < manifest.minNativeVersionCode) return { action: 'needs-new-app', reason: `needs app version ${manifest.minNativeVersionCode}, have ${appVersionCode}` }
  if (blockedBundleIds.includes(manifest.bundleId)) return { action: 'ignore', reason: 'was rolled back before' }
  return { action: 'download', needsDownload: !downloadedBundleIds.includes(manifest.bundleId) }
}

