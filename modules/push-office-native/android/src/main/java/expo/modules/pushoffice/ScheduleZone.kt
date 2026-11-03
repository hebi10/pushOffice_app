package expo.modules.pushoffice

import java.time.ZoneId

/** The persisted recurrence zone is part of an event's anchor, independent of device travel. */
object ScheduleZone {
  fun validate(value: String): String {
    require(value in ZoneId.getAvailableZoneIds()) { "anchorZone은 올바른 IANA 시간대여야 합니다." }
    return ZoneId.of(value).id
  }
  fun fallback(configured: String?, device: ZoneId): ZoneId =
    try { configured?.let { ZoneId.of(validate(it)) } ?: device } catch(_: IllegalArgumentException) { device }
  fun resolve(persisted: String?, incoming: String?, fallback: ZoneId): ZoneId {
    // Even an ignored edit must not bypass incoming bridge validation.
    incoming?.let(::validate)
    return ZoneId.of(persisted?.let(::validate) ?: incoming ?: fallback.id)
  }
}
