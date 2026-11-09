package expo.modules.pushoffice

import android.app.ActivityManager
import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Instant
import java.time.ZonedDateTime

/** One native model at a time. Engine and conversations are always closed. */
internal object AiModelRunner {
  private val inferenceMutex = Mutex()

  suspend fun infer(context: Context, id: String, prompt: String): String {
    require(prompt.length in 1..3500) { "입력 문장은 3,500자 이내로 작성해 주세요." }
    require(id != "gemini-nano") { "Gemini Nano는 AICore 실행 경로를 사용해 주세요." }
    val model = AiModelCatalog.get(id)
    val file = AiModelDownloadStore.verifiedInstalledFile(context, model)
      ?: throw IllegalStateException("모델 다운로드가 완료되지 않았습니다.")
    val memory = ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
    require(memory.availMem >= model.minAvailableMb * 1_000_000L) {
      "현재 사용 가능한 RAM이 부족합니다. 앱을 정리한 뒤 다시 실행해 주세요."
    }
    return inferenceMutex.withLock {
      withContext(Dispatchers.IO) {
        Engine(EngineConfig(modelPath = file.absolutePath, backend = Backend.CPU())).use { engine ->
          engine.initialize()
          engine.createConversation().use { conversation ->
            conversation.sendMessage(prompt).toString().trim()
          }
        }
      }
    }
  }

  private fun json(raw: String): JSONObject {
    val fence = 0x60.toChar().toString().repeat(3)
    val data = raw.trim().removePrefix(fence + "json").removePrefix(fence)
      .removeSuffix(fence).trim()
    require(data.startsWith("{") && data.endsWith("}")) {
      "AI 출력 형식을 확인할 수 없습니다. 날짜와 시간을 직접 입력해 주세요."
    }
    return JSONObject(data)
  }

  suspend fun parse(context: Context, id: String, text: String, now: ZonedDateTime): ParsedSchedule {
    if (id == "gemini-nano") return NanoClient.parse(text, now)
    val prompt = "Current datetime: " + now + ". Timezone: " + now.zone.id +
      ". Parse Korean calendar event. Return only JSON with title (string), " +
      "startAt (epoch milliseconds integer), repeatType (none|monthly|yearly), " +
      "or error if date/time missing or ambiguous. Never guess. User text: " + JSONObject.quote(text)
    val data = json(infer(context, id, prompt))
    require(!data.has("error")) { data.optString("error") }
    val title = data.optString("title").trim()
    val number = data.opt("startAt") as? Number
      ?: throw IllegalArgumentException("날짜와 시간을 다시 확인해 주세요.")
    val start = number.toLong()
    require(number.toDouble().isFinite() && number.toDouble() == start.toDouble()) {
      "날짜 값이 올바르지 않습니다."
    }
    val repeat = data.optString("repeatType")
    require(repeat in setOf("none", "monthly", "yearly")) { "반복 설정을 다시 확인해 주세요." }
    require(start > now.toInstant().toEpochMilli() && title.isNotBlank()) {
      "미래 날짜·시간과 일정 제목을 확인해 주세요."
    }
    val candidate = ScheduleRecord("preview", "local", "event", title, start,
      repeatType=repeat, createdAt=now.toInstant().toEpochMilli(), updatedAt=now.toInstant().toEpochMilli())
    ScheduleTime.validate(candidate, now.toInstant().toEpochMilli())
    return ParsedSchedule(title, Instant.ofEpochMilli(start).atZone(now.zone), repeat)
  }

  suspend fun briefing(context: Context, id: String, prompt: String): String {
    if (id == "gemini-nano") return NanoClient.briefing(prompt)
    val response = json(infer(context, id, "Summarize only supplied local schedules in Korean, " +
      "no invented facts. Return JSON with briefing string. Data: " + JSONObject.quote(prompt)))
    val briefing = response.optString("briefing").trim()
    require(briefing.isNotBlank() && briefing.length <= 12000) { "기기 AI 요약을 확인할 수 없습니다." }
    return briefing
  }

  suspend fun benchmark(context: Context, id: String, input: String, now: ZonedDateTime): Map<String, Any> {
    require(input.isNotBlank() && input.length <= 500) { "테스트 문장을 500자 이내로 입력해 주세요." }
    val started = android.os.SystemClock.elapsedRealtime()
    return try {
      val parsed = parse(context, id, input, now)
      val at = parsed.start?.toInstant()?.toEpochMilli()
        ?: throw IllegalArgumentException("날짜와 시간을 추출하지 못했습니다.")
      mapOf("modelId" to id, "success" to true, "title" to parsed.title,
        "startAt" to at, "repeatType" to parsed.repeatType,
        "durationMs" to (android.os.SystemClock.elapsedRealtime() - started))
    } catch (error: Exception) {
      mapOf("modelId" to id, "success" to false,
        "message" to (error.message ?: "기기 AI 테스트에 실패했습니다.").take(240),
        "durationMs" to (android.os.SystemClock.elapsedRealtime() - started))
    }
  }
}
