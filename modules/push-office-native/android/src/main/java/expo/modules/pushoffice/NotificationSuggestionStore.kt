package expo.modules.pushoffice

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject

data class NotificationSuggestion(
  val id: String,
  val sourceApp: String,
  val packageName: String,
  val excerpt: String,
  val title: String,
  val startAt: Long?,
  val receivedAt: Long,
  val analysis: String,
  val triage: String = "confirmed_candidate"
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id, "sourceApp" to sourceApp, "packageName" to packageName,
    "excerpt" to excerpt, "title" to title, "startAt" to startAt,
    "receivedAt" to receivedAt, "analysis" to analysis, "triage" to triage
  )
  fun toJson() = JSONObject().put("id", id).put("sourceApp", sourceApp)
    .put("packageName", packageName).put("excerpt", excerpt)
    .put("title", title).put("startAt", startAt ?: JSONObject.NULL).put("receivedAt", receivedAt)
    .put("analysis", analysis).put("triage", triage)
  companion object {
    fun fromJson(value: JSONObject): NotificationSuggestion {
      // Existing private records have startAt but no triage field.
      val startAt = if (value.has("startAt") && !value.isNull("startAt")) value.getLong("startAt") else null
      val triage = value.optString("triage", "confirmed_candidate")
      require(triage in listOf("confirmed_candidate", "needs_confirmation"))
      require((triage == "confirmed_candidate") == (startAt != null))
      return NotificationSuggestion(
        value.getString("id"), value.getString("sourceApp"), value.getString("packageName"),
        value.getString("excerpt"), value.getString("title"), startAt,
        value.getLong("receivedAt"), value.getString("analysis"), triage
      )
    }
  }
}

/** App-private, bounded queue: no automatic calendar write and no remote transmission. */
object NotificationSuggestionStore {
  private const val PREF = "push_office_notification_suggestions"
  private const val ENABLED = "enabled"
  private const val ITEMS = "items"
  private const val SEEN = "seen"
  private const val LIMIT = 24
  private const val SEEN_LIMIT = 200
  private const val RETAIN_MS = 48L * 60 * 60 * 1000
  private val lock = Any()
  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)

  fun accessGranted(context: Context): Boolean {
    val component = ComponentName(context, ScheduleNotificationListener::class.java)
    return if (Build.VERSION.SDK_INT >= 27)
      context.getSystemService(NotificationManager::class.java).isNotificationListenerAccessGranted(component)
    else {
      val allowed = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
      allowed.split(':').any { it == component.flattenToString() }
    }
  }
  fun enabled(context: Context): Boolean = prefs(context).getBoolean(ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) = synchronized(lock) {
    if (enabled) {
      require(accessGranted(context)) { "Android 알림 접근 권한을 먼저 허용해 주세요." }
      check(prefs(context).edit().putBoolean(ENABLED, true).commit()) { "설정을 저장하지 못했습니다." }
    } else {
      // Explicit opt-out immediately removes all captured candidates and deduplication keys.
      check(prefs(context).edit().clear().commit()) { "수집 기록을 삭제하지 못했습니다." }
    }
  }

  private fun readItems(context: Context): List<NotificationSuggestion> = try {
    val array = JSONArray(prefs(context).getString(ITEMS, "[]"))
    (0 until array.length()).mapNotNull {
      runCatching { NotificationSuggestion.fromJson(array.getJSONObject(it)) }.getOrNull()
    }
  } catch (_: Exception) { emptyList() }

  private fun readSeen(context: Context): List<String> = try {
    val array = JSONArray(prefs(context).getString(SEEN, "[]"))
    (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotBlank) }
  } catch (_: Exception) { emptyList() }

  private fun write(context: Context, items: List<NotificationSuggestion>, seen: List<String>? = null) {
    val editor = prefs(context).edit().putString(ITEMS, JSONArray(items.map(NotificationSuggestion::toJson)).toString())
    if (seen != null) editor.putString(SEEN, JSONArray(seen).toString())
    check(editor.commit()) { "일정 후보를 저장하지 못했습니다." }
  }
  private fun retained(context: Context): List<NotificationSuggestion> {
    val now = System.currentTimeMillis()
    val current = readItems(context)
    val valid = current.filter { it.receivedAt in (now - RETAIN_MS)..now }
    if (valid.size != current.size) write(context, valid)
    return valid
  }
  fun all(context: Context): List<NotificationSuggestion> = synchronized(lock) { retained(context).sortedByDescending { it.receivedAt } }
  fun get(context: Context, id: String): NotificationSuggestion? = synchronized(lock) { retained(context).firstOrNull { it.id == id } }
  fun dismiss(context: Context, id: String): Boolean = synchronized(lock) {
    val existing = retained(context)
    if (existing.none { it.id == id }) false
    else { write(context, existing.filterNot { it.id == id }); true }
  }
  /** User-initiated foreground ML Kit refinement; stale/disabled candidates are not resurrected. */
  fun refine(context: Context, id: String, title: String, startAt: Long): NotificationSuggestion = synchronized(lock) {
    require(enabled(context) && accessGranted(context)) { "알림 분석 기능과 접근 권한을 확인해 주세요." }
    val now = System.currentTimeMillis()
    require(title.isNotBlank() && startAt > now && startAt <= now + 366L * 24 * 60 * 60 * 1000) { "일정 제목과 미래 날짜를 확인해 주세요." }
    val current = retained(context)
    val existing = current.firstOrNull { it.id == id } ?: throw IllegalStateException("일정 후보가 삭제되었거나 만료됐습니다.")
    require(existing.triage == "confirmed_candidate") { "날짜와 시간을 먼저 확인해 주세요." }
    require(current.none { it.id != id && it.title == title && it.startAt == startAt }) { "이미 같은 일정 후보가 있습니다." }
    require(ScheduleStore(context).use { db -> db.all().none { it.title == title && it.startAt == startAt } }) { "이미 저장된 일정입니다." }
    val updated = existing.copy(title = title.take(120), startAt = startAt,
      analysis = "on_device_ai", triage = "confirmed_candidate")
    write(context, current.map { if (it.id == id) updated else it })
    updated
  }
  fun add(context: Context, suggestion: NotificationSuggestion): Boolean = synchronized(lock) {
    if (!enabled(context) || !accessGranted(context)) return@synchronized false
    val now = System.currentTimeMillis()
    if (suggestion.triage !in listOf("confirmed_candidate", "needs_confirmation")) return@synchronized false
    val start = suggestion.startAt
    if (suggestion.triage == "confirmed_candidate" &&
        (start == null || start <= now || start > now + 366L * 24 * 60 * 60 * 1000)) return@synchronized false
    if (suggestion.triage == "needs_confirmation" && start != null) return@synchronized false
    val current = retained(context)
    if (suggestion.id in readSeen(context)) return@synchronized false
    if (current.any { it.triage == suggestion.triage &&
          if (start != null) it.startAt == start && it.title == suggestion.title
          else it.packageName == suggestion.packageName && it.excerpt == suggestion.excerpt }) return@synchronized false
    if (start != null) {
      val existing = ScheduleStore(context).use { it.all().any { row -> row.startAt == start && row.title == suggestion.title } }
      if (existing) return@synchronized false
    }
    val seen = (readSeen(context) + suggestion.id).takeLast(SEEN_LIMIT)
    write(context, (current + suggestion).takeLast(LIMIT), seen)
    true
  }
}

/** Only plausible user-facing time/date content may be analyzed; secrets are excluded conservatively. */
object NotificationSuggestionPolicy {
  private val date = Regex("""(?:\d{4}[-년]\s*\d{1,2}[-월]\s*\d{1,2}일?|\d{1,2}월\s*\d{1,2}일|오늘|내일|모레|(?:이번|다음)\s*주\s*[월화수목금토일]요일)""")
  private val time = Regex("""(?:(?:오전|오후|저녁|아침)\s*)?\d{1,2}시(?:\s*(?:반|\d{1,2}분))?|(?<!\d)\d{1,2}:\d{2}(?!\d)""")
  private val secret = Regex("""인증번호|인증코드|비밀번호|보안코드|로그인|일회용|OTP|verification code|security code|결제|계좌|은행|광고""", RegexOption.IGNORE_CASE)
  fun hasDate(text: String): Boolean = date.containsMatchIn(text)
  fun hasTime(text: String): Boolean = time.containsMatchIn(text)
  fun isSensitive(title: String, text: String): Boolean = secret.containsMatchIn("$title $text")
  fun candidate(title: String, text: String): String? {
    val body = text.trim().take(480)
    val combined = "$title $body"
    if (body.isBlank() || secret.containsMatchIn(combined)) return null
    val candidate = if (date.containsMatchIn(body) && time.containsMatchIn(body)) body else combined.take(480)
    return candidate.takeIf { date.containsMatchIn(it) && time.containsMatchIn(it) }
  }
}
