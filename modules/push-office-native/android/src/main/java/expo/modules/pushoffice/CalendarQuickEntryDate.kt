package expo.modules.pushoffice

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/** Calendar sends a civil date, never an epoch that could shift across time zones. */
internal object CalendarQuickEntryDate {
  const val EXTRA_DATE = "calendarSelectedDate"

  fun parse(value: String?): LocalDate? {
    if (value == null) return null
    require(Regex("""\d{4}-\d{2}-\d{2}""").matches(value)) {
      "캘린더 날짜는 YYYY-MM-DD 형식이어야 합니다."
    }
    val parsed = try { LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE) }
      catch (_: DateTimeParseException) { throw IllegalArgumentException("선택한 캘린더 날짜가 올바르지 않습니다.") }
    require(parsed.year in 1..9999 && parsed.toString() == value) {
      "선택한 캘린더 날짜가 올바르지 않습니다."
    }
    return parsed
  }
}
