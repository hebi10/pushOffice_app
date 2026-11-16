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
  const val MAX_BYTES = 8 * 1024 * 1024

  fun boundedUtf8(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val block = ByteArray(8192)
    while (true) {
      val count = input.read(block)
      if (count == -1) break
      if (count == 0) continue
      require(output.size() + count <= MAX_BYTES) { "백업 파일이 너무 큽니다." }
      output.write(block, 0, count)
    }
    return Charsets.UTF_8.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .decode(ByteBuffer.wrap(output.toByteArray())).toString()
  }

  fun boundedWrite(output: OutputStream, text: String) {
    val bytes = text.toByteArray(Charsets.UTF_8)
    require(bytes.isNotEmpty() && bytes.size <= MAX_BYTES) { "백업 파일 크기가 올바르지 않습니다." }
    output.write(bytes)
    output.flush()
  }

  fun read(context: Context, uri: Uri): String {
    val stream = context.contentResolver.openInputStream(uri)
      ?: throw IllegalStateException("파일을 열 수 없습니다.")
    return stream.use(::boundedUtf8)
  }

  fun write(context: Context, uri: Uri, text: String) {
    val stream = context.contentResolver.openOutputStream(uri, "w")
      ?: throw IllegalStateException("파일을 저장할 수 없습니다.")
    stream.use { boundedWrite(it, text) }
  }
}
