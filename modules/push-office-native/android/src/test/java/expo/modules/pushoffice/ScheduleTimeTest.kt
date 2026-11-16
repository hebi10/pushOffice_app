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
  @Test fun dailyAndWeeklyKeepOriginalLocalWallClockAndWeekday() {
    val daily = record(at("2026-11-16T09:00:00"), "daily")
    assertEquals(at("2026-11-17T09:00:00"), ScheduleTime.nextOccurrence(daily, at("2026-11-16T10:00:00"), zone))
    assertEquals(at("2026-11-23T09:00:00"), ScheduleTime.nextOccurrence(daily.copy(repeatType="weekly"), at("2026-11-16T10:00:00"), zone))
    assertEquals(at("2026-11-30T09:00:00"), ScheduleTime.nextOccurrence(daily.copy(repeatType="weekly"), at("2026-11-24T10:00:00"), zone))
  }

  @Test fun dailyAndWeeklyRemainAtLocalTimeAcrossDst() {
    val ny = ZoneId.of("America/New_York")
    fun atNewYork(value: String) = java.time.LocalDateTime.parse(value).atZone(ny).toInstant().toEpochMilli()
    val daily = record(atNewYork("2027-03-12T09:30:00"), "daily").copy(anchorZone = ny.id)
    assertEquals(atNewYork("2027-03-14T09:30:00"), ScheduleTime.nextOccurrence(daily, atNewYork("2027-03-13T10:00:00"), zone))
    val weekly = daily.copy(repeatType="weekly")
    assertEquals(atNewYork("2027-03-19T09:30:00"), ScheduleTime.nextOccurrence(weekly, atNewYork("2027-03-13T10:00:00"), zone))
  }

  @Test fun dailyAndWeeklyRecordsAcceptAnOptionalValidEnd() {
    val start = at("2026-11-16T13:00:00")
    ScheduleTime.validate(record(start, "daily", start + 3600000), start - 1)
    ScheduleTime.validate(record(start, "weekly", start + 3600000), start - 1)
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
