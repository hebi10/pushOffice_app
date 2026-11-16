package expo.modules.pushoffice

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import org.junit.Assert.*
import org.junit.Test

class LocalBackupDocumentsTest {
  @Test fun utf8RoundTripPreservesKoreanAndLineBreaks() {
    val content = "{\"title\":\"반복 일정\",\"note\":\"진료\\n예약\"}"
    val output = ByteArrayOutputStream()
    LocalBackupDocuments.boundedWrite(output, content)
    assertEquals(content, LocalBackupDocuments.boundedUtf8(ByteArrayInputStream(output.toByteArray())))
  }

  @Test fun damagedUtf8IsRejected() {
    val bytes = byteArrayOf(0xC3.toByte(), 0x28)
    assertThrows(Exception::class.java) {
      LocalBackupDocuments.boundedUtf8(ByteArrayInputStream(bytes))
    }
  }

  @Test fun oversizeFileIsRejectedBeforeParsing() {
    val input = ByteArrayInputStream(ByteArray(LocalBackupDocuments.MAX_BYTES + 1))
    assertThrows(IllegalArgumentException::class.java) { LocalBackupDocuments.boundedUtf8(input) }
  }

  @Test fun oversizedExportDoesNotWritePartially() {
    val output = ByteArrayOutputStream()
    assertThrows(IllegalArgumentException::class.java) {
      LocalBackupDocuments.boundedWrite(output, "한".repeat(LocalBackupDocuments.MAX_BYTES / 3 + 1))
    }
    assertEquals(0, output.size())
  }
}
