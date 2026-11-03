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
  private fun record(id: String, title: String) = ScheduleRecord(id,"local","event",title,now.plusDays(1).toInstant().toEpochMilli(),createdAt=1,updatedAt=1)
}
