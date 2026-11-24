package expo.modules.pushoffice

import java.time.ZoneId

/** Lead time in elapsed minutes; zero preserves the legacy reminder at event start. */
internal object ScheduleReminders {
  val options = listOf(0, 5, 10, 15, 30, 60, 120, 1440)
  val defaults = listOf(0)
  const val MAX_COUNT = 4
  fun validate(values: List<Int>): List<Int> {
    require(values.size in 1..MAX_COUNT && values.distinct().size == values.size && values.all { it in options }) {
      "알림 시점을 1~4개 선택해 주세요."
    }
    return values.sorted()
  }
  fun fromMap(value: Map<String, Any?>): List<Int> {
    if (!value.containsKey("reminderOffsets")) return defaults
    val raw = value["reminderOffsets"] as? List<*> ?: throw IllegalArgumentException("알림 시점을 확인해 주세요.")
    require(raw.size in 1..MAX_COUNT) { "알림 시점을 1~4개 선택해 주세요." }
    return validate(raw.map {
      val n = (it as? Number)?.toDouble() ?: throw IllegalArgumentException("알림 시점을 확인해 주세요.")
      require(n.isFinite() && n in 0.0..1440.0 && n % 1.0 == 0.0) { "알림 시점을 확인해 주세요." }
      n.toInt()
    })
  }
  fun completedAt(value: Any?): Long? {
    if (value == null) return null
    val n = (value as? Number)?.toDouble() ?: throw IllegalArgumentException("완료 시각을 확인해 주세요.")
    require(n.isFinite() && n % 1.0 == 0.0 && n in 0.0..253402300799999.0) { "완료 시각을 확인해 주세요." }
    return n.toLong()
  }
  fun kind(offset: Int): String = if (offset == 0) "reminder" else "reminder-before-$offset"
  fun offset(kindName: String): Int? = options.firstOrNull { kind(it) == kindName }
  fun notificationTag(id: String, kind: String): String =
    if (offset(kind)?.let { it > 0 } == true) ScheduleTime.alarmIdentity(id, kind) else id

  fun compatibleVersionInputs(record: ScheduleRecord): Set<String> {
    val current = record.toString()
    if (record.excludedStarts.isNotEmpty()) return setOf(current)
    val v4 = current.removeSuffix(", excludedStarts=[])") + ")"
    if (record.completedAt != null || record.reminderOffsets != defaults) return setOf(current, v4)
    val v3 = v4.removeSuffix(", reminderOffsets=[0], completedAt=null)") + ")"
    return if (record.category == null) setOf(current, v4, v3, v3.removeSuffix(", category=null)") + ")")
      else setOf(current, v4, v3)
  }

  fun label(offset: Int): String = when (offset) {
    0 -> "시작 시간"; 1440 -> "1일 전"; 120 -> "2시간 전"; 60 -> "1시간 전"
    else -> "${offset}분 전"
  }
  fun enabled(record: ScheduleRecord): Boolean = record.completedAt == null && record.notificationEnabled
  fun next(record: ScheduleRecord, now: Long, zone: ZoneId, offset: Int): Long? {
    if (!enabled(record) || offset !in record.reminderOffsets) return null
    val lead = offset * 60_000L
    val occurrence = ScheduleTime.nextOccurrence(record, now + lead, zone) ?: return null
    return (occurrence - lead).takeIf { it > now }
  }
  fun stillUseful(reservation: ReminderReservation, offset: Int, now: Long): Boolean =
    offset == 0 || now < reservation.at + offset * 60_000L
}
