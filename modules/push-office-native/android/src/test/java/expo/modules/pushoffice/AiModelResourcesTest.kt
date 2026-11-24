package expo.modules.pushoffice

import java.io.File
import java.security.MessageDigest
import java.util.concurrent.CancellationException
import org.junit.Assert.*
import org.junit.Test

class AiModelResourcesTest {
  private fun capacity(ramMb: Long, storageMb: Long, low: Boolean = false) =
    AiDeviceCapacity(ramMb * 1_000_000L, 8_000_000_000L, low, storageMb * 1_000_000L)

  @Test fun recommendationsRespectCurrentRamAndStorageWithoutAutoSelecting() {
    val low = capacity(1200, 2000)
    val states = AiModelCatalog.models.associate { it.id to "not_installed" }
    assertNull(AiModelResources.recommendedId(low, states))
    assertEquals("gemini-nano", AiModelResources.recommendedId(low, states + ("gemini-nano" to "available")))
    assertEquals("qwen3-06", AiModelResources.recommendedId(capacity(1800, 2000), states))
    assertEquals("qwen35-08", AiModelResources.recommendedId(capacity(3000, 0),
      states + ("qwen35-08" to "installed")))
    assertNull(AiModelResources.recommendedId(capacity(6000, 2000, low=true), states))
    assertNull(AiModelResources.recommendedId(capacity(3000, 100), states))
    assertFalse(low.memoryReady(AiModelCatalog.get("qwen3-06")))
    assertTrue(capacity(1400, 0).memoryReady(AiModelCatalog.get("qwen3-06")))
  }

  @Test fun multipleDownloadsReserveRemainingBytesAndFailClosedOnOverflow() {
    assertEquals(700L, AiModelResources.remaining(1000L,300L))
    assertEquals(1000L, AiModelResources.remaining(1000L,-1L))
    assertEquals(0L, AiModelResources.remaining(1000L,1500L))
    assertTrue(AiModelResources.enoughStorage(1_900_000_000L, 900_000_000L, listOf(700_000_000L)))
    assertFalse(AiModelResources.enoughStorage(1_899_999_999L, 900_000_000L, listOf(700_000_000L)))
    assertFalse(AiModelResources.enoughStorage(Long.MAX_VALUE, Long.MAX_VALUE, listOf(1L)))
    assertFalse(AiModelResources.enoughStorage(-1L, 500L, emptyList()))
  }

  @Test fun listCacheInvalidatesByIdentityVersionExpiryAndRemoval() {
    val cache = AiModelStatusCache(ttlMs=300)
    val stamp = ModelFileStamp("model", 100L, 10L, 1L, 2L, 3L, "a".repeat(64))
    assertFalse(cache.fresh("m", stamp, 100L))
    cache.record("m",stamp,100L)
    assertTrue(cache.fresh("m",stamp,399L))
    assertFalse(cache.fresh("m",stamp,400L))
    assertFalse(cache.fresh("m",stamp,99L))
    for (changed in listOf(stamp.copy(bytes=99), stamp.copy(modified=11), stamp.copy(inode=3),
      stamp.copy(changed=4), stamp.copy(expectedSha="b".repeat(64)))) {
      assertFalse(cache.fresh("m",changed,120L))
    }
    cache.invalidate("m")
    assertFalse(cache.fresh("m",stamp,120L))
  }

  @Test fun hashingCanBeCancelledAndNeverConvertsCancellationToCorruption() {
    val file = File.createTempFile("po-ai-hash", ".bin")
    try {
      val bytes = ByteArray(2 * 1024 * 1024) { 42 }
      file.writeBytes(bytes)
      val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
      var checks = 0
      assertThrows(CancellationException::class.java) {
        AiModelIntegrity.matches(file, bytes.size.toLong(), sha) {
          if (++checks == 2) throw CancellationException("test")
        }
      }
      assertEquals(2, checks)
      assertTrue(AiModelIntegrity.matches(file, bytes.size.toLong(), sha))
    } finally { file.delete() }
  }
}
