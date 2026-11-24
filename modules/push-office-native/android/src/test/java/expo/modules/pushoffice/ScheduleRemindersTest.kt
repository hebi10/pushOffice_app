package expo.modules.pushoffice

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.*
import org.junit.Test

class ScheduleRemindersTest {
  private val zone = ZoneId.of("Asia/Seoul")
  private val start = ZonedDateTime.of(2026, 12, 1, 9, 0, 0, 0, zone).toInstant().toEpochMilli()
  private val base = ScheduleRecord("test", "local", "event", "합성 일정", start,
    createdAt = 1, updatedAt = 2, anchorZone = zone.id, reminderOffsets = listOf(0, 10, 30, 1440))

  @Test fun validatesAndCanonicalizesAtMostFourExplicitOffsets() {
    assertEquals(listOf(0), ScheduleReminders.fromMap(emptyMap()))
    assertEquals(listOf(0, 10, 30, 1440), ScheduleReminders.fromMap(mapOf("reminderOffsets" to listOf(1440.0, 0.0, 30.0, 10.0))))
    for (invalid in listOf(emptyList<Int>(), listOf(0,0), listOf(7), listOf(0,5,10,15,30), listOf(-1))) {
      assertThrows(IllegalArgumentException::class.java) { ScheduleReminders.validate(invalid) }
    }
    for (invalid in listOf(listOf(10.5), listOf("10"), listOf(Double.NaN), null)) {
      assertThrows(IllegalArgumentException::class.java) { ScheduleReminders.fromMap(mapOf("reminderOffsets" to invalid)) }
    }
    assertThrows(IllegalArgumentException::class.java) { ScheduleReminders.completedAt(-1) }
  }

  @Test fun independentLeadTimesNeverCreatePastAlarmAndAdvanceRecurringAnchor() {
    assertEquals(start - 1440 * 60_000L, ScheduleReminders.next(base, start - 2 * 86400000L, zone, 1440))
    assertEquals(start - 30 * 60_000L, ScheduleReminders.next(base, start - 60 * 60_000L, zone, 30))
    assertNull(ScheduleReminders.next(base, start - 20 * 60_000L, zone, 30))
    assertEquals(start, ScheduleReminders.next(base, start - 20 * 60_000L, zone, 0))
    val daily = base.copy(repeatType = "daily")
    assertEquals(start + 86400000L - 30 * 60_000L, ScheduleReminders.next(daily, start - 20 * 60_000L, zone, 30))
    assertEquals(start, ScheduleReminders.next(daily, start - 20 * 60_000L, zone, 0))
    assertNull(ScheduleReminders.next(base.copy(notificationEnabled = false), start - 86400000L, zone, 0))
    assertNull(ScheduleReminders.next(base.copy(completedAt = start - 1), start - 86400000L, zone, 0))
    assertNull(ScheduleTime.nextOccurrence(daily.copy(completedAt = start), start, zone))
  }

  @Test fun uniqueKindsAndLateAdvanceDoesNotNotifyAfterEventStarts() {
    val kinds = ScheduleReminders.options.map(ScheduleReminders::kind)
    assertEquals(kinds.size, kinds.distinct().size)
    assertEquals("reminder", ScheduleReminders.kind(0))
    for (offset in ScheduleReminders.options) assertEquals(offset, ScheduleReminders.offset(ScheduleReminders.kind(offset)))
    assertNull(ScheduleReminders.offset("arbitrary"))
    val reservation = ReminderReservation(base.id, ScheduleReminders.kind(30), start - 30 * 60_000L, "v", "synthetic")
    assertTrue(ScheduleReminders.stillUseful(reservation, 30, start - 1))
    assertFalse(ScheduleReminders.stillUseful(reservation, 30, start))
    assertTrue(ScheduleReminders.stillUseful(reservation, 0, start + 86400000L))
  }

  @Test fun onlyDefaultUnchangedRecordsRecognizeLegacyVersionInputs() {
    val default = base.copy(reminderOffsets = listOf(0))
    val inputs = ScheduleReminders.compatibleVersionInputs(default)
    assertEquals(4, inputs.size)
    assertTrue(inputs.any { it.endsWith(", category=null)") })
    assertTrue(inputs.any { it.endsWith(", notes=null)") })
    assertEquals(2, ScheduleReminders.compatibleVersionInputs(base).size)
    assertTrue(base.toString() in ScheduleReminders.compatibleVersionInputs(base))
    val completed = default.copy(completedAt = start)
    assertEquals(2, ScheduleReminders.compatibleVersionInputs(completed).size)
    assertEquals(setOf(base.copy(excludedStarts=listOf(start)).toString()), ScheduleReminders.compatibleVersionInputs(base.copy(excludedStarts=listOf(start))))
  }
}
