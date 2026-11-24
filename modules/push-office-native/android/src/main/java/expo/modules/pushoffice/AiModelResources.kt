package expo.modules.pushoffice

/** Decimal MB, matching the model catalogue's published approximate file sizes. */
internal data class AiDeviceCapacity(
  val availableRamBytes: Long, val totalRamBytes: Long, val lowMemory: Boolean,
  val freeStorageBytes: Long
) {
  fun memoryReady(model: AiModelDefinition): Boolean =
    model.file == null || (!lowMemory && availableRamBytes >= model.minAvailableMb * 1_000_000L &&
      totalRamBytes >= model.minAvailableMb * 1_000_000L)

  fun estimatedStorageReady(model: AiModelDefinition): Boolean =
    model.file == null || freeStorageBytes >= model.approximateMb * 1_000_000L + AiModelResources.STORAGE_MARGIN
}

internal object AiModelResources {
  const val STORAGE_MARGIN = 300_000_000L

  /** Reserve other active transfers' remaining bytes, not just the requested model. */
  fun enoughStorage(freeBytes: Long, newBytes: Long, outstanding: List<Long>): Boolean {
    if (freeBytes < 0 || newBytes <= 0 || outstanding.any { it < 0 }) return false
    return try {
      val required = outstanding.fold(Math.addExact(newBytes, STORAGE_MARGIN)) { acc, bytes ->
        Math.addExact(acc, bytes)
      }
      freeBytes >= required
    } catch (_: ArithmeticException) { false }
  }

  fun remaining(expected: Long, downloaded: Long): Long =
    (expected.coerceAtLeast(0) - downloaded.coerceIn(0, expected.coerceAtLeast(0))).coerceAtLeast(0)

  /** A resource recommendation only; never an accuracy/speed ranking or automatic selection. */
  fun recommendedId(capacity: AiDeviceCapacity, states: Map<String, String>): String? {
    if (states["gemini-nano"] == "available") return "gemini-nano"
    val fitting = AiModelCatalog.models.filter { it.file != null && capacity.memoryReady(it) }
      .sortedBy { it.approximateMb }
    fitting.firstOrNull { states[it.id] == "installed" }?.let { return it.id }
    if (states["gemini-nano"] == "downloadable") return "gemini-nano"
    return fitting.firstOrNull {
      states[it.id] == "not_installed" && capacity.estimatedStorageReady(it)
    }?.id
  }
}

/** UI status only. A stamp never authorizes opening a model or selecting it. */
internal data class ModelFileStamp(
  val path: String, val bytes: Long, val modified: Long,
  val device: Long, val inode: Long, val changed: Long, val expectedSha: String
)
internal class AiModelStatusCache(private val ttlMs: Long = 300_000L) {
  private data class Entry(val stamp: ModelFileStamp, val checkedAt: Long)
  private val entries = mutableMapOf<String, Entry>()

  fun fresh(id: String, stamp: ModelFileStamp, now: Long): Boolean {
    val entry = entries[id] ?: return false
    return entry.stamp == stamp && now >= entry.checkedAt && now - entry.checkedAt < ttlMs
  }
  fun record(id: String, stamp: ModelFileStamp, now: Long) {
    entries[id] = Entry(stamp, now)
  }
  fun invalidate(id: String) { entries.remove(id) }
}
