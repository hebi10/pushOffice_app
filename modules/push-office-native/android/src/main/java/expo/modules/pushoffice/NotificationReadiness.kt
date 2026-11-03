package expo.modules.pushoffice

/** Pure conjunction shared by the Android readiness adapter and its regression tests. */
object NotificationReadiness {
  fun allowed(appEnabled: Boolean, runtimePermission: Boolean, channelEnabled: Boolean, groupEnabled: Boolean) =
    appEnabled && runtimePermission && channelEnabled && groupEnabled
}
