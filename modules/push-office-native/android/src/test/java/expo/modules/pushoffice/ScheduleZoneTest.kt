package expo.modules.pushoffice

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.*
import org.junit.Test

class ScheduleZoneTest {
  private val newYork=ZoneId.of("America/New_York")
  @Test fun existingEditedRecordKeepsSeoulAnchorWhileDeviceIsNewYork() {
    assertEquals(ZoneId.of("Asia/Seoul"),ScheduleZone.resolve("Asia/Seoul",null,newYork))
  }
  @Test fun incomingZoneDoesNotSilentlyChangeAnExistingAnchor() {
    assertEquals(ZoneId.of("Asia/Seoul"),ScheduleZone.resolve("Asia/Seoul","America/New_York",newYork))
  }
  @Test fun newImportedRecordUsesExplicitLegacyZone() {
    assertEquals(ZoneId.of("Asia/Seoul"),ScheduleZone.resolve(null,"Asia/Seoul",newYork))
  }
  @Test fun newRecordWithoutZoneUsesActualDeviceIanaZone() {
    assertEquals(newYork,ScheduleZone.resolve(null,null,newYork))
  }
  @Test fun configuredIanaZonePrecedesDeviceButInvalidSettingsFallBack() {
    assertEquals(ZoneId.of("Asia/Seoul"),ScheduleZone.fallback("Asia/Seoul",newYork))
    assertEquals(newYork,ScheduleZone.fallback("broken",newYork))
    assertEquals(newYork,ScheduleZone.fallback(null,newYork))
  }
  @Test fun recurrenceProjectionPrefersCanonicalAnchorOverCurrentDeviceZone() {
    val anchor=ZonedDateTime.parse("2027-01-31T09:00:00+09:00[Asia/Seoul]").toInstant().toEpochMilli()
    val after=ZonedDateTime.parse("2027-02-01T00:00:00+09:00[Asia/Seoul]").toInstant().toEpochMilli()
    val expected=ZonedDateTime.parse("2027-02-28T09:00:00+09:00[Asia/Seoul]").toInstant().toEpochMilli()
    val record=ScheduleRecord("zone","local","event","월말",anchor,repeatType="monthly",createdAt=1,updatedAt=1,anchorZone="Asia/Seoul")
    assertEquals(expected,ScheduleTime.nextOccurrence(record,after,newYork))
    assertThrows(IllegalArgumentException::class.java) { ScheduleTime.nextOccurrence(record.copy(anchorZone="broken"),0,newYork) }
  }
  @Test fun bridgeRejectsInvalidIncomingAnchorInsteadOfIgnoringIt() {
    val value=mapOf<String,Any?>("id" to "test", "userId" to "local", "type" to "event", "title" to "회의", "startAt" to 2000L, "endAt" to null, "isAllDay" to false, "repeatType" to "none", "notificationEnabled" to true, "createdAt" to 1L, "updatedAt" to 1L, "anchorZone" to "Not/AZone")
    assertThrows(IllegalArgumentException::class.java) { ScheduleRecord.fromMap(value) }
  }
  @Test fun malformedOrOffsetOnlyIncomingZonesAreRejectedEvenOnExistingRecords() {
    for(zone in listOf("Not/AZone","","+09:00","GMT+09:00")) {
      assertThrows(IllegalArgumentException::class.java) { ScheduleZone.validate(zone) }
      assertThrows(IllegalArgumentException::class.java) { ScheduleZone.resolve("Asia/Seoul",zone,newYork) }
    }
  }
}
