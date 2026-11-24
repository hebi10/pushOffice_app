package expo.modules.pushoffice

/** All editor/chooser/dialog width paths share the same positive viewport bound. */
internal object QuickEntryViewport {
  fun width(availablePx: Int, capPx: Int, full: Boolean): Int {
    val available = availablePx.coerceAtLeast(1)
    val desired = if (full) available else (available * .94).toInt()
    return desired.coerceIn(1, minOf(available, capPx.coerceAtLeast(1)))
  }
  fun scrollHeight(availablePx: Int, reservedPx: Int, minimumPx: Int): Int {
    val available = availablePx.coerceAtLeast(1)
    val minimum = minimumPx.coerceIn(1, available)
    return (available - reservedPx.coerceIn(0, available)).coerceIn(minimum, available)
  }
}
