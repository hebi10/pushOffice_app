package expo.modules.pushoffice

import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.security.MessageDigest
import java.util.UUID

class ScheduleRemindersDeviceTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()
  private fun reservation(id: String, kind: String): JSONObject? =
    context.getSharedPreferences("push_office_reservations", Context.MODE_PRIVATE)
      .getString(ScheduleTime.alarmIdentity(id, kind), null)?.let { JSONObject(it) }

  @Test fun migrationV3PreservesCategoryAndLegacyAlarmDefault() {
    val db = SQLiteDatabase.create(null)
    try {
      db.execSQL("CREATE TABLE schedules (id TEXT PRIMARY KEY, category TEXT, title TEXT)")
      db.execSQL("INSERT INTO schedules VALUES ('legacy','work','old schedule')")
      ScheduleStore(context).use { it.onUpgrade(db, 3, 4) }
      db.rawQuery("SELECT id,category,title,reminderOffsets,completedAt FROM schedules", null).use {
        assertTrue(it.moveToFirst())
        assertEquals("legacy", it.getString(0))
        assertEquals("work", it.getString(1))
        assertEquals("old schedule", it.getString(2))
        assertEquals("0", it.getString(3))
        assertTrue(it.isNull(4))
      }
    } finally { db.close() }
  }

  @Test fun multipleAlarmsRecoverIndependentlyAndCompletionRejectsEveryOldToken() {
    val previous = ReminderSettings.load(context)
    val now = System.currentTimeMillis()
    val start = now + 7 * 86400000L
    val id = "po-reminders-" + UUID.randomUUID()
    val kinds = listOf("reminder", ScheduleReminders.kind(10), ScheduleReminders.kind(30))
    val record = ScheduleRecord(id, "local", "event", "합성 반복 일정", start,
      repeatType = "daily", createdAt = now, updatedAt = now, anchorZone = "Asia/Seoul",
      category = "work", notes = "보존할 메모", reminderOffsets = listOf(0, 10, 30))
    val scheduler = ReminderScheduler(context)
    try {
      previous.copy(pushEnabled = true, dailyBriefingEnabled = false).save(context)
      assertTrue(ScheduleRuntime.save(context, record).sync.alarmsReady)
      val tokens = kinds.associateWith { requireNotNull(reservation(id, it)).getString("token") }
      for (offset in record.reminderOffsets) {
        assertEquals(start - offset * 60_000L, reservation(id, ScheduleReminders.kind(offset))!!.getLong("at"))
      }
      assertEquals(3, tokens.values.toSet().size)
      scheduler.snooze(id, 120)
      val snoozeToken = reservation(id, "snooze")!!.getString("token")
      ReminderRecoveryReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
      for (kind in kinds) assertEquals(tokens[kind], reservation(id, kind)?.getString("token"))
      val firstKind = ScheduleReminders.kind(30)
      assertNotNull(scheduler.consume(id, firstKind, tokens[firstKind]))
      scheduler.rescheduleAll(start - 30 * 60_000L)
      assertEquals(start + 86400000L - 30 * 60_000L, reservation(id, firstKind)!!.getLong("at"))
      assertEquals(tokens["reminder"], reservation(id, "reminder")!!.getString("token"))
      assertEquals(tokens[ScheduleReminders.kind(10)], reservation(id, ScheduleReminders.kind(10))!!.getString("token"))
      val completed = ScheduleRuntime.setCompleted(context, id, true)
      assertTrue(completed.sync.alarmsReady)
      assertNotNull(completed.record.completedAt)
      assertEquals("work", completed.record.category)
      assertEquals("보존할 메모", completed.record.notes)
      assertEquals(record.startAt, completed.record.startAt)
      assertEquals(record.reminderOffsets, completed.record.reminderOffsets)
      assertEquals(completed.record.completedAt, ScheduleRuntime.setCompleted(context,id,true).record.completedAt)
      for (kind in kinds) {
        assertNull(reservation(id, kind))
        assertNull(scheduler.consume(id, kind, tokens[kind]))
      }
      assertNull(reservation(id, "snooze"))
      assertNull(scheduler.consume(id, "snooze", snoozeToken))
      assertThrows(IllegalArgumentException::class.java) { scheduler.snooze(id, 10) }
      val reopened = ScheduleRuntime.setCompleted(context, id, false)
      assertNull(reopened.record.completedAt)
      assertTrue(reopened.sync.alarmsReady)
      for (kind in kinds) {
        assertNotNull(reservation(id, kind))
        assertNotEquals(tokens[kind], reservation(id, kind)?.getString("token"))
      }
      val edited = ScheduleRuntime.save(context, reopened.record.copy(reminderOffsets = listOf(0), updatedAt = reopened.record.updatedAt + 1))
      assertTrue(edited.sync.alarmsReady)
      assertNull(reservation(id, firstKind))
      assertNull(reservation(id, ScheduleReminders.kind(10)))
    } finally {
      ScheduleRuntime.delete(context, id)
      previous.save(context)
      ScheduleRuntime.changed(context)
    }
  }

  @Test fun existingLegacyTokenIsRetainedAndCompletedBackupRestoresWithoutScheduling() {
    val previous = ReminderSettings.load(context)
    val now = System.currentTimeMillis()
    val id = "po-legacy-reminder-" + UUID.randomUUID()
    val restoredId = id + "-restore"
    val record = ScheduleRecord(id,"local","event","합성 일정",now + 86400000L,
      createdAt=now, updatedAt=now, anchorZone="Asia/Seoul")
    try {
      previous.copy(pushEnabled=true,dailyBriefingEnabled=false).save(context)
      val saved = ScheduleRuntime.save(context, record).record
      val prefs = context.getSharedPreferences("push_office_reservations", Context.MODE_PRIVATE)
      val key = ScheduleTime.alarmIdentity(id,"reminder")
      val old = requireNotNull(reservation(id,"reminder"))
      val versionInput = ScheduleReminders.compatibleVersionInputs(saved).single { it.endsWith(", notes=null)") }
      val sha = MessageDigest.getInstance("SHA-256").digest(versionInput.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
      check(prefs.edit().putString(key, old.put("version",sha).toString()).commit())
      val token = old.getString("token")
      ReminderScheduler(context).rescheduleAll()
      assertEquals(token,reservation(id,"reminder")?.getString("token"))
      val backup = saved.copy(id=restoredId, completedAt=now, reminderOffsets=listOf(0,60))
      ScheduleStore(context).use { store ->
        assertEquals(1,store.importBackupRecords(listOf(ScheduleRecord.fromMap(backup.toMap()))))
        assertEquals(backup.completedAt,store.get(restoredId)?.completedAt)
        assertEquals(backup.reminderOffsets,store.get(restoredId)?.reminderOffsets)
      }
      ScheduleRuntime.changed(context)
      assertNull(reservation(restoredId,"reminder"))
      assertNull(reservation(restoredId,ScheduleReminders.kind(60)))
    } finally {
      ScheduleRuntime.delete(context,id)
      ScheduleRuntime.delete(context,restoredId)
      previous.save(context)
      ScheduleRuntime.changed(context)
    }
  }
}
