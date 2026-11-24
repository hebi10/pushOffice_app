package expo.modules.pushoffice

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.atomic.AtomicInteger
import android.util.Log

/** Event-driven background capture. No permanent process, polling or remote processing. */
class ScheduleNotificationListener : NotificationListenerService() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private data class Capture(val sourcePackage: String, val key: String, val created: Long, val title: String, val body: String)
  private val queue = NotificationCaptureQueue<Capture>()
  private val overflow = AtomicInteger(0)
  private val worker = scope.launch(start = CoroutineStart.LAZY) {
    val context = applicationContext
    for (item in queue.items) {
      try {
        if (!NotificationSuggestionStore.enabled(context) || !NotificationSuggestionStore.accessGranted(context)) continue
        val (sourcePackage, key, created, title, body) = item
        val now = ZonedDateTime.ofInstant(Instant.ofEpochMilli(created), ZoneId.systemDefault())
        val decision = NotificationIntentPolicy.classify(title, body, now)
        if (decision.triage == NotificationTriage.DISCARD) continue
        val id = MessageDigest.getInstance("SHA-256")
          .digest((sourcePackage + "|" + key + "|" + decision.excerpt).toByteArray(Charsets.UTF_8))
          .take(16).joinToString("") { "%02x".format(it) }
        val label = try {
          packageManager.getApplicationLabel(packageManager.getApplicationInfo(sourcePackage, 0)).toString()
        } catch (_: Exception) { sourcePackage }
        NotificationSuggestionStore.add(context, NotificationSuggestion(
          id = id, sourceApp = label.take(60), packageName = sourcePackage,
          excerpt = decision.excerpt.take(300), title = decision.title.take(120),
          startAt = decision.startAt, receivedAt = created,
          analysis = "local_rules",
          triage = if (decision.triage == NotificationTriage.CONFIRMED_CANDIDATE)
            "confirmed_candidate" else "needs_confirmation"
        ))
      } catch (e: CancellationException) { throw e }
      catch (_: Exception) { /* A malformed notification must never stop the queue. */ }
    }
  }
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || !NotificationSuggestionStore.enabled(this) || sbn.packageName == packageName) return
    val notification = sbn.notification ?: return
    if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0 ||
        (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0 ||
        notification.visibility == Notification.VISIBILITY_SECRET) return
    val title = notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val body = notification.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    if (body.isBlank() || NotificationSuggestionPolicy.isSensitive(title, body)) return
    // Keep only bounded, in-memory snapshots; never retain StatusBarNotification objects.
    if (title.length > 4096 || body.length > 4096) return
    worker.start()
    if (!queue.offer(Capture(sbn.packageName, sbn.key, sbn.postTime, title, body))) {
      val dropped = overflow.incrementAndGet()
      if (dropped == 1 || dropped % 100 == 0) Log.w("PushOfficeCapture", "Notification queue capacity reached")
    }
  }
  override fun onDestroy() {
    queue.cancel()
    worker.cancel()
    scope.cancel()
    super.onDestroy()
  }
}
