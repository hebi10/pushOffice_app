package expo.modules.pushoffice

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.*
import org.junit.Test

class ScheduleTimeTest {
  private val zone = ZoneId.of("Asia/Seoul")
  private fun at(value: String) = ZonedDateTime.parse(value + "+09:00[Asia/Seoul]").toInstant().toEpochMilli()
  private fun record(start: Long, repeat: String = "none", end: Long? = null) = ScheduleRecord(
    id = "sample", userId = "local", type = "schedule", title = "회의", startAt = start,
    endAt = end, repeatType = repeat, createdAt = start, updatedAt = start
  )
  @Test fun monthlyRecurrenceRetainsJanuary31Anchor() {
    val schedule = record(at("2027-01-31T09:00:00"), "monthly")
    assertEquals(at("2027-02-28T09:00:00"), ScheduleTime.nextOccurrence(schedule, at("2027-02-01T00:00:00"), zone))
    assertEquals(at("2027-03-31T09:00:00"), ScheduleTime.nextOccurrence(schedule, at("2027-03-01T00:00:00"), zone))
  }
  @Test fun yearlyRecurrenceRetainsLeapDayAnchor() {
    val schedule = record(at("2024-02-29T09:00:00"), "yearly")
    assertEquals(at("2025-02-28T09:00:00"), ScheduleTime.nextOccurrence(schedule, at("2025-01-01T00:00:00"), zone))
    assertEquals(at("2028-02-29T09:00:00"), ScheduleTime.nextOccurrence(schedule, at("2028-01-01T00:00:00"), zone))
  }
  @Test fun rejectsPastNewOneShot() {
    assertThrows(IllegalArgumentException::class.java) { ScheduleTime.validate(record(1000), 2000) }
  }
  @Test fun rejectsEndBeforeStart() {
    assertThrows(IllegalArgumentException::class.java) { ScheduleTime.validate(record(4000, end = 3000), 2000) }
  }
  @Test fun pendingIntentIdentityIsStableAndDoesNotCollideForHashCollisionIds() {
    assertEquals(ScheduleTime.alarmIdentity("Aa", "reminder"), ScheduleTime.alarmIdentity("Aa", "reminder"))
    assertNotEquals(ScheduleTime.alarmIdentity("Aa", "reminder"), ScheduleTime.alarmIdentity("BB", "reminder"))
    assertNotEquals(ScheduleTime.alarmIdentity("Aa", "reminder"), ScheduleTime.alarmIdentity("Aa", "snooze"))
  }
}
