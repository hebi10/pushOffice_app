package expo.modules.pushoffice

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

/** Only bounded plain text; no stream, URI, file permission, implicit command or automatic save. */
internal object SharedScheduleText {
  const val MAX_LENGTH = 4096
  const val EXTRA = "sharedScheduleText"
  fun accept(action: String?, mime: String?, value: CharSequence?): String? {
    if (action != Intent.ACTION_SEND || mime != "text/plain" || value == null ||
        value.length !in 1..MAX_LENGTH) return null
    val text = value.toString().replace("\r\n","\n").replace('\r','\n').trim()
    if (text.isBlank() || text.length > MAX_LENGTH ||
        text.any { it.isISOControl() && it != '\n' && it != '\t' }) return null
    return text
  }
}

/** The only exported entry point for the share sheet; the actual editor remains non-exported. */
class ShareTextActivity : Activity() {
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    try {
      if (state != null) return
      val text = SharedScheduleText.accept(intent.action, intent.type, intent.getCharSequenceExtra(Intent.EXTRA_TEXT))
      if (text == null) {
        Toast.makeText(this,"4,096자 이하의 일반 텍스트만 공유할 수 있습니다.",Toast.LENGTH_SHORT).show()
        return
      }
      startActivity(Intent(this,QuickEntryActivity::class.java)
        .putExtra("entryMode","sharedText").putExtra(SharedScheduleText.EXTRA,text))
    } catch (_: Exception) {
      Toast.makeText(this,"공유한 텍스트를 열지 못했습니다.",Toast.LENGTH_SHORT).show()
    } finally { finish() }
  }
}
