package expo.modules.pushoffice

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.time.ZonedDateTime
import java.time.ZoneId
import java.util.UUID

class DailyWeeklyPersistenceTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val zone = ZoneId.of("Asia/Seoul")

  @Test fun sqlitePreservesDailyWeeklyAnchorsAndExplicitEndTimeWithoutSchemaMigration() {
    val start = ZonedDateTime.now(zone).plusDays(9).withHour(15).withMinute(0).withSecond(0).withNano(0)
      .toInstant().toEpochMilli()
    for (repeat in listOf("daily", "weekly")) {
      val id = "func-12-03-" + UUID.randomUUID()
      val record = ScheduleRecord(id = id, userId = "local", type = "schedule",
        title = "반복 일정 저장", startAt = start, endAt = start + 90 * 60_000L,
        repeatType = repeat, notificationEnabled = false, sourceText = "",
        createdAt = System.currentTimeMillis(), updatedAt = System.currentTimeMillis(),
        anchorZone = zone.id)
      ScheduleStore(context).use { store ->
        try {
          store.save(record)
          val restored = store.get(id)!!
          assertEquals(record.repeatType, restored.repeatType)
          assertEquals(record.startAt, restored.startAt)
          assertEquals(record.endAt, restored.endAt)
          assertEquals("Asia/Seoul", restored.anchorZone)
          val next = ScheduleTime.nextOccurrence(restored, start, store.anchorZone(id))!!
          val expected = if (repeat == "daily") start + 24 * 60 * 60 * 1000L else start + 7 * 24 * 60 * 60 * 1000L
          assertEquals(expected, next)
        } finally {
          store.delete(id)
        }
      }
    }
  }
}
