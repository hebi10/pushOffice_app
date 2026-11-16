package expo.modules.pushoffice

import java.net.URI

/** Optional local-only details. Never infer them from notification text or send them to an AI prompt. */
object ScheduleExtras {
  const val LOCATION_LIMIT = 160
  const val URL_LIMIT = 2048
  const val NOTES_LIMIT = 2000

  fun location(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }?.also {
    require(it.length <= LOCATION_LIMIT && it.none { ch -> ch == '\n' || ch == '\r' || ch.isISOControl() }) {
      "장소는 줄바꿈 없이 160자 이내로 입력해 주세요."
    }
  }

  fun meetingUrl(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }?.also {
    require(it.length <= URL_LIMIT) { "회의 링크는 2048자 이내로 입력해 주세요." }
    val uri = runCatching { URI(it) }.getOrNull()
    require(uri != null && uri.scheme.equals("https", ignoreCase = true) &&
      !uri.isOpaque && !uri.host.isNullOrBlank() && uri.userInfo == null &&
      it.none { ch -> ch.isWhitespace() || ch.isISOControl() }) {
      "회의 링크는 계정 정보가 없는 HTTPS 주소로 입력해 주세요."
    }
  }

  fun notes(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }?.also {
    require(it.length <= NOTES_LIMIT && it.none { ch -> ch.isISOControl() && ch != '\n' && ch != '\t' }) {
      "메모는 2000자 이내로 입력해 주세요."
    }
  }

  fun fromMap(value: Map<String, Any?>, key: String): String? {
    val raw = value[key] ?: return null
    require(raw is String) { "$key 문자열을 확인해 주세요." }
    return when (key) {
      "location" -> location(raw)
      "meetingUrl" -> meetingUrl(raw)
      "notes" -> notes(raw)
      else -> throw IllegalArgumentException("지원하지 않는 일정 항목입니다.")
    }
  }

  fun validate(record: ScheduleRecord) {
    location(record.location)
    meetingUrl(record.meetingUrl)
    notes(record.notes)
  }
}
