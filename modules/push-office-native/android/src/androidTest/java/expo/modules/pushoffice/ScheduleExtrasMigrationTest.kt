package expo.modules.pushoffice

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.time.ZonedDateTime
import java.time.ZoneId
import java.util.UUID

class ScheduleExtrasMigrationTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()

  @Test fun legacyV1RowsSurviveUpgradeWithNullOptionalDetailsAndSameRepeatAlarmState() {
    val db = SQLiteDatabase.create(null)
    try {
      db.execSQL("""CREATE TABLE schedules (
        id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, type TEXT NOT NULL,
        title TEXT NOT NULL, startAt INTEGER NOT NULL, endAt INTEGER,
        isAllDay INTEGER NOT NULL, repeatType TEXT NOT NULL,
        notificationEnabled INTEGER NOT NULL, notificationId TEXT, sourceText TEXT NOT NULL,
        createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, anchorZone TEXT NOT NULL)""")
      db.execSQL("INSERT INTO schedules (id,userId,type,title,startAt,endAt,isAllDay,repeatType,notificationEnabled,notificationId,sourceText,createdAt,updatedAt,anchorZone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        arrayOf<Any>("v1-saved", "local", "event", "이전 일정", 1820000000000L,
          1820003600000L, 0, "monthly", 1, "existing-token", "원문", 100L, 200L, "Asia/Seoul"))
      ScheduleStore(context).use { it.onUpgrade(db, 1, 2) }
      db.rawQuery("SELECT title,startAt,endAt,repeatType,notificationEnabled,notificationId,sourceText,anchorZone,location,meetingUrl,notes FROM schedules WHERE id='v1-saved'", null).use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals("이전 일정", cursor.getString(0))
        assertEquals(1820000000000L, cursor.getLong(1))
        assertEquals(1820003600000L, cursor.getLong(2))
        assertEquals("monthly", cursor.getString(3))
        assertEquals(1, cursor.getInt(4))
        assertEquals("existing-token", cursor.getString(5))
        assertEquals("원문", cursor.getString(6))
        assertEquals("Asia/Seoul", cursor.getString(7))
        assertTrue(cursor.isNull(8))
        assertTrue(cursor.isNull(9))
        assertTrue(cursor.isNull(10))
      }
      db.rawQuery("SELECT COUNT(*) FROM schedules", null).use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals(1, cursor.getInt(0))
      }
    } finally {
      db.close()
    }
  }

  @Test fun sqliteSaveReadEditKeepsExtrasAndRejectsUnsafeMeetingLinksWithoutOverwriting() {
    val start = ZonedDateTime.now(ZoneId.of("Asia/Seoul")).plusDays(10)
      .withHour(13).withMinute(0).withSecond(0).withNano(0).toInstant().toEpochMilli()
    val id = "func12-04-" + UUID.randomUUID()
    val original = ScheduleRecord(
      id = id, userId = "local", type = "event", title = "확장 필드 저장",
      startAt = start, repeatType = "weekly", endAt = start + 3_600_000L,
      notificationEnabled = false, createdAt = System.currentTimeMillis(),
      updatedAt = System.currentTimeMillis(), anchorZone = "Asia/Seoul",
      location = "회의실 B", meetingUrl = "https://meet.example.org/room", notes = "준비물\n노트북"
    )
    ScheduleStore(context).use { store ->
      try {
        store.save(original)
        val stored = store.get(id)!!
        assertEquals(original.location, stored.location)
        assertEquals(original.meetingUrl, stored.meetingUrl)
        assertEquals(original.notes, stored.notes)
        assertEquals(original.repeatType, stored.repeatType)
        assertEquals(original.endAt, stored.endAt)
        assertEquals(original.createdAt, stored.createdAt)

        assertThrows(IllegalArgumentException::class.java) {
          store.save(original.copy(meetingUrl = "javascript:alert(1)"))
        }
        assertEquals(original.meetingUrl, store.get(id)?.meetingUrl)

        store.save(original.copy(location = null, meetingUrl = null, notes = null,
          updatedAt = System.currentTimeMillis() + 1))
        val cleared = store.get(id)!!
        assertNull(cleared.location)
        assertNull(cleared.meetingUrl)
        assertNull(cleared.notes)
      } finally {
        store.delete(id)
      }
    }
  }
}
