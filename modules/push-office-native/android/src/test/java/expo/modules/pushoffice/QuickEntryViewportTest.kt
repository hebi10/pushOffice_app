package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class QuickEntryViewportTest {
  @Test fun boundedWidthForPhoneTabletAndTinyMultiWindow() {
    assertEquals(376, QuickEntryViewport.width(400, 400, false))
    assertEquals(400, QuickEntryViewport.width(823, 400, false))
    assertEquals(320, QuickEntryViewport.width(320, 400, true))
    assertEquals(1, QuickEntryViewport.width(-20, 400, true))
    assertEquals(1, QuickEntryViewport.width(0, 0, false))
  }
  @Test fun scrollHeightRemainsPositiveAndNeverExceedsCurrentViewport() {
    assertEquals(600, QuickEntryViewport.scrollHeight(800, 200, 48))
    assertEquals(48, QuickEntryViewport.scrollHeight(160, 200, 48))
    assertEquals(20, QuickEntryViewport.scrollHeight(20, 200, 48))
    assertEquals(1, QuickEntryViewport.scrollHeight(0, 200, 48))
  }
}
