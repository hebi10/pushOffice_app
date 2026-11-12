package expo.modules.pushoffice

import java.time.ZonedDateTime

/** Explicit three-way decision: an incomplete notification must never receive a fabricated startAt. */
internal enum class NotificationTriage { CONFIRMED_CANDIDATE, NEEDS_CONFIRMATION, DISCARD }

internal data class NotificationDecision(
  val triage: NotificationTriage,
  val excerpt: String = "",
  val title: String = "",
  val startAt: Long? = null
)

/** Fast local intent classification, before any AI model is considered. */
internal object NotificationIntentPolicy {
  private val irrelevant = Regex(
    """취소|무산|연기|철회|배송|택배|방송|생중계|뉴스|기사|특보|할인|쿠폰|광고|서버\s*점검|시스템\s*점검|경기\s*결과""",
    RegexOption.IGNORE_CASE
  )
  private val eventIntent = Regex(
    """예약|미팅|회의|약속|만나|만날|보자|면접|치과|병원|검진|예방접종|수업|교육|발표|식사|모임|동창회|운동|행사|기념일|공연|기차\s*출발|회식|영화\s*(?:볼|관람)|여행|상담|전화"""
  )
  private val weekday = Regex("""(?:이번\s*주|다음\s*주)?\s*[월화수목금토일]요일""")
  private val vagueDate = Regex("""이번\s*주|다음\s*주|주말|다음\s*달|이번\s*달|퇴근하고|어제\s*말한|12월\s*중순|다음\s*번""")

  fun classify(title: String, text: String, now: ZonedDateTime): NotificationDecision {
    val body = text.trim().take(480)
    if (body.isBlank() || NotificationSuggestionPolicy.isSensitive(title, body)) {
      return NotificationDecision(NotificationTriage.DISCARD)
    }
    val combined = "$title $body".trim().take(480)
    if (irrelevant.containsMatchIn(combined)) return NotificationDecision(NotificationTriage.DISCARD)

    val hasDate = NotificationSuggestionPolicy.hasDate(combined) || weekday.containsMatchIn(combined)
    val hasTime = NotificationSuggestionPolicy.hasTime(combined)
    val hasIntent = eventIntent.containsMatchIn(combined)
    val source = if (NotificationSuggestionPolicy.hasDate(body) && NotificationSuggestionPolicy.hasTime(body)) {
      body
    } else {
      combined
    }

    if (hasDate && hasTime) {
      val parsed = ScheduleParser.parse(source, now)
      if (parsed.error == null && parsed.shiftMinutes == null && parsed.start != null &&
          parsed.title.isNotBlank() && hasIntent) {
        return NotificationDecision(NotificationTriage.CONFIRMED_CANDIDATE,
          excerpt = source, title = parsed.title.trim().take(120),
          startAt = parsed.start.toInstant().toEpochMilli())
      }
    }
    if (hasIntent && (hasDate || hasTime || vagueDate.containsMatchIn(combined))) {
      return NotificationDecision(NotificationTriage.NEEDS_CONFIRMATION,
        excerpt = source, title = body.take(120), startAt = null)
    }
    if (hasDate && hasTime) {
      return NotificationDecision(NotificationTriage.NEEDS_CONFIRMATION,
        excerpt = source, title = body.take(120), startAt = null)
    }
    return NotificationDecision(NotificationTriage.DISCARD)
  }
}
