#!/usr/bin/env bash
set -euo pipefail
cd android
./gradlew :push-office-native:connectedDebugAndroidTest \
  --no-daemon --max-workers=2 \
  '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=x86_64 \
  -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.pushoffice.ScheduleWidgetViewsTest
