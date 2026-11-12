#!/usr/bin/env bash
set -euo pipefail
cd android
./gradlew -I ../.github/ci/kotlin-compiler-mirror.init.gradle \
  :push-office-native:connectedDebugAndroidTest \
  --no-daemon --max-workers=2 \
  '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=x86_64 \
  -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.pushoffice.ScheduleWidgetViewsTest,expo.modules.pushoffice.QuickEntryActivityUiTest,expo.modules.pushoffice.NotiAi01PersistenceTest
