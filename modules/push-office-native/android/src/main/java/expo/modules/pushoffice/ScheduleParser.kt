package expo.modules.pushoffice

import java.time.*

data class ParsedSchedule(val title: String = "", val start: ZonedDateTime? = null, val repeatType: String = "none", val shiftMinutes: Int? = null, val error: String? = null)

/** Conservative local Korean grammar; ambiguous and compound input is never committed as one event. */
object ScheduleParser {
  fun parse(text: String, now: ZonedDateTime): ParsedSchedule = parse(text, now, null)

  private val shift = Regex("""(.+?)\s*(?:(한|\d{1,2})\s*시간(?:\s*(반|\d{1,2}\s*분))?|(\d{1,3})\s*분)\s*(늦춰|늦추|뒤로|당겨|앞으로)(?:\s*(?:줘|주세요|줘요|해 줘))?\s*[.!]?$""")

  /** Only a missing date may inherit the calendar selection; explicit user dates always win. */
  fun parse(text: String, now: ZonedDateTime, calendarDate: LocalDate?): ParsedSchedule {
    val source = text.trim()
    if (source.isBlank() || source.length > 4096) return ParsedSchedule(error="일정 문장을 확인해 주세요.")
    val shiftMatch = shift.matchEntire(source)
    if (shiftMatch != null) {
      val title = shiftMatch.groupValues[1].trim()
      val hours = shiftMatch.groupValues[2].let { if (it == "한") 1 else it.toIntOrNull() ?: 0 }
      val extra = shiftMatch.groupValues[3].let { if (it == "반") 30 else it.replace(Regex("""\s+"""), "").removeSuffix("분").toIntOrNull() ?: 0 }
      val onlyMinutes = shiftMatch.groupValues[4].toIntOrNull() ?: 0
      val minutes = hours * 60 + extra + onlyMinutes
      if (title.isBlank() || ScheduleLanguage.hasDate(title) || ScheduleLanguage.times(title).isNotEmpty() ||
          ScheduleLanguage.isChange(title) || extra !in 0..59 || minutes !in 1..1440) {
        return ParsedSchedule(error="변경할 일정과 시간 간격을 직접 확인해 주세요.")
      }
      return ParsedSchedule(title=title, shiftMinutes=if (shiftMatch.groupValues[5] in listOf("당겨", "앞으로")) -minutes else minutes)
    }
    if (ScheduleLanguage.isChange(source)) return ParsedSchedule(error="취소·변경된 일정은 기존 일정 상세에서 직접 수정하거나 삭제해 주세요.")

    try {
      val dates = ScheduleLanguage.dates(source)
      val times = ScheduleLanguage.times(source)
      if (dates.size > 1 || times.size > 1 || ScheduleLanguage.hasShortRange(source))
        return ParsedSchedule(error="여러 날짜·시간 또는 시간 범위가 있습니다. 일정을 하나씩 직접 확인해 주세요.")
      val dateToken = dates.singleOrNull()
      val time = times.singleOrNull()
      if (listOfNotNull(dateToken, time).any { ScheduleLanguage.isApproximate(source, it) })
        return ParsedSchedule(error="정확한 날짜와 시간을 직접 확인해 주세요.")
      var date: LocalDate? = null
      var repeat = "none"
      if (dateToken != null) {
        val resolved = ScheduleLanguage.resolveDate(dateToken.value, now)
        date = resolved.first; repeat = resolved.second
      }
      val extraRepeat = ScheduleLanguage.repeatWords(source).filter { token ->
        dateToken == null || token.range.first !in dateToken.range
      }
      if (extraRepeat.size > 1 || (repeat != "none" && extraRepeat.isNotEmpty()))
        return ParsedSchedule(error="반복 설정을 하나씩 확인해 주세요.")
      val repeatToken = extraRepeat.singleOrNull()
      if (repeatToken != null) {
        repeat = when (repeatToken.value) {
          "매일" -> "daily"
          "매주" -> "weekly"
          else -> return ParsedSchedule(error="반복 날짜를 직접 확인해 주세요.")
        }
      }
      val titlePart = ScheduleLanguage.stripTokens(source, listOfNotNull(dateToken, time, repeatToken))
      if (ScheduleLanguage.hasDate(titlePart))
        return ParsedSchedule(error="날짜 표현이 명확하지 않습니다. 날짜를 직접 확인해 주세요.")
      if (time == null) return ParsedSchedule(error="시간을 입력하거나 아래에서 직접 지정해 주세요.")
      if (Regex("""\d+\s*(?:시(?!간)|분(?!기)|시간)|\d+:\d+""").containsMatchIn(titlePart))
        return ParsedSchedule(error="시간 표현을 직접 확인해 주세요.")
      if (date == null && repeat == "daily") date = calendarDate ?: now.toLocalDate()
      if(date == null) date = calendarDate
      if(date == null) return ParsedSchedule(error="날짜를 입력하거나 아래에서 직접 지정해 주세요.")
      require(date.year in 1970..9999) { "날짜 범위를 확인해 주세요." }
      val clock = ScheduleLanguage.resolveTime(time)
      var nextDate: LocalDate = date
      if ((repeat == "daily" || repeat == "weekly") && nextDate.isBefore(now.toLocalDate())) {
        val days = java.time.temporal.ChronoUnit.DAYS.between(nextDate, now.toLocalDate())
        nextDate = nextDate.plusDays(if (repeat == "daily") days else (days / 7) * 7)
      }
      var start = ScheduleLanguage.strictStart(nextDate, clock, now.zone)
      if (!start.toInstant().isAfter(now.toInstant()) && repeat in setOf("daily", "weekly")) {
        nextDate = if (repeat == "daily") nextDate.plusDays(1) else nextDate.plusWeeks(1)
        start = ScheduleLanguage.strictStart(nextDate, clock, now.zone)
      }
      val title = titlePart.replace(Regex("""^(?:에|에는)\s+"""), "")
        .replace(Regex("""\s*(?:일정\s*)?(?:등록|추가|예약)\s*해\s*(?:줘|주세요|줘요)[.!]?$"""), "").trim()
      require(title.isNotBlank()) { "일정 제목을 입력해 주세요." }
      require(start.toInstant().isAfter(now.toInstant())) { "미래 날짜와 시간을 지정해 주세요." }
      return ParsedSchedule(title,start,repeat)
    } catch (e: Exception) {
      return ParsedSchedule(error=e.message?.takeIf { it.contains("주세요") } ?: "날짜 또는 시간이 올바르지 않습니다. 직접 확인해 주세요.")
    }
  }

  fun mentionsDate(text: String): Boolean = ScheduleLanguage.hasDate(text)

  fun targets(parsed: ParsedSchedule, schedules: List<ScheduleRecord>): List<ScheduleRecord> {
    if(parsed.error != null || parsed.title.isBlank()) return emptyList()
    val exact=schedules.filter { it.title.contains(parsed.title,ignoreCase=true) }
    if(exact.isNotEmpty()) return exact
    val withoutParticle=parsed.title.removeSuffix("을").removeSuffix("를").trim()
    return if(withoutParticle.isBlank() || withoutParticle==parsed.title) emptyList() else schedules.filter { it.title.contains(withoutParticle,ignoreCase=true) }
  }
}
