package expo.modules.pushoffice

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel

/** A single consumer processes bounded FIFO snapshots without blocking Android callbacks. */
internal class NotificationCaptureQueue<T>(capacity: Int = 128) {
  private val channel = Channel<T>(capacity)
  val items: ReceiveChannel<T> get() = channel
  fun offer(item: T): Boolean = channel.trySend(item).isSuccess
  fun cancel() { channel.cancel() }
}
