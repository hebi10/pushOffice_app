package expo.modules.pushoffice

object WidgetRefreshTime {
  /** Advance just past an event to drop it from Next, or refresh the date at midnight. */
  fun next(now: Long, midnight: Long, occurrence: Long?): Long =
    minOf(midnight, occurrence?.let { maxOf(now + 1_000, it + 1_000) } ?: midnight)
}
