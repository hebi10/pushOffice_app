package expo.modules.pushoffice

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.*
import android.os.Bundle
import java.time.*
import java.time.format.DateTimeFormatter

open class ScheduleWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { refreshAll(context) }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { refreshAll(context) }
  override fun onDisabled(context: Context) { refreshAll(context) }
  override fun onDeleted(context: Context, ids: IntArray) { refreshAll(context) }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context,intent)
    if(intent.action in setOf(WidgetRefreshScheduler.ACTION,ScheduleRuntime.ACTION_CHANGED,Intent.ACTION_BOOT_COMPLETED,Intent.ACTION_TIME_CHANGED,Intent.ACTION_TIMEZONE_CHANGED,Intent.ACTION_DATE_CHANGED,Intent.ACTION_MY_PACKAGE_REPLACED)) refreshAll(context)
  }
  companion object {
    fun refreshAll(context: Context): Unit = ScheduleSerial.withLock {
      val manager=AppWidgetManager.getInstance(context)
      val providers = listOf(ScheduleWidgetProvider::class.java to false,ScheduleAgendaWidgetProvider::class.java to true)
      val widgetIds = providers.associate { (provider, _) -> provider to manager.getAppWidgetIds(ComponentName(context, provider)) }
      if (widgetIds.values.all { it.isEmpty() }) { WidgetRefreshScheduler.reserve(context, null); return@withLock }
      val now=ZonedDateTime.now(); val midnight=now.toLocalDate().atStartOfDay(now.zone).toInstant().toEpochMilli()
      val end=now.toLocalDate().plusDays(1).atStartOfDay(now.zone).toInstant().toEpochMilli()
      val records=ScheduleStore(context).use { store -> store.all().map { it to store.anchorZone(it.id) } }
      fun events(after: Long)=records.mapNotNull { (r,anchorZone) -> ScheduleTime.nextOccurrence(r,after,anchorZone)?.let { Triple(r,it,Instant.ofEpochMilli(it).atZone(now.zone)) } }.sortedBy { it.second }
      val upcoming=events(System.currentTimeMillis()-1).take(1)
      val today=events(midnight-1).filter { it.second<end }.take(3)
      WidgetRefreshScheduler.reserve(context, WidgetRefreshTime.next(now.toInstant().toEpochMilli(), end, upcoming.firstOrNull()?.second))
      for((provider,agenda) in providers) {
        for(id in widgetIds.getValue(provider)) {
          val data=if(agenda) today else upcoming
          val events=data.map { event ->
            WidgetEvent(event.first.id,event.third.format(DateTimeFormatter.ofPattern(if(agenda) "HH:mm" else "M/d HH:mm")),event.first.title)
          }
          manager.updateAppWidget(id,ScheduleWidgetViews.create(context,agenda,events,manager.getAppWidgetOptions(id)))
        }
      }
    }
  }
}
class ScheduleAgendaWidgetProvider : ScheduleWidgetProvider()
