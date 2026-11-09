package expo.modules.pushoffice

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.ZoneId
import java.time.ZonedDateTime

/** Isolated Android-instrumentation probe. Real model weights are staged by CI, not packaged. */
class AiModelAndroidRealInferenceTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()
  private val now = ZonedDateTime.of(2026, 11, 9, 12, 0, 0, 0, ZoneId.of("Asia/Seoul"))
  private val sample = "2026년 11월 17일 오후 3시에 치과 예약"

  @Test fun reportModelDirectory() {
    val directory = File(requireNotNull(context.getExternalFilesDir(null)), "ai_models")
    assertTrue(directory.isDirectory || directory.mkdirs())
    Log.i("PushOfficeAiRealQA", "MODEL_DIR=" + directory.absolutePath)
  }

  @Test fun verifyRealWeightFileAndRunNativeAndroidCpuInference() = runBlocking {
    val id = requireNotNull(InstrumentationRegistry.getArguments().getString("modelId")) {
      "Real-model CI must provide modelId"
    }
    val expectedBytes = requireNotNull(InstrumentationRegistry.getArguments().getString("modelBytes")) {
      "Real-model CI must provide the exact verified host file size"
    }.toLong()
    require(expectedBytes in 100_000_000L..4_500_000_000L) { "Invalid expected model size" }
    val model = AiModelCatalog.get(id)
    require(model.file != null && model.sha256 != null) { "Only pinned LiteRT-LM weights are supported." }
    val directory = File(requireNotNull(context.getExternalFilesDir(null)), "ai_models")
    require(directory.isDirectory || directory.mkdirs()) { "Model directory unavailable on Android" }
    val file = File(directory, id + ".litertlm")
    // The host stages verified bytes while this same instrumentation run is active.
    Log.i("PushOfficeAiRealQA", "MODEL_DIR=" + directory.absolutePath)
    val report = JSONObject()
      .put("environment", "actual Android x86_64 emulator instrumentation")
      .put("api", Build.VERSION.SDK_INT)
      .put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
      .put("modelId", id)
      .put("expectedFileBytes", expectedBytes)
      .put("expectedPinnedSha256", model.sha256)
    var verified = false
    var rawSuccess = false
    var calendarPassed = false
    var briefingPassed: Boolean? = null
    var briefingRaw = ""
    val scheduleCountBefore = ScheduleStore(context).use { it.all().size }
    try {
      val startedWaiting = SystemClock.elapsedRealtime()
      while ((!file.isFile || file.length() != expectedBytes) &&
        SystemClock.elapsedRealtime() - startedWaiting < 180_000L) {
        delay(500L)
      }
      report.put("fileBytes", if (file.isFile) file.length() else 0L)
      require(file.isFile && file.length() == expectedBytes) {
        "Actual .litertlm file missing or incomplete on Android after host transfer."
      }
      val prefs = context.getSharedPreferences("push_office_ai_models", Context.MODE_PRIVATE)
      require(prefs.edit().putLong(id + "_bytes", file.length())
        .putString(id + "_sha", model.sha256).remove(id + "_corrupt").commit()) {
        "Test-only model manifest could not be persisted."
      }
      verified = withTimeout(90_000L) {
        AiModelDownloadStore.verifiedInstalledFile(context, model) != null
      }
      require(verified) { "Full-file SHA-256 failed after transfer to Android." }
      val started = SystemClock.elapsedRealtime()
      val raw = withTimeout(300_000L) { AiModelRunner.infer(context, id, "Reply with READY only.") }
      rawSuccess = raw.isNotBlank()
      require(rawSuccess) { "Native LiteRT-LM returned an empty response." }
      report.put("actualAndroidCpuInferenceMs", SystemClock.elapsedRealtime() - started)
      report.put("rawResponsePreview", raw.take(180))
      var scheduleRaw = ""
      val benchmark = withTimeout(300_000L) {
        AiModelRunner.benchmark(context, id, sample, now) { raw -> scheduleRaw = raw }
      }
      // Only fixed synthetic QA input is used. Never log real users' messages.
      report.put("sampleScheduleRawPreview", scheduleRaw.take(600))
      calendarPassed = benchmark["success"] == true &&
        benchmark["startAt"] == 1794895200000L && benchmark["repeatType"] == "none"
      report.put("koreanScheduleMs", benchmark["durationMs"])
      report.put("koreanScheduleTitle", benchmark["title"] ?: JSONObject.NULL)
      if (!calendarPassed) report.put("calendarFailure", benchmark["message"] ?: "Wrong local date or recurrence")
      val policyAccepted = NotificationSuggestionPolicy.candidate("치과 예약", sample) != null
      val policyDeniedSecret = NotificationSuggestionPolicy.candidate("인증번호", "인증번호 123456. " + sample) == null
      report.put("notificationCandidatePolicyPassed", policyAccepted && policyDeniedSecret)
      require(policyAccepted && policyDeniedSecret) { "Notification candidate policy regression." }
      if (id == "qwen35-08") {
        val startedBriefing = SystemClock.elapsedRealtime()
        val result = withTimeout(150_000L) {
          AiModelRunner.briefing(context, id,
            "일정 1건: 2026년 11월 17일 오후 3시 치과 예약. 이 일정만 간단히 요약해 주세요.") {
              raw -> briefingRaw = raw
            }
        }
        briefingPassed = result.contains("치과")
        report.put("briefingMs", SystemClock.elapsedRealtime() - startedBriefing)
        report.put("briefingPreview", result.take(180))
      }
    } catch (error: Throwable) {
      report.put("errorType", error.javaClass.simpleName)
      report.put("error", (error.message ?: "Unknown Android inference failure").take(300))
    } finally {
      report.put("sha256VerifiedOnAndroid", verified)
      report.put("actualCpuTextGenerated", rawSuccess)
      if (id == "qwen35-08") report.put("sampleBriefingRawPreview", briefingRaw.take(600))
      report.put("noScheduleSavedByTest",
        ScheduleStore(context).use { it.all().size } == scheduleCountBefore)
      if (briefingPassed != null) report.put("localBriefingPassed", briefingPassed)
      report.put("koreanSchedulePassed", calendarPassed)
      report.put("inferenceVerdict", if (rawSuccess) "executed" else "failed")
      File(requireNotNull(context.getExternalFilesDir(null)),
        "push-office-real-android-" + id + ".json")
        .writeText(report.toString(2), Charsets.UTF_8)
      Log.i("PushOfficeAiRealQA", "REPORT=" + report.toString())
    }
    assertTrue("Real Android LiteRT-LM model SHA-256 verification failed: " + report, verified)
    assertTrue("Real Android CPU model did not produce text: " + report, rawSuccess)
    assertTrue("AI QA must never save a schedule: " + report,
      report.optBoolean("noScheduleSavedByTest", false))
  }
}
