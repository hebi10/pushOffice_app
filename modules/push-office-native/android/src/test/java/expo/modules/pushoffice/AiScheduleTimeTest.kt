package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class AiScheduleTimeTest {
  private val now = ZonedDateTime.of(2026,11,9,12,0,0,0,ZoneId.of("Asia/Seoul"))
  private val text = "2026년 11월 17일 오후 3시에 치과 예약"

  @Test fun exactLocalDateIsConvertedByJavaTime() {
    val actual = AiScheduleTime.validated(text, now, "치과 예약", "2026-11-17", "15:00", "none")
    assertEquals(2026, actual.start!!.year)
    assertEquals(11, actual.start!!.monthValue)
    assertEquals(17, actual.start!!.dayOfMonth)
    assertEquals(15, actual.start!!.hour)
    assertEquals(1794895200000L, actual.start!!.toInstant().toEpochMilli())
  }
  @Test fun incorrectFutureDateAndTimeAreRejected() {
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated(text, now, "치과 예약", "2026-11-18", "15:00", "none")
    }
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated(text, now, "치과 예약", "2026-11-17", "16:00", "none")
    }
  }
  @Test fun relativeDateIsGroundedAndUnsupportedDatesFailClosed() {
    val relative = AiScheduleTime.validated("내일 오후 3시에 치과 예약",
      now, "치과 예약", "2026-11-10", "15:00", "none")
    assertEquals(10, relative.start!!.dayOfMonth)
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated("다음 분기쯤 치과 예약", now,
        "치과 예약", "2026-11-17", "15:00", "none")
    }
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated("11월 17일 치과 예약", now,
        "치과 예약", "2026-11-17", "15:00", "none")
    }
  }

  @Test fun daylightSavingGapsAndOverlapsAreRejected() {
    val ny = ZoneId.of("America/New_York")
    val springNow = ZonedDateTime.of(2026, 3, 1, 12, 0, 0, 0, ny)
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated("2026년 3월 8일 오전 2시 30분에 치과 예약",
        springNow, "치과 예약", "2026-03-08", "02:30", "none")
    }
    val fallNow = ZonedDateTime.of(2026, 10, 30, 12, 0, 0, 0, ny)
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated("2026년 11월 1일 오전 1시 30분에 치과 예약",
        fallNow, "치과 예약", "2026-11-01", "01:30", "none")
    }
  }

  @Test fun repeatHallucinationAndImpossibleDateAreRejected() {
    assertThrows(IllegalArgumentException::class.java) {
      AiScheduleTime.validated(text, now, "치과 예약", "2026-11-17", "15:00", "yearly")
    }
    assertThrows(Exception::class.java) {
      AiScheduleTime.validated(text, now, "치과 예약", "2026-02-30", "15:00", "none")
    }
    assertThrows(Exception::class.java) {
      AiScheduleTime.validated(text, now, "치과 예약", "2026-11-17", "25:00", "none")
    }
  }
}
