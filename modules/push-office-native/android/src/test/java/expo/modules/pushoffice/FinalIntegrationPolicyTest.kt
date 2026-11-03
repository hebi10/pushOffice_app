package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class FinalIntegrationPolicyTest {
  @Test fun blockedAppChannelGroupOrRuntimePermissionNeverClaimsReadiness() {
    assertTrue(NotificationReadiness.allowed(true, true, true, true))
    assertFalse(NotificationReadiness.allowed(false, true, true, true)) // API26–32 app disabled
    assertFalse(NotificationReadiness.allowed(true, false, true, true)) // API33 permission denied
    assertFalse(NotificationReadiness.allowed(true, true, false, true))
    assertFalse(NotificationReadiness.allowed(true, true, true, false))
  }
  @Test fun widgetRefreshAdvancesAtNextEventOrMidnightWithoutPushDependency() {
    assertEquals(21_000L, WidgetRefreshTime.next(10_000, 100_000, 20_000))
    assertEquals(100_000L, WidgetRefreshTime.next(10_000, 100_000, 200_000))
    assertEquals(100_000L, WidgetRefreshTime.next(10_000, 100_000, null))
    assertEquals(11_000L, WidgetRefreshTime.next(10_000, 100_000, 10_000))
  }
}
