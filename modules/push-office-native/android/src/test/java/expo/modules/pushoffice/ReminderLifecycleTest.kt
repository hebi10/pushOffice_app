package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class ReminderLifecycleTest {
  private fun record(enabled: Boolean) = ScheduleRecord("event", "local", "schedule", "회의", 100,
    notificationEnabled = enabled, createdAt = 0, updatedAt = 0)
  @Test fun staggeredInexactDeliveryDoesNotDiscardTheOtherDueOneShot() {
    val first = ReminderReservation("first", "reminder", 100, "v1", "first-token")
    val second = ReminderReservation("second", "reminder", 200, "v1", "second-token")
    val reservations = mutableMapOf(first.id to first, second.id to second)
    // Both are due at 500; consuming first must leave the second deliverable even though nextOccurrence is null.
    assertTrue(ReminderLifecycle.matches(reservations[first.id], "first-token", "v1"))
    reservations.remove(first.id)
    val restored = ReminderLifecycle.choose(reservations[second.id], second.id, "reminder", "v1", null)
    assertEquals(second, restored)
    assertTrue(ReminderLifecycle.matches(restored, "second-token", "v1"))
  }
  @Test fun obsoleteOccurrenceCannotNotifyAfterEditDisableDeleteOrReplacement() {
    val old = ReminderReservation("event", "reminder", 100, "before-edit", "old-token")
    val edited = ReminderLifecycle.choose(old, "event", "reminder", "after-edit", 900)!!
    assertFalse(ReminderLifecycle.matches(edited, "old-token", "after-edit"))
    assertFalse(ReminderLifecycle.matches(old, "old-token", "disabled-version"))
    assertFalse(ReminderLifecycle.matches(null, "old-token", "before-edit"))
    assertTrue(ReminderLifecycle.matches(edited, edited.token, "after-edit"))
    val recreated = ReminderLifecycle.choose(null, "event", "reminder", "before-edit", 100)!!
    assertFalse(ReminderLifecycle.matches(recreated, "old-token", "before-edit"))
  }
  @Test fun disabledHistoricalOneShotCannotNewlyEnablePastNotifications() {
    assertThrows(IllegalArgumentException::class.java) {
      ReminderLifecycle.validateSave(record(true), record(false), 500, false)
    }
    ReminderLifecycle.validateSave(record(false), record(false), 500, false)
    ReminderLifecycle.validateSave(record(true), null, 500, true) // explicit history import
  }
  @Test fun nativeMutationAndRecoveryCannotInterleaveInsideCriticalSection() {
    val firstEntered = CountDownLatch(1)
    val releaseFirst = CountDownLatch(1)
    val secondAttempting = CountDownLatch(1)
    val secondEntered = CountDownLatch(1)
    val failed = AtomicBoolean(false)
    val first = Thread {
      ScheduleSerial.withLock {
        firstEntered.countDown()
        if (!releaseFirst.await(3, TimeUnit.SECONDS)) failed.set(true)
      }
    }
    val second = Thread {
      firstEntered.await()
      secondAttempting.countDown()
      ScheduleSerial.withLock { secondEntered.countDown() }
    }
    first.start(); second.start()
    try {
      assertTrue(secondAttempting.await(1, TimeUnit.SECONDS))
      assertFalse("recovery entered while mutation held lock", secondEntered.await(100, TimeUnit.MILLISECONDS))
    } finally { releaseFirst.countDown(); first.join(2000); second.join(2000) }
    assertFalse(failed.get())
    assertEquals(0, secondEntered.count)
  }
}
