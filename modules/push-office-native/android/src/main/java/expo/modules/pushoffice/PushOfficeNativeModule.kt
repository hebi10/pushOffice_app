package expo.modules.pushoffice

import android.app.StatusBarManager
import android.provider.Settings
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.pm.PackageManager
import android.content.Intent
import android.graphics.drawable.Icon
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PushOfficeNativeModule : Module() {
  private val context get() = appContext.reactContext ?: error("앱 컨텍스트가 준비되지 않았습니다.")
  private val listener: () -> Unit = { sendEvent("schedulesChanged", emptyMap<String, Any>()) }
  override fun definition() = ModuleDefinition {
    Name("PushOfficeNative")
    Events("schedulesChanged", "aiDownloadProgress")
    OnCreate { ScheduleStore.addListener(listener) }
    OnDestroy { ScheduleStore.removeListener(listener) }
    AsyncFunction("openQuickEntry") { promise: Promise ->
      val activity=appContext.currentActivity
      if(activity==null) promise.reject("NO_ACTIVITY","앱 화면에서 빠른 입력을 열어 주세요.",null)
      else activity.runOnUiThread {
        try { activity.startActivity(Intent(activity,QuickEntryActivity::class.java)); promise.resolve(null) }
        catch(e: Exception) { promise.reject("OPEN_ENTRY",e.message,e) }
      }
    }
    AsyncFunction("openVoiceQuickEntry") { promise: Promise ->
      val activity=appContext.currentActivity
      if(activity==null) promise.reject("NO_ACTIVITY","앱 화면에서 음성 입력을 열어 주세요.",null)
      else activity.runOnUiThread {
        try {
          activity.startActivity(Intent(activity,QuickEntryActivity::class.java).putExtra("entryMode","voice"))
          promise.resolve(null)
        } catch(e: Exception) { promise.reject("OPEN_VOICE_ENTRY",e.message,e) }
      }
    }
    AsyncFunction("getNotificationSuggestionStatus") {
      mapOf(
        "enabled" to NotificationSuggestionStore.enabled(context),
        "accessGranted" to NotificationSuggestionStore.accessGranted(context),
        "pendingCount" to NotificationSuggestionStore.all(context).size
      )
    }
    AsyncFunction("setNotificationCaptureEnabled") { enabled: Boolean ->
      NotificationSuggestionStore.setEnabled(context, enabled)
      enabled
    }
    AsyncFunction("openNotificationAccessSettings") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("NO_ACTIVITY", "앱 설정에서 권한 화면을 열어 주세요.", null)
      else activity.runOnUiThread {
        try {
          val component = ComponentName(activity, ScheduleNotificationListener::class.java)
          val intent = if (Build.VERSION.SDK_INT >= 30)
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
              .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component.flattenToString())
          else Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          try { activity.startActivity(intent) }
          catch (_: android.content.ActivityNotFoundException) {
            activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
          }
          promise.resolve(null)
        } catch (error: Exception) { promise.reject("OPEN_NOTIFICATION_ACCESS", error.message, error) }
      }
    }
    AsyncFunction("getNotificationSuggestions") { NotificationSuggestionStore.all(context).map(NotificationSuggestion::toMap) }
    AsyncFunction("refineNotificationSuggestion") Coroutine { id: String ->
      require(appContext.currentActivity?.hasWindowFocus() == true) { "기기 AI 분석은 앱 화면에서 사용해 주세요." }
      require(NotificationSuggestionStore.enabled(context) && NotificationSuggestionStore.accessGranted(context)) { "알림 분석 권한이 없습니다." }
      val original = NotificationSuggestionStore.get(context, id)
        ?: throw IllegalStateException("일정 후보가 삭제되었거나 만료됐습니다.")
      val zone = ScheduleZone.fallback(ReminderSettings.load(context).timezone, java.time.ZoneId.systemDefault())
      val timestamp = java.time.Instant.ofEpochMilli(original.receivedAt).atZone(zone)
      val parsed = NanoClient.parse(original.excerpt, timestamp)
      require(appContext.currentActivity?.hasWindowFocus() == true) { "앱 화면이 닫혀 AI 결과를 저장하지 않았습니다." }
      NotificationSuggestionStore.refine(context, id, parsed.title, parsed.start?.toInstant()?.toEpochMilli()
        ?: throw IllegalArgumentException("AI 분석 날짜가 올바르지 않습니다.")).toMap()
    }
    AsyncFunction("dismissNotificationSuggestion") { id: String ->
      NotificationSuggestionStore.dismiss(context, id)
    }
    AsyncFunction("openNotificationSuggestion") { id: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("NO_ACTIVITY", "앱 화면에서 일정 후보를 열어 주세요.", null)
      else activity.runOnUiThread {
        try {
          require(NotificationSuggestionStore.get(context, id) != null) { "일정 후보가 만료됐습니다." }
          activity.startActivity(Intent(activity, QuickEntryActivity::class.java)
            .putExtra("entryMode", "notificationSuggestion").putExtra("suggestionId", id))
          promise.resolve(null)
        } catch (error: Exception) { promise.reject("OPEN_SUGGESTION", error.message, error) }
      }
    }
    AsyncFunction("getQuickTileEnabled") {
      context.packageManager.getComponentEnabledSetting(ComponentName(context, ScheduleTileService::class.java)) !=
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED
    }
    AsyncFunction("setQuickTileEnabled") { enabled: Boolean ->
      val component = ComponentName(context, ScheduleTileService::class.java)
      context.packageManager.setComponentEnabledSetting(component,
        if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
        PackageManager.DONT_KILL_APP)
      enabled
    }
    AsyncFunction("requestAddTile") { promise: Promise ->
      val activity=appContext.currentActivity
      if(activity==null) promise.reject("NO_ACTIVITY","앱 화면에서 타일 추가를 요청해 주세요.",null)
      else activity.runOnUiThread {
        if(Build.VERSION.SDK_INT<33) {
          android.app.AlertDialog.Builder(android.view.ContextThemeWrapper(activity, R.style.PushOfficeDialog)).setTitle(activity.getString(R.string.tile_add_title)).setMessage(activity.getString(R.string.tile_add_manual,activity.getString(R.string.tile_label))).setPositiveButton("확인",null).show()
          promise.resolve("unsupported_manual")
        } else try {
          activity.getSystemService(StatusBarManager::class.java).requestAddTileService(
            ComponentName(activity,ScheduleTileService::class.java),activity.getString(R.string.tile_label),Icon.createWithResource(activity,R.drawable.ic_schedule_tile),activity.mainExecutor
          ) { result -> promise.resolve(when(result) {
            StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED -> "added"
            StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED -> "already_added"
            StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_NOT_ADDED -> "not_added"
            else -> "error_$result"
          }) }
        } catch(e: Exception) { promise.reject("ADD_TILE",e.message,e) }
      }
    }
    AsyncFunction("requestPinWidget") { kind: String, promise: Promise ->
      val activity=appContext.currentActivity
      if(activity==null) promise.reject("NO_ACTIVITY","앱 화면에서 위젯 추가를 요청해 주세요.",null)
      else activity.runOnUiThread {
        try {
          require(kind=="small" || kind=="agenda") { "지원하지 않는 위젯입니다." }
          val manager=AppWidgetManager.getInstance(activity)
          val provider=if(kind=="agenda") ScheduleAgendaWidgetProvider::class.java else ScheduleWidgetProvider::class.java
          promise.resolve(manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(ComponentName(activity,provider),null,null))
        } catch(e: Exception) { promise.reject("PIN_WIDGET",e.message,e) }
      }
    }
    AsyncFunction("getAiStatus") Coroutine { -> NanoClient.status() }
    AsyncFunction("downloadAiModel") Coroutine { ->
      require(appContext.currentActivity?.hasWindowFocus() == true) { "앱 설정 화면에서 다운로드를 실행해 주세요." }
      NanoClient.download { update -> sendEvent("aiDownloadProgress", update) }
    }
    AsyncFunction("generateBriefing") Coroutine { prompt: String ->
      require(appContext.currentActivity?.hasWindowFocus()==true) { "AI 요약은 앱 화면이 열려 있을 때 사용할 수 있습니다." }
      NanoClient.briefing(prompt)
    }
    AsyncFunction("refreshWidgets") { ScheduleWidgetProvider.refreshAll(context) }
    AsyncFunction("setUiTheme") { mode: String ->
      require(mode in setOf("system","light","dark")) { "지원하지 않는 테마입니다." }
      context.getSharedPreferences("push_office_ui",android.content.Context.MODE_PRIVATE)
        .edit().putString("themeMode",mode).apply()
    }
    AsyncFunction("getSchedules") { ScheduleStore(context).use { it.all().map(ScheduleRecord::toMap) } }
    AsyncFunction("saveSchedule") { value: Map<String, Any?> ->
      ScheduleRuntime.save(context, ScheduleRecord.fromMap(value)).toMap()
    }
    AsyncFunction("importSchedules") { values: List<Map<String, Any?>> -> ScheduleSerial.withLock {
      // Existing ids win: rerunning legacy import cannot overwrite an edited local record.
      val records = values.map(ScheduleRecord::fromMap)
      records.forEach { ScheduleTime.validate(it, System.currentTimeMillis(), true) }
      ScheduleStore(context).use { store -> store.importRecords(records) }
      ScheduleRuntime.changed(context)
      records.size
    } }
    AsyncFunction("deleteSchedule") { id: String -> ScheduleRuntime.delete(context, id) }
    AsyncFunction("configure") { value: Map<String, Any?> -> ScheduleSerial.withLock {
      val previous = ReminderSettings.load(context)
      ReminderSettings(
        value["pushEnabled"] as? Boolean ?: previous.pushEnabled,
        value["dailyBriefingEnabled"] as? Boolean ?: previous.dailyBriefingEnabled,
        value["dailyBriefingTime"] as? String ?: previous.dailyBriefingTime,
        value["timezone"] as? String ?: previous.timezone
      ).save(context)
      ReminderScheduler(context).rescheduleAll()
      ScheduleWidgetProvider.refreshAll(context)
      mapOf("exactAlarmAllowed" to ReminderScheduler(context).exactAlarmAllowed(),
        "notificationsAllowed" to ReminderNotifications.allowed(context),
        "timing" to if (ReminderScheduler(context).exactAlarmAllowed()) "exact" else "inexact")
    } }
    AsyncFunction("snoozeSchedule") { id: String, minutes: Int -> ReminderScheduler(context).snooze(id, minutes) }
    AsyncFunction("cancelSnooze") { id: String -> ReminderScheduler(context).cancelSnooze(id) }
  }
}

fun ScheduleRecord.toMap(): Map<String, Any?> = mapOf(
  "id" to id, "userId" to userId, "type" to type, "title" to title, "startAt" to startAt,
  "endAt" to endAt, "isAllDay" to isAllDay, "repeatType" to repeatType,
  "notificationEnabled" to notificationEnabled, "notificationId" to notificationId,
  "sourceText" to sourceText, "createdAt" to createdAt, "updatedAt" to updatedAt, "anchorZone" to anchorZone
)
