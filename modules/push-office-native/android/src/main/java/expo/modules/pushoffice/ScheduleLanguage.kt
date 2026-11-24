package expo.modules.pushoffice

import java.time.*
import java.time.temporal.TemporalAdjusters

/** Single source of truth for native entry and notification triage. */
internal object ScheduleLanguage {
  private val digits = Regex("""\d+""")
  private val weekdayNames = "월화수목금토일"
  private val dayWords = mapOf("하루" to 1, "이틀" to 2, "사흘" to 3, "나흘" to 4, "일주일" to 7)
  private val hourWords = mapOf("한" to 1, "두" to 2, "세" to 3, "네" to 4, "다섯" to 5,
    "여섯" to 6, "일곱" to 7, "여덟" to 8, "아홉" to 9, "열" to 10, "열한" to 11, "열두" to 12)
  private val datePattern = Regex(
    """(?:매년|매해)\s*\d{1,2}월\s*\d{1,2}일|(?:매월|매달)\s*\d{1,2}일|매주\s*[월화수목금토일]요일|(?:다다음|다음|이번)\s*주\s*[월화수목금토일]요일|(?:이번|다음|다다음)\s*달\s*\d{1,2}일|(?:올해|내년)\s*\d{1,2}월\s*\d{1,2}일|(?<!\d)\d{4}-\d{1,2}-\d{1,2}(?!\d)|(?<!\d)(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일|(?<!\d)\d{1,3}일\s*(?:뒤|후)|(?:하루|이틀|사흘|나흘|일주일)\s*(?:뒤|후)|(?<![가-힣])(?:오늘|내일|모레|글피)|[월화수목금토일]요일"""
  )
  private val dateCue = Regex("""오늘|내일|모레|글피|어제|그제|지난\s*(?:주|달|해)|저번\s*(?:주|달)|(?:다다음|다음|이번)\s*(?:주|달|분기)|올해|내년|주말|평일|[월화수목금토일]요일|(?<!\d)\d{1,4}\s*(?:년|월|일)(?!정)|\d{1,4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|매(?:일|주|월|달|년|해)""")
  private val timePattern = Regex(
    """(?<![\d:])(?:(오전|오후|아침|저녁|새벽|밤)\s*)?(?:(\d{1,2}):(\d{2})(?![\d:])|(\d{1,2}|열두|열한|열|아홉|여덟|일곱|여섯|다섯|네|세|두|한)\s*시(?!간|작|스템)(?:\s*(반|\d{1,2}\s*분))?)|정오|자정"""
  )
  private val timeCue = Regex("""오전|오후|아침|저녁|새벽|밤|점심|정오|자정|퇴근|(?<!\d)\d{1,3}\s*(?:시|시간|분)|(?<!\d)\d{1,2}:\d{1,2}""")
  private val approximate = Regex("""^\s*(?:쯤|정도|무렵|전후|경(?=\s|$)|부터|까지|이후|이전)""")
  private val shortRange = Regex("""\d{1,2}\s*(?:~|～|–|—|-|에서|부터)\s*\d{1,2}\s*(?:시|분)""")
  private val change = Regex("""취소|무산|연기|철회|(?:일정|시간|날짜|예약|회의|미팅|약속|면접|수업|모임)\s*(?:변경|수정|조정)|(?:으로|로)\s*변경|변경(?:됐|되었|해|합니다|됨|\s*안내)|바뀌|바꿔|바꾸|미뤄|미루|앞당|늦춰|늦추|당겨|뒤로\s*옮|앞으로\s*옮""")
  private val repeatPattern = Regex("""매주말|평일마다|주말마다|매일|매주|매월|매달|매년|매해|격주""")

  fun dates(text: String): List<MatchResult> = datePattern.findAll(text).toList()
  fun times(text: String): List<MatchResult> = timePattern.findAll(text).toList()
  fun hasDate(text: String): Boolean = dateCue.containsMatchIn(text) || dates(text).isNotEmpty()
  fun hasTime(text: String): Boolean = times(text).isNotEmpty() || timeCue.containsMatchIn(text)
  fun isChange(text: String): Boolean = change.containsMatchIn(text)
  fun isApproximate(text: String, token: MatchResult): Boolean =
    approximate.containsMatchIn(text.substring(token.range.last + 1))
  fun hasShortRange(text: String): Boolean = shortRange.containsMatchIn(text)
  fun repeatWords(text: String): List<MatchResult> = repeatPattern.findAll(text).toList()

  /** A date token owns attached repeat words; no nested date selection. */
  fun resolveDate(token: String, now: ZonedDateTime): Pair<LocalDate, String> {
    val compact = token.replace(Regex("""\s+"""), "")
    val values = digits.findAll(compact).map { it.value.toInt() }.toList()
    val today = now.toLocalDate()
    fun weekday(value: String): DayOfWeek =
      DayOfWeek.of(weekdayNames.indexOf(value[value.length - 3]) + 1)
    fun monthly(day: Int): LocalDate {
      require(day in 1..31)
      return (0L..24L).map { YearMonth.from(today).plusMonths(it) }
        .mapNotNull { if (day <= it.lengthOfMonth()) it.atDay(day) else null }
        .first { !it.isBefore(today) }
    }
    fun yearly(month: Int, day: Int): LocalDate {
      val md = MonthDay.of(month, day)
      return (today.year..today.year + 8).mapNotNull { if (md.isValidYear(it)) md.atYear(it) else null }
        .first { !it.isBefore(today) }
    }
    return when {
      compact.startsWith("매년") || compact.startsWith("매해") ->
        yearly(values[0], values[1]) to "yearly"
      compact.startsWith("매월") || compact.startsWith("매달") ->
        monthly(values.single()) to "monthly"
      compact.startsWith("매주") ->
        today.with(TemporalAdjusters.nextOrSame(weekday(compact))) to "weekly"
      compact.endsWith("요일") -> {
        val day = weekday(compact)
        val week = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val date = when {
          compact.startsWith("다다음주") -> week.plusWeeks(2).with(TemporalAdjusters.nextOrSame(day))
          compact.startsWith("다음주") -> week.plusWeeks(1).with(TemporalAdjusters.nextOrSame(day))
          compact.startsWith("이번주") -> week.with(TemporalAdjusters.nextOrSame(day))
          else -> today.with(TemporalAdjusters.nextOrSame(day))
        }
        date to "none"
      }
      compact.startsWith("이번달") || compact.startsWith("다음달") || compact.startsWith("다다음달") -> {
        val offset = when {
          compact.startsWith("다다음달") -> 2L
          compact.startsWith("다음달") -> 1L
          else -> 0L
        }
        YearMonth.from(today).plusMonths(offset).atDay(values.single()) to "none"
      }
      compact.startsWith("올해") || compact.startsWith("내년") ->
        LocalDate.of(today.year + if (compact.startsWith("내년")) 1 else 0, values[0], values[1]) to "none"
      compact.contains("-") && values.size == 3 ->
        LocalDate.of(values[0], values[1], values[2]) to "none"
      compact.contains("월") && compact.endsWith("일") ->
        if (values.size == 3) LocalDate.of(values[0], values[1], values[2]) to "none"
        else LocalDate.of(today.year, values[0], values[1]) to "none"
      compact.endsWith("후") || compact.endsWith("뒤") -> {
        val prefix = compact.dropLast(1)
        val days = dayWords[prefix] ?: values.single()
        require(days in 1..366) { "1~366일 이내 날짜를 확인해 주세요." }
        today.plusDays(days.toLong()) to "none"
      }
      else -> today.plusDays(when (compact) {
        "오늘" -> 0; "내일" -> 1; "모레" -> 2; "글피" -> 3
        else -> error("날짜를 직접 지정해 주세요.")
      }.toLong()) to "none"
    }
  }

  fun resolveTime(token: MatchResult): LocalTime {
    if (token.value == "정오") return LocalTime.NOON
    require(token.value != "자정") { "자정이 어느 날짜의 00:00인지 직접 확인해 주세요." }
    val period = token.groupValues[1]
    val colon = token.groupValues[2]
    val hourToken = colon.ifEmpty { token.groupValues[4] }
    var hour = hourToken.toIntOrNull() ?: requireNotNull(hourWords[hourToken])
    val minuteText = token.groupValues[5].replace(Regex("""\s+"""), "")
    val minute = if (colon.isNotEmpty()) token.groupValues[3].toInt()
      else if (minuteText == "반") 30 else minuteText.removeSuffix("분").toIntOrNull() ?: 0
    if (period.isNotEmpty()) {
      require(hour in 1..12)
      val colloquialRange = when (period) {
        "밤" -> 8..11
        "새벽" -> 1..6
        "아침" -> 5..11
        "저녁" -> 5..11
        else -> 1..12
      }
      require(hour in colloquialRange) { "오전·오후와 날짜를 직접 확인해 주세요." }
      hour = hour % 12 + if (period in setOf("오후", "저녁", "밤")) 12 else 0
    } else {
      require(hour == 0 || hour >= 13 || (hourToken.length == 2 &&
        (colon.isNotEmpty() || hourToken.startsWith("0")))) {
        "오전·오후를 확인해 주세요. 24시간 형식(HH:mm)도 사용할 수 있습니다."
      }
    }
    return LocalTime.of(hour, minute)
  }

  fun strictStart(date: LocalDate, time: LocalTime, zone: ZoneId): ZonedDateTime {
    val local = date.atTime(time)
    val offsets = zone.rules.getValidOffsets(local)
    require(offsets.size == 1) { "해당 시간대의 날짜·시간을 직접 확인해 주세요." }
    return ZonedDateTime.ofStrict(local, offsets.single(), zone)
  }

  fun stripTokens(text: String, tokens: List<MatchResult>): String {
    var remaining = text
    for (token in tokens.sortedByDescending { it.range.first }) {
      val suffix = remaining.substring(token.range.last + 1)
      val particle = Regex("""^(?:에는|에|마다)(?=\s|$|[,.;])""").find(suffix)
      remaining = remaining.replaceRange(token.range.first,
        token.range.last + 1 + (particle?.value?.length ?: 0), " ")
    }
    return remaining.replace(Regex("""\s+"""), " ").trim()
  }
}
