#!/usr/bin/env bash
set -euo pipefail
mkdir -p android-ai-qa
adb logcat -c
set +e
(
  cd android
  ./gradlew -I ../.github/ci/kotlin-compiler-mirror.init.gradle \
    :push-office-native:connectedDebugAndroidTest \
    --no-daemon --max-workers=2 \
    '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' \
    -Pkotlin.compiler.execution.strategy=in-process \
    -PreactNativeArchitectures=x86_64 \
    -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.pushoffice.AiModelsEmulatorProbeTest
)
gradle_result=$?
set -e
adb logcat -d -v brief -s PushOfficeAiEmuQA:I '*:S' > android-ai-qa/android-logcat.txt || true
if ! python3 tools/ci/verify_android_ai_emulator_report.py \
    android-ai-qa/android-logcat.txt android-ai-qa/five-model-probe.json; then
  echo "::error::Android AI model test evidence missing or invalid"
  exit 1
fi
if [ "$gradle_result" -ne 0 ]; then
  echo "::error::Android instrumentation failed with exit code $gradle_result"
  exit "$gradle_result"
fi
