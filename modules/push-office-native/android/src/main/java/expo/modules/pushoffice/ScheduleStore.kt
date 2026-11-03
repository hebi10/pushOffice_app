package expo.modules.pushoffice

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.time.ZoneId
import java.util.concurrent.CopyOnWriteArraySet

/** One SQLite database shared by JS, native entry, widgets, and receivers. */
class ScheduleStore(context: Context) : SQLiteOpenHelper(context.applicationContext, "push_office_local.db", null, 1) {
  private val storageContext=context.applicationContext
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("""CREATE TABLE schedules (
      id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, startAt INTEGER NOT NULL, endAt INTEGER,
      isAllDay INTEGER NOT NULL, repeatType TEXT NOT NULL,
      notificationEnabled INTEGER NOT NULL, notificationId TEXT, sourceText TEXT NOT NULL,
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, anchorZone TEXT NOT NULL)""")
    db.execSQL("CREATE INDEX schedules_start ON schedules(startAt)")
  }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
  fun all(): List<ScheduleRecord> = readableDatabase.query("schedules", null, null, null, null, null, "startAt ASC").use { cursor ->
    buildList { while (cursor.moveToNext()) add(read(cursor)) }
  }
  fun get(id: String): ScheduleRecord? = readableDatabase.query("schedules", null, "id=?", arrayOf(id), null, null, null).use {
    if (it.moveToFirst()) read(it) else null
  }
  fun anchorZone(id: String): ZoneId = readableDatabase.query("schedules", arrayOf("anchorZone"), "id=?", arrayOf(id), null, null, null).use {
    if (it.moveToFirst()) ZoneId.of(it.getString(0)) else ZoneId.systemDefault()
  }
  /** Existing historical records can be retained/imported without triggering a past alarm. */
  fun save(record: ScheduleRecord, allowPast: Boolean = false, zone: ZoneId? = null): ScheduleRecord = ScheduleSerial.withLock {
    val saved=write(record,allowPast,zone)
    notifyChanged()
    saved
  }
  /** A failed batch leaves no rows and emits no mutation event; retry cannot revive a partial import. */
  fun importRecords(records: List<ScheduleRecord>): Int = ScheduleSerial.withLock {
    records.forEach { ScheduleTime.validate(it,System.currentTimeMillis(),true) }
    val db=writableDatabase
    db.beginTransaction()
    try {
      records.forEach { if(get(it.id)==null) write(it,true,null) }
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
    notifyChanged()
    records.size
  }
  /** Caller holds ScheduleSerial; notifications belong after an entire mutation commits. */
  private fun write(record: ScheduleRecord, allowPast: Boolean, zone: ZoneId?): ScheduleRecord {
    val previous = get(record.id)
    ReminderLifecycle.validateSave(record, previous, System.currentTimeMillis(), allowPast)
    val storedZone = ScheduleZone.resolve(previous?.anchorZone,record.anchorZone,
      zone ?: ScheduleZone.fallback(ReminderSettings.load(storageContext).timezone,ZoneId.systemDefault()))
    val values = ContentValues().apply {
      put("id", record.id); put("userId", record.userId); put("type", record.type); put("title", record.title.trim())
      put("startAt", record.startAt); if (record.endAt == null) putNull("endAt") else put("endAt", record.endAt)
      put("isAllDay", if (record.isAllDay) 1 else 0); put("repeatType", record.repeatType)
      put("notificationEnabled", if (record.notificationEnabled) 1 else 0); put("notificationId", record.notificationId)
      put("sourceText", record.sourceText); put("createdAt", previous?.createdAt ?: record.createdAt)
      put("updatedAt", record.updatedAt); put("anchorZone", storedZone.id)
    }
    writableDatabase.insertWithOnConflict("schedules", null, values, SQLiteDatabase.CONFLICT_REPLACE).also {
      check(it != -1L) { "일정을 저장하지 못했습니다." }
    }
    return get(record.id)!!
  }
  fun delete(id: String) = ScheduleSerial.withLock {
    writableDatabase.delete("schedules", "id=?", arrayOf(id))
    notifyChanged()
  }
  private fun read(c: Cursor) = ScheduleRecord(
    id = c.string("id"), userId = c.string("userId"), type = c.string("type"), title = c.string("title"),
    startAt = c.long("startAt"), endAt = c.getColumnIndexOrThrow("endAt").let { if (c.isNull(it)) null else c.getLong(it) },
    isAllDay = c.long("isAllDay") == 1L, repeatType = c.string("repeatType"),
    notificationEnabled = c.long("notificationEnabled") == 1L,
    notificationId = c.getColumnIndexOrThrow("notificationId").let { if (c.isNull(it)) null else c.getString(it) },
    sourceText = c.string("sourceText"), createdAt = c.long("createdAt"), updatedAt = c.long("updatedAt"),
    anchorZone = c.string("anchorZone")
  )
  private fun Cursor.string(name: String) = getString(getColumnIndexOrThrow(name))
  private fun Cursor.long(name: String) = getLong(getColumnIndexOrThrow(name))
  companion object {
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    fun addListener(listener: () -> Unit) { listeners.add(listener) }
    fun removeListener(listener: () -> Unit) { listeners.remove(listener) }
    fun notifyChanged() { listeners.forEach { it() } }
  }
}
