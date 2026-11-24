package expo.modules.pushoffice

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.util.UUID

class ReminderScheduler(private val context: Context) {
  private val alarms = context.getSystemService(AlarmManager::class.java)
  private val reservations = context.getSharedPreferences("push_office_reservations", Context.MODE_PRIVATE)
  fun exactAlarmAllowed(): Boolean = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()

  /** Reconcile without replacing unchanged reservations, including overdue inexact deliveries. */
  fun rescheduleAll(now: Long = System.currentTimeMillis()): Unit = ScheduleSerial.withLock {
    val settings = ReminderSettings.load(context)
    val wanted = mutableSetOf<String>()
    var failure: Exception? = null
    fun attempt(action: () -> Unit) {
      try { action() } catch (error: Exception) { if (failure == null) failure = error }
    }
    ScheduleStore(context).use { store ->
      store.all().forEach { record ->
        if (settings.pushEnabled && ScheduleReminders.enabled(record)) {
          val version = version(record)
          val compatible = compatibleVersions(record)
          val zone = store.anchorZone(record.id)
          for (offset in record.reminderOffsets) {
            attempt {
              val kind = ScheduleReminders.kind(offset)
              val existing = read(record.id, kind)?.takeIf {
                it.version in compatible && ScheduleReminders.stillUseful(it, offset, now)
              }?.copy(version = version)
              val next = ReminderLifecycle.choose(existing, record.id, kind, version,
                ScheduleReminders.next(record, now, zone, offset))
              next?.let { wanted.add(key(it.id, it.kind)); reserve(it) }
            }
          }
          val snooze = read(record.id, "snooze")?.takeIf { it.version in compatible }?.copy(version = version)
          if (snooze != null) {
            wanted.add(key(snooze.id, snooze.kind)); attempt { reserve(snooze) }
          }
        } else if (record.completedAt != null || !record.notificationEnabled) {
          attempt { clearDisplayed(record.id) }
        }
      }
    }
    if (settings.pushEnabled && settings.dailyBriefingEnabled) {
      val zone = ZoneId.of(settings.timezone)
      val localNow = Instant.ofEpochMilli(now).atZone(zone)
      var next = localNow.toLocalDate().atTime(LocalTime.parse(settings.dailyBriefingTime)).atZone(zone)
      if (next.toInstant().toEpochMilli() <= now) next = next.plusDays(1)
      val briefing = ReminderLifecycle.choose(read("daily", "briefing"), "daily", "briefing", version(settings), next.toInstant().toEpochMilli())!!
      wanted.add(key(briefing.id, briefing.kind)); attempt { reserve(briefing) }
    }
    reservations.all.keys.filter { it !in wanted }.forEach { identity ->
      attempt {
        val obsolete = readKey(identity)
        if (obsolete != null) cancel(obsolete.id, obsolete.kind)
        else check(reservations.edit().remove(identity).commit())
      }
    }
    // Report partial failure only after attempting all independent reservations.
    failure?.let { throw it }
  }
  private fun clearDisplayed(id: String) {
    val notifications = context.getSystemService(android.app.NotificationManager::class.java)
    notifications.cancel(id, 1)
    ScheduleReminders.options.filter { it != 0 }.forEach {
      notifications.cancel(ScheduleReminders.notificationTag(id, ScheduleReminders.kind(it)), 1)
    }
  }
  fun cancelSchedule(id: String): Unit = ScheduleSerial.withLock {
    var failure: Exception? = null
    val kinds = ScheduleReminders.options.map(ScheduleReminders::kind) + "snooze"
    for (kind in kinds) {
      try { cancel(id, kind) } catch (error: Exception) { if (failure == null) failure = error }
    }
    try { clearDisplayed(id) } catch (error: Exception) { if (failure == null) failure = error }
    failure?.let { throw it }
  }
  fun snooze(id: String, minutes: Int): Long = ScheduleSerial.withLock {
    require(minutes in 1..1440) { "다시 알림은 1분부터 24시간까지 가능합니다." }
    val record = ScheduleStore(context).use { it.get(id) } ?: error("일정을 찾을 수 없습니다.")
    require(ReminderSettings.load(context).pushEnabled && ScheduleReminders.enabled(record)) { "완료된 일정이거나 알림이 꺼져 있습니다." }
    val at = System.currentTimeMillis() + minutes * 60_000L
    reserve(ReminderReservation(id, "snooze", at, version(record), UUID.randomUUID().toString()))
    at
  }
  fun cancelSnooze(id: String): Unit = ScheduleSerial.withLock { cancel(id, "snooze") }

  /** Called under the same lock as notification delivery; stale/disabled/deleted tokens are rejected. */
  fun consume(id: String, kind: String, token: String?): ReminderReservation? = ScheduleSerial.withLock {
    val settings = ReminderSettings.load(context)
    if (!settings.pushEnabled) return@withLock null
    val versions = if (kind == "briefing") {
      if (!settings.dailyBriefingEnabled || id != "daily") return@withLock null
      setOf(version(settings))
    } else {
      val record = ScheduleStore(context).use { it.get(id) } ?: return@withLock null
      if (!ScheduleReminders.enabled(record)) return@withLock null
      if (kind != "snooze" && ScheduleReminders.offset(kind) !in record.reminderOffsets) return@withLock null
      compatibleVersions(record)
    }
    val reservation = read(id, kind)
    if (versions.none { ReminderLifecycle.matches(reservation, token, it) }) return@withLock null
    cancel(id, kind)
    reservation
  }
  private fun version(record: ScheduleRecord): String = fingerprint(record.toString())
  /** v2/v3 default records must retain queued legacy alarms across an app upgrade. */
  private fun compatibleVersions(record: ScheduleRecord): Set<String> =
    ScheduleReminders.compatibleVersionInputs(record).map(::fingerprint).toSet()
  private fun version(settings: ReminderSettings): String = fingerprint(settings.toString())
  private fun fingerprint(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
  private fun key(id: String, kind: String) = ScheduleTime.alarmIdentity(id, kind)
  private fun read(id: String, kind: String) = readKey(key(id, kind))
  private fun readKey(identity: String): ReminderReservation? {
    val raw = reservations.getString(identity, null) ?: return null
    return runCatching { JSONObject(raw).let {
      ReminderReservation(it.getString("id"), it.getString("kind"), it.getLong("at"), it.getString("version"), it.getString("token"))
    } }.getOrNull()
  }
  private fun pending(id: String, kind: String, token: String? = null): PendingIntent = PendingIntent.getBroadcast(context, 0,
    Intent(context, ReminderReceiver::class.java).apply {
      action = ACTION_FIRE
      data = Uri.parse(key(id, kind) + "/" + token)
      putExtra("scheduleId", id); putExtra("kind", kind); putExtra("reservationToken", token)
    }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun reserve(reservation: ReminderReservation) {
    val previous = read(reservation.id, reservation.kind)
    if (previous != null && previous.token != reservation.token) cancel(previous.id, previous.kind)
    val json = JSONObject().put("id", reservation.id).put("kind", reservation.kind).put("at", reservation.at)
      .put("version", reservation.version).put("token", reservation.token)
    check(reservations.edit().putString(key(reservation.id, reservation.kind), json.toString()).commit())
    val operation = pending(reservation.id, reservation.kind, reservation.token)
    try {
      if (exactAlarmAllowed()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reservation.at, operation)
      else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reservation.at, operation)
    } catch (_: SecurityException) {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reservation.at, operation)
    }
  }
  private fun cancel(id: String, kind: String) {
    // Do not mutate extras of a PendingIntent that may already be queued for delivery.
    val existing = read(id, kind)
    val operation = if (existing == null) null else PendingIntent.getBroadcast(context, 0, Intent(context, ReminderReceiver::class.java).apply {
      action = ACTION_FIRE; data = Uri.parse(key(id, kind) + "/" + existing.token)
    }, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
    // Invalidate the persisted token before touching the platform alarm; an already queued callback is stale.
    check(reservations.edit().remove(key(id, kind)).commit()) { "알림 예약을 취소하지 못했습니다." }
    if (operation != null) { alarms.cancel(operation); operation.cancel() }
  }
  companion object { const val ACTION_FIRE = "expo.modules.pushoffice.REMINDER" }
}
