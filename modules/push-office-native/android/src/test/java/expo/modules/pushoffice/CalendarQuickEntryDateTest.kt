package expo.modules.pushoffice

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test

class CalendarQuickEntryDateTest {
  @Test fun validCalendarDatePreservesLocalDayWithoutEpochConversion() {
    assertEquals(LocalDate.of(2026, 11, 20), CalendarQuickEntryDate.parse("2026-11-20"))
    assertEquals(LocalDate.of(2028, 2, 29), CalendarQuickEntryDate.parse("2028-02-29"))
    assertNull(CalendarQuickEntryDate.parse(null))
  }

  @Test fun malformedNonCanonicalAndImpossibleDaysAreRejected() {
    for (value in listOf("", "2026-2-3", "2026-02-30", "2026-13-01", "0000-01-01",
      "2026-11-20T00:00:00Z", "2026-11-20extra", "2026/11/20", "not-a-date")) {
      assertThrows("Should reject $value", IllegalArgumentException::class.java) {
        CalendarQuickEntryDate.parse(value)
      }
    }
  }
}
