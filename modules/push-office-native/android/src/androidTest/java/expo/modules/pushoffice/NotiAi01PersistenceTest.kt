package expo.modules.pushoffice

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NotiAi01PersistenceTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()

  @Test fun oldStoredNotificationWithoutTriageStillRestoresTheOriginalSchedule() {
    val legacy = JSONObject()
      .put("id", "legacy-candidate")
      .put("sourceApp", "테스트 앱")
      .put("packageName", "example.test")
      .put("excerpt", "내일 오후 3시 예약")
      .put("title", "예약")
      .put("startAt", 1_800_000_000_000L)
      .put("receivedAt", 1_700_000_000_000L)
      .put("analysis", "local_rules")

    val value = NotificationSuggestion.fromJson(legacy)
    assertEquals("confirmed_candidate", value.triage)
    assertEquals(1_800_000_000_000L, value.startAt)
    assertEquals("legacy-candidate", value.id)
    assertEquals("local_rules", value.analysis)
  }

  @Test fun incompleteCandidateJsonRoundTripRetainsNullWithoutInventingTime() {
    val unfinished = NotificationSuggestion(
      id = "new-candidate",
      sourceApp = "테스트 앱",
      packageName = "example.test",
      excerpt = "내일 약속 잡자",
      title = "내일 약속 잡자",
      startAt = null,
      receivedAt = 1_700_000_000_000L,
      analysis = "local_rules",
      triage = "needs_confirmation"
    )
    val stored = unfinished.toJson()
    assertTrue(stored.isNull("startAt"))
    val restored = NotificationSuggestion.fromJson(stored)
    assertEquals("needs_confirmation", restored.triage)
    assertNull(restored.startAt)
    assertNull(restored.toMap()["startAt"])
    assertEquals("내일 약속 잡자", restored.title)
  }

  @Test fun oldPermissionConsentCannotEnableExpandedContentAnalysisSilently() {
    val preferences = context.getSharedPreferences("push_office_notification_suggestions", Context.MODE_PRIVATE)
    try {
      assertTrue(preferences.edit().clear().putBoolean("enabled", true).commit())
      assertFalse(NotificationSuggestionStore.enabled(context))
      assertTrue(preferences.edit().putInt("consent_version", 2).commit())
      assertTrue(NotificationSuggestionStore.enabled(context))
    } finally {
      preferences.edit().clear().commit()
    }
  }
}
