package expo.modules.pushoffice

import android.content.Context

data class ScheduleSyncResult(val alarmsReady: Boolean, val widgetsReady: Boolean) {
  fun toMap(): Map<String, Boolean> = mapOf("alarmsReady" to alarmsReady, "widgetsReady" to widgetsReady)
  val ready: Boolean get() = alarmsReady && widgetsReady
}
data class ScheduleSaveResult(val record: ScheduleRecord, val sync: ScheduleSyncResult)

/** Post-commit work cannot turn a durable SQLite mutation into a failed save. */
internal object ScheduleSideEffects {
  fun reconcile(beforeAlarms: () -> Unit = {}, alarms: () -> Unit, widgets: () -> Unit): ScheduleSyncResult {
    val before = runCatching(beforeAlarms).isSuccess
    val scheduled = runCatching(alarms).isSuccess
    val refreshed = runCatching(widgets).isSuccess
    return ScheduleSyncResult(before && scheduled, refreshed)
  }
}

/** Native entry points share the mutation lock, and report post-commit work separately. */
object ScheduleRuntime {
  const val ACTION_CHANGED = "expo.modules.pushoffice.SCHEDULES_CHANGED"
  fun save(context: Context, record: ScheduleRecord, allowPast: Boolean = false): ScheduleSaveResult = ScheduleSerial.withLock {
    val saved = ScheduleStore(context).use { it.save(record, allowPast) }
    val status = changed(context) { ReminderScheduler(context).cancelSnooze(record.id) }
    ScheduleSaveResult(saved, status)
  }
  fun delete(context: Context, id: String): ScheduleSyncResult = ScheduleSerial.withLock {
    ScheduleStore(context).use { it.delete(id) }
    changed(context) { ReminderScheduler(context).cancelSchedule(id) }
  }
  fun changed(context: Context, beforeAlarms: () -> Unit = {}): ScheduleSyncResult = ScheduleSerial.withLock {
    ScheduleSideEffects.reconcile(beforeAlarms,
      alarms = { ReminderScheduler(context).rescheduleAll() },
      widgets = { ScheduleWidgetProvider.refreshAll(context) })
  }
}
