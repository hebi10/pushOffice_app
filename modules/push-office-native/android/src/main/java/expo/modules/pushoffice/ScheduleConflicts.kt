package expo.modules.pushoffice

import java.time.Instant
import java.time.ZoneId

internal data class ScheduleConflict(val id: String, val title: String, val startAt: Long, val proposedStart: Long) {
  fun toMap(): Map<String, Any> = mapOf("id" to id, "title" to title, "startAt" to startAt, "proposedStart" to proposedStart)
}
internal object ScheduleConflicts {
  const val MAX_REPORT = 8
  private const val HORIZON = 30L * 86400000L
  private const val DAY_LOOKBACK = 2L * 86400000L

  private data class Slot(val start: Long, val end: Long)
  private fun zone(record: ScheduleRecord, fallback: ZoneId) =
    record.anchorZone?.let(ZoneId::of) ?: fallback
  private fun duration(record: ScheduleRecord): Long = (record.endAt?.minus(record.startAt) ?: 0L).coerceAtLeast(0)
  private fun slot(record: ScheduleRecord, at: Long, fallback: ZoneId): Slot {
    val length = duration(record)
    val end = if (length > 0L) at + length else if (record.isAllDay) {
      val z = zone(record,fallback)
      Instant.ofEpochMilli(at).atZone(z).toLocalDate().plusDays(1).atStartOfDay(z).toInstant().toEpochMilli()
    } else at
    return Slot(at, end.coerceAtMost(ScheduleOccurrences.MAX_EPOCH).coerceAtLeast(at))
  }
  private fun overlap(a: Slot,b: Slot): Boolean = when {
    a.start == a.end && b.start == b.end -> a.start == b.start
    a.start == a.end -> a.start >= b.start && a.start < b.end
    b.start == b.end -> b.start >= a.start && b.start < a.end
    else -> a.start < b.end && b.start < a.end
  }

  /** First active occurrence + 30 elapsed days for a repeating draft; one-off checks the exact proposed slot. */
  fun find(draft: ScheduleRecord, records: List<ScheduleRecord>, now: Long, fallback: ZoneId,
    ignoreOccurrenceAt: Long? = null): List<ScheduleConflict> {
    if (draft.completedAt != null) return emptyList()
    val first = if (draft.repeatType == "none") draft.startAt
      else ScheduleTime.nextOccurrence(draft,now-1,zone(draft,fallback)) ?: return emptyList()
    val until = (first + HORIZON).coerceAtMost(ScheduleOccurrences.MAX_EPOCH)
    val result = mutableListOf<ScheduleConflict>()
    val active = records.filter { it.completedAt == null }.mapNotNull { record ->
      if (record.id != draft.id) record
      else if (ignoreOccurrenceAt != null && record.repeatType != "none")
        record.copy(excludedStarts = (record.excludedStarts + ignoreOccurrenceAt).distinct().sorted())
      else null
    }
    var current = first
    for (iteration in 0..31) {
      val proposed = slot(draft,current,fallback)
      for (other in active) {
        val lookback = if (other.isAllDay && duration(other)==0L) DAY_LOOKBACK else duration(other)
        var cursor = (proposed.start - lookback - 1L).coerceAtLeast(-1L)
        // A fixed duration needs at most two candidates; DST all-day lookback at most four.
        for (scan in 0..3) {
          val at = ScheduleTime.nextOccurrence(other,cursor,zone(other,fallback)) ?: break
          if (at > proposed.end) break
          if (overlap(proposed,slot(other,at,fallback))) {
            if (result.none { hit -> hit.id == other.id && hit.startAt == at && hit.proposedStart == current })
              result.add(ScheduleConflict(other.id,other.title,at,current))
            if (result.size >= MAX_REPORT) return result
            break
          }
          cursor = at
        }
      }
      if (draft.repeatType == "none") break
      val next = ScheduleTime.nextOccurrence(draft,current,zone(draft,fallback)) ?: break
      if (next > until) break
      current = next
    }
    return result
  }
}
