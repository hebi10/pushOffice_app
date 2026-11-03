package expo.modules.pushoffice

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build

object ReminderNotifications {
  fun allowed(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(ReminderReceiver.CHANNEL, "일정 알림", NotificationManager.IMPORTANCE_HIGH))
    val channel = manager.getNotificationChannel(ReminderReceiver.CHANNEL)
    val groupEnabled = Build.VERSION.SDK_INT < 28 || channel?.group == null || manager.getNotificationChannelGroup(channel.group)?.isBlocked != true
    return NotificationReadiness.allowed(manager.areNotificationsEnabled(),
      Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
      channel?.importance != NotificationManager.IMPORTANCE_NONE, groupEnabled)
  }
  /** Data URI participates in PendingIntent identity and is handled by Expo on cold and warm starts. */
  fun openIntent(context: Context, scheduleId: String?): Intent = Intent(Intent.ACTION_VIEW,
    Uri.parse(if (scheduleId == null) "pushofficeapp:///" else "pushofficeapp://schedule/${Uri.encode(scheduleId)}"))
    .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
}
