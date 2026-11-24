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
    val status = changed(context) {
      val scheduler = ReminderScheduler(context)
      scheduler.cancelSnooze(record.id)
      if (saved.completedAt != null || !saved.notificationEnabled) scheduler.cancelSchedule(record.id)
    }
    ScheduleSaveResult(saved, status)
  }
  /** Completion is a dedicated mutation; always use the current row, not an edited UI snapshot. */
  fun setCompleted(context: Context, id: String, completed: Boolean): ScheduleSaveResult = ScheduleSerial.withLock {
    val current = ScheduleStore(context).use { it.get(id) } ?: error("일정을 찾을 수 없습니다.")
    if ((current.completedAt != null) == completed) {
      return@withLock ScheduleSaveResult(current, changed(context) {
        if (completed) ReminderScheduler(context).cancelSchedule(id)
      })
    }
    val now = System.currentTimeMillis()
    save(context, current.copy(completedAt = if (completed) now else null, updatedAt = maxOf(now, current.updatedAt + 1)), allowPast = true)
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
