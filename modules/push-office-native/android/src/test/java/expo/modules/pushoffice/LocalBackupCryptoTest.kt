package expo.modules.pushoffice

import java.util.Base64
import org.junit.Assert.*
import org.junit.Test

class LocalBackupCryptoTest {
  private val passphrase = "synthetic-test-passphrase-한글"
  private val data = "{\"title\":\"한글 일정\",\"memo\":\"회의 장소와 메모\"}"

  @Test fun portableEncryptionUsesRandomSaltAndNonceAndPreservesKorean() {
    val first = LocalBackupCrypto.encrypt(data, passphrase)
    val second = LocalBackupCrypto.encrypt(data, passphrase)
    assertTrue(first.startsWith(LocalBackupCrypto.HEADER + "\n"))
    assertFalse(first.contains("한글 일정"))
    assertFalse(first.contains(passphrase))
    assertNotEquals(first, second)
    assertNotEquals(first.split('\n')[1], second.split('\n')[1])
    assertNotEquals(first.split('\n')[2], second.split('\n')[2])
    assertEquals(data, LocalBackupCrypto.decrypt(first, passphrase))
    assertEquals(data, LocalBackupCrypto.decrypt(second, passphrase))
  }

  @Test fun wrongPasswordAndModifiedAuthenticatedCiphertextNeverReturnPlaintext() {
    val archive = LocalBackupCrypto.encrypt(data, passphrase)
    assertThrows(Exception::class.java) { LocalBackupCrypto.decrypt(archive, "synthetic-wrong-phrase") }
    val parts = archive.split('\n').toMutableList()
    val bytes = Base64.getDecoder().decode(parts[3])
    bytes[0] = (bytes[0].toInt() xor 1).toByte()
    parts[3] = Base64.getEncoder().encodeToString(bytes)
    assertThrows(Exception::class.java) { LocalBackupCrypto.decrypt(parts.joinToString("\n"), passphrase) }
    assertThrows(Exception::class.java) { LocalBackupCrypto.decrypt(archive.replace("V1", "V2"), passphrase) }
  }

  @Test fun decryptsIndependentStandardCryptoVector() {
    // Public synthetic vector: Python hashlib PBKDF2 + cryptography AESGCM, no production key.
    val archive = listOf(LocalBackupCrypto.HEADER, "AAECAwQFBgcICQoLDA0ODw==",
      "EBESExQVFhcYGRob", "3Oe4g0cS+lbw+27UEQqzr8JPGmXGxbJ5z+sDLVyOI/fDFWZRZnnKypQ=").joinToString("\n")
    assertEquals("{\"title\":\"한글 일정\"}", LocalBackupCrypto.decrypt(archive, "synthetic-vector-passphrase"))
  }

  @Test fun boundsAndMalformedEnvelopeFailBeforeKeyDerivation() {
    assertThrows(IllegalArgumentException::class.java) { LocalBackupCrypto.encrypt(data, "short") }
    assertThrows(IllegalArgumentException::class.java) { LocalBackupCrypto.encrypt("a".repeat(LocalBackupCrypto.MAX_PLAINTEXT_BYTES + 1), passphrase) }
    assertThrows(IllegalArgumentException::class.java) { LocalBackupCrypto.decrypt(LocalBackupCrypto.HEADER + "\nAA==\nAA==\nAA==", passphrase) }
    assertThrows(IllegalArgumentException::class.java) { LocalBackupCrypto.decrypt("a".repeat(LocalBackupCrypto.MAX_ENCRYPTED_BYTES + 1), passphrase) }
  }
}
