package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class NanoDownloadDiagnosticsTest {
  @Test fun bindingFailureProvidesSpecificRecoverySteps() {
    val failure = NanoDownloadDiagnostics.fromDescription("4-CONNECTION_ERROR 601-BINDING_FAILURE")
    assertEquals("AICORE_BINDING_601", failure.code)
    assertTrue(failure.retryable)
    assertTrue(failure.guidance.contains("AICore"))
  }

  @Test fun preparationFailureExplainsConfigurationDelay() {
    val failure = NanoDownloadDiagnostics.fromDescription("3-PREPARATION_ERROR 606-FEATURE_NOT_FOUND")
    assertEquals("AICORE_FEATURE_606", failure.code)
    assertTrue(failure.guidance.contains("다시 시작"))
  }

  @Test fun networkFailureIsRecoverableWithManualRetry() {
    val failure = NanoDownloadDiagnostics.fromDescription("1-DOWNLOAD_ERROR Unable to resolve host example.com")
    assertEquals("AICORE_NETWORK", failure.code)
    assertTrue(failure.guidance.contains("Wi-Fi"))
  }

  @Test fun foregroundUseRestrictionIsDistinguishedFromNetworkError() {
    assertEquals("AICORE_FOREGROUND_REQUIRED",
      NanoDownloadDiagnostics.fromDescription("BACKGROUND_USE_BLOCKED").code)
  }

  @Test fun unknownErrorDoesNotEchoRawExceptionDetails() {
    val sensitive = "private-access-token-should-never-be-displayed"
    val result = NanoDownloadDiagnostics.from(IllegalStateException("Unknown service failure $sensitive")).asResult()
    assertEquals("error", result["status"])
    assertEquals("AICORE_DOWNLOAD_UNKNOWN", result["errorCode"])
    assertEquals(true, result["retryable"])
    assertFalse((result["message"] as String).contains(sensitive))
  }

  @Test fun incompleteDownloadNeverClaimsSuccess() {
    val result = NanoDownloadDiagnostics.incomplete().asResult()
    assertEquals("AICORE_NOT_READY", result["errorCode"])
    assertEquals("error", result["status"])
    assertEquals(true, result["retryable"])
  }
}
