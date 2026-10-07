#!/usr/bin/env bash
# Publishes a live update (a signed web bundle) so the phone apps pick up fixes
# to their screens without anyone reinstalling the APK.
#
#   usage: ./scripts/release-ota.sh [practitioner|patient|both]     (default: both)
#
# What it does, per app:
#   1. builds the web app for that app            (dist/)
#   2. zips it                                    (ota-out/<app>/b<build>.zip)
#   3. signs the zip with that app's PRIVATE key  (~/.sneham-ota/<app>.pem — never in git)
#   4. checks the signature against the PUBLIC key that is baked into the APK
#   5. writes manifest.json — the one small file the phones look at
#   6. uploads both to the public `ota` storage bucket, if SUPABASE_SERVICE_ROLE_KEY is
#      set; otherwise prints the two files to drop into the bucket by hand.
#
# Only changes to screens/logic can go out this way. Anything that needs a native
# change (a new plugin, permission, icon…) needs a new APK: bump versionCode in
# android/app/build.gradle and set MIN_NATIVE_VERSION_CODE accordingly.
#
# Safety rails: runs only from a clean `main` (so the build number — the commit
# count — always goes up and matches what was reviewed).

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
KEYDIR="${SNEHAM_OTA_KEYS:-$HOME/.sneham-ota}"
OUT="$ROOT/ota-out"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ] && [ -z "${OTA_ALLOW_ANY_BRANCH:-}" ]; then
  echo "Refusing: live updates are published from 'main' only (you are on '$branch')." >&2; exit 1
fi
if ! git diff --quiet HEAD -- src android package.json package-lock.json capacitor.config.ts vite.config.ts index.html public; then
  echo "Refusing: there are uncommitted changes in the app. Commit first so the update matches what was reviewed." >&2; exit 1
fi

BUILD="$(git rev-list --count HEAD)"
APK_VERSION_CODE="$(grep -E 'versionCode' android/app/build.gradle | head -1 | tr -dc '0-9')"
MIN_NATIVE="${MIN_NATIVE_VERSION_CODE:-$APK_VERSION_CODE}"

# Supabase location (for the public URL and the upload)
if [ -z "${SUPABASE_URL:-}" ] && [ -f .env ]; then SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"; fi

publish() {
  local surface="$1"
  local key="$KEYDIR/$surface.pem"
  local pub="$ROOT/ota/keys/$surface.pub.pem"
  [ -f "$key" ] || { echo "Missing private key $key — cannot sign." >&2; exit 1; }
  [ -f "$pub" ] || { echo "Missing public key $pub." >&2; exit 1; }

  echo ""
  echo "==> $surface — build $BUILD (needs app version >= $MIN_NATIVE)"
  VITE_DEFAULT_SURFACE="$surface" npm run build >/dev/null

  local dir="$OUT/$surface"; rm -rf "$dir"; mkdir -p "$dir"
  local file="b$BUILD.zip"
  # index.html must sit at the root of the zip; no hidden files.
  (cd dist && zip -qrX "$dir/$file" . -x '.*' '*/.DS_Store')
  unzip -l "$dir/$file" | grep -q ' index.html$' || { echo "index.html is not at the root of the zip" >&2; exit 1; }

  openssl dgst -sha256 -sign "$key" -out "$dir/$file.sig" "$dir/$file"
  # The same check the phone does, done here first: refuse to publish anything
  # the APK would reject.
  openssl dgst -sha256 -verify "$pub" -signature "$dir/$file.sig" "$dir/$file" >/dev/null \
    || { echo "Signature does not verify against $pub — wrong key for this app?" >&2; exit 1; }
  local sig; sig="$(base64 < "$dir/$file.sig" | tr -d '\n')"

  cat > "$dir/manifest.json" <<JSON
{"build":$BUILD,"bundleId":"b$BUILD","file":"$file","signature":"$sig","minNativeVersionCode":$MIN_NATIVE}
JSON
  echo "    $(du -h "$dir/$file" | cut -f1) bundle, signature verified"

  if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -n "${SUPABASE_URL:-}" ]; then
    # Bundle first, manifest last — phones never see a manifest whose file isn't there yet.
    curl -fsS -X POST "$SUPABASE_URL/storage/v1/object/ota/$surface/$file" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/zip" -H "x-upsert: true" --data-binary @"$dir/$file" >/dev/null
    curl -fsS -X POST "$SUPABASE_URL/storage/v1/object/ota/$surface/manifest.json" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" -H "cache-control: max-age=0" -H "x-upsert: true" --data-binary @"$dir/manifest.json" >/dev/null
    echo "    uploaded to the ota bucket ($surface/)"
  else
    echo "    NOT uploaded (no SUPABASE_SERVICE_ROLE_KEY). Put these two files in the ota bucket, folder '$surface/':"
    echo "      1. $dir/$file"
    echo "      2. $dir/manifest.json   (upload this one last)"
  fi
}

target="${1:-both}"
case "$target" in
  practitioner) publish practitioner ;;
  patient) publish patient ;;
  both) publish practitioner; publish patient ;;
  *) echo "usage: $0 [practitioner|patient|both]" >&2; exit 1 ;;
esac
echo ""
echo "Done. Phones pick this up the next time they open the app (or come back to it)."
