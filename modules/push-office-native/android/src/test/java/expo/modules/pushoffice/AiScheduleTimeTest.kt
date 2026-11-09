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
