package expo.modules.pushoffice

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.*
import org.junit.Test

class PoAi01ScheduleLanguageTest {
  private val zone = ZoneId.of("Asia/Seoul")
  private val now = ZonedDateTime.of(2026, 11, 24, 14, 10, 0, 0, zone)
  private fun exact(text: String, expected: String, title: String = "회의", repeat: String = "none") {
    val value = ScheduleParser.parse(text, now)
    assertNull(text, value.error)
    assertEquals(text, LocalDateTime.parse(expected), value.start?.toLocalDateTime())
    assertEquals(text, title, value.title)
    assertEquals(text, repeat, value.repeatType)
  }

  @Test fun groundedRelativeDatesAndKoreanHourWords() {
    exact("글피 오후 세 시 반 회의", "2026-11-27T15:30")
    exact("3일 뒤 오전 열한 시 회의", "2026-11-27T11:00")
    exact("이틀 후 오후 2:30 회의", "2026-11-26T14:30")
    exact("사흘 뒤 09:00 회의", "2026-11-27T09:00")
    exact("일주일 후 오전 아홉 시 회의", "2026-12-01T09:00")
    exact("다다음 주 월요일 오후 3시 회의", "2026-12-07T15:00")
    exact("다음 달 5일 오전 9시 회의", "2026-12-05T09:00")
    exact("이번 달 30일 18:00 회의", "2026-11-30T18:00")
    exact("다다음 달 2일 14:00 회의", "2027-01-02T14:00")
    exact("내년 1월 5일 오전 9시 회의", "2027-01-05T09:00")
    exact("2027-1-5 07:30 회의", "2027-01-05T07:30")
    exact("내일 정오 회의", "2026-11-25T12:00")
    exact("내일 오전 12시 회의", "2026-11-25T00:00")
    exact("내일 오후 12시 회의", "2026-11-25T12:00")
    exact("내일 오후 3:15 회의", "2026-11-25T15:15")
    exact("내일 새벽 5시 회의", "2026-11-25T05:00")
    exact("내일 밤 10시 회의", "2026-11-25T22:00")
    exact("내일 03시 회의", "2026-11-25T03:00")
    exact("내일오후3시 회의", "2026-11-25T15:00")
    exact("내일 오후 3시에 카페에서 회의 등록해 줘", "2026-11-25T15:00", "카페에서 회의")
    exact("매달 31일 오전 9시 회의", "2026-12-31T09:00", repeat="monthly")
    exact("매해 2월 29일 오전 9시 회의", "2028-02-29T09:00", repeat="yearly")
  }

  @Test fun ambiguousMalformedAndCompoundExpressionsNeverAcquireATimestamp() {
    val inputs = listOf(
      "내일 3시 회의", "내일 세 시 회의", "내일 3:30 회의", "내일 밤 3시 회의",
      "내일 자정 회의", "내일 밤 12시 회의", "내일 오후 13시 회의",
      "내일 오후 3시 90분 회의", "내일 오후 3시 300분 회의", "내일 25:00 회의",
      "내일 오후 3시쯤 회의", "내일 오후 3시부터 오후 5시까지 회의",
      "내일 오후 3~5시 회의", "내일 오후 3시와 오후 5시 회의",
      "내일 또는 모레 오후 3시 회의", "내일 11월 27일 오후 3시 회의",
      "다음 주 오후 3시 회의", "다음 달 초 오후 3시 회의",
      "11월 31일 오후 3시 회의", "2027년 2월 29일 오후 3시 회의",
      "어제 오후 3시 회의", "어제 말한 내일 오후 3시 회의",
      "내일 오후 3시 회의 취소", "내일 오후 3시로 변경됐습니다",
      "내일 오후 3시 회의 변경", "내일 회의 30분 늦춰",
      "격주 금요일 오후 3시 회의", "다음 달 30일 7시간 후 회의"
    )
    for (text in inputs) {
      val parsed = ScheduleParser.parse(text, now, LocalDate.of(2026, 12, 1))
      assertNotNull(text, parsed.error)
      assertNull(text, parsed.start)
      assertNull(text, parsed.shiftMinutes)
    }
    assertTrue(ScheduleParser.mentionsDate("다음 주 오후 3시 회의"))
    assertTrue(ScheduleParser.mentionsDate("12월 중순 오후 3시 회의"))
    assertFalse(ScheduleParser.mentionsDate("오후 세 시 회의"))
    val selected = ScheduleParser.parse("오후 세 시 회의", now, LocalDate.of(2026, 12, 1))
    assertEquals(LocalDateTime.parse("2026-12-01T15:00"), selected.start?.toLocalDateTime())
  }

  @Test fun shiftRequiresAnExplicitDurationAndNeverCreatesAnEvent() {
    for ((text, minutes) in listOf("회의 30분 늦춰" to 30, "회의 2시간 당겨 줘" to -120,
      "회의 한 시간 반 앞으로" to -90, "회의 1시간 15분 뒤로" to 75)) {
      val parsed = ScheduleParser.parse(text, now)
      assertNull(text, parsed.error)
      assertNull(text, parsed.start)
      assertEquals(text, minutes, parsed.shiftMinutes)
      assertEquals(text, "회의", parsed.title)
    }
    for (text in listOf("회의 0분 늦춰", "회의 25시간 늦춰", "회의 1시간 90분 늦춰")) {
      assertNotNull(text, ScheduleParser.parse(text, now).error)
    }
  }

  @Test fun notificationTriageUsesTheSameGrammarAndDoesNotCreateDuplicateChangeCandidates() {
    for (text in listOf("글피 오후 세 시 반 회의", "3일 후 오전 9시 치과 예약", "내일 정오 회의")) {
      val decision = NotificationIntentPolicy.classify("일정 안내", text, now)
      assertEquals(text, NotificationTriage.CONFIRMED_CANDIDATE, decision.triage)
      assertEquals(text, ScheduleParser.parse(text, now).start?.toInstant()?.toEpochMilli(), decision.startAt)
    }
    for (text in listOf("내일 3시 회의", "내일 오후 3시쯤 회의", "내일 오후 3시와 오후 5시 회의",
      "다음 달 초 회식", "내일 자정 회의")) {
      val decision = NotificationIntentPolicy.classify("일정 안내", text, now)
      assertEquals(text, NotificationTriage.NEEDS_CONFIRMATION, decision.triage)
      assertNull(text, decision.startAt)
    }
    val conflicting = NotificationIntentPolicy.classify("내일 오후 2시 회의", "내일 오후 3시 회의", now)
    assertEquals(NotificationTriage.NEEDS_CONFIRMATION, conflicting.triage)
    assertNull(conflicting.startAt)
    for (text in listOf("내일 오후 3시 회의 취소", "내일 오후 3시 회의 변경 안내",
      "내일 오후 3시로 변경됐습니다", "내일 오후 3시 인증번호 안내", "내일 오후 3시 배송")) {
      val decision = NotificationIntentPolicy.classify("일정 안내", text, now)
      assertEquals(text, NotificationTriage.DISCARD, decision.triage)
      assertNull(text, decision.startAt)
      assertTrue(decision.excerpt.isEmpty())
    }
    val truncated = "내일 오후 3시 회의 " + "가".repeat(500) + " 취소"
    assertEquals(NotificationTriage.DISCARD, NotificationIntentPolicy.classify("안내", truncated, now).triage)
  }

  @Test fun aiValidationCannotInventAnAnswerForAmbiguousOrMultipleDates() {
    for (text in listOf("내일 3시 회의", "내일 오후 3시쯤 회의", "내일 또는 모레 오후 3시 회의",
      "내일 오후 3시 회의 변경")) {
      assertThrows(IllegalArgumentException::class.java) {
        AiScheduleTime.validated(text, now, "회의", "2026-11-25", "15:00", "none")
      }
    }
    val result = AiScheduleTime.validated("글피 오후 세 시 반 회의", now, "회의", "2026-11-27", "15:30", "none")
    assertEquals(LocalDateTime.parse("2026-11-27T15:30"), result.start?.toLocalDateTime())
  }
}
