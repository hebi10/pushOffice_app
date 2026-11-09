package expo.modules.pushoffice

/** Approved public LiteRT-LM files; no user-supplied model URLs. */
internal data class AiModelDefinition(
  val id: String,
  val title: String,
  val description: String,
  val source: String,
  val file: String?,
  val approximateMb: Int,
  val minAvailableMb: Int,
  val sha256: String? = null
) {
  val downloadUrl: String? get() = file?.let { "https://huggingface.co/" + source + "/resolve/main/" + it }
  val sourceUrl: String get() = if (id == "gemini-nano")
    "https://developers.google.com/ml-kit/genai/prompt/android/get-started"
    else "https://huggingface.co/" + source
}
internal object AiModelCatalog {
  val models = listOf(
    AiModelDefinition("gemini-nano", "Gemini Nano", "AICore가 관리하는 Android 시스템 AI", "aicore", null, 0, 0),
    AiModelDefinition("qwen3-06", "Qwen3 0.6B", "가벼운 입력 비교 후보", "litert-community/Qwen3-0.6B",
      "Qwen3-0.6B.litertlm", 614, 1400,
      "c5f39b4191926786c3e6668b62af4d6eb15248dfc7a5348252a9b406f33f2108"),
    AiModelDefinition("qwen35-08", "Qwen3.5 0.8B", "일정 입력 균형형 비교 후보", "litert-community/Qwen3.5-0.8B",
      "Qwen3.5-0.8B_int8.litertlm", 965, 2500,
      "d6702088983b3a997db5299558a37d2fd924a94daf2b09bd42c4e618c6f694a4"),
    AiModelDefinition("qwen35-2", "Qwen3.5 2B", "복잡한 문장 비교 후보 · 큰 RAM 필요", "litert-community/Qwen3.5-2B",
      "Qwen3.5-2B_int8.litertlm", 2120, 4000,
      "c2438cb9c050220e667366b4beeca4daac56e693b226420674f53fc40f007c49"),
    AiModelDefinition("gemma4-e2b", "Gemma 4 E2B", "Google 오픈 모델 · 큰 RAM 필요",
      "litert-community/gemma-4-E2B-it-litert-lm", "gemma-4-E2B-it.litertlm", 2590, 4400,
      "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c")
  )
  fun get(id: String): AiModelDefinition = models.firstOrNull { it.id == id }
    ?: throw IllegalArgumentException("지원하지 않는 AI 모델입니다.")
}
