package expo.modules.pushoffice

import java.io.File
import java.security.MessageDigest
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Offline synthetic benchmark. Exercises the production gate + parser; no device or AI calls. */
class NotiAi00BaselineTest {
  private val clock = ZonedDateTime.of(2026, 11, 12, 10, 0, 0, 0, ZoneId.of("Asia/Seoul"))

  private data class Case(
    val id: String, val group: String, val app: String, val title: String,
    val body: String, val expectedLocalStart: String, val expectedRepeat: String
  ) {
    val positive: Boolean get() = group == "complete" || group == "incomplete"
  }
  private data class Observation(val sample: Case, val candidate: Boolean, val accepted: Boolean, val exact: Boolean)
  private fun jsonIds(ids: List<String>): String =
    ids.joinToString(prefix = "[", postfix = "]") { "\"" + it + "\"" }
  private fun sha256(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

  @Test fun measureCurrentRulesWithoutRecordingPrivateNotifications() {
    val resourceName = "noti-ai-00-cases.tsv"
    val url = requireNotNull(javaClass.classLoader?.getResource(resourceName)) { "Missing synthetic fixture." }
    val bytes = requireNotNull(javaClass.classLoader?.getResourceAsStream(resourceName)).use { it.readBytes() }
    val rows = bytes.toString(Charsets.UTF_8).trimEnd().lines()
    assertEquals("id\tgroup\tapp\ttitle\tbody\texpected_local_start\texpected_repeat", rows.first())
    val cases = rows.drop(1).map { line ->
      val fields = line.split('\t')
      assertEquals("Fixture must contain seven TSV columns.", 7, fields.size)
      Case(fields[0], fields[1], fields[2], fields[3], fields[4], fields[5], fields[6])
    }
    assertEquals(60, cases.size)
    assertEquals(60, cases.map { it.id }.distinct().size)
    val groups = mapOf("complete" to 24, "incomplete" to 12, "unrelated" to 14, "sensitive" to 10)
    groups.forEach { (group, count) -> assertEquals(group, count, cases.count { it.group == group }) }
    for (item in cases) {
      assertTrue("Only nonidentifying case IDs allowed.", item.id.matches(Regex("[EINS][0-9]{2}")))
      assertTrue("Unknown classification.", item.group in groups)
      assertTrue("Application label and sample title required.", item.app.isNotBlank() && item.title.isNotBlank())
      if (item.group == "complete") {
        LocalDateTime.parse(item.expectedLocalStart)
        assertTrue(item.expectedRepeat in listOf("none", "monthly", "yearly"))
      } else {
        assertEquals("-", item.expectedLocalStart)
        assertEquals("none", item.expectedRepeat)
      }
    }

    // Identical decision sequence to ScheduleNotificationListener: gate, then Kotlin parse.
    val outcomes = cases.map { item ->
      val source = NotificationSuggestionPolicy.candidate(item.title, item.body)
      val parsed = source?.let { ScheduleParser.parse(it, clock) }
      val accepted = parsed != null && parsed.error == null && parsed.shiftMinutes == null &&
        parsed.start != null && parsed.title.isNotBlank()
      val exact = item.group == "complete" && accepted &&
        parsed?.start?.toLocalDateTime()?.toString() == item.expectedLocalStart &&
        parsed?.repeatType == item.expectedRepeat
      Observation(item, source != null, accepted, exact)
    }

    val positives = cases.count { it.positive }
    val negatives = cases.size - positives
    val candidateTp = outcomes.count { it.sample.positive && it.candidate }
    val candidateFp = outcomes.count { !it.sample.positive && it.candidate }
    val finalTp = outcomes.count { it.sample.positive && it.accepted }
    val finalFp = outcomes.count { !it.sample.positive && it.accepted }
    val completeAccepted = outcomes.count { it.sample.group == "complete" && it.accepted }
    val incompleteAccepted = outcomes.count { it.sample.group == "incomplete" && it.accepted }
    val exactMatches = outcomes.count { it.exact }
    val missedComplete = outcomes.filter { it.sample.group == "complete" && !it.accepted }.map { it.sample.id }
    val missedIncomplete = outcomes.filter { it.sample.group == "incomplete" && !it.accepted }.map { it.sample.id }
    val falsePositiveIds = outcomes.filter { it.sample.group == "unrelated" && it.accepted }.map { it.sample.id }
    val sensitiveLeaks = outcomes.filter { it.sample.group == "sensitive" && it.candidate }.map { it.sample.id }
    val wrongDateIds = outcomes.filter { it.sample.group == "complete" && it.accepted && !it.exact }.map { it.sample.id }

    val report = buildString {
      append("{\n")
      append("  \"schemaVersion\":1,\n")
      append("  \"dataset\":\"synthetic-notification-v1\",\n")
      append("  \"referenceClock\":\"2026-11-12T10:00:00+09:00[Asia/Seoul]\",\n")
      append("  \"fixtureSha256\":\"" + sha256(bytes) + "\",\n")
      append("  \"realNotificationMetrics\":false,\"aiInferenceMeasured\":false,\"deviceLatencyOrBatteryMeasured\":false,\n")
      append("  \"sampleCount\":" + cases.size + ",\n")
      append("  \"groups\":{\"complete\":24,\"incomplete\":12,\"unrelated\":14,\"sensitive\":10},\n")
      append("  \"candidateConfusion\":{\"tp\":" + candidateTp + ",\"fp\":" + candidateFp + ",\"fn\":" + (positives - candidateTp) + ",\"tn\":" + (negatives - candidateFp) + "},\n")
      append("  \"finalConfusion\":{\"tp\":" + finalTp + ",\"fp\":" + finalFp + ",\"fn\":" + (positives - finalTp) + ",\"tn\":" + (negatives - finalFp) + "},\n")
      append("  \"confirmedRecall\":{\"matched\":" + completeAccepted + ",\"total\":24},\n")
      append("  \"incompleteIntentRecall\":{\"matched\":" + incompleteAccepted + ",\"total\":12},\n")
      append("  \"dateTimeExactOnAllConfirmed\":{\"matched\":" + exactMatches + ",\"total\":24},\n")
      append("  \"sensitiveBlockedBeforeParsing\":{\"blocked\":" + (10 - sensitiveLeaks.size) + ",\"total\":10},\n")
      append("  \"missedConfirmedIds\":" + jsonIds(missedComplete) + ",\n")
      append("  \"missedIncompleteIds\":" + jsonIds(missedIncomplete) + ",\n")
      append("  \"falsePositiveUnrelatedIds\":" + jsonIds(falsePositiveIds) + ",\n")
      append("  \"wrongDateOrRepeatIds\":" + jsonIds(wrongDateIds) + ",\n")
      append("  \"sensitiveCandidateLeakIds\":" + jsonIds(sensitiveLeaks) + ",\n")
      append("  \"cases\":[\n")
      append(outcomes.joinToString(",\n") {
        "    {\"id\":\"" + it.sample.id + "\",\"group\":\"" + it.sample.group +
          "\",\"candidate\":" + it.candidate + ",\"accepted\":" + it.accepted + ",\"exact\":" + it.exact + "}"
      })
      append("\n  ]\n}\n")
    }
    val resourceFile = File(url.toURI()).canonicalFile
    val moduleBuildDir = generateSequence(resourceFile.parentFile) { it.parentFile }
      .firstOrNull { it.name == "build" } ?: error("Gradle module build directory is unavailable.")
    val reportFile = File(moduleBuildDir, "reports/noti-ai-00/baseline.json")
    require(reportFile.parentFile.mkdirs() || reportFile.parentFile.isDirectory) { "Cannot make QA report folder." }
    reportFile.writeText(report, Charsets.UTF_8)
    println("NOTI-AI-00 sample=60, complete=" + completeAccepted + "/24, incomplete=" + incompleteAccepted + "/12")
    println("NOTI-AI-00 candidate TP/FP=" + candidateTp + "/" + candidateFp +
      " final TP/FP=" + finalTp + "/" + finalFp)
    println("NOTI-AI-00 report=" + reportFile.absolutePath)

    // Sensitive examples must never cross the initial content-filtering boundary.
    assertTrue("Sensitive synthetic alert passed the pre-AI gate.", sensitiveLeaks.isEmpty())
  }
}
