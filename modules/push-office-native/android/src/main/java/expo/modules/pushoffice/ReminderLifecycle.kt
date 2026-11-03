package expo.modules.pushoffice

import java.util.UUID

data class ReminderReservation(val id: String, val kind: String, val at: Long, val version: String, val token: String)

/** Pure reservation policy used by the persisted Android scheduler. Due alarms remain deliverable. */
object ReminderLifecycle {
  fun choose(existing: ReminderReservation?, id: String, kind: String, version: String, nextAt: Long?): ReminderReservation? {
    if (existing != null && existing.version == version) return existing
    return nextAt?.let { ReminderReservation(id, kind, it, version, UUID.randomUUID().toString()) }
  }
  fun matches(existing: ReminderReservation?, token: String?, currentVersion: String): Boolean =
    existing != null && token != null && existing.token == token && existing.version == currentVersion
  fun validateSave(record: ScheduleRecord, previous: ScheduleRecord?, now: Long, allowPast: Boolean) {
    val retainingEnabledHistory = previous?.notificationEnabled == true && previous.startAt == record.startAt && previous.repeatType == record.repeatType
    ScheduleTime.validate(record, now, allowPast || retainingEnabledHistory)
  }
}

/** One process-wide, reentrant lock covers mutation, configuration, recovery and alarm delivery. */
object ScheduleSerial {
  private val lock = Any()
  fun <T> withLock(block: () -> T): T = synchronized(lock, block)
}
