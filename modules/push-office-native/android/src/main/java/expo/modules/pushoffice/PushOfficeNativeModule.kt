package expo.modules.pushoffice

import android.app.Activity
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class PushOfficeNativeModule : Module() {
  private val context get() = appContext.reactContext ?: error("앱 컨텍스트가 준비되지 않았습니다.")
  private val listener: () -> Unit = { sendEvent("schedulesChanged", emptyMap<String, Any>()) }
  private val backupScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var backupPromise: Promise? = null
  private var pendingExport: String? = null

  private fun launchLocalBackupDocument(create: Boolean, text: String?, promise: Promise) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("BACKUP_ACTIVITY", "앱 설정 화면에서 파일을 선택해 주세요.", null)
      return
    }
    activity.runOnUiThread {
      if (backupPromise != null) {
        promise.reject("BACKUP_BUSY", "이전 파일 선택 작업을 완료해 주세요.", null)
        return@runOnUiThread
      }
      try {
        if (create) require(text != null && text.length <= LocalBackupDocuments.MAX_BYTES) {
          "백업 데이터가 너무 큽니다."
        }
        val intent = Intent(if (create) Intent.ACTION_CREATE_DOCUMENT else Intent.ACTION_OPEN_DOCUMENT)
          .addCategory(Intent.CATEGORY_OPENABLE)
          .setType(if (create) "application/json" else "*/*")
        if (create) intent.putExtra(Intent.EXTRA_TITLE,
          "PushOffice-" + java.time.LocalDate.now().toString() + ".json")
        backupPromise = promise
        pendingExport = text
        activity.startActivityForResult(intent, if (create) 59301 else 59302)
      } catch (_: Exception) {
        backupPromise = null
        pendingExport = null
        promise.reject("BACKUP_PICKER", "Android 파일 선택창을 열지 못했습니다.", null)
      }
    }
  }
  override fun definition() = ModuleDefinition {
    Name("PushOfficeNative")
    Events("schedulesChanged", "aiDownloadProgress")
    OnCreate { ScheduleStore.addListener(listener) }
    OnDestroy {
      ScheduleStore.removeListener(listener)
      backupPromise?.reject("BACKUP_INTERRUPTED", "백업 파일 작업이 중단되었습니다.", null)
      backupPromise = null
      pendingExport = null
      backupScope.cancel()
    }
    OnActivityResult { activity, payload ->
      if (payload.requestCode == 59301 || payload.requestCode == 59302) {
        val operation = backupPromise
        val content = pendingExport
        backupPromise = null
        pendingExport = null
        if (operation != null) {
          if (payload.resultCode == Activity.RESULT_CANCELED) {
            operation.resolve(if (payload.requestCode == 59301) false else null)
          } else {
            val uri = payload.data?.data
            if (payload.resultCode != Activity.RESULT_OK || uri == null) {
              operation.reject("BACKUP_DOCUMENT", "파일 선택 결과가 올바르지 않습니다.", null)
            } else {
              backupScope.launch {
                try {
                  if (payload.requestCode == 59301) {
                    LocalBackupDocuments.write(activity.applicationContext, uri, content
                      ?: throw IllegalStateException("백업 정보가 없습니다."))
                    operation.resolve(true)
                  } else {
                    operation.resolve(LocalBackupDocuments.read(activity.applicationContext, uri))
                  }
                } catch (_: Exception) {
                  operation.reject("BACKUP_DOCUMENT_IO", "파일을 읽거나 저장하지 못했습니다. 용량과 접근 권한을 확인해 주세요.", null)
                }
              }
            }
          }
        }
      }
    }
    AsyncFunction("createLocalBackupDocument") { text: String, promise: Promise ->
      launchLocalBackupDocument(true, text, promise)
    }
    AsyncFunction("pickLocalBackupDocument") { promise: Promise ->
      launchLocalBackupDocument(false, null, promise)
    }
    AsyncFunction("openQuickEntry") { promise: Promise ->
      val activity=appContext.currentActivity
      if(activity==null) promise.reject("NO_ACTIVITY","앱 화면에서 빠른 입력을 열어 주세요.",null)
      else activity.runOnUiThread {
        try { activity.startActivity(Intent(activity,QuickEntryActivity::class.java)); promise.resolve(null) }
        catch(e: Exception) { promise.reject("OPEN_ENTRY",e.message,e) }
      }
    }
    AsyncFunction("openQuickEntryForDate") { selectedDate: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("NO_ACTIVITY", "앱 화면에서 빠른 입력을 열어 주세요.", null)
      else activity.runOnUiThread {
        try {
          val date = requireNotNull(CalendarQuickEntryDate.parse(selectedDate))
          activity.startActivity(Intent(activity, QuickEntryActivity::class.java)
            .putExtra(CalendarQuickEntryDate.EXTRA_DATE, date.toString()))
          promise.resolve(null)
        } catch (_: Exception) {
          promise.reject("OPEN_ENTRY_DATE", "선택한 날짜를 확인하고 다시 시도해 주세요.", null)
        }
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
      val parsed = AiModelRunner.parse(context,AiModelDownloadStore.selected(context),original.excerpt,timestamp)
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
    AsyncFunction("listAiModels") Coroutine { -> AiModelDownloadStore.list(context) }
    AsyncFunction("downloadAiModelById") Coroutine { id: String -> AiModelDownloadStore.download(context,id) }
    AsyncFunction("removeAiModel") Coroutine { id: String -> AiModelDownloadStore.remove(context,id) }
    AsyncFunction("verifyAiModel") Coroutine { id: String -> AiModelDownloadStore.verify(context,id) }
    AsyncFunction("selectAiModel") Coroutine { id: String -> AiModelDownloadStore.choose(context,id) }
    AsyncFunction("testAiModel") Coroutine { id: String, text: String ->
      require(appContext.currentActivity?.hasWindowFocus() == true) { "앱을 열고 모델을 테스트해 주세요." }
      val zone = ScheduleZone.fallback(ReminderSettings.load(context).timezone, java.time.ZoneId.systemDefault())
      AiModelRunner.benchmark(context,id,text,java.time.ZonedDateTime.now(zone))
    }
    AsyncFunction("downloadAiModel") Coroutine { ->
      require(appContext.currentActivity?.hasWindowFocus() == true) { "앱 설정 화면에서 다운로드를 실행해 주세요." }
      NanoClient.download { update -> sendEvent("aiDownloadProgress", update) }
    }
    AsyncFunction("generateBriefing") Coroutine { prompt: String ->
      require(appContext.currentActivity?.hasWindowFocus()==true) { "AI 요약은 앱 화면이 열려 있을 때 사용할 수 있습니다." }
      AiModelRunner.briefing(context,AiModelDownloadStore.selected(context),prompt)
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
    AsyncFunction("importBackupSchedules") { values: List<Map<String, Any?>> -> ScheduleSerial.withLock {
      val records = values.map(ScheduleRecord::fromMap)
      val imported = ScheduleStore(context).use { it.importBackupRecords(records) }
      val alarmsReady = if (imported > 0) runCatching { ScheduleRuntime.changed(context) }.isSuccess else true
      mapOf("imported" to imported, "alarmsReady" to alarmsReady)
    } }
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
  "sourceText" to sourceText, "createdAt" to createdAt, "updatedAt" to updatedAt, "anchorZone" to anchorZone,
  "location" to location, "meetingUrl" to meetingUrl, "notes" to notes
)
