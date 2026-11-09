#!/usr/bin/env bash
set -euo pipefail
ID="${1:?model id required}"
WEIGHT="${2:?full verified model file required}"
mkdir -p android-ai-real
echo "Model ID: $ID"
echo "Host model bytes: $(stat -c%s "$WEIGHT")"
adb logcat -c

# Install the instrumentation host and get its app-owned writable file path.
(
  cd android
  ./gradlew -I ../.github/ci/kotlin-compiler-mirror.init.gradle \
    :push-office-native:connectedDebugAndroidTest \
    --no-daemon --max-workers=2 \
    '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' \
    -Pkotlin.compiler.execution.strategy=in-process \
    -PreactNativeArchitectures=x86_64 \
    '-Pandroid.testInstrumentationRunnerArguments.class=expo.modules.pushoffice.AiModelAndroidRealInferenceTest#reportModelDirectory'
)

adb logcat -d -v brief -s PushOfficeAiRealQA:I '*:S' > android-ai-real/device-logcat.txt
DIR="$(grep 'MODEL_DIR=' android-ai-real/device-logcat.txt | tail -1 | sed 's/.*MODEL_DIR=//' | tr -d '\r')"
if [[ -z "$DIR" || "$DIR" != /storage/emulated/0/Android/data/*/files/ai_models ]]; then
  echo "::error::Android app-owned model directory was not reported: $DIR"
  exit 1
fi
echo "Android app-scoped target: $DIR"
# Gradle connectedAndroidTest can uninstall its instrumentation APK after the
# directory probe. Restore that same test APK before staging the model bytes.
adb shell pm list instrumentation | tr -d '\r' > android-ai-real/instrumentation-packages.txt
RUNNER="$(sed -n '/expo\.modules\.pushoffice/s/^instrumentation:\([^ ]*\).*/\1/p' android-ai-real/instrumentation-packages.txt | head -1)"
if [[ -z "$RUNNER" ]]; then
  TEST_APK="$(find modules/push-office-native/android/build/outputs/apk/androidTest -type f -name '*.apk' -print -quit 2>/dev/null || true)"
  if [[ -z "$TEST_APK" ]]; then
    echo "::error::Instrumentation APK missing after Gradle connectedDebugAndroidTest."
    exit 1
  fi
  echo "Restoring instrumentation APK removed by Gradle test cleanup: $TEST_APK"
  adb install -r "$TEST_APK" > android-ai-real/instrumentation-reinstall.txt
  adb shell pm list instrumentation | tr -d '\r' > android-ai-real/instrumentation-packages.txt
  RUNNER="$(sed -n '/expo\.modules\.pushoffice/s/^instrumentation:\([^ ]*\).*/\1/p' android-ai-real/instrumentation-packages.txt | head -1)"
fi
if [[ -z "$RUNNER" ]]; then
  echo "::error::Android instrumentation runner unavailable after test APK reinstall."
  cat android-ai-real/instrumentation-packages.txt
  adb shell pm list packages | tr -d '\r' | grep -F 'expo.modules.pushoffice' || true
  exit 1
fi
echo "Android instrumentation runner: $RUNNER"
adb shell mkdir -p "$DIR"
adb push "$WEIGHT" "$DIR/$ID.litertlm"
adb shell ls -l "$DIR/$ID.litertlm"
adb logcat -c
set +e
adb shell am instrument -w -r \
  -e class 'expo.modules.pushoffice.AiModelAndroidRealInferenceTest#verifyRealWeightFileAndRunNativeAndroidCpuInference' \
  -e modelId "$ID" "$RUNNER" > android-ai-real/instrumentation-result.txt 2>&1
run_result=$?
set -e
adb logcat -d -v brief -s PushOfficeAiRealQA:I '*:S' > android-ai-real/device-logcat.txt || true
adb shell rm -f "$DIR/$ID.litertlm" || true
python3 tools/ci/verify_android_ai_real_report.py android-ai-real/device-logcat.txt \
  "android-ai-real/$ID-report.json" "$ID"
cat android-ai-real/instrumentation-result.txt
if [[ "$run_result" -ne 0 ]] || grep -q 'FAILURES!!!' android-ai-real/instrumentation-result.txt; then
  echo "::error::Android instrumented real-model inference test failed."
  exit 1
fi
