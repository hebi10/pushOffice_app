package expo.modules.pushoffice

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class LocalBackupRestoreTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()

  private fun fixture(id: String, title: String = "복원 확인"): ScheduleRecord {
    val now = System.currentTimeMillis()
    return ScheduleRecord(
      id = id, userId = "local", type = "event", title = title,
      startAt = now + 7 * 24 * 60 * 60 * 1000L,
      endAt = null, isAllDay = false, repeatType = "monthly",
      notificationEnabled = false, notificationId = null, sourceText = "",
      createdAt = now, updatedAt = now, anchorZone = "Asia/Seoul"
    )
  }

  @Test fun existingRecordsAreNeverOverwrittenAndRepeatImportAddsNothing() {
    val id = "backup-qa-" + UUID.randomUUID()
    ScheduleStore(context).use { store ->
      val original = fixture(id, "보존할 일정")
      assertEquals(1, store.importBackupRecords(listOf(original)))
      assertEquals(0, store.importBackupRecords(listOf(original.copy(title = "덮어쓰기 금지"))))
      assertEquals("보존할 일정", store.get(id)?.title)
      store.delete(id)
    }
  }

  @Test fun invalidBatchAddsNoRecords() {
    val first = fixture("backup-valid-" + UUID.randomUUID())
    val second = fixture("backup-invalid-" + UUID.randomUUID()).copy(
      endAt = System.currentTimeMillis()
    )
    ScheduleStore(context).use { store ->
      assertThrows(IllegalArgumentException::class.java) {
        store.importBackupRecords(listOf(first, second))
      }
      assertNull(store.get(first.id))
      assertNull(store.get(second.id))
    }
  }

  @Test fun duplicateIdsInOneBackupAreRejected() {
    val first = fixture("backup-duplicate-" + UUID.randomUUID())
    ScheduleStore(context).use { store ->
      assertThrows(IllegalArgumentException::class.java) {
        store.importBackupRecords(listOf(first, first))
      }
      assertNull(store.get(first.id))
    }
  }
}
