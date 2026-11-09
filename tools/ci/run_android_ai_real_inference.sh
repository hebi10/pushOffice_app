#!/usr/bin/env bash
set -euo pipefail

ID="${1:?model id required}"
WEIGHT="${2:?full verified model file required}"
test -f "$WEIGHT"
mkdir -p android-ai-real
echo "Model ID: $ID"
echo "Host model bytes: $(stat -c%s "$WEIGHT")"

# Keep the target app alive throughout staging and inference. A separate
# connectedAndroidTest session may reset application-scoped external storage.
adb logcat -c
(
  cd android
  ./gradlew -I ../.github/ci/kotlin-compiler-mirror.init.gradle \
    :push-office-native:connectedDebugAndroidTest \
    --no-daemon --max-workers=2 \
    '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' \
    -Pkotlin.compiler.execution.strategy=in-process \
    -PreactNativeArchitectures=x86_64 \
    '-Pandroid.testInstrumentationRunnerArguments.class=expo.modules.pushoffice.AiModelAndroidRealInferenceTest#verifyRealWeightFileAndRunNativeAndroidCpuInference' \
    "-Pandroid.testInstrumentationRunnerArguments.modelId=$ID"
) > android-ai-real/gradle-instrumentation.txt 2>&1 &
GRADLE_PID=$!

# The running instrumentation test reports its own writable directory and
# waits for the full model. Never infer a package name or target storage path.
DIR=""
for ((attempt=0; attempt<480; attempt++)); do
  adb logcat -d -v brief -s PushOfficeAiRealQA:I '*:S' > android-ai-real/staging-logcat.txt 2>/dev/null || true
  DIR="$(sed -n 's/.*MODEL_DIR=//p' android-ai-real/staging-logcat.txt | tail -1 | tr -d '\r')"
  if [[ -n "$DIR" ]]; then break; fi
  if ! kill -0 "$GRADLE_PID" 2>/dev/null; then
    echo "::error::Android instrumentation ended before providing MODEL_DIR."
    set +e; wait "$GRADLE_PID"; gradle_status=$?; set -e
    tail -100 android-ai-real/gradle-instrumentation.txt
    exit "$((gradle_status == 0 ? 1 : gradle_status))"
  fi
  sleep 2
done

if [[ "$DIR" != /storage/emulated/0/Android/data/*/files/ai_models ]]; then
  echo "::error::Instrumented Android app did not report an approved model directory: $DIR"
  tail -100 android-ai-real/gradle-instrumentation.txt
  kill "$GRADLE_PID" 2>/dev/null || true
  wait "$GRADLE_PID" 2>/dev/null || true
  exit 1
fi

echo "Android test-owned target: $DIR"
adb shell mkdir -p "$DIR"
adb push "$WEIGHT" "$DIR/$ID.litertlm"
adb shell ls -l "$DIR/$ID.litertlm"

set +e
wait "$GRADLE_PID"
gradle_status=$?
set -e
tail -100 android-ai-real/gradle-instrumentation.txt

adb logcat -d -v brief -s PushOfficeAiRealQA:I '*:S' > android-ai-real/device-logcat.txt || true
adb shell rm -f "$DIR/$ID.litertlm" || true

set +e
python3 tools/ci/verify_android_ai_real_report.py android-ai-real/device-logcat.txt \
  "android-ai-real/$ID-report.json" "$ID"
report_status=$?
set -e
if [[ "$gradle_status" -ne 0 || "$report_status" -ne 0 ]]; then
  echo "::error::Android real model QA failed (instrumentation=$gradle_status, report=$report_status)."
  exit 1
fi
