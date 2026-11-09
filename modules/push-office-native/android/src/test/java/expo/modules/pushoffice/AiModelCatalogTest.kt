package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class AiModelCatalogTest {
  @Test fun exactlyFiveModelsAndUniqueIds() {
    assertEquals(5, AiModelCatalog.models.size)
    assertEquals(5, AiModelCatalog.models.map { it.id }.toSet().size)
    assertEquals("gemini-nano", AiModelCatalog.models.first().id)
  }

  @Test fun onlyApprovedHuggingFaceArtifactsAreDownloadable() {
    AiModelCatalog.models.drop(1).forEach { model ->
      assertTrue(model.downloadUrl!!.startsWith("https://huggingface.co/litert-community/"))
      assertTrue(model.downloadUrl!!.endsWith(".litertlm"))
      assertTrue(model.approximateMb >= 500)
      assertTrue(model.minAvailableMb >= 1000)
      assertEquals("https://huggingface.co/" + model.source, model.sourceUrl)
    }
  }

  @Test fun systemManagedNanoCannotBeFetchedLikeAWeightFile() {
    assertNull(AiModelCatalog.get("gemini-nano").downloadUrl)
    assertEquals(0, AiModelCatalog.get("gemini-nano").approximateMb)
    assertThrows(IllegalArgumentException::class.java) { AiModelCatalog.get("unknown") }
  }

  @Test fun pinnedArtifactsUseKnownSHA256() {
    assertEquals(64, AiModelCatalog.get("qwen3-06").sha256!!.length)
    assertEquals(64, AiModelCatalog.get("gemma4-e2b").sha256!!.length)
    assertEquals(64, AiModelCatalog.get("qwen35-08").sha256!!.length)
    assertEquals(64, AiModelCatalog.get("qwen35-2").sha256!!.length)
  }
}
