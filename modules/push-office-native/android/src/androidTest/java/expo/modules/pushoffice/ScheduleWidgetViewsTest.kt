package expo.modules.pushoffice

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Rect
import android.os.Bundle
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.RemoteViews
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.roundToInt

class ScheduleWidgetViewsTest {
  private val events = listOf(
    WidgetEvent("회의/with space?#", "09:00", "고객사와 다음 분기 업무 범위를 확인하는 아주 긴 일정 제목"),
    WidgetEvent("second", "13:30", "디자인 검토"),
    WidgetEvent("third", "18:00", "퇴근 전 업무 정리")
  )
  private val smallEvents = events.map { event -> event.copy(time = "12/31 ${event.time}") }

  @Test fun resizedWidgetsKeepEntryActionsVisibleAtNormalAndLargeFont() = onMain {
    for (fontScale in listOf(1f, 2f)) {
      for (agenda in listOf(false, true)) {
        val width = if (agenda) 250 else 180
        val defaultHeight = if (agenda) 160 else 148
        for (height in listOf(110, defaultHeight, 360)) {
          for (count in listOf(0, 1, 2, 3)) {
            val records = (if (agenda) events else smallEvents).take(count)
            val fixture = render(agenda, records, width, height, fontScale)
            val description = "agenda=$agenda, ${width}x${height}dp, font=$fontScale, records=$count"
            assertEquals(description, fontScale, fixture.context.resources.configuration.fontScale, .001f)
            assertInputActionsFit(fixture, description)
            val rows = visibleRows(fixture.root)
            assertTrue("$description: the first event or empty message is present", rows.isNotEmpty())
            assertTrue("$description: hidden records do not leave empty rows", rows.size <= maxOf(1, if (agenda) count else minOf(1, count)))
            if (count == 0) assertEquals("$description: one empty message", 1, rows.size)
            if (!agenda) assertEquals("$description: next-event widget has one row", 1, rows.size)
            if (agenda && height == defaultHeight && fontScale == 1f && count >= 2) {
              assertEquals("$description: default agenda shows both example events", 2, rows.size)
            }
            if (agenda && height == 360 && count == 3) assertEquals("$description: expanded agenda exposes all records", 3, rows.size)
            val header = fixture.root.findViewById<View>(R.id.widget_header)
            if (header.visibility == View.VISIBLE) {
              assertTrue("$description: header does not overlap the first event", bounds(fixture.root, header).bottom <= bounds(fixture.root, rows.first()).top)
              listOf(R.id.widget_heading, R.id.widget_brand).map { fixture.root.findViewById<TextView>(it) }
                .filter { it.visibility == View.VISIBLE }
                .forEach { assertTextFits(it, 1, "$description: header ${it.text}") }
            }
            rows.forEachIndexed { index, row ->
              assertTextFits(row, if (!agenda && count > 0) 2 else 1, "$description: event ${index + 1}")
              if (!agenda && count > 0) assertDateAndTitleAreVisible(row, records.first(), description)
              val bounds = bounds(fixture.root, row)
              assertTrue("$description: event stays inside widget", bounds.top >= 0 && bounds.bottom <= fixture.root.height)
              if (index > 0) assertTrue("$description: event rows do not overlap", bounds.top >= bounds(fixture.root, rows[index - 1]).bottom)
            }
            val lastRow = bounds(fixture.root, rows.last())
            val actions = bounds(fixture.root, fixture.root.findViewById(R.id.widget_actions))
            assertTrue("$description: controls follow events without overlap", actions.top >= lastRow.bottom)
            assertTrue("$description: controls stay next to events", actions.top - lastRow.bottom <= fixture.dp(8))
          }
        }
      }
    }
  }

  @Test fun enlargingOneEventWidgetDoesNotStretchTheContentGaps() = onMain {
    for (agenda in listOf(false, true)) {
      for (fontScale in listOf(1f, 2f)) {
        val records = (if (agenda) events else smallEvents).take(1)
        val short = render(agenda, records, if (agenda) 250 else 180, 188, fontScale)
        val tall = render(agenda, records, if (agenda) 250 else 180, 420, fontScale)
        val shortRow = bounds(short.root, visibleRows(short.root).single())
        val tallRow = bounds(tall.root, visibleRows(tall.root).single())
        assertEquals("event height does not absorb host height", shortRow.height(), tallRow.height())
        fun contentOrigin(fixture: Fixture): Int {
          val header = fixture.root.findViewById<View>(R.id.widget_header)
          return if (header.visibility == View.VISIBLE) bounds(fixture.root, header).bottom else fixture.root.paddingTop
        }
        val shortOffset = shortRow.top - contentOrigin(short)
        val tallOffset = tallRow.top - contentOrigin(tall)
        assertEquals("event follows the header or root padding without stretching", shortOffset, tallOffset)
        assertTrue("event starts beside its content origin", shortOffset in 0..short.dp(8) && tallOffset in 0..tall.dp(8))
        val shortGap = bounds(short.root, short.root.findViewById(R.id.widget_actions)).top - shortRow.bottom
        val tallGap = bounds(tall.root, tall.root.findViewById(R.id.widget_actions)).top - tallRow.bottom
        assertEquals("input gap does not absorb host height", shortGap, tallGap)
        assertTrue("input actions stay beside the event", shortGap in 0..short.dp(8) && tallGap in 0..tall.dp(8))
      }
    }
  }

  @Test fun orientationVariantsUseActualPortraitAndLandscapeDimensionPairs() = onMain {
    for (fontScale in listOf(1f, 2f)) {
      for (agenda in listOf(false, true)) {
        val portraitWidth = if (agenda) 250 else 180
        val landscapeWidth = if (agenda) 420 else 320
        val portraitHeight = 360
        val landscapeHeight = 110
        val portraitContext = configuredContext(fontScale, Configuration.ORIENTATION_PORTRAIT)
        val landscapeContext = configuredContext(fontScale, Configuration.ORIENTATION_LANDSCAPE)
        val records = if (agenda) events else smallEvents
        val options = Bundle().apply {
          putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, portraitWidth)
          putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, landscapeWidth)
          putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, landscapeHeight)
          putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, portraitHeight)
        }
        val views = ScheduleWidgetViews.create(portraitContext, agenda, records, options)
        val portrait = applyViews(portraitContext, views, portraitWidth, portraitHeight)
        val landscape = applyViews(landscapeContext, views, landscapeWidth, landscapeHeight)
        assertInputActionsFit(portrait, "portrait agenda=$agenda font=$fontScale")
        assertInputActionsFit(landscape, "landscape agenda=$agenda font=$fontScale")
        assertEquals("portrait uses maxHeight instead of an imaginary minWidth/minHeight size", if (agenda) 3 else 1, visibleRows(portrait.root).size)
        assertEquals("the same RemoteViews switches to the short landscape variant", 1, visibleRows(landscape.root).size)
        if (!agenda) {
          assertDateAndTitleAreVisible(visibleRows(portrait.root).single(), records.first(), "portrait font=$fontScale")
          assertDateAndTitleAreVisible(visibleRows(landscape.root).single(), records.first(), "landscape font=$fontScale")
        }
      }
    }
  }

  @Test fun missingAndZeroOptionsRetainDefaultFootprintsInEitherOrientation() = onMain {
    for (agenda in listOf(false, true)) {
      val width = if (agenda) 250 else 180
      val height = if (agenda) 160 else 148
      val records = if (agenda) events else smallEvents
      val portraitContext = configuredContext(1f, Configuration.ORIENTATION_PORTRAIT)
      for (options in listOf(Bundle(), Bundle().apply {
        putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
      })) {
        val views = ScheduleWidgetViews.create(portraitContext, agenda, records, options)
        for (orientation in listOf(Configuration.ORIENTATION_PORTRAIT, Configuration.ORIENTATION_LANDSCAPE)) {
          val fixture = applyViews(configuredContext(1f, orientation), views, width, height)
          assertInputActionsFit(fixture, "default agenda=$agenda orientation=$orientation")
          assertEquals("default capacity remains intact", if (agenda) 2 else 1, visibleRows(fixture.root).size)
        }
      }
    }
  }

  @Test fun longEventTitleIsEllipsizedWhileTimeRetainsVisualHierarchy() = onMain {
    val fixture = render(false, smallEvents.take(1), 180, 188, 1f)
    val row = visibleRows(fixture.root).single()
    assertTextFits(row, 2, "next-event widget")
    assertDateAndTitleAreVisible(row, smallEvents.first(), "next-event widget")
    assertTrue("long titles are truncated at the visible end", row.layout.getEllipsisCount(row.layout.lineCount - 1) > 0)
    assertTrue("event retains its date and time", row.text.toString().contains(smallEvents.first().time))
    val text = row.text as Spanned
    val timeStart = text.toString().indexOf(smallEvents.first().time)
    val timeEnd = timeStart + smallEvents.first().time.length
    assertTrue("time has a color distinct from the title", text.getSpans(timeStart, timeEnd, ForegroundColorSpan::class.java).isNotEmpty())
    assertTrue("time is emphasized", text.getSpans(timeStart, timeEnd, StyleSpan::class.java).isNotEmpty())
    assertTrue("time is smaller than the title", text.getSpans(timeStart, timeEnd, RelativeSizeSpan::class.java).any { it.sizeChange < 1f })
  }

  @Test fun eventDestinationsPreserveEncodedIdsAndPackageScope() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val intent = ScheduleWidgetViews.eventIntent(context, events.first().id)
    assertEquals(Intent.ACTION_VIEW, intent.action)
    assertEquals(context.packageName, intent.`package`)
    assertEquals("pushofficeapp", intent.data?.scheme)
    assertEquals("schedule", intent.data?.host)
    assertEquals(listOf(events.first().id), intent.data?.pathSegments)
    assertTrue(intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
    assertTrue(intent.flags and Intent.FLAG_ACTIVITY_CLEAR_TOP != 0)
  }

  @Test fun textVoiceAndEmptyStateEntryHaveDistinctPendingIntentIdentities() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val intents = listOf("text", "voice", "chooser").map { mode ->
      ScheduleWidgetViews.entryIntent(context, mode).also { intent ->
        assertEquals(QuickEntryActivity::class.java.name, intent.component?.className)
        assertEquals(context.packageName, intent.component?.packageName)
        assertEquals(mode, intent.getStringExtra("entryMode"))
        assertEquals("pushoffice://entry/$mode", intent.dataString)
        assertTrue(intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
      }
    }
    for (first in intents.indices) for (second in first + 1 until intents.size) {
      assertFalse("entry modes must not overwrite one another's PendingIntent", intents[first].filterEquals(intents[second]))
    }
  }

  private fun assertInputActionsFit(fixture: Fixture, description: String) {
    val actions = fixture.root.findViewById<View>(R.id.widget_actions)
    val actionBounds = bounds(fixture.root, actions)
    assertTrue("$description: action row fits allocated height", actionBounds.bottom <= fixture.root.height)
    assertTrue("$description: action row and bottom padding fit allocated height", actionBounds.bottom + fixture.root.paddingBottom <= fixture.root.height)
    val buttons = listOf(R.id.widget_text, R.id.widget_voice).map { fixture.root.findViewById<TextView>(it) }
    buttons.forEach { button ->
      assertEquals("$description: input action is visible", View.VISIBLE, button.visibility)
      assertTrue("$description: input touch target is at least 48dp high", button.height >= fixture.dp(48))
      assertTrue("$description: input touch target is at least 48dp wide", button.width >= fixture.dp(48))
      assertTrue("$description: input action is clickable", button.hasOnClickListeners())
      assertTextFits(button, 1, "$description: ${button.text}")
      assertEquals("$description: input label is not truncated", 0, button.layout.getEllipsisCount(0))
      val buttonBounds = bounds(fixture.root, button)
      assertTrue("$description: input stays within width", buttonBounds.left >= 0 && buttonBounds.right <= fixture.root.width)
    }
    assertTrue("$description: input touch targets do not overlap", bounds(fixture.root, buttons[0]).right <= bounds(fixture.root, buttons[1]).left)
  }

  private fun assertTextFits(text: TextView, expectedLines: Int, description: String) {
    assertNotNull("$description: text has a measured layout", text.layout)
    assertEquals("$description: visible line count", expectedLines, text.layout.lineCount)
    assertTrue("$description: glyphs fit the view height", text.layout.height <= text.height - text.compoundPaddingTop - text.compoundPaddingBottom)
  }

  private fun assertDateAndTitleAreVisible(row: TextView, event: WidgetEvent, description: String) {
    assertEquals("$description: date and time are not truncated", 0, row.layout.getEllipsisCount(0))
    assertEquals("$description: date and time remain on their own line", event.time, row.text.subSequence(0, row.layout.getLineEnd(0)).toString().trim())
    val titleStart = row.layout.getLineStart(1)
    val titleEnd = row.layout.getLineEnd(1)
    val titleLine = row.text.subSequence(titleStart, titleEnd).toString().trim()
    assertTrue("$description: title is present on the second line", titleLine.isNotEmpty() && event.title.startsWith(titleLine.take(1)))
    assertTrue("$description: at least part of the title is visible", row.layout.getEllipsisCount(1) == 0 || row.layout.getEllipsisStart(1) > 0)
  }

  private fun render(agenda: Boolean, records: List<WidgetEvent>, widthDp: Int, heightDp: Int, fontScale: Float): Fixture {
    val context = configuredContext(fontScale)
    val options = Bundle().apply {
      putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, widthDp)
      putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, widthDp)
      putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, heightDp)
      putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, heightDp)
    }
    return applyViews(context, ScheduleWidgetViews.create(context, agenda, records, options), widthDp, heightDp)
  }

  private fun configuredContext(fontScale: Float, orientation: Int? = null): Context {
    val base = ApplicationProvider.getApplicationContext<Context>()
    val configuration = Configuration(base.resources.configuration).apply {
      this.fontScale = fontScale
      if (orientation != null) this.orientation = orientation
    }
    return base.createConfigurationContext(configuration)
  }

  private fun applyViews(context: Context, views: RemoteViews, widthDp: Int, heightDp: Int): Fixture {
    val fixture = Fixture(context)
    fixture.root = views.apply(context, FrameLayout(context)) as ViewGroup
    val width = fixture.dp(widthDp)
    val height = fixture.dp(heightDp)
    fixture.root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
    fixture.root.layout(0, 0, width, height)
    dumpLayout(fixture, widthDp, heightDp)
    return fixture
  }

  private fun dumpLayout(fixture: Fixture, widthDp: Int, heightDp: Int) {
    val root = fixture.root
    val header = root.findViewById<View>(R.id.widget_header)
    val rowInfo = visibleRows(root).joinToString { row ->
      "${bounds(root, row)} h=${row.height} textHeight=${row.layout.height} textSize=${row.textSize} pad=${row.paddingTop}/${row.paddingBottom}"
    }
    val message = "WIDGET ${widthDp}x${heightDp}dp font=${fixture.context.resources.configuration.fontScale} density=${fixture.context.resources.displayMetrics.density} root=${root.width}x${root.height} padding=${root.paddingTop}/${root.paddingBottom} header=${header.visibility}:${bounds(root, header)} rows=[$rowInfo] actions=${bounds(root, root.findViewById(R.id.widget_actions))}"
    Log.i("WidgetSizingTest", message)
    InstrumentationRegistry.getInstrumentation().sendStatus(2, Bundle().apply { putString("stream", "\n$message\n") })
  }

  private fun visibleRows(root: ViewGroup) = listOf(R.id.widget_event_1, R.id.widget_event_2, R.id.widget_event_3)
    .mapNotNull { root.findViewById<TextView>(it) }
    .filter { it.visibility == View.VISIBLE }

  private fun bounds(root: ViewGroup, child: View): Rect = Rect(0, 0, child.width, child.height).also { root.offsetDescendantRectToMyCoords(child, it) }

  private fun onMain(block: () -> Unit) = InstrumentationRegistry.getInstrumentation().runOnMainSync(block)

  private class Fixture(val context: Context) {
    lateinit var root: ViewGroup
    fun dp(value: Int) = (value * context.resources.displayMetrics.density).roundToInt()
  }
}
