package expo.modules.pushoffice

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.atomic.AtomicInteger

/** Event-driven background capture. No permanent process, polling or remote processing. */
class ScheduleNotificationListener : NotificationListenerService() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val active = AtomicInteger(0)
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || !NotificationSuggestionStore.enabled(this) || sbn.packageName == packageName) return
    val notification = sbn.notification ?: return
    if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0 ||
        (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0 ||
        notification.visibility == Notification.VISIBILITY_SECRET) return
    val title = notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val body = notification.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val source = NotificationSuggestionPolicy.candidate(title, body) ?: return
    // A burst of notifications cannot spawn unlimited AICore sessions.
    if (active.incrementAndGet() > 2) { active.decrementAndGet(); return }
    val id = MessageDigest.getInstance("SHA-256")
      .digest((sbn.packageName + "|" + sbn.key + "|" + source).toByteArray(Charsets.UTF_8))
      .take(16).joinToString("") { "%02x".format(it) }
    val context = applicationContext
    val sourcePackage = sbn.packageName
    val created = sbn.postTime
    scope.launch {
      try {
        if (!NotificationSuggestionStore.enabled(context) || !NotificationSuggestionStore.accessGranted(context)) return@launch
        val now = ZonedDateTime.ofInstant(Instant.ofEpochMilli(created), ZoneId.systemDefault())
        // ML Kit GenAI can reject background inference (BACKGROUND_USE_BLOCKED).
        // Background only performs deterministic local parsing; AI refinement happens on user action in foreground.
        val parsed = ScheduleParser.parse(source, now)
        val start = parsed.start ?: return@launch
        if (parsed.error != null || parsed.shiftMinutes != null || parsed.title.isBlank()) return@launch
        val label = try {
          packageManager.getApplicationLabel(packageManager.getApplicationInfo(sourcePackage, 0)).toString()
        } catch (_: Exception) { sourcePackage }
        NotificationSuggestionStore.add(context, NotificationSuggestion(
          id = id, sourceApp = label.take(60), packageName = sourcePackage,
          excerpt = source.take(300), title = parsed.title.trim().take(120),
          startAt = start.toInstant().toEpochMilli(), receivedAt = System.currentTimeMillis(),
          analysis = "local_rules"
        ))
      } catch (e: CancellationException) { throw e }
      catch (_: Exception) { /* A malformed notification must never crash the listener. */ }
      finally { active.decrementAndGet() }
    }
  }
  override fun onDestroy() {
    scope.cancel()
    super.onDestroy()
  }
}
