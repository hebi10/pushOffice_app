package expo.modules.pushoffice

data class ScheduleRecord(
  val id: String,
  val userId: String,
  val type: String,
  val title: String,
  val startAt: Long,
  val endAt: Long? = null,
  val isAllDay: Boolean = false,
  val repeatType: String = "none",
  val notificationEnabled: Boolean = true,
  val notificationId: String? = null,
  val sourceText: String = "",
  val createdAt: Long,
  val updatedAt: Long,
  val anchorZone: String? = null
) {
  companion object {
    fun fromMap(value: Map<String, Any?>): ScheduleRecord {
      fun string(key: String): String = value[key] as? String ?: throw IllegalArgumentException("$key 값이 필요합니다.")
      fun epoch(key: String): Long {
        val number = value[key] as? Number ?: throw IllegalArgumentException("$key 값이 필요합니다.")
        val double = number.toDouble()
        require(double.isFinite() && double % 1.0 == 0.0 && double >= 0 && double <= 253402300799999.0) { "$key 날짜가 올바르지 않습니다." }
        return number.toLong()
      }
      fun boolean(key: String): Boolean = value[key] as? Boolean ?: throw IllegalArgumentException("$key 값이 필요합니다.")
      return ScheduleRecord(string("id"), string("userId"), string("type"), string("title"), epoch("startAt"),
        if (value["endAt"] == null) null else epoch("endAt"), boolean("isAllDay"), string("repeatType"),
        boolean("notificationEnabled"), value["notificationId"] as? String, value["sourceText"] as? String ?: "",
        epoch("createdAt"), epoch("updatedAt"),
        if(value.containsKey("anchorZone")) ScheduleZone.validate(string("anchorZone")) else null)
    }
  }
}
