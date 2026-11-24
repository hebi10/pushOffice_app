package expo.modules.pushoffice

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class ScheduleCategoryMigrationTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()

  @Test fun bothOldSchemaVersionsMigrateWithoutDroppingDataOrInventingCategory() {
    for (version in listOf(1, 2)) {
      val db = SQLiteDatabase.create(null)
      try {
        db.execSQL("""CREATE TABLE schedules (
          id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, type TEXT NOT NULL,
          title TEXT NOT NULL, startAt INTEGER NOT NULL, endAt INTEGER,
          isAllDay INTEGER NOT NULL, repeatType TEXT NOT NULL,
          notificationEnabled INTEGER NOT NULL, notificationId TEXT, sourceText TEXT NOT NULL,
          createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, anchorZone TEXT NOT NULL
          ${if (version == 2) ", location TEXT, meetingUrl TEXT, notes TEXT" else ""})""")
        db.execSQL("INSERT INTO schedules (id,userId,type,title,startAt,endAt,isAllDay,repeatType,notificationEnabled,notificationId,sourceText,createdAt,updatedAt,anchorZone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          arrayOf<Any>("legacy-id", "local", "event", "기존 일정", 1820000000000L,
            1820003600000L, 0, "weekly", 1, "synthetic-reservation", "기존 원문", 100L, 200L, "Asia/Seoul"))
        if (version == 2) db.execSQL("UPDATE schedules SET location='회의실', notes='기존 메모'")
        db.beginTransaction()
        try {
          ScheduleStore(context).use { it.onUpgrade(db, version, 3) }
          db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        db.rawQuery("SELECT id,title,startAt,endAt,repeatType,notificationEnabled,notificationId,sourceText,anchorZone,location,notes,category FROM schedules", null).use { row ->
          assertTrue(row.moveToFirst())
          assertEquals("legacy-id", row.getString(0))
          assertEquals("기존 일정", row.getString(1))
          assertEquals(1820000000000L, row.getLong(2))
          assertEquals(1820003600000L, row.getLong(3))
          assertEquals("weekly", row.getString(4))
          assertEquals(1, row.getInt(5))
          assertEquals("synthetic-reservation", row.getString(6))
          assertEquals("기존 원문", row.getString(7))
          assertEquals("Asia/Seoul", row.getString(8))
          assertEquals(if (version == 2) "회의실" else null, row.getString(9))
          assertEquals(if (version == 2) "기존 메모" else null, row.getString(10))
          assertTrue(row.isNull(11))
          assertFalse(row.moveToNext())
        }
      } finally { db.close() }
    }
  }

  @Test fun categoryPersistsThroughNativeBridgeAndRestoreAndInvalidValuesCannotOverwrite() {
    val id = "po-category-" + UUID.randomUUID()
    val newId = id + "-new"
    val invalidId = id + "-invalid"
    val now = System.currentTimeMillis()
    val fixture = ScheduleRecord(id, "local", "event", "카테고리 확인", now + 86400000,
      repeatType = "weekly", notificationEnabled = false, createdAt = now, updatedAt = now,
      anchorZone = "Asia/Seoul", location = "회의실", notes = "메모", category = "work")
    ScheduleStore(context).use { store ->
      try {
        val saved = store.save(fixture)
        assertEquals("work", saved.category)
        assertEquals(fixture.category, ScheduleRecord.fromMap(saved.toMap()).category)
        assertEquals(null, ScheduleRecord.fromMap(saved.toMap() - "category").category)
        assertThrows(IllegalArgumentException::class.java) {
          ScheduleRecord.fromMap(saved.toMap() + ("category" to 123))
        }
        assertThrows(IllegalArgumentException::class.java) {
          store.save(saved.copy(category = "invalid"))
        }
        assertEquals(saved, store.get(id))
        assertThrows(IllegalArgumentException::class.java) {
          store.importBackupRecords(listOf(fixture.copy(id = newId, category = "health"),
            fixture.copy(id = invalidId, category = "invalid")))
        }
        assertNull(store.get(newId))
        assertNull(store.get(invalidId))
        assertEquals(1, store.importBackupRecords(listOf(saved.copy(category = "family"),
          fixture.copy(id = newId, category = "health"))))
        assertEquals("work", store.get(id)?.category)
        assertEquals("health", store.get(newId)?.category)
        val cleared = store.save(saved.copy(category = null))
        assertNull(cleared.category)
        assertEquals(saved.startAt, cleared.startAt)
        assertEquals(saved.repeatType, cleared.repeatType)
        assertEquals(saved.anchorZone, cleared.anchorZone)
        assertEquals(saved.location, cleared.location)
      } finally {
        for (key in listOf(id, newId, invalidId)) store.delete(key)
      }
    }
  }
}
