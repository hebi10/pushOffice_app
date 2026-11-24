package expo.modules.pushoffice

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.ZoneId
import java.util.UUID

class ReminderSchedulerRecoveryTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()
  private fun reservation(id: String, kind: String): JSONObject? =
    context.getSharedPreferences("push_office_reservations", Context.MODE_PRIVATE)
      .getString(ScheduleTime.alarmIdentity(id, kind), null)?.let { JSONObject(it) }

  @Test fun persistedRepeatAndSnoozeRecoverAndOldTokensAreRejected() {
    val previous = ReminderSettings.load(context)
    val now = System.currentTimeMillis()
    val zone = ZoneId.of("Asia/Seoul")
    val start = now + 7 * 24 * 60 * 60_000L
    val id = "po-fix-04-" + UUID.randomUUID()
    val record = ScheduleRecord(id, "local", "schedule", "테스트 반복", start,
      repeatType = "daily", notificationEnabled = true, createdAt = now, updatedAt = now, anchorZone = zone.id)
    try {
      previous.copy(pushEnabled = true, dailyBriefingEnabled = false).save(context)
      val result = ScheduleRuntime.save(context, record)
      assertTrue(result.sync.alarmsReady)
      val first = requireNotNull(reservation(id, "reminder"))
      val token = first.getString("token")
      assertEquals(start, first.getLong("at"))
      val scheduler = ReminderScheduler(context)
      scheduler.snooze(id, 120)
      val snooze = requireNotNull(reservation(id, "snooze")).getString("token")
      // Invoke the real recovery receiver on the test emulator; this is not a physical reboot.
      ReminderRecoveryReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
      assertEquals(token, reservation(id, "reminder")?.getString("token"))
      assertEquals(snooze, reservation(id, "snooze")?.getString("token"))
      ReminderRecoveryReceiver().onReceive(context, Intent(Intent.ACTION_TIMEZONE_CHANGED))
      assertEquals(token, reservation(id, "reminder")?.getString("token"))
      assertNull(scheduler.consume(id, "reminder", "obsolete-token"))
      assertNotNull(scheduler.consume(id, "reminder", token))
      scheduler.rescheduleAll(start + 1)
      val next = requireNotNull(reservation(id, "reminder"))
      assertNotEquals(token, next.getString("token"))
      assertEquals(ScheduleTime.nextOccurrence(record, start + 1, zone), next.getLong("at"))
      assertNull(scheduler.consume(id, "reminder", token))
      val disabled = ScheduleRuntime.save(context, record.copy(notificationEnabled = false, updatedAt = now + 1))
      assertTrue(disabled.sync.alarmsReady)
      assertNull(reservation(id, "reminder"))
      assertNull(reservation(id, "snooze"))
      assertNull(scheduler.consume(id, "reminder", next.getString("token")))
    } finally {
      ScheduleRuntime.delete(context, id)
      previous.save(context)
      ScheduleRuntime.changed(context)
    }
  }
}
