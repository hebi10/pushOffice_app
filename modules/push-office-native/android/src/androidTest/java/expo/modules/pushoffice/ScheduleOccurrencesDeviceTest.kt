package expo.modules.pushoffice

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.ZoneId
import java.util.UUID

class ScheduleOccurrencesDeviceTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()
  @Test fun schemaV4MigrationPreservesCompletionAndAlarmOffsets() {
    val db=SQLiteDatabase.create(null)
    try {
      db.execSQL("CREATE TABLE schedules (id TEXT PRIMARY KEY, reminderOffsets TEXT, completedAt INTEGER)")
      db.execSQL("INSERT INTO schedules VALUES ('old','0,30',123)")
      ScheduleStore(context).use { it.onUpgrade(db,4,5) }
      db.rawQuery("SELECT reminderOffsets,completedAt,excludedStarts FROM schedules",null).use {
        assertTrue(it.moveToFirst()); assertEquals("0,30",it.getString(0)); assertEquals(123L,it.getLong(1)); assertEquals("",it.getString(2))
      }
    } finally { db.close() }
  }

  @Test fun editDeleteAndCompleteAreAtomicAndOldTokensCannotReviveExcludedSlots() {
    val previous=ReminderSettings.load(context)
    val now=System.currentTimeMillis()
    val start=now+7*86400000L
    val id="po-occurrence-"+UUID.randomUUID()
    val zone=ZoneId.of("Asia/Seoul")
    val generated=mutableListOf<String>()
    val record=ScheduleRecord(id,"local","event","원본 일정",start,endAt=start+3600000L,
      repeatType="daily",createdAt=now,updatedAt=now,anchorZone=zone.id,category="work",
      notes="원본 메모",reminderOffsets=listOf(0,30))
    try {
      previous.copy(pushEnabled=true,dailyBriefingEnabled=false).save(context)
      val initial=ScheduleRuntime.save(context,record).record
      val prefs=context.getSharedPreferences("push_office_reservations",Context.MODE_PRIVATE)
      val token=JSONObject(requireNotNull(prefs.getString(ScheduleTime.alarmIdentity(id,"reminder"),null))).getString("token")
      assertThrows(IllegalArgumentException::class.java) {
        ScheduleRuntime.mutateOccurrence(context,id,start,initial.updatedAt,"edit",
          mapOf("title" to "", "startAt" to start+60000L, "endAt" to start+120000L))
      }
      assertEquals(initial,ScheduleStore(context).use { it.get(id) })
      val (edit,sync)=ScheduleRuntime.mutateOccurrence(context,id,start,initial.updatedAt,"edit",
        mapOf("title" to "독립 일정", "startAt" to start+60000L, "endAt" to start+120000L))
      val detached=requireNotNull(edit.detached)
      generated.add(detached.id)
      assertTrue(sync.alarmsReady)
      assertEquals(listOf(start),edit.series.excludedStarts)
      assertEquals("none",detached.repeatType)
      assertEquals("work",detached.category)
      assertEquals("원본 메모",detached.notes)
      assertEquals(record.reminderOffsets,detached.reminderOffsets)
      assertEquals(start+86400000L,ScheduleTime.nextOccurrence(edit.series,now,zone))
      assertNull(ReminderScheduler(context).consume(id,"reminder",token))
      assertThrows(IllegalArgumentException::class.java) {
        ScheduleRuntime.mutateOccurrence(context,id,start,edit.series.updatedAt,"delete",emptyMap())
      }
      assertThrows(IllegalArgumentException::class.java) {
        ScheduleRuntime.save(context,edit.series.copy(startAt=start+60000L))
      }
      val (removed,_)=ScheduleRuntime.mutateOccurrence(context,id,start+86400000L,edit.series.updatedAt,"delete",emptyMap())
      assertNull(removed.detached)
      assertEquals(listOf(start,start+86400000L),removed.series.excludedStarts)
      val (done,_)=ScheduleRuntime.mutateOccurrence(context,id,start+2*86400000L,removed.series.updatedAt,"complete",emptyMap())
      val completed=requireNotNull(done.detached)
      generated.add(completed.id)
      assertNotNull(completed.completedAt)
      assertEquals(start+3*86400000L,ScheduleTime.nextOccurrence(done.series,now,zone))
      assertEquals(done.series.excludedStarts,ScheduleRecord.fromMap(done.series.toMap()).excludedStarts)
      ScheduleRuntime.delete(context,id)
      assertNotNull(ScheduleStore(context).use { it.get(detached.id) })
      assertNotNull(ScheduleStore(context).use { it.get(completed.id) })
    } finally {
      (listOf(id)+generated).forEach { ScheduleRuntime.delete(context,it) }
      previous.save(context)
      ScheduleRuntime.changed(context)
    }
  }
}
