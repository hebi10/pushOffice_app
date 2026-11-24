package expo.modules.pushoffice

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.*
import org.junit.Test

class ScheduleOccurrencesTest {
  private val zone = ZoneId.of("Asia/Seoul")
  private val start = ZonedDateTime.of(2027,1,31,9,0,0,0,zone).toInstant().toEpochMilli()
  private val base = ScheduleRecord("series","local","event","반복 일정",start,repeatType="monthly",
    createdAt=1,updatedAt=2,anchorZone=zone.id,reminderOffsets=listOf(0,30))
  @Test fun skippedAnchorsAndMonthEndsNeverAppearInNextOccurrenceOrLeadAlarms() {
    val feb = ZonedDateTime.of(2027,2,28,9,0,0,0,zone).toInstant().toEpochMilli()
    val mar = ZonedDateTime.of(2027,3,31,9,0,0,0,zone).toInstant().toEpochMilli()
    val changed = base.copy(excludedStarts=listOf(start,feb))
    assertEquals(mar,ScheduleTime.nextOccurrence(changed,start-1,zone))
    assertEquals(mar-30*60_000L,ScheduleReminders.next(changed,start-86400000L,zone,30))
    assertEquals(mar,ScheduleTime.nextOccurrence(changed,feb-1,zone))
    assertEquals(feb,ScheduleTime.nextOccurrence(base,start,zone))
    ScheduleOccurrences.requireEditable(base,feb,2,zone)
    assertThrows(IllegalArgumentException::class.java) { ScheduleOccurrences.requireEditable(changed,feb,2,zone) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleOccurrences.requireEditable(base,feb+1,2,zone) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleOccurrences.requireEditable(base,feb,1,zone) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleOccurrences.requireEditable(base.copy(completedAt=1),feb,2,zone) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleTime.validate(base.copy(repeatType="none",excludedStarts=listOf(start)),1,true) }
  }
  @Test fun exclusionInputRejectsDuplicatesInvalidEpochsAndOverLimit() {
    assertEquals(emptyList<Long>(),ScheduleOccurrences.fromMap(emptyMap()))
    assertEquals(listOf(1L,2L),ScheduleOccurrences.fromMap(mapOf("excludedStarts" to listOf(2.0,1.0))))
    for (value in listOf(listOf(1L,1L),listOf(-1L),listOf(Long.MAX_VALUE),List(4097){it.toLong()})) {
      assertThrows(IllegalArgumentException::class.java) { ScheduleOccurrences.validate(value) }
    }
    assertThrows(IllegalArgumentException::class.java) { ScheduleOccurrences.fromMap(mapOf("excludedStarts" to listOf(1.1))) }
  }
}
