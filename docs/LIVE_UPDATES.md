# Live updates — fixing the phone apps without reinstalling

Changes to the app's screens and logic can reach Dr. Neha's phone without sending
a new APK. Anything *native* (a new plugin, permission, icon, app name) still needs
an APK.

## How it works
- You publish a **signed web bundle** to the public `ota` bucket in Supabase, plus a
  small `manifest.json` per app saying what's newest.
- The phone checks the manifest when the app opens (and when she returns after a
  while), downloads the bundle, and the native plugin **refuses it unless it carries
  a valid signature from that app's own key** (the public half is baked into the APK).
- It switches on the next start of the app, or when she comes back after ≥ 5 minutes
  away, or from Profile → **Restart now**.
- If a new version fails to start properly (doesn't report "ready" within 10 s), the app
  returns to the version inside the APK and never retries that update.

## One-time setup
1. In the Supabase SQL editor run `supabase/migration_v48_ota_bucket.sql` (creates the
   public `ota` bucket; read the comments — no write policies, on purpose).
2. Build and install the new APKs once (`npm run android:apks`). This is the **last**
   reinstall for this feature. The build refuses to produce an app without its key.
3. Signing keys already exist in `~/.sneham-ota/` (`practitioner.pem`, `patient.pem`).
   **Back these up somewhere offline** (not in git, not in cloud sync you don't trust).
   Lose one → that app needs a reinstall to change keys. Leak one → anyone can push
   code to that app: replace the key and reinstall.
4. Optional, for one-command publishing: put your Supabase **service role** key in your
   shell as `SUPABASE_SERVICE_ROLE_KEY` (never in the repo or a `VITE_` variable).
   Without it the script prints the two files to drag into the bucket in the dashboard.

## Publishing an update
```bash
git checkout main && git pull        # must be a clean main
./scripts/release-ota.sh             # both apps (or: practitioner | patient)
```
It builds, zips, signs, verifies the signature against the public key, then uploads
(bundle first, manifest last).

## Testing the first update (do this before relying on it)
1. Install the new APK on your own phone.
2. Make a tiny visible change (e.g. a text tweak), commit to `main`, publish.
3. Open the app: Profile → *App version* → **Diagnostics** shows `update … downloaded`,
   then `ready for next start`. Tap **Restart now** (or close and reopen).
4. Confirm the change and that the build number moved up.

## Safety rules the app enforces
- Only the app's own signed bundles (else rejected by the plugin).
- Only a **higher build number** than the running one (a newer APK always wins).
- Only if `minNativeVersionCode` ≤ the phone's app version (otherwise it shows
  "a newer version of the app is needed").
- A bundle that was rolled back is blocked from being retried.

## Pulling a bad update
Publish a fixed build (higher number) — phones move to it. To stop everything, delete
`manifest.json` from the bucket (phones already holding a downloaded bundle apply it on
next start; publishing a fixed build supersedes it).
