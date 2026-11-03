package expo.modules.pushoffice

import android.content.Context
import java.time.LocalTime
import java.time.ZoneId

data class ReminderSettings(
  val pushEnabled: Boolean = true,
  val dailyBriefingEnabled: Boolean = false,
  val dailyBriefingTime: String = "08:00",
  val timezone: String = ZoneId.systemDefault().id
) {
  fun validate() {
    require(Regex("\\d{2}:\\d{2}").matches(dailyBriefingTime)) { "브리핑 시간은 HH:mm 형식이어야 합니다." }
    LocalTime.parse(dailyBriefingTime)
    ZoneId.of(timezone)
  }
  fun save(context: Context): Unit = ScheduleSerial.withLock {
    validate()
    context.getSharedPreferences("push_office_reminders", Context.MODE_PRIVATE).edit()
      .putBoolean("pushEnabled", pushEnabled).putBoolean("dailyBriefingEnabled", dailyBriefingEnabled)
      .putString("dailyBriefingTime", dailyBriefingTime).putString("timezone", timezone).commit()
    Unit
  }
  companion object {
    fun load(context: Context): ReminderSettings {
      val p = context.getSharedPreferences("push_office_reminders", Context.MODE_PRIVATE)
      return ReminderSettings(p.getBoolean("pushEnabled", true), p.getBoolean("dailyBriefingEnabled", false),
        p.getString("dailyBriefingTime", "08:00")!!, p.getString("timezone", ZoneId.systemDefault().id)!!)
    }
  }
}
