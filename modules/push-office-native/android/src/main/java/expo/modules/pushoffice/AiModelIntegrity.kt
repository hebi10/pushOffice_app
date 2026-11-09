package expo.modules.pushoffice

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/** Full-file verification, never trusts a stored digest string without recomputing it. */
internal object AiModelIntegrity {
  fun matches(file: File, expectedBytes: Long, expectedSha256: String): Boolean {
    if (!file.isFile || expectedBytes <= 0 || file.length() != expectedBytes ||
        !expectedSha256.matches(Regex("[a-f0-9]{64}"))) return false
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).buffered(1024 * 1024).use { stream ->
      val buffer = ByteArray(1024 * 1024)
      while (true) {
        val count = stream.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    val bytes = expectedSha256.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    return MessageDigest.isEqual(digest.digest(), bytes)
  }
}
