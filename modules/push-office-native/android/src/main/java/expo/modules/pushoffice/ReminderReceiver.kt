package expo.modules.pushoffice

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import java.time.Instant
import java.time.ZoneId

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    ScheduleSerial.withLock { receiveLocked(context, intent) }
  }
  private fun receiveLocked(context: Context, intent: Intent) {
    val scheduler = ReminderScheduler(context)
    if (intent.action == ACTION_SNOOZE) {
      intent.getStringExtra("scheduleId")?.let { id ->
        runCatching { scheduler.snooze(id, 10) }
        context.getSystemService(NotificationManager::class.java).cancel(id, 1)
      }
      return
    }
    if (intent.action != ReminderScheduler.ACTION_FIRE) return
    val id = intent.getStringExtra("scheduleId") ?: return
    val kind = intent.getStringExtra("kind") ?: return
    val fired = scheduler.consume(id, kind, intent.getStringExtra("reservationToken")) ?: return
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
            "$time ${event.title}"
          } else null
        } }
        post(context, "daily", "오늘의 일정 ${lines.size}개", if (lines.isEmpty()) "오늘 예정된 일정이 없습니다." else lines.joinToString("\n"), false)
      }
    } else {
      val event = ScheduleStore(context).use { it.get(id) }
      if (event != null && event.notificationEnabled) post(context, id, event.title, "예정된 일정입니다.", true)
    }
    scheduler.rescheduleAll(maxOf(System.currentTimeMillis(), fired.at))
    ScheduleWidgetProvider.refreshAll(context)
  }
  private fun post(context: Context, id: String, title: String, body: String, canSnooze: Boolean) {
    if (!ReminderNotifications.allowed(context)) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val builder = Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body)).setAutoCancel(true)
    val launch = ReminderNotifications.openIntent(context, if (canSnooze) id else null)
    builder.setContentIntent(PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    if (canSnooze) {
      val snooze = PendingIntent.getBroadcast(context, 0, Intent(context, ReminderReceiver::class.java).apply {
        action = ACTION_SNOOZE; data = Uri.parse(ScheduleTime.alarmIdentity(id, "snooze-action")); putExtra("scheduleId", id)
      }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      builder.addAction(Notification.Action.Builder(null, "10분 후 다시 알림", snooze).build())
    }
    manager.notify(id, 1, builder.build())
  }
  companion object {
    const val CHANNEL = "push_office_local_schedules"
    const val ACTION_SNOOZE = "expo.modules.pushoffice.SNOOZE"
  }
}

class ReminderRecoveryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    ScheduleRuntime.changed(context)
  }
}
