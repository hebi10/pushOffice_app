#!/usr/bin/env bash
set -euo pipefail

APK="android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APK" ]; then
  echo "::error::Release APK was not built: $APK"
  exit 1
fi

if ! adb install -r "$APK"; then
  echo "Unsigned release APK; applying an isolated temporary emulator key."
  keytool -genkeypair -noprompt \
    -keystore "$RUNNER_TEMP/ui-preview.jks" \
    -storepass android -keypass android -alias preview \
    -dname "CN=Temporary UI Preview" \
    -keyalg RSA -keysize 2048 -validity 2

  "$ANDROID_HOME/build-tools/36.0.0/apksigner" sign \
    --ks "$RUNNER_TEMP/ui-preview.jks" \
    --ks-key-alias preview \
    --ks-pass pass:android --key-pass pass:android \
    --out "$RUNNER_TEMP/ui-preview.apk" "$APK"

  adb install -r "$RUNNER_TEMP/ui-preview.apk"
fi

python3 tools/ui/capture_android.py
python3 tools/ui/capture_store_sources.py
