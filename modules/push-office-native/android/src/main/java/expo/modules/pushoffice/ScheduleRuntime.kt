package expo.modules.pushoffice

import android.content.Context

/** Native entry points use these helpers so mutation, alarms and widget refresh stay together. */
object ScheduleRuntime {
  const val ACTION_CHANGED = "expo.modules.pushoffice.SCHEDULES_CHANGED"
  fun save(context: Context, record: ScheduleRecord, allowPast: Boolean = false): ScheduleRecord = ScheduleSerial.withLock {
    val saved = ScheduleStore(context).use { it.save(record, allowPast) }
    ReminderScheduler(context).cancelSnooze(record.id)
    changed(context)
    saved
  }
  fun delete(context: Context, id: String) = ScheduleSerial.withLock {
    ReminderScheduler(context).cancelSchedule(id)
    ScheduleStore(context).use { it.delete(id) }
    changed(context)
  }
  fun changed(context: Context) = ScheduleSerial.withLock {
    ReminderScheduler(context).rescheduleAll()
    ScheduleWidgetProvider.refreshAll(context)
  }
}
