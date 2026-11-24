package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class ScheduleSideEffectsTest {
  @Test fun failedAlarmDoesNotPreventWidgetRefreshOrReportSaveFailure() {
    val calls = mutableListOf<String>()
    val result = ScheduleSideEffects.reconcile(
      alarms = { calls.add("alarm"); error("injected failure") },
      widgets = { calls.add("widget") })
    assertEquals(listOf("alarm", "widget"), calls)
    assertFalse(result.alarmsReady)
    assertTrue(result.widgetsReady)
  }

  @Test fun cancellationFailureStillReconcilesAndManualRetryCanSucceed() {
    var reconciled = false
    val result = ScheduleSideEffects.reconcile(
      beforeAlarms = { error("injected cancellation failure") },
      alarms = { reconciled = true },
      widgets = { error("injected widget failure") })
    assertTrue(reconciled)
    assertFalse(result.alarmsReady)
    assertFalse(result.widgetsReady)
    assertTrue(ScheduleSideEffects.reconcile(alarms = {}, widgets = {}).ready)
  }
}
