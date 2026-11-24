package expo.modules.pushoffice

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class NotificationCaptureQueueTest {
  @Test fun tenAndFiftyConsecutiveAlertsAreAcceptedInOrder() = runBlocking {
    for (count in listOf(10, 50)) {
      val queue = NotificationCaptureQueue<Int>()
      try {
        repeat(count) { assertTrue("Lost alert $it", queue.offer(it)) }
        assertEquals((0 until count).toList(), List(count) { queue.items.receive() })
      } finally { queue.cancel() }
    }
  }

  @Test fun overflowDoesNotEvictAcceptedAlertsAndCancellationClearsPendingItems() = runBlocking {
    val queue = NotificationCaptureQueue<Int>(2)
    assertTrue(queue.offer(1))
    assertTrue(queue.offer(2))
    assertFalse(queue.offer(3))
    assertEquals(1, queue.items.receive())
    assertTrue(queue.offer(4))
    assertEquals(2, queue.items.receive())
    queue.cancel()
    assertTrue(queue.items.tryReceive().isClosed)
    assertFalse(queue.offer(5))
  }
}
