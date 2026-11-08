package expo.modules.pushoffice

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import android.widget.TextView
import kotlin.math.max
import kotlin.math.roundToInt

internal data class WidgetEvent(val id: String, val time: String, val title: String)

internal object ScheduleWidgetViews {
  fun create(context: Context, agenda: Boolean, events: List<WidgetEvent>, options: Bundle): RemoteViews {
    val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: if (agenda) 250 else 180
    val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT).takeIf { it > 0 } ?: if (agenda) 160 else 148
    val maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH).takeIf { it > 0 } ?: minWidth
    val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).takeIf { it > 0 } ?: minHeight
    return RemoteViews(
      createForSize(context, agenda, events, maxWidth, minHeight),
      createForSize(context, agenda, events, minWidth, maxHeight)
    )
  }

  private fun createForSize(context: Context, agenda: Boolean, events: List<WidgetEvent>, width: Int, height: Int): RemoteViews {
    val heading = if (agenda) "오늘의 일정" else "다음 일정"
    val rows = if (agenda) listOf(R.id.widget_event_1, R.id.widget_event_2, R.id.widget_event_3) else listOf(R.id.widget_event_1)
    val empty = if (agenda) "오늘 일정 없음" else "일정 없음"
    val accent = context.getColor(R.color.po_widget_accent)
    val samples = events.take(rows.size).map { eventText(it, agenda, accent) }.ifEmpty { listOf(empty) }
    var eventSize = 15f
    var rowPadding = if (agenda) 3 else 4
    val lines = if (agenda) 1 else 2
    fun measuredRowHeight() = samples.maxOf { measure(context, it, eventSize, width, rowPadding, 28, lines = lines).measuredHeight }
    var rowHeight = measuredRowHeight()
    val headingView = measure(context, heading, 14f, width, 0, 24, bold = true)
    val brandView = measure(context, "PushOffice", 10f, width, 0, 0, bold = true)
    val actionHeight = dp(context, 48)
    val gap = dp(context, 6)
    var padding = dp(context, 12)
    var showHeader = true
    val availableHeight = dp(context, height)
    val minimumPadding = dp(context, 2)
    if (!agenda && availableHeight - minimumPadding * 2 - actionHeight - gap < rowHeight) {
      rowPadding = 0
      rowHeight = measuredRowHeight()
      while (eventSize > 11f && availableHeight - minimumPadding * 2 - actionHeight - gap < rowHeight) {
        eventSize -= 1f
        rowHeight = measuredRowHeight()
      }
    }
    if (context.resources.configuration.fontScale >= 1.5f && height <= 160) showHeader = false
    if (availableHeight - padding * 2 - headingView.measuredHeight - actionHeight - gap < rowHeight) showHeader = false
    if (availableHeight - padding * 2 - actionHeight - gap < rowHeight) padding = dp(context, 4)
    if (availableHeight - padding * 2 - actionHeight - gap < rowHeight) padding = minimumPadding
    val headerHeight = if (showHeader) headingView.measuredHeight else 0
    padding = minOf(padding, ((availableHeight - headerHeight - actionHeight - gap - rowHeight) / 2).coerceAtLeast(0))
    val capacity = ((availableHeight - padding * 2 - headerHeight - actionHeight - gap) / rowHeight).coerceIn(1, rows.size)
    val horizontalPadding = dp(context, 12)
    val showBrand = showHeader && headingView.measuredWidth + brandView.measuredWidth + dp(context, 12) <= dp(context, width) - horizontalPadding * 2

    return RemoteViews(context.packageName, if (agenda) R.layout.widget_agenda else R.layout.widget_small).apply {
      setViewPadding(R.id.widget_root, horizontalPadding, padding, horizontalPadding, padding)
      setViewVisibility(R.id.widget_header, if (showHeader) View.VISIBLE else View.GONE)
      setViewVisibility(R.id.widget_brand, if (showBrand) View.VISIBLE else View.GONE)
      rows.forEachIndexed { index, row ->
        val event = events.getOrNull(index)?.takeIf { index < capacity }
        val visible = event != null || index == 0
        setViewVisibility(row, if (visible) View.VISIBLE else View.GONE)
        setViewPadding(row, 0, dp(context, rowPadding), 0, dp(context, rowPadding))
        setTextViewTextSize(row, TypedValue.COMPLEX_UNIT_SP, eventSize)
        setTextViewText(row, event?.let { eventText(it, agenda, accent) } ?: empty)
        setContentDescription(row, event?.let { "${it.time}, ${it.title}" } ?: if (agenda) "오늘 예정된 일정이 없습니다." else "예정된 일정이 없습니다.")
        setOnClickPendingIntent(row, when {
          event != null -> pending(context, eventIntent(context, event.id))
          visible -> pending(context, entryIntent(context, "chooser"))
          else -> null
        })
      }
      setOnClickPendingIntent(R.id.widget_text, pending(context, entryIntent(context, "text")))
      setOnClickPendingIntent(R.id.widget_voice, pending(context, entryIntent(context, "voice")))
    }
  }

  fun eventIntent(context: Context, id: String): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse("pushofficeapp://schedule/${Uri.encode(id)}"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

  fun entryIntent(context: Context, mode: String): Intent =
    Intent(context, QuickEntryActivity::class.java)
      .setData(Uri.parse("pushoffice://entry/$mode"))
      .putExtra("entryMode", mode)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

  private fun eventText(event: WidgetEvent, agenda: Boolean, accent: Int): CharSequence = SpannableString("${event.time}${if (agenda) "  " else "\n"}${event.title}").apply {
    setSpan(ForegroundColorSpan(accent), 0, event.time.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    setSpan(StyleSpan(Typeface.BOLD), 0, event.time.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    if (!agenda) setSpan(RelativeSizeSpan(.8f), 0, event.time.length + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
  }

  private fun pending(context: Context, intent: Intent) = PendingIntent.getActivity(
    context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
  )

  private fun measure(context: Context, value: CharSequence, size: Float, width: Int, verticalPadding: Int, minimum: Int, bold: Boolean = false, lines: Int = 1): TextView =
    TextView(context).apply {
      text = value
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      includeFontPadding = false
      maxLines = lines
      ellipsize = TextUtils.TruncateAt.END
      if (bold) setTypeface(null, Typeface.BOLD)
      setPadding(0, dp(context, verticalPadding), 0, dp(context, verticalPadding))
      minHeight = dp(context, minimum)
      measure(View.MeasureSpec.makeMeasureSpec(dp(context, max(width - 24, 1)), View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
    }

  private fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).roundToInt()
}
