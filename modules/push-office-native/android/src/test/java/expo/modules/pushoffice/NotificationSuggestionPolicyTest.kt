package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class NotificationSuggestionPolicyTest {
  @Test fun requiresBothDateAndTime() {
    assertEquals("11월 12일 오후 3시 강남역에서 만나자",
      NotificationSuggestionPolicy.candidate("친구", "11월 12일 오후 3시 강남역에서 만나자"))
    assertNull(NotificationSuggestionPolicy.candidate("친구", "내일 만나자"))
    assertNull(NotificationSuggestionPolicy.candidate("친구", "3시쯤 전화"))
    assertNull(NotificationSuggestionPolicy.candidate("친구", "새로운 알림이 도착했습니다"))
  }
  @Test fun blocksLikelySensitiveNotificationsBeforeAnalysis() {
    assertNull(NotificationSuggestionPolicy.candidate("문자", "11월 12일 오후 3시 인증번호 123456"))
    assertNull(NotificationSuggestionPolicy.candidate("은행", "2026-11-12 15:30 결제 승인"))
    assertNull(NotificationSuggestionPolicy.candidate("보안", "11월 12일 오전 9시 OTP 코드"))
  }
  @Test fun handlesIsoDateAndTimeWithoutAssumingAnEventWasConfirmed() {
    assertEquals("2026-11-12 15:00 치과 예약",
      NotificationSuggestionPolicy.candidate("예약 안내", "2026-11-12 15:00 치과 예약"))
    assertNull(NotificationSuggestionPolicy.candidate("광고", "2026-11-12 15:00 쿠폰"))
  }
}
