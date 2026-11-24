package expo.modules.pushoffice

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import java.time.Instant
import java.time.ZoneId

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try { ScheduleSerial.withLock { receiveLocked(context, intent) } }
    catch (_: Exception) { Log.w("PushOfficeReminder", "Reminder delivery could not finish") }
  }
  private fun receiveLocked(context: Context, intent: Intent) {
    val scheduler = ReminderScheduler(context)
    if (intent.action == ACTION_SNOOZE) {
      intent.getStringExtra("scheduleId")?.let { id ->
        if (runCatching { scheduler.snooze(id, 10) }.isSuccess) {
          val originalKind = intent.getStringExtra("notificationKind") ?: "reminder"
          context.getSystemService(NotificationManager::class.java).cancel(ScheduleReminders.notificationTag(id, originalKind), 1)
        } else {
          Log.w("PushOfficeReminder", "Snooze could not be reserved")
        }
      }
      return
    }
    if (intent.action != ReminderScheduler.ACTION_FIRE) return
    val id = intent.getStringExtra("scheduleId") ?: return
    val kind = intent.getStringExtra("kind") ?: return
    val fired = scheduler.consume(id, kind, intent.getStringExtra("reservationToken")) ?: return
    try {
      val settings = ReminderSettings.load(context)
      if (!settings.pushEnabled) return
      if (kind == "briefing") {
        if (settings.dailyBriefingEnabled) {
          val now = System.currentTimeMillis()
          val zone = ZoneId.of(settings.timezone)
          val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
          val lines = ScheduleStore(context).use { store -> store.all().mapNotNull { event ->
            val dayStart = today.atStartOfDay(zone).toInstant().toEpochMilli()
            val occurrence = ScheduleTime.nextOccurrence(event, dayStart - 1, store.anchorZone(event.id))
            if (occurrence != null && Instant.ofEpochMilli(occurrence).atZone(zone).toLocalDate() == today) {
              val time = if (event.isAllDay) "종일" else Instant.ofEpochMilli(occurrence).atZone(zone).toLocalTime().toString()
              "$time ${event.title}${event.location?.let { " · $it" } ?: ""}"
            } else null
          } }
          post(context, "daily", "오늘의 일정 ${lines.size}개", if (lines.isEmpty()) "오늘 예정된 일정이 없습니다." else lines.joinToString("\n"), false)
        }
      } else {
        val event = ScheduleStore(context).use { it.get(id) }
        if (event != null && ScheduleReminders.enabled(event)) {
          val offset = ScheduleReminders.offset(kind)
          // A delayed early reminder is no longer useful after its intended event starts.
          if (offset == null || ScheduleReminders.stillUseful(fired, offset, System.currentTimeMillis())) {
            val body = if (offset != null && offset > 0) {
              val remaining = ((fired.at + offset * 60_000L - System.currentTimeMillis()) + 59_999L) / 60_000L
              if (remaining > 0) "일정 시작까지 약 ${remaining}분 남았습니다." else "곧 시작할 일정입니다."
            } else "예정된 일정입니다."
            post(context, id, event.title, body, true, kind)
          }
        }
      }
    } finally {
      // A failed notification post must not prevent the next repeating occurrence from being scheduled.
      val sync = ScheduleSideEffects.reconcile(
        alarms = { scheduler.rescheduleAll(maxOf(System.currentTimeMillis(), fired.at)) },
        widgets = { ScheduleWidgetProvider.refreshAll(context) })
      if (!sync.ready) Log.w("PushOfficeReminder", "Reminder recovery needs retry")
    }
  }
  private fun post(context: Context, id: String, title: String, body: String, canSnooze: Boolean, kind: String = "briefing") {
    if (!ReminderNotifications.allowed(context)) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val builder = Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body)).setAutoCancel(true)
    // Hide schedule titles and locations on lock screens configured to hide sensitive content.
    builder.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(
      Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle("Push Office").setContentText("일정 알림이 있습니다.").build())
    val launch = ReminderNotifications.openIntent(context, if (canSnooze) id else null)
    builder.setContentIntent(PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    if (canSnooze) {
      val snooze = PendingIntent.getBroadcast(context, 0, Intent(context, ReminderReceiver::class.java).apply {
        action = ACTION_SNOOZE
        data = Uri.parse(ScheduleTime.alarmIdentity(id, "snooze-action-" + kind))
        putExtra("scheduleId", id); putExtra("notificationKind", kind)
      }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      builder.addAction(Notification.Action.Builder(null, "10분 후 다시 알림", snooze).build())
    }
    manager.notify(ScheduleReminders.notificationTag(id, kind), 1, builder.build())
  }
  companion object {
    const val CHANNEL = "push_office_local_schedules"
    const val ACTION_SNOOZE = "expo.modules.pushoffice.SNOOZE"
  }
}

class ReminderRecoveryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val result = ScheduleRuntime.changed(context)
    if (!result.ready) Log.w("PushOfficeReminder", "Alarm or widget recovery needs retry")
  }
}
