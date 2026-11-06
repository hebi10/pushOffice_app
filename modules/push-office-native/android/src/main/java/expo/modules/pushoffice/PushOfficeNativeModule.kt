package expo.modules.pushoffice

import android.app.StatusBarManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
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
    Events("schedulesChanged")
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
