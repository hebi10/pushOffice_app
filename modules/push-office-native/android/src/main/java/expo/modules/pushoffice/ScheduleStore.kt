package expo.modules.pushoffice

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.time.ZoneId
import java.util.concurrent.CopyOnWriteArraySet

/** One SQLite database shared by JS, native entry, widgets, and receivers. */
class ScheduleStore(context: Context) : SQLiteOpenHelper(context.applicationContext, "push_office_local.db", null, 5) {
  private val storageContext=context.applicationContext
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("""CREATE TABLE schedules (
      id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, startAt INTEGER NOT NULL, endAt INTEGER,
      isAllDay INTEGER NOT NULL, repeatType TEXT NOT NULL,
      notificationEnabled INTEGER NOT NULL, notificationId TEXT, sourceText TEXT NOT NULL,
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, anchorZone TEXT NOT NULL,
      location TEXT, meetingUrl TEXT, notes TEXT, category TEXT,
      reminderOffsets TEXT NOT NULL DEFAULT '0', completedAt INTEGER, excludedStarts TEXT NOT NULL DEFAULT '')""")
    db.execSQL("CREATE INDEX schedules_start ON schedules(startAt)")
  }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) {
      db.execSQL("ALTER TABLE schedules ADD COLUMN location TEXT")
      db.execSQL("ALTER TABLE schedules ADD COLUMN meetingUrl TEXT")
      db.execSQL("ALTER TABLE schedules ADD COLUMN notes TEXT")
    }
    if (oldVersion < 3 && newVersion >= 3) {
      db.execSQL("ALTER TABLE schedules ADD COLUMN category TEXT")
    }
    if (oldVersion < 4 && newVersion >= 4) {
      db.execSQL("ALTER TABLE schedules ADD COLUMN reminderOffsets TEXT NOT NULL DEFAULT '0'")
      db.execSQL("ALTER TABLE schedules ADD COLUMN completedAt INTEGER")
    }
    if (oldVersion < 5 && newVersion >= 5) {
      db.execSQL("ALTER TABLE schedules ADD COLUMN excludedStarts TEXT NOT NULL DEFAULT ''")
    }
  }
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
  /** Backup-only restore: strict validation, no overwrite, and all inserts in one SQLite transaction. */
  fun importBackupRecords(records: List<ScheduleRecord>): Int = ScheduleSerial.withLock {
    require(records.size <= 10000 && records.map { it.id }.toSet().size == records.size) {
      "백업의 일정 수 또는 ID가 올바르지 않습니다."
    }
    val now = System.currentTimeMillis()
    records.forEach { ScheduleTime.validate(it, now, true) }
    val db = writableDatabase
    var imported = 0
    db.beginTransaction()
    try {
      records.forEach { record ->
        if (get(record.id) == null) {
          write(record, true, null)
          imported++
        }
      }
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
    if (imported > 0) notifyChanged()
    imported
  }
  /** Caller holds ScheduleSerial; notifications belong after an entire mutation commits. */
  private fun write(record: ScheduleRecord, allowPast: Boolean, zone: ZoneId?): ScheduleRecord {
    val previous = get(record.id)
    if (previous != null && previous.excludedStarts.isNotEmpty()) {
      require(record.startAt == previous.startAt && record.repeatType == previous.repeatType) {
        "개별 변경된 회차가 있어 반복 기준일·주기를 바꿀 수 없습니다. 새 반복 일정을 만들어 주세요."
      }
      require(record.excludedStarts.containsAll(previous.excludedStarts)) { "기존 제외 회차를 보존해야 합니다." }
    }
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
      put("location", ScheduleExtras.location(record.location))
      put("meetingUrl", ScheduleExtras.meetingUrl(record.meetingUrl))
      put("notes", ScheduleExtras.notes(record.notes))
      put("category", ScheduleCategory.validate(record.category))
      put("reminderOffsets", ScheduleReminders.validate(record.reminderOffsets).joinToString(","))
      if (record.completedAt == null) putNull("completedAt") else put("completedAt", record.completedAt)
      put("excludedStarts", ScheduleOccurrences.validate(record.excludedStarts).joinToString(","))
    }
    writableDatabase.insertWithOnConflict("schedules", null, values, SQLiteDatabase.CONFLICT_REPLACE).also {
      check(it != -1L) { "일정을 저장하지 못했습니다." }
    }
    return get(record.id)!!
  }
  /** Delete skips the original slot; edit/complete detach one independent row in the same transaction. */
  internal fun mutateOccurrence(id: String, at: Long, expectedUpdatedAt: Long, action: String,
    replacement: Map<String, Any?>, now: Long = System.currentTimeMillis()): OccurrenceMutation = ScheduleSerial.withLock {
    require(action in setOf("edit", "delete", "complete")) { "회차 작업을 확인해 주세요." }
    val original = get(id) ?: error("일정을 찾을 수 없습니다.")
    val zone = anchorZone(id)
    ScheduleOccurrences.requireEditable(original, at, expectedUpdatedAt, zone)
    val updated = original.copy(excludedStarts = (original.excludedStarts + at).sorted(),
      updatedAt = maxOf(now, original.updatedAt + 1))
    val detached = if (action == "delete") null else {
      val title = if (action == "edit") (replacement["title"] as? String)?.trim()
        ?: throw IllegalArgumentException("일정 제목을 확인해 주세요.") else original.title
      val start = if (action == "edit") ScheduleOccurrences.epoch(replacement["startAt"]) else at
      val end = if (action == "edit") replacement["endAt"]?.let(ScheduleOccurrences::epoch)
        else original.endAt?.let { at + it - original.startAt }
      require(end == null || end > start) { "종료 시간은 시작 시간 이후여야 합니다." }
      original.copy(id = java.util.UUID.randomUUID().toString(), title = title, startAt = start, endAt = end,
        repeatType = "none", notificationId = null, createdAt = now, updatedAt = now,
        completedAt = if (action == "complete") now else null, excludedStarts = emptyList())
    }
    val db = writableDatabase
    var result: ScheduleRecord? = null
    db.beginTransaction()
    try {
      write(updated, true, zone)
      if (detached != null) {
        check(get(detached.id) == null) { "일정 ID 충돌입니다. 다시 시도해 주세요." }
        result = write(detached, true, zone)
      }
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
    notifyChanged()
    OccurrenceMutation(updated, result)
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
    anchorZone = c.string("anchorZone"),
    location = c.getColumnIndexOrThrow("location").let { if (c.isNull(it)) null else c.getString(it) },
    meetingUrl = c.getColumnIndexOrThrow("meetingUrl").let { if (c.isNull(it)) null else c.getString(it) },
    notes = c.getColumnIndexOrThrow("notes").let { if (c.isNull(it)) null else c.getString(it) },
    category = c.getColumnIndexOrThrow("category").let { if (c.isNull(it)) null else c.getString(it) },
    reminderOffsets = ScheduleReminders.validate(c.string("reminderOffsets").split(",").map { it.toInt() }),
    completedAt = c.getColumnIndexOrThrow("completedAt").let { if (c.isNull(it)) null else c.getLong(it) },
    excludedStarts = c.string("excludedStarts").let { raw ->
      if (raw.isEmpty()) emptyList() else ScheduleOccurrences.validate(raw.split(",").map { it.toLong() })
    }
  )
  private fun Cursor.string(name: String) = getString(getColumnIndexOrThrow(name))
  private fun Cursor.long(name: String) = getLong(getColumnIndexOrThrow(name))
  companion object {
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    fun addListener(listener: () -> Unit) { listeners.add(listener) }
    fun removeListener(listener: () -> Unit) { listeners.remove(listener) }
    fun notifyChanged() { listeners.forEach { listener -> runCatching { listener() } } }
  }
}
