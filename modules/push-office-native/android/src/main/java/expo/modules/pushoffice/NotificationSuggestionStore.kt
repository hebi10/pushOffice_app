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
  val startAt: Long,
  val receivedAt: Long,
  val analysis: String
) {
  fun toMap(): Map<String, Any> = mapOf(
    "id" to id, "sourceApp" to sourceApp, "packageName" to packageName,
    "excerpt" to excerpt, "title" to title, "startAt" to startAt,
    "receivedAt" to receivedAt, "analysis" to analysis
  )
  fun toJson() = JSONObject().put("id", id).put("sourceApp", sourceApp)
    .put("packageName", packageName).put("excerpt", excerpt)
    .put("title", title).put("startAt", startAt).put("receivedAt", receivedAt)
    .put("analysis", analysis)
  companion object {
    fun fromJson(value: JSONObject) = NotificationSuggestion(
      value.getString("id"), value.getString("sourceApp"), value.getString("packageName"),
      value.getString("excerpt"), value.getString("title"), value.getLong("startAt"),
      value.getLong("receivedAt"), value.getString("analysis")
    )
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
  fun add(context: Context, suggestion: NotificationSuggestion): Boolean = synchronized(lock) {
    if (!enabled(context) || !accessGranted(context)) return@synchronized false
    val now = System.currentTimeMillis()
    if (suggestion.startAt <= now || suggestion.startAt > now + 366L * 24 * 60 * 60 * 1000) return@synchronized false
    val current = retained(context)
    if (suggestion.id in readSeen(context)) return@synchronized false
    if (current.any { it.startAt == suggestion.startAt && it.title == suggestion.title }) return@synchronized false
    val existing = ScheduleStore(context).use { it.all().any { row -> row.startAt == suggestion.startAt && row.title == suggestion.title } }
    if (existing) return@synchronized false
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
  fun candidate(title: String, text: String): String? {
    val body = text.trim().take(480)
    val combined = "$title $body"
    if (body.isBlank() || secret.containsMatchIn(combined)) return null
    val candidate = if (date.containsMatchIn(body) && time.containsMatchIn(body)) body else combined.take(480)
    return candidate.takeIf { date.containsMatchIn(it) && time.containsMatchIn(it) }
  }
}
