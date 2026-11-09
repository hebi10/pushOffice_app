package expo.modules.pushoffice

import android.content.Context
import android.os.Build
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.time.ZoneId
import java.time.ZonedDateTime

/** Android-run probes, not synthetic inference success. Missing AICore or model bytes are reported. */
class AiModelsEmulatorProbeTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()
  private val sample = "2026년 11월 17일 오후 3시에 치과 예약"
  private val now = ZonedDateTime.of(2026, 11, 9, 12, 0, 0, 0, ZoneId.of("Asia/Seoul"))

  @Test fun allFiveNativeModelRoutesAreProbedWithoutPretendingUnavailableModelsExecuted() = runBlocking {
    val results = JSONArray()
    var unexpectedFailure = false
    for (model in AiModelCatalog.models) {
      val item = JSONObject()
        .put("modelId", model.id)
        .put("model", model.title)
        .put("runtime", if (model.id == "gemini-nano") "AICore" else "LiteRT-LM")
      try {
        if (model.id == "gemini-nano") {
          val status = withTimeout(35_000L) { NanoClient.status() }
          val state = status["status"]?.toString() ?: "unknown"
          item.put("state", state)
          if (state == "available") {
            val result = withTimeout(150_000L) { AiModelRunner.benchmark(context, model.id, sample, now) }
            val success = result["success"] == true
            item.put("inference", if (success) "passed" else "failed")
            item.put("durationMs", result["durationMs"])
            if (!success) {
              unexpectedFailure = true
              item.put("reason", result["message"]?.toString() ?: "AICore failed after reporting available")
            }
          } else {
            item.put("inference", "not_executed")
            item.put("reason", "AICore did not report an available Gemini Nano runtime")
          }
        } else {
          val verified = withTimeout(90_000L) { AiModelDownloadStore.verifiedInstalledFile(context, model) }
          if (verified == null) {
            val unavailable = withTimeout(25_000L) { AiModelRunner.benchmark(context, model.id, sample, now) }
            assertEquals("Missing model must never be reported as successful", false, unavailable["success"])
            item.put("state", "no_verified_model_file")
            item.put("inference", "not_executed")
            item.put("safety", "missing model rejected on Android")
          } else {
            val result = withTimeout(240_000L) { AiModelRunner.benchmark(context, model.id, sample, now) }
            val success = result["success"] == true
            item.put("state", "sha256_verified_on_android")
            item.put("inference", if (success) "passed" else "failed")
            item.put("durationMs", result["durationMs"])
            if (success) {
              item.put("title", result["title"])
              item.put("startAt", result["startAt"])
              item.put("repeatType", result["repeatType"])
            } else {
              unexpectedFailure = true
              item.put("reason", result["message"]?.toString() ?: "LiteRT-LM failed")
            }
          }
        }
      } catch (error: Exception) {
        item.put("inference", "probe_error")
        item.put("reason", (error.message ?: error.javaClass.simpleName).take(200))
        unexpectedFailure = true
      }
      results.put(item)
    }

    val actual = AiScheduleTime.validated(sample, now, "치과 예약", "2026-11-17", "15:00", "none")
    assertEquals(1794895200000L, actual.start!!.toInstant().toEpochMilli())
    val localSafety = verifyAndroidShaFixture()
    assertTrue(localSafety)

    val report = JSONObject()
      .put("source", "Android JUnit instrumentation, not Linux CPU inference")
      .put("api", Build.VERSION.SDK_INT)
      .put("device", Build.MODEL)
      .put("supportedAbis", JSONArray(Build.SUPPORTED_ABIS.toList()))
      .put("modelCount", results.length())
      .put("androidShaCorruptionTest", "passed")
      .put("androidScheduleTimestampTest", "passed")
      .put("models", results)
    val file = File(requireNotNull(context.getExternalFilesDir(null)), "push-office-android-ai-probe.json")
    file.writeText(report.toString(2), Charsets.UTF_8)
    Log.i("PushOfficeAiEmuQA", "REPORT=" + report.toString())
    assertEquals(5, results.length())
    assertFalse("An available, installed model failed the Android inference probe", unexpectedFailure)
  }

  private fun verifyAndroidShaFixture(): Boolean {
    val file = File.createTempFile("ai-model-sha-probe", ".bin", context.cacheDir)
    return try {
      val content = ByteArray(128 * 1024) { (it % 239).toByte() }
      file.writeBytes(content)
      val expected = MessageDigest.getInstance("SHA-256")
        .digest(content).joinToString("") { "%02x".format(it) }
      val verified = AiModelIntegrity.matches(file, content.size.toLong(), expected)
      content[101] = (content[101].toInt() xor 1).toByte()
      file.writeBytes(content)
      verified && !AiModelIntegrity.matches(file, content.size.toLong(), expected)
    } finally {
      file.delete()
    }
  }
}
