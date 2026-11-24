#!/usr/bin/env bash
set -euo pipefail
cd android
bash ../.github/ci/retry-gradle-resolution.sh ./gradlew -I ../.github/ci/kotlin-compiler-mirror.init.gradle \
  :push-office-native:connectedDebugAndroidTest \
  --no-daemon --max-workers=2 \
  '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=x86_64 \
  -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.pushoffice.ScheduleWidgetViewsTest,expo.modules.pushoffice.QuickEntryActivityUiTest,expo.modules.pushoffice.NotiAi01PersistenceTest,expo.modules.pushoffice.LocalBackupRestoreTest,expo.modules.pushoffice.DailyWeeklyPersistenceTest,expo.modules.pushoffice.ScheduleExtrasMigrationTest,expo.modules.pushoffice.ScheduleCategoryMigrationTest,expo.modules.pushoffice.ReminderSchedulerRecoveryTest,expo.modules.pushoffice.ScheduleRemindersDeviceTest,expo.modules.pushoffice.LocalBackupCryptoDeviceTest
