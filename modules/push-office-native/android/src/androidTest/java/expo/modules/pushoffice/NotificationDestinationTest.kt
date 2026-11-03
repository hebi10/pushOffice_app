package expo.modules.pushoffice

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test

class NotificationDestinationTest {
  @Test fun scheduleDestinationEncodesIdAndUsesPackageScopedViewIntent() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val intent = ReminderNotifications.openIntent(context, "회의/with space?#")
    assertEquals(Intent.ACTION_VIEW, intent.action)
    assertEquals(context.packageName, intent.`package`)
    assertEquals("pushofficeapp", intent.data?.scheme)
    assertEquals("schedule", intent.data?.host)
    assertEquals(listOf("회의/with space?#"), intent.data?.pathSegments)
    assertTrue(intent.flags and Intent.FLAG_ACTIVITY_CLEAR_TOP != 0)
  }
  @Test fun dailyBriefingDeliberatelyOpensHome() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    assertEquals("pushofficeapp:///", ReminderNotifications.openIntent(context, null).dataString)
  }
}
