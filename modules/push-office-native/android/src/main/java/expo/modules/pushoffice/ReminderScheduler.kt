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
    ScheduleStore(context).use { store ->
      store.all().forEach { record ->
        if (settings.pushEnabled && record.notificationEnabled) {
          val version = version(record)
          val next = ReminderLifecycle.choose(read(record.id, "reminder"), record.id, "reminder", version,
            ScheduleTime.nextOccurrence(record, now, store.anchorZone(record.id)))
          next?.let { wanted.add(key(it.id, it.kind)); reserve(it) }
          val snooze = read(record.id, "snooze")
          if (snooze != null && snooze.version == version) {
            wanted.add(key(snooze.id, snooze.kind)); reserve(snooze)
          }
        }
      }
    }
    if (settings.pushEnabled && settings.dailyBriefingEnabled) {
      val zone = ZoneId.of(settings.timezone)
      val localNow = Instant.ofEpochMilli(now).atZone(zone)
      var next = localNow.toLocalDate().atTime(LocalTime.parse(settings.dailyBriefingTime)).atZone(zone)
      if (next.toInstant().toEpochMilli() <= now) next = next.plusDays(1)
      val briefing = ReminderLifecycle.choose(read("daily", "briefing"), "daily", "briefing", version(settings), next.toInstant().toEpochMilli())!!
      wanted.add(key(briefing.id, briefing.kind)); reserve(briefing)
    }
    reservations.all.keys.filter { it !in wanted }.forEach { identity ->
      readKey(identity)?.let { cancel(it.id, it.kind) } ?: reservations.edit().remove(identity).commit()
    }
  }
  fun cancelSchedule(id: String): Unit = ScheduleSerial.withLock {
    cancel(id, "reminder"); cancel(id, "snooze")
    context.getSystemService(android.app.NotificationManager::class.java).cancel(id, 1)
  }
  fun snooze(id: String, minutes: Int): Long = ScheduleSerial.withLock {
    require(minutes in 1..1440) { "다시 알림은 1분부터 24시간까지 가능합니다." }
    val record = ScheduleStore(context).use { it.get(id) } ?: error("일정을 찾을 수 없습니다.")
    require(ReminderSettings.load(context).pushEnabled && record.notificationEnabled) { "알림이 꺼져 있습니다." }
    val at = System.currentTimeMillis() + minutes * 60_000L
    reserve(ReminderReservation(id, "snooze", at, version(record), UUID.randomUUID().toString()))
    at
  }
  fun cancelSnooze(id: String): Unit = ScheduleSerial.withLock { cancel(id, "snooze") }

  /** Called under the same lock as notification delivery; stale/disabled/deleted tokens are rejected. */
  fun consume(id: String, kind: String, token: String?): ReminderReservation? = ScheduleSerial.withLock {
    val settings = ReminderSettings.load(context)
    if (!settings.pushEnabled) return@withLock null
    val version = if (kind == "briefing") {
      if (!settings.dailyBriefingEnabled) return@withLock null
      version(settings)
    } else {
      if (kind !in setOf("reminder", "snooze")) return@withLock null
      val record = ScheduleStore(context).use { it.get(id) } ?: return@withLock null
      if (!record.notificationEnabled) return@withLock null
      version(record)
    }
    val reservation = read(id, kind)
    if (!ReminderLifecycle.matches(reservation, token, version)) return@withLock null
    cancel(id, kind)
    reservation
  }
  private fun version(record: ScheduleRecord): String = fingerprint(record.toString())
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
    if (operation != null) { alarms.cancel(operation); operation.cancel() }
    reservations.edit().remove(key(id, kind)).commit()
  }
  companion object { const val ACTION_FIRE = "expo.modules.pushoffice.REMINDER" }
}
