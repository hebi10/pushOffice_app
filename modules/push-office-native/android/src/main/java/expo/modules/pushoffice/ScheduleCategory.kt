package expo.modules.pushoffice

/** Stable local category IDs; null preserves the meaning of every pre-v3 record. */
internal object ScheduleCategory {
  val options: List<Pair<String?, String>> = listOf(
    null to "미분류", "work" to "업무", "personal" to "개인", "family" to "가족",
    "health" to "건강", "study" to "학습", "other" to "기타"
  )
  fun validate(value: String?): String? {
    require(options.any { it.first == value }) { "일정 카테고리를 확인해 주세요." }
    return value
  }
  fun fromMap(value: Map<String, Any?>): String? {
    val raw = value["category"] ?: return null
    require(raw is String) { "일정 카테고리를 확인해 주세요." }
    return validate(raw)
  }
}
