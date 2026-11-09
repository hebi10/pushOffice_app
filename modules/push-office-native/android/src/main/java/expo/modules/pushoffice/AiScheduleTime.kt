package expo.modules.pushoffice

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

/** Device computes epoch. Model only extracts human-readable local date and time. */
internal object AiScheduleTime {
  fun validated(text: String, now: ZonedDateTime, title: String, date: String,
                time: String, repeat: String): ParsedSchedule {
    require(title.isNotBlank() && title.length <= 180) { "일정 제목을 다시 확인해 주세요." }
    require(date.matches(Regex("""\d{4}-\d{2}-\d{2}"""))) {
      "AI 날짜는 YYYY-MM-DD 형식이어야 합니다."
    }
    require(time.matches(Regex("""\d{2}:\d{2}"""))) {
      "AI 시각은 HH:mm 형식이어야 합니다."
    }
    require(repeat in listOf("none", "monthly", "yearly")) {
      "반복 설정을 다시 확인해 주세요."
    }
    val start = LocalDate.parse(date).atTime(LocalTime.parse(time)).atZone(now.zone)
    require(start.toInstant().isAfter(now.toInstant())) {
      "미래 날짜와 시간을 지정해 주세요."
    }
    val ground = ScheduleParser.parse(text, now)
    if (ground.error == null && ground.start != null && ground.shiftMinutes == null) {
      require(start.toInstant() == ground.start.toInstant() && repeat == ground.repeatType) {
        "AI가 날짜·시각이나 반복을 원문과 다르게 추출했습니다. 기본 해석이나 직접 입력을 이용해 주세요."
      }
    }
    val draft = ScheduleRecord("preview", "local", "event", title,
      start.toInstant().toEpochMilli(), repeatType=repeat,
      createdAt=now.toInstant().toEpochMilli(), updatedAt=now.toInstant().toEpochMilli())
    ScheduleTime.validate(draft, now.toInstant().toEpochMilli())
    return ParsedSchedule(title, start, repeat)
  }
}
