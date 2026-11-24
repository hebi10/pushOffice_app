package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class ScheduleCategoryTest {
  @Test fun stableIdsAndLegacyNullAreOnlyAcceptedValues() {
    assertEquals(listOf(null, "work", "personal", "family", "health", "study", "other"),
      ScheduleCategory.options.map { it.first })
    ScheduleCategory.options.forEach { (id, _) ->
      assertEquals(id, ScheduleCategory.validate(id))
      assertEquals(id, ScheduleCategory.fromMap(mapOf("category" to id)))
    }
    assertNull(ScheduleCategory.fromMap(emptyMap()))
    for (value in listOf("", "unknown", "업무", " work ")) {
      assertThrows(IllegalArgumentException::class.java) { ScheduleCategory.validate(value) }
    }
    assertThrows(IllegalArgumentException::class.java) { ScheduleCategory.fromMap(mapOf("category" to 5)) }
  }
}
