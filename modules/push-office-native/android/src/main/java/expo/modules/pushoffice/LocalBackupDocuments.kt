package expo.modules.pushoffice

import android.content.Context
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Android Storage Access Framework only. Never use a shared directory or app-wide storage permission. */
internal object LocalBackupDocuments {
  const val MAX_BYTES = LocalBackupCrypto.MAX_PLAINTEXT_BYTES
  const val MAX_ENCRYPTED_BYTES = LocalBackupCrypto.MAX_ENCRYPTED_BYTES

  fun boundedUtf8(input: InputStream, maxBytes: Int = MAX_BYTES): String {
    val output = ByteArrayOutputStream()
    val block = ByteArray(8192)
    while (true) {
      val count = input.read(block)
      if (count == -1) break
      if (count == 0) continue
      require(output.size() + count <= maxBytes) { "백업 파일이 너무 큽니다." }
      output.write(block, 0, count)
    }
    val text = Charsets.UTF_8.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .decode(ByteBuffer.wrap(output.toByteArray())).toString()
    require(output.size() <= MAX_BYTES || LocalBackupCrypto.isEncryptedFamily(text)) { "백업 파일이 너무 큽니다." }
    return text
  }

  private fun validatedBytes(text: String): ByteArray {
    val limit = if (LocalBackupCrypto.isEncryptedFamily(text)) MAX_ENCRYPTED_BYTES else MAX_BYTES
    require(text.length in 1..limit) { "백업 파일 크기가 올바르지 않습니다." }
    return text.toByteArray(Charsets.UTF_8).also {
      require(it.size in 1..limit) { "백업 파일 크기가 올바르지 않습니다." }
    }
  }

  fun boundedWrite(output: OutputStream, text: String) {
    val bytes = validatedBytes(text)
    try { output.write(bytes); output.flush() }
    finally { bytes.fill(0) }
  }

  fun read(context: Context, uri: Uri): String {
    val stream = context.contentResolver.openInputStream(uri)
      ?: throw IllegalStateException("파일을 열 수 없습니다.")
    return stream.use { boundedUtf8(it, MAX_ENCRYPTED_BYTES) }
  }

  fun write(context: Context, uri: Uri, text: String) {
    val bytes = validatedBytes(text)
    try {
      val stream = context.contentResolver.openOutputStream(uri, "wt")
        ?: throw IllegalStateException("파일을 저장할 수 없습니다.")
      stream.use { it.write(bytes); it.flush() }
    } finally { bytes.fill(0) }
  }
}
