package expo.modules.pushoffice

import java.time.*
import java.time.temporal.TemporalAdjusters

data class ParsedSchedule(val title: String = "", val start: ZonedDateTime? = null, val repeatType: String = "none", val shiftMinutes: Int? = null, val error: String? = null)

/** Conservative local Korean grammar. Unknown/missing dates never acquire an implicit date. */
object ScheduleParser {
  fun parse(text: String, now: ZonedDateTime): ParsedSchedule {
    var remaining = text.trim()
    val shift = Regex("(?:한\\s*시간|1\\s*시간)\\s*(늦춰|늦추|뒤로|당겨|앞으로).*$").find(remaining)
    if (shift != null) {
      val title = remaining.removeRange(shift.range).trim()
      return ParsedSchedule(title=title, shiftMinutes=if (shift.groupValues[1] in listOf("당겨","앞으로")) -60 else 60,
        error=if(title.isBlank()) "변경할 일정 이름을 입력해 주세요." else null)
    }
    try {
      var repeat = "none"
      var date: LocalDate? = null
      fun consume(match: MatchResult) { remaining = remaining.replaceRange(match.range, " ").trim() }
      val yearly = Regex("매년\\s*(\\d{1,2})월\\s*(\\d{1,2})일").find(remaining)
      val monthly = Regex("매월\\s*(\\d{1,2})일").find(remaining)
      val absolute = Regex("(?:(\\d{4})년\\s*)?(\\d{1,2})월\\s*(\\d{1,2})일").find(remaining)
      val iso = Regex("(\\d{4})-(\\d{2})-(\\d{2})").find(remaining)
      val weekday = Regex("(다음\\s*주|이번\\s*주)?\\s*([월화수목금토일])요일").find(remaining)
      when {
        yearly != null -> {
          repeat = "yearly"
          val month = yearly.groupValues[1].toInt(); val day = yearly.groupValues[2].toInt()
          val md = MonthDay.of(month, day)
          date = (now.year..now.year+8).mapNotNull { y -> if(md.isValidYear(y)) md.atYear(y) else null }.first { !it.isBefore(now.toLocalDate()) }
          consume(yearly)
        }
        monthly != null -> {
          repeat = "monthly"; val day = monthly.groupValues[1].toInt()
          require(day in 1..31)
          date = (0L..24L).map { YearMonth.from(now).plusMonths(it) }.mapNotNull { if(day <= it.lengthOfMonth()) it.atDay(day) else null }.first { !it.isBefore(now.toLocalDate()) }
          consume(monthly)
        }
        absolute != null -> { date = LocalDate.of(absolute.groupValues[1].toIntOrNull() ?: now.year, absolute.groupValues[2].toInt(), absolute.groupValues[3].toInt()); consume(absolute) }
        iso != null -> { date = LocalDate.parse(iso.value); consume(iso) }
        remaining.contains("모레") -> { date=now.toLocalDate().plusDays(2); remaining=remaining.replace("모레", " ") }
        remaining.contains("내일") -> { date=now.toLocalDate().plusDays(1); remaining=remaining.replace("내일", " ") }
        remaining.contains("오늘") -> { date=now.toLocalDate(); remaining=remaining.replace("오늘", " ") }
        weekday != null -> {
          val day = DayOfWeek.of("월화수목금토일".indexOf(weekday.groupValues[2])+1)
          date = when {
            weekday.groupValues[1].startsWith("다음") -> now.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusWeeks(1).with(TemporalAdjusters.nextOrSame(day))
            weekday.groupValues[1].startsWith("이번") -> now.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).with(TemporalAdjusters.nextOrSame(day))
            else -> now.toLocalDate().with(TemporalAdjusters.nextOrSame(day))
          }; consume(weekday)
        }
      }
      val time = Regex("(?:(오전|오후|저녁|아침)\\s*)?(\\d{1,2})시(?:\\s*(반|\\d{1,2}분))?").find(remaining)
      val colon = Regex("(?<!\\d)(\\d{1,2}):(\\d{2})(?!\\d)").find(remaining)
      if(date == null) return ParsedSchedule(error="날짜를 입력하거나 아래에서 직접 지정해 주세요.")
      if(time == null && colon == null) return ParsedSchedule(error="시간을 입력하거나 아래에서 직접 지정해 주세요.")
      val hour: Int; val minute: Int
      if(time != null) {
        var h = time.groupValues[2].toInt(); val period=time.groupValues[1]
        if(period.isNotBlank()) { require(h in 1..12); h=h%12+if(period in listOf("오후","저녁")) 12 else 0 }
        hour=h; minute=if(time.groupValues[3]=="반") 30 else time.groupValues[3].removeSuffix("분").toIntOrNull() ?: 0
        consume(time)
      } else { hour=colon!!.groupValues[1].toInt(); minute=colon.groupValues[2].toInt(); consume(colon) }
      val start=date.atTime(LocalTime.of(hour,minute)).atZone(now.zone)
      val title=remaining.replace(Regex("\\s+")," ").trim().removeSuffix("등록해 줘").removeSuffix("추가해 줘").trim()
      require(title.isNotBlank()) { "일정 제목을 입력해 주세요." }
      require(start.toInstant().isAfter(now.toInstant())) { "미래 날짜와 시간을 지정해 주세요." }
      return ParsedSchedule(title,start,repeat)
    } catch (e: Exception) { return ParsedSchedule(error=e.message?.takeIf { it.contains("주세요") } ?: "날짜 또는 시간이 올바르지 않습니다. 직접 확인해 주세요.") }
  }
  fun targets(parsed: ParsedSchedule, schedules: List<ScheduleRecord>): List<ScheduleRecord> {
    if(parsed.error != null || parsed.title.isBlank()) return emptyList()
    val exact=schedules.filter { it.title.contains(parsed.title,ignoreCase=true) }
    if(exact.isNotEmpty()) return exact
    val withoutParticle=parsed.title.removeSuffix("을").removeSuffix("를").trim()
    return if(withoutParticle.isBlank() || withoutParticle==parsed.title) emptyList() else schedules.filter { it.title.contains(withoutParticle,ignoreCase=true) }
  }
}
