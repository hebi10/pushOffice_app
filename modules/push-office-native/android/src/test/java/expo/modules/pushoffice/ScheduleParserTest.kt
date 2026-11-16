package expo.modules.pushoffice

import java.time.*
import org.junit.Assert.*
import org.junit.Test

class ScheduleParserTest {
  private val zone = ZoneId.of("Asia/Seoul")
  private val now = ZonedDateTime.of(2026, 11, 3, 10, 0, 0, 0, zone)
  private fun parse(text: String) = ScheduleParser.parse(text, now)
  @Test fun relativeKoreanDateAndTime() {
    val result = parse("내일 오후 3시 30분 고객 미팅")
    assertEquals(LocalDateTime.of(2026,11,4,15,30), result.start?.toLocalDateTime())
    assertEquals("고객 미팅", result.title)
  }
  @Test fun nextWeekdayUsesNextWeek() {
    assertEquals(LocalDate.of(2026,11,9), parse("다음 주 월요일 오전 9시 회의").start?.toLocalDate())
  }
  @Test fun missingAndInvalidDatesAreRejected() {
    assertNotNull(parse("오후 3시 회의").error)
    assertNotNull(parse("2026년 2월 30일 오후 3시 회의").error)
    assertNotNull(parse("내일 회의").error)
    assertNotNull(parse("내일 오후 13시 회의").error)
  }
  @Test fun monthlyAndYearlyKeepExplicitAnchor() {
    val monthly = parse("매월 31일 오전 9시 결산")
    assertEquals("monthly", monthly.repeatType)
    assertEquals(LocalDate.of(2026,12,31), monthly.start?.toLocalDate())
    val yearly = parse("매년 2월 29일 오전 9시 기념일")
    assertEquals("yearly", yearly.repeatType)
    assertEquals(LocalDate.of(2028,2,29), yearly.start?.toLocalDate())
  }
  @Test fun dailyRuleChoosesNextFutureOccurrenceWithoutGuessingTime() {
    val daily = parse("매일 오후 3시 운동")
    assertEquals("daily", daily.repeatType)
    assertEquals(LocalDateTime.of(2026,11,3,15,0), daily.start?.toLocalDateTime())
    assertEquals("운동", daily.title)
    val after = ScheduleParser.parse("매일 오전 9시 운동", now)
    assertEquals(LocalDateTime.of(2026,11,4,9,0), after.start?.toLocalDateTime())
    assertNotNull(parse("매일 운동").error)
  }

  @Test fun weeklyRuleUsesExplicitWeekdayOrCalendarAnchor() {
    val weekly = parse("매주 금요일 오전 9시 회의")
    assertEquals("weekly", weekly.repeatType)
    assertEquals("회의", weekly.title)
    assertEquals(LocalDateTime.of(2026,11,6,9,0), weekly.start?.toLocalDateTime())
    val calendar = ScheduleParser.parse("매주 오후 2시 점검", now, LocalDate.of(2026,11,5))
    assertEquals("weekly", calendar.repeatType)
    assertEquals(LocalDate.of(2026,11,5), calendar.start?.toLocalDate())
    assertNotNull(parse("매주 오후 2시 점검").error)
  }

  @Test fun explicitDateCanAnchorDailyWithoutChangingTitle() {
    val daily = parse("매일 내일 오후 3시 고객 미팅")
    assertEquals("daily", daily.repeatType)
    assertEquals(LocalDate.of(2026,11,4), daily.start?.toLocalDate())
    assertEquals("고객 미팅", daily.title)
  }

  @Test fun shiftKeepsAllMatchingTargetsForUserChoice() {
    val result = parse("고객 미팅 한 시간 늦춰")
    assertEquals(60, result.shiftMinutes)
    val items = listOf(record("a", "고객 미팅"), record("b", "고객 미팅"), record("c", "다른 회의"))
    assertEquals(listOf("a","b"), ScheduleParser.targets(result, items).map { it.id })
  }
  @Test fun targetNameEndingInKoreanParticleIsPreserved() {
    assertEquals("가을",parse("가을 한 시간 당겨").title)
    assertEquals(-60,parse("가을 한 시간 당겨").shiftMinutes)
  }
  @Test fun selectedCalendarDayFillsOnlyMissingDate() {
    val selected = LocalDate.of(2026, 11, 20)
    val parsed = ScheduleParser.parse("오후 3시 치과 예약", now, selected)
    assertNull(parsed.error)
    assertEquals(LocalDateTime.of(2026, 11, 20, 15, 0), parsed.start?.toLocalDateTime())
    assertEquals("치과 예약", parsed.title)
    assertEquals("none", parsed.repeatType)
  }

  @Test fun explicitRelativeAndAbsoluteDatesOverrideCalendarSelection() {
    val selected = LocalDate.of(2026, 11, 20)
    val explicit = ScheduleParser.parse("2026년 11월 18일 오후 5시 회의", now, selected)
    assertEquals(LocalDate.of(2026, 11, 18), explicit.start?.toLocalDate())
    val tomorrow = ScheduleParser.parse("내일 오전 9시 회의", now, selected)
    assertEquals(LocalDate.of(2026, 11, 4), tomorrow.start?.toLocalDate())
    val monthly = ScheduleParser.parse("매월 29일 오후 2시 점검", now, selected)
    assertEquals("monthly", monthly.repeatType)
    assertEquals(LocalDate.of(2026, 11, 29), monthly.start?.toLocalDate())
  }

  @Test fun missingTimeAndInvalidExplicitDatesNeverBecomeAutoScheduled() {
    val selected = LocalDate.of(2026, 11, 20)
    assertNotNull(ScheduleParser.parse("치과 예약", now, selected).error)
    assertNotNull(ScheduleParser.parse("11월 20일 회의", now, selected).error)
    assertNotNull(ScheduleParser.parse("2026년 2월 30일 오후 3시 회의", now, selected).error)
    assertNotNull(ScheduleParser.parse("오후 3시 회의", now, null).error)
    assertTrue(ScheduleParser.mentionsDate("2026년 2월 30일 오후 3시 회의"))
    assertFalse(ScheduleParser.mentionsDate("오후 3시 회의"))
  }

  private fun record(id: String, title: String) = ScheduleRecord(id,"local","event",title,now.plusDays(1).toInstant().toEpochMilli(),createdAt=1,updatedAt=1)
}
