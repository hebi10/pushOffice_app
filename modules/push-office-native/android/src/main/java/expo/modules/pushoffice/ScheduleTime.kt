package expo.modules.pushoffice

import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Base64

object ScheduleTime {
  /** Return the first occurrence strictly after [after], always derived from original startAt. */
  fun nextOccurrence(record: ScheduleRecord, after: Long, zone: ZoneId): Long? {
    val recurrenceZone=record.anchorZone?.let { ZoneId.of(ScheduleZone.validate(it)) } ?: zone
    if (record.startAt > after) return record.startAt
    if (record.repeatType == "none") return null
    val anchor = Instant.ofEpochMilli(record.startAt).atZone(recurrenceZone).toLocalDateTime()
    val reference = Instant.ofEpochMilli(after).atZone(recurrenceZone).toLocalDateTime()
    var steps = when (record.repeatType) {
      "monthly" -> ChronoUnit.MONTHS.between(anchor.toLocalDate().withDayOfMonth(1), reference.toLocalDate().withDayOfMonth(1))
      "yearly" -> (reference.year - anchor.year).toLong()
      else -> throw IllegalArgumentException("지원하지 않는 반복 방식입니다.")
    }.coerceAtLeast(0)
    while (true) {
      val local = if (record.repeatType == "monthly") anchor.plusMonths(steps) else anchor.plusYears(steps)
      val candidate = local.atZone(recurrenceZone).toInstant().toEpochMilli()
      if (candidate > after) return candidate
      steps++
    }
  }
  fun validate(record: ScheduleRecord, now: Long, allowPast: Boolean = false) {
    record.anchorZone?.let(ScheduleZone::validate)
    require(record.id.isNotBlank() && record.id.length <= 256) { "일정 ID가 올바르지 않습니다." }
    require(record.userId.isNotBlank()) { "사용자 ID가 필요합니다." }
    require(record.title.isNotBlank() && record.title.length <= 500) { "일정 제목을 입력해 주세요 (500자 이하)." }
    require(record.type.isNotBlank()) { "일정 종류가 필요합니다." }
    require(record.repeatType in setOf("none", "monthly", "yearly")) { "지원하지 않는 반복 방식입니다." }
    require(record.startAt in 0..253402300799999L) { "시작 날짜가 올바르지 않습니다." }
    require(record.endAt == null || record.endAt in record.startAt..253402300799999L) { "종료 시간은 시작 시간 이후여야 합니다." }
    require(allowPast || !record.notificationEnabled || record.repeatType != "none" || record.startAt > now) { "과거 시간에 새 알림을 예약할 수 없습니다." }
    require(record.createdAt >= 0 && record.updatedAt >= 0) { "기록 시간이 올바르지 않습니다." }
  }
  /** Intent data participates in Android PendingIntent equality; hashCode alone can collide. */
  fun alarmIdentity(id: String, kind: String): String {
    val encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(id.toByteArray(Charsets.UTF_8))
    val encodedKind = Base64.getUrlEncoder().withoutPadding().encodeToString(kind.toByteArray(Charsets.UTF_8))
    return "pushoffice://alarm/$encodedKind/$encoded"
  }
}
