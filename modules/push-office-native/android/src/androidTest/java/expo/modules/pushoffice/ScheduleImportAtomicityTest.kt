package expo.modules.pushoffice

import android.content.Context
import android.content.ContextWrapper
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import java.io.File
import java.util.UUID
import org.junit.Assert.*
import org.junit.Test

/** Uses a unique test-only directory and real SQLite; never opens the user's default database. */
class ScheduleImportAtomicityTest {
  private class IsolatedContext(base: Context) : ContextWrapper(base) {
    val directory=File(base.cacheDir,"schedule-import-${UUID.randomUUID()}").apply { mkdirs() }
    override fun getApplicationContext(): Context = this
    override fun getDatabasePath(name: String): File = File(directory,name)
    override fun openOrCreateDatabase(name: String,mode: Int,factory: SQLiteDatabase.CursorFactory?): SQLiteDatabase =
      SQLiteDatabase.openOrCreateDatabase(getDatabasePath(name),factory)
    override fun openOrCreateDatabase(name: String,mode: Int,factory: SQLiteDatabase.CursorFactory?,errorHandler: DatabaseErrorHandler?): SQLiteDatabase =
      SQLiteDatabase.openOrCreateDatabase(getDatabasePath(name).absolutePath,factory,errorHandler)
    override fun deleteDatabase(name: String): Boolean = SQLiteDatabase.deleteDatabase(getDatabasePath(name))
  }
  private fun record(id: String,title: String=id)=ScheduleRecord(id,"local","event",title,System.currentTimeMillis()+3600000,
    createdAt=1,updatedAt=1,anchorZone="Asia/Seoul")

  @Test fun secondInsertFailureRollsBackWholeBatchAndPreservesExistingRows() {
    val context=IsolatedContext(ApplicationProvider.getApplicationContext())
    val store=ScheduleStore(context)
    var notifications=0
    val listener: ()->Unit = { notifications++ }
    try {
      val existing=store.save(record("existing"))
      store.writableDatabase.execSQL("CREATE TRIGGER reject_second BEFORE INSERT ON schedules WHEN NEW.id='second' BEGIN SELECT RAISE(ABORT, 'forced second insert failure'); END")
      ScheduleStore.addListener(listener)
      assertThrows(Exception::class.java) { store.importRecords(listOf(record("first"),record("second"))) }
      assertNull(store.get("first")); assertNull(store.get("second"))
      assertEquals(existing,store.get("existing"))
      assertEquals(0,notifications)
    } finally { ScheduleStore.removeListener(listener); store.close(); context.directory.deleteRecursively() }
  }

  @Test fun successfulBatchRetainsExistingIdsAndNotifiesAfterBothRowsCommit() {
    val context=IsolatedContext(ApplicationProvider.getApplicationContext())
    val store=ScheduleStore(context)
    var notifications=0
    val listener: ()->Unit = {
      assertNotNull(store.get("first")); assertNotNull(store.get("second")); notifications++
    }
    try {
      val existing=store.save(record("existing","original title"))
      ScheduleStore.addListener(listener)
      store.importRecords(listOf(record("existing","should not replace"),record("first"),record("second")))
      assertEquals(existing,store.get("existing"))
      assertEquals(1,notifications)
    } finally { ScheduleStore.removeListener(listener); store.close(); context.directory.deleteRecursively() }
  }
}
