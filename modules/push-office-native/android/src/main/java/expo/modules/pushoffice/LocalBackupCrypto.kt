package expo.modules.pushoffice

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/** Portable, versioned envelope. No stored key, device identifier, or plaintext fallback. */
internal object LocalBackupCrypto {
  const val FAMILY = "PUSH-OFFICE-ENCRYPTED-BACKUP-"
  const val HEADER = FAMILY + "V1"
  const val MAX_PLAINTEXT_BYTES = 8 * 1024 * 1024
  const val MAX_ENCRYPTED_BYTES = 12 * 1024 * 1024
  private const val ITERATIONS = 600_000
  private const val SALT_BYTES = 16
  private const val NONCE_BYTES = 12
  private const val TAG_BYTES = 16
  private val random = SecureRandom()
  private val encoder = Base64.getEncoder()
  private val decoder = Base64.getDecoder()

  fun isEncryptedFamily(text: String): Boolean = text.startsWith(FAMILY)
  private fun validatePassword(password: String) {
    require(password.length in 12..128 && password.isNotBlank()) {
      "백업 비밀번호는 12~128자로 입력해 주세요."
    }
  }

  private fun <T> withKey(password: String, salt: ByteArray, action: (SecretKeySpec) -> T): T {
    validatePassword(password)
    val chars = password.toCharArray()
    val spec = PBEKeySpec(chars, salt, ITERATIONS, 256)
    chars.fill('\u0000')
    var bytes: ByteArray? = null
    try {
      val keyBytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
      bytes = keyBytes
      return action(SecretKeySpec(keyBytes, "AES"))
    } finally {
      spec.clearPassword()
      bytes?.fill(0)
    }
  }

  fun encrypt(text: String, password: String): String {
    validatePassword(password)
    require(text.length <= MAX_PLAINTEXT_BYTES) { "백업 파일이 너무 큽니다." }
    val plain = text.toByteArray(Charsets.UTF_8)
    try {
      require(plain.size in 1..MAX_PLAINTEXT_BYTES) { "백업 파일 크기가 올바르지 않습니다." }
      val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
      val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes)
      val encrypted = withKey(password, salt) { key ->
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_BYTES * 8, nonce))
        cipher.updateAAD(HEADER.toByteArray(Charsets.UTF_8))
        cipher.doFinal(plain)
      }
      return listOf(HEADER, encoder.encodeToString(salt), encoder.encodeToString(nonce),
        encoder.encodeToString(encrypted)).joinToString("\n").also {
        require(it.length <= MAX_ENCRYPTED_BYTES)
      }
    } finally { plain.fill(0) }
  }

  private fun envelopePart(value: String, maxBytes: Int): ByteArray {
    require(value.length <= ((maxBytes + 2) / 3) * 4) { "암호화 백업 형식이 올바르지 않습니다." }
    return decoder.decode(value).also {
      require(it.size <= maxBytes && encoder.encodeToString(it) == value) {
        "암호화 백업 형식이 올바르지 않습니다."
      }
    }
  }

  fun decrypt(text: String, password: String): String {
    validatePassword(password)
    require(text.length <= MAX_ENCRYPTED_BYTES) { "백업 파일이 너무 큽니다." }
    val lines = text.split('\n', limit = 5)
    require(lines.size == 4 && lines[0] == HEADER) { "지원하지 않는 암호화 백업 형식입니다." }
    val salt = envelopePart(lines[1], SALT_BYTES)
    val nonce = envelopePart(lines[2], NONCE_BYTES)
    val encrypted = envelopePart(lines[3], MAX_PLAINTEXT_BYTES + TAG_BYTES)
    require(salt.size == SALT_BYTES && nonce.size == NONCE_BYTES &&
      encrypted.size > TAG_BYTES) { "암호화 백업 형식이 올바르지 않습니다." }
    val plain = withKey(password, salt) { key ->
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BYTES * 8, nonce))
      cipher.updateAAD(HEADER.toByteArray(Charsets.UTF_8))
      cipher.doFinal(encrypted)
    }
    try {
      require(plain.size in 1..MAX_PLAINTEXT_BYTES)
      return Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(plain)).toString()
    } finally { plain.fill(0) }
  }
}
