package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class AiModelIntegrityTest {
  @Test fun validEntireFilePassesAndOneChangedByteFails() {
    val file = File.createTempFile("po-model", ".litertlm")
    try {
      val content = ByteArray(64 * 1024) { (it % 251).toByte() }
      file.writeBytes(content)
      val expected = MessageDigest.getInstance("SHA-256").digest(content)
        .joinToString("") { "%02x".format(it) }
      assertTrue(AiModelIntegrity.matches(file, content.size.toLong(), expected))
      content[8192] = (content[8192].toInt() xor 0x01).toByte()
      file.writeBytes(content)
      assertFalse(AiModelIntegrity.matches(file, content.size.toLong(), expected))
    } finally { file.delete() }
  }

  @Test fun sizeMismatchAndMalformedHashFailClosed() {
    val file = File.createTempFile("po-model", ".litertlm")
    try {
      file.writeText("model-data")
      assertFalse(AiModelIntegrity.matches(file, 4, "a".repeat(64)))
      assertFalse(AiModelIntegrity.matches(file, 10, "invalid"))
      assertFalse(AiModelIntegrity.matches(file, 0, "a".repeat(64)))
    } finally { file.delete() }
  }
}
