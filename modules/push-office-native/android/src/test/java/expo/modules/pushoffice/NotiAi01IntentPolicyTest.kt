package expo.modules.pushoffice

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.*
import org.junit.Test

class NotiAi01IntentPolicyTest {
  private val zone = ZoneId.of("Asia/Seoul")
  private val now = ZonedDateTime.of(2026, 11, 12, 10, 0, 0, 0, zone)

  @Test fun classifyAllSixtySyntheticNotificationsWithoutCreatingTimesForIncompleteCases() {
    val fixture = requireNotNull(javaClass.classLoader?.getResourceAsStream("noti-ai-01-triage-cases.tsv")) {
      "Missing NOTI-AI-01 synthetic regression fixture."
    }.use { it.bufferedReader(Charsets.UTF_8).readLines() }
    assertEquals(61, fixture.size)
    assertEquals(
      "id\tgroup\tapp\ttitle\tbody\texpected_local_start\texpected_repeat\texpected_triage",
      fixture.first()
    )
    val counted = mutableMapOf<String, Int>()
    for (row in fixture.drop(1)) {
      val fields = row.split('\t')
      assertEquals(8, fields.size)
      val id = fields[0]
      val group = fields[1]
      val expectedDate = fields[5]
      val expectedRepeat = fields[6]
      val expected = when (fields[7]) {
        "confirmed_candidate" -> NotificationTriage.CONFIRMED_CANDIDATE
        "needs_confirmation" -> NotificationTriage.NEEDS_CONFIRMATION
        "discard" -> NotificationTriage.DISCARD
        else -> throw IllegalArgumentException("Unexpected expected class for $id")
      }
      val actual = NotificationIntentPolicy.classify(fields[3], fields[4], now)
      assertEquals("Mismatched triage for synthetic case $id", expected, actual.triage)
      counted[group] = (counted[group] ?: 0) + 1
      when (expected) {
        NotificationTriage.CONFIRMED_CANDIDATE -> {
          val at = requireNotNull(actual.startAt) { "No verified start for $id" }
          val trusted = LocalDateTime.parse(expectedDate).atZone(zone).toInstant().toEpochMilli()
          assertEquals("Wrong local date/time for $id", trusted, at)
          val parsed = ScheduleParser.parse(actual.excerpt, now)
          assertEquals("Wrong repetition for $id", expectedRepeat, parsed.repeatType)
          assertTrue("Blank title for $id", actual.title.isNotBlank())
        }
        NotificationTriage.NEEDS_CONFIRMATION -> {
          assertNull("Incomplete event must not have an invented timestamp: $id", actual.startAt)
          assertTrue("Incomplete event must keep a reviewable title: $id", actual.title.isNotBlank())
          assertTrue("Incomplete event must keep original text for review: $id", actual.excerpt.isNotBlank())
        }
        NotificationTriage.DISCARD -> {
          assertNull("Discarded alert must not contain a date: $id", actual.startAt)
          assertTrue("No rejected text should reach candidate persistence: $id", actual.excerpt.isBlank())
        }
      }
    }
    assertEquals(24, counted["complete"])
    assertEquals(12, counted["incomplete"])
    assertEquals(14, counted["unrelated"])
    assertEquals(10, counted["sensitive"])
  }

  @Test fun sensitiveAndCancelledIntentsAreDiscardedBeforeAnyCandidatePersistence() {
    val blocked = listOf(
      "내일 오후 3시 OTP 123456",
      "내일 오전 9시 은행 상담 예약",
      "11월 18일 오후 2시 회의 취소",
      "다음 주 월요일 오후 4시 방송 생중계",
      "내일 오후 6시 배송 예정",
      "2026-11-16 14:00 보안코드 안내"
    )
    for (body in blocked) {
      val result = NotificationIntentPolicy.classify("알림", body, now)
      assertEquals(body, NotificationTriage.DISCARD, result.triage)
      assertNull(result.startAt)
    }
  }

  @Test fun ambiguousHourAlwaysRequiresUserChoiceAndNeverDefaultsToThreeAm() {
    val ambiguous = NotificationIntentPolicy.classify("친구", "토요일 3시에 만나자", now)
    assertEquals(NotificationTriage.NEEDS_CONFIRMATION, ambiguous.triage)
    assertNull(ambiguous.startAt)
    val clear = NotificationIntentPolicy.classify("친구", "금요일 오후 3시에 만나자", now)
    assertEquals(NotificationTriage.CONFIRMED_CANDIDATE, clear.triage)
    assertEquals(Instant.parse("2026-11-13T06:00:00Z").toEpochMilli(), clear.startAt)
  }

  @Test fun oldPrivateCandidateModelStillHasExplicitConfirmedMeaningWhileIncompleteIsNullable() {
    val old = NotificationSuggestion(
      id = "legacy", sourceApp = "친구", packageName = "local.example",
      excerpt = "내일 오후 3시 예약", title = "예약", startAt = 1_800_000_000_000L,
      receivedAt = 1_700_000_000_000L, analysis = "local_rules"
    )
    assertEquals("confirmed_candidate", old.triage)
    assertTrue(old.toMap()["startAt"] is Long)
    val incomplete = old.copy(startAt = null, triage = "needs_confirmation")
    assertNull(incomplete.toMap()["startAt"])
    assertEquals("needs_confirmation", incomplete.toMap()["triage"])
  }
}
