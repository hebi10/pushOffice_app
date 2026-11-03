package expo.modules.pushoffice

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/** One inexact non-wakeup reservation, independent of notification preferences. Doze may defer it. */
object WidgetRefreshScheduler {
  const val ACTION = "expo.modules.pushoffice.WIDGET_REFRESH"
  fun reserve(context: Context, at: Long?) {
    val manager = context.getSystemService(AlarmManager::class.java)
    val intent = Intent(context, ScheduleWidgetProvider::class.java).setAction(ACTION)
    if (at == null) {
      PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)?.let {
        manager.cancel(it); it.cancel()
      }
    } else {
      val pending = PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      manager.set(AlarmManager.RTC, at, pending)
    }
  }
}
