package expo.modules.pushoffice

/** Stable non-sensitive codes; raw service exceptions must not be shown or persisted. */
internal data class NanoDownloadDiagnostic(
  val code: String,
  val guidance: String,
  val retryable: Boolean = true
) {
  fun asResult(context: String = "기기 AI 다운로드 오류"): Map<String, Any> = mapOf(
    "status" to "error",
    "message" to "$context [$code]. $guidance",
    "errorCode" to code,
    "retryable" to retryable
  )
}

internal object NanoDownloadDiagnostics {
  fun from(error: Throwable): NanoDownloadDiagnostic {
    val descriptions = generateSequence(error) { it.cause }.take(5)
      .joinToString(" ") { "${it.javaClass.simpleName} ${it.message.orEmpty().take(500)}" }
    return fromDescription(descriptions)
  }

  fun fromDescription(value: String): NanoDownloadDiagnostic {
    val text = value.uppercase()
    return when {
      ("601" in text && ("BINDING_FAILURE" in text || "CONNECTION_ERROR" in text)) ||
        "BINDING_FAILURE" in text -> NanoDownloadDiagnostic(
          "AICORE_BINDING_601",
          "AICore 서비스에 연결하지 못했습니다. AICore를 업데이트하고 앱을 다시 실행한 뒤 재시도해 주세요."
        )
      ("606" in text && ("FEATURE_NOT_FOUND" in text || "PREPARATION_ERROR" in text)) ||
        "FEATURE_NOT_FOUND" in text -> NanoDownloadDiagnostic(
          "AICORE_FEATURE_606",
          "AICore 모델 구성이 준비되지 않았습니다. 인터넷 연결 상태에서 업데이트하고 기기를 다시 시작한 후 지원 상태를 확인해 주세요."
        )
      "BACKGROUND_USE_BLOCKED" in text -> NanoDownloadDiagnostic(
        "AICORE_FOREGROUND_REQUIRED",
        "AI 모델은 앱을 화면에 열어 둔 상태에서 다시 요청해 주세요."
      )
      listOf("UNABLE TO RESOLVE HOST", "UNKNOWNHOST", "TIMEOUT",
        "SOCKETEXCEPTION", "NETWORK", "CONNECTION REFUSED").any { it in text } ->
        NanoDownloadDiagnostic(
          "AICORE_NETWORK",
          "네트워크를 확인하고 Wi-Fi에서 잠시 후 수동으로 다시 시도해 주세요."
        )
      else -> NanoDownloadDiagnostic(
        "AICORE_DOWNLOAD_UNKNOWN",
        "AICore·Android 업데이트를 확인한 뒤 상태 새로고침 또는 다운로드 재시도를 이용해 주세요."
      )
    }
  }

  fun incomplete() = NanoDownloadDiagnostic(
    "AICORE_NOT_READY",
    "설치 완료를 확인하지 못했습니다. AICore 업데이트 후 상태를 다시 확인해 주세요."
  )
}
