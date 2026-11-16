package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class ScheduleExtrasTest {
  @Test fun optionalValuesStayNullableAndTrimmed() {
    assertNull(ScheduleExtras.location(null))
    assertNull(ScheduleExtras.location("  "))
    assertNull(ScheduleExtras.meetingUrl(""))
    assertNull(ScheduleExtras.notes("  "))
    assertEquals("3층 회의실", ScheduleExtras.location(" 3층 회의실 "))
    assertEquals("https://meet.example.org/room?token=abc", ScheduleExtras.meetingUrl(" https://meet.example.org/room?token=abc "))
    assertEquals("전화 통화\n기록", ScheduleExtras.notes(" 전화 통화\n기록 "))
  }

  @Test fun linksRequireHttpsValidHostAndNoEmbeddedCredentials() {
    for (value in listOf("http://meet.example.org/a", "javascript:alert(1)", "file:///etc/passwd",
        "https://user:pass@meet.example.org/x", "https://", "https://meet.example.org/a b",
        "https://meet.example.org/hi\nthere")) {
      assertThrows("Link must be rejected: $value", IllegalArgumentException::class.java) {
        ScheduleExtras.meetingUrl(value)
      }
    }
    assertThrows(IllegalArgumentException::class.java) { ScheduleExtras.meetingUrl("https://example.org/" + "x".repeat(2100)) }
  }

  @Test fun textLimitsAndControlCharactersAreEnforced() {
    assertThrows(IllegalArgumentException::class.java) { ScheduleExtras.location("a".repeat(161)) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleExtras.location("room\nnext") }
    assertThrows(IllegalArgumentException::class.java) { ScheduleExtras.notes("x".repeat(2001)) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleExtras.notes("before\u0000after") }
  }

  @Test fun oldNativeMapsWithoutExtrasRemainAcceptedAndMalformedValuesAreRejected() {
    val base = mapOf<String, Any?>(
      "id" to "legacy", "userId" to "local", "type" to "event", "title" to "이전 일정",
      "startAt" to 1820000000000L, "endAt" to null, "isAllDay" to false,
      "repeatType" to "monthly", "notificationEnabled" to false,
      "notificationId" to null, "sourceText" to "", "createdAt" to 1L,
      "updatedAt" to 1L, "anchorZone" to "Asia/Seoul"
    )
    val old = ScheduleRecord.fromMap(base)
    assertNull(old.location)
    assertNull(old.meetingUrl)
    assertNull(old.notes)
    val value = ScheduleRecord.fromMap(base + mapOf(
      "location" to "3층", "meetingUrl" to "https://meet.example.org/a", "notes" to "준비물"
    ))
    assertEquals("3층", value.location)
    assertEquals("https://meet.example.org/a", value.meetingUrl)
    assertEquals("준비물", value.notes)
    assertThrows(IllegalArgumentException::class.java) { ScheduleRecord.fromMap(base + ("notes" to 12)) }
    assertThrows(IllegalArgumentException::class.java) { ScheduleRecord.fromMap(base + ("meetingUrl" to "http://bad.example.org")) }
  }
}
