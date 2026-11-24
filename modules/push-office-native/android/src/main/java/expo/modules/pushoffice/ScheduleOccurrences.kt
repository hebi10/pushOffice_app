package expo.modules.pushoffice

import java.time.ZoneId

/** Exceptions are immutable original occurrence instants, never shifted display dates. */
internal object ScheduleOccurrences {
  const val MAX_EXCLUSIONS = 4096
  const val MAX_EPOCH = 253402300799999L

  fun validate(values: List<Long>): List<Long> {
    require(values.size <= MAX_EXCLUSIONS && values.distinct().size == values.size &&
      values.all { it in 0..MAX_EPOCH }) { "제외 회차 정보가 올바르지 않습니다." }
    return values.sorted()
  }
  fun epoch(value: Any?): Long {
    val number = (value as? Number)?.toDouble() ?: throw IllegalArgumentException("회차 날짜를 확인해 주세요.")
    require(number.isFinite() && number % 1.0 == 0.0 && number in 0.0..MAX_EPOCH.toDouble()) {
      "회차 날짜를 확인해 주세요."
    }
    return number.toLong()
  }
  fun fromMap(value: Map<String, Any?>): List<Long> {
    if (!value.containsKey("excludedStarts")) return emptyList()
    val raw = value["excludedStarts"] as? List<*> ?: throw IllegalArgumentException("제외 회차 정보가 올바르지 않습니다.")
    require(raw.size <= MAX_EXCLUSIONS) { "제외 회차 수가 너무 많습니다." }
    return validate(raw.map(::epoch))
  }
  fun requireEditable(record: ScheduleRecord, at: Long, expectedUpdatedAt: Long, zone: ZoneId) {
    require(record.updatedAt == expectedUpdatedAt) { "일정이 변경되었습니다. 다시 열어 주세요." }
    require(record.repeatType != "none" && record.completedAt == null) { "진행 중인 반복 일정을 선택해 주세요." }
    require(at in record.startAt..MAX_EPOCH && at !in record.excludedStarts &&
      ScheduleTime.nextOccurrence(record, at - 1L, zone) == at) { "선택한 회차가 없거나 이미 변경되었습니다." }
    require(record.excludedStarts.size < MAX_EXCLUSIONS) { "개별 변경 한도에 도달했습니다. 새 반복 일정을 만들어 주세요." }
  }
}

internal data class OccurrenceMutation(val series: ScheduleRecord, val detached: ScheduleRecord?)
