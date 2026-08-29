#!/usr/bin/env bash
# Builds the practitioner and patient debug APKs side by side.
#
# Each surface ships as its own Android app: separate applicationId (so both
# install at once), separate launcher label, and — because the manifest derives
# its deep-link scheme from ${applicationId} — its own OAuth callback scheme.
#
#   usage: ./scripts/build-apks.sh [practitioner|patient]   (default: both)

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/dist-apk"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

GRADLE_PROPS="$ROOT/android/app/build.gradle"
STRINGS="$ROOT/android/app/src/main/res/values/strings.xml"

# Snapshot the on-disk values rather than trusting git, so an interrupted build
# never leaves the repo pinned to one surface.
ICON_BG="$ROOT/android/app/src/main/res/drawable/ic_launcher_background.xml"

SNAP="$(mktemp -d)"
cp "$GRADLE_PROPS" "$SNAP/build.gradle"
cp "$STRINGS" "$SNAP/strings.xml"
cp "$ICON_BG" "$SNAP/ic_launcher_background.xml"

restore() {
  cp "$SNAP/build.gradle" "$GRADLE_PROPS"
  cp "$SNAP/strings.xml" "$STRINGS"
  cp "$SNAP/ic_launcher_background.xml" "$ICON_BG"
}
trap 'restore; rm -rf "$SNAP"' EXIT

build_surface() {
  local surface="$1" app_id="$2" label="$3"

  echo ""
  echo "==> $label  ($app_id)"

  restore
  /usr/bin/sed -i '' -E "s|applicationId \"[^\"]*\"|applicationId \"$app_id\"|" "$GRADLE_PROPS"
  /usr/bin/sed -i '' -E \
    -e "s|(<string name=\"app_name\">)[^<]*|\1$label|" \
    -e "s|(<string name=\"title_activity_main\">)[^<]*|\1$label|" \
    -e "s|(<string name=\"package_name\">)[^<]*|\1$app_id|" \
    -e "s|(<string name=\"custom_url_scheme\">)[^<]*|\1$app_id|" \
    "$STRINGS"

  # swap launcher icon background per surface
  local bg_src="$ROOT/android/app/src/main/res/drawable/ic_launcher_background_${surface}.xml"
  if [ -f "$bg_src" ]; then
    cp "$bg_src" "$ICON_BG"
  fi

  VITE_DEFAULT_SURFACE="$surface" npm run build
  npx cap sync android

  (cd "$ROOT/android" && ./gradlew --quiet assembleDebug)

  mkdir -p "$OUT"
  cp "$ROOT/android/app/build/outputs/apk/debug/app-debug.apk" "$OUT/sneham-$surface.apk"
  echo "==> $OUT/sneham-$surface.apk"
}

target="${1:-both}"

if [ "$target" = "practitioner" ] || [ "$target" = "both" ]; then
  build_surface practitioner com.sneham.practitioner "Sneham Dr"
fi

if [ "$target" = "patient" ] || [ "$target" = "both" ]; then
  build_surface patient com.sneham.patient "Sneham"
fi

echo ""
ls -lh "$OUT"
