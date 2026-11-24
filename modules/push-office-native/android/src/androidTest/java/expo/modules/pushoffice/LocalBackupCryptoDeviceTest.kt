package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64

class LocalBackupCryptoDeviceTest {
  @Test fun androidProviderCanDecryptIndependentVectorAndRoundTripEncryptedFile() {
    val archive = listOf(LocalBackupCrypto.HEADER, "AAECAwQFBgcICQoLDA0ODw==",
      "EBESExQVFhcYGRob", "3Oe4g0cS+lbw+27UEQqzr8JPGmXGxbJ5z+sDLVyOI/fDFWZRZnnKypQ=").joinToString("\n")
    assertEquals("{\"title\":\"한글 일정\"}", LocalBackupCrypto.decrypt(archive, "synthetic-vector-passphrase"))
    val data = "{\"title\":\"반복 일정\",\"notes\":\"한글 메모\"}"
    val phrase = "synthetic-android-한글"
    val encrypted = LocalBackupCrypto.encrypt(data, phrase)
    val output = ByteArrayOutputStream()
    LocalBackupDocuments.boundedWrite(output, encrypted)
    val restored = LocalBackupDocuments.boundedUtf8(ByteArrayInputStream(output.toByteArray()),
      LocalBackupDocuments.MAX_ENCRYPTED_BYTES)
    assertEquals(data, LocalBackupCrypto.decrypt(restored, phrase))
    assertThrows(Exception::class.java) { LocalBackupCrypto.decrypt(restored, "synthetic-wrong-phrase") }
    val parts = restored.split('\n').toMutableList()
    val bytes = Base64.getDecoder().decode(parts[3])
    bytes[0] = (bytes[0].toInt() xor 1).toByte()
    parts[3] = Base64.getEncoder().encodeToString(bytes)
    assertThrows(Exception::class.java) { LocalBackupCrypto.decrypt(parts.joinToString("\n"), phrase) }
  }
}
