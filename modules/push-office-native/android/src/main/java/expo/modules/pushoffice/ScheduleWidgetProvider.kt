package expo.modules.pushoffice

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.*
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import java.time.*
import java.time.format.DateTimeFormatter

open class ScheduleWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { refreshAll(context) }
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
          val views=RemoteViews(context.packageName,if(agenda) R.layout.widget_agenda else R.layout.widget_small)
          val data=if(agenda) today else upcoming
          val rows=if(agenda) listOf(R.id.widget_event_1,R.id.widget_event_2,R.id.widget_event_3) else listOf(R.id.widget_event_1)
          rows.forEachIndexed { index,row ->
            val event=data.getOrNull(index)
            views.setViewVisibility(row,if(event!=null || index==0) View.VISIBLE else View.GONE)
            views.setTextViewText(row,event?.let { "${it.third.format(DateTimeFormatter.ofPattern(if(agenda) "HH:mm" else "M월 d일 HH:mm"))}  ${it.first.title}" } ?: if(agenda) "오늘 예정된 일정이 없습니다." else "예정된 일정이 없습니다.")
            // Clear old click when the displayed row becomes empty.
            views.setOnClickPendingIntent(row,event?.let {
              val intent=Intent(Intent.ACTION_VIEW,Uri.parse("pushofficeapp://schedule/${Uri.encode(it.first.id)}")).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
              PendingIntent.getActivity(context,0,intent,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            } ?: entry(context,"chooser"))
          }
          views.setOnClickPendingIntent(R.id.widget_text,entry(context,"text"))
          views.setOnClickPendingIntent(R.id.widget_voice,entry(context,"voice"))
          manager.updateAppWidget(id,views)
        }
      }
    }
    private fun entry(context: Context, mode: String)=PendingIntent.getActivity(context,0,
      Intent(context,QuickEntryActivity::class.java).setData(Uri.parse("pushoffice://entry/$mode")).putExtra("entryMode",mode).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}
class ScheduleAgendaWidgetProvider : ScheduleWidgetProvider()
