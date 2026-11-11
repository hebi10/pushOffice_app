package expo.modules.pushoffice

import android.Manifest
import android.app.KeyguardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Rect
import android.os.PowerManager
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.Button
import android.widget.ScrollView
import android.widget.TextView
import android.view.WindowManager
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class QuickEntryActivityUiTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()

  @Test fun tileAndChooserUseTheSameRecognizableAppName() {
    val service = context.packageManager.getServiceInfo(ComponentName(context, ScheduleTileService::class.java), 0)
    assertEquals("Push Office", service.loadLabel(context.packageManager).toString())
    launch().use { scenario ->
      scenario.onActivity { activity ->
        assertTrue(views(activity).filterIsInstance<TextView>().any { it.text.toString() == "Push Office" })
        assertTrue(views(activity).none { it is EditText })
      }
    }
  }

  @Test fun inputChoicesHaveAccessibleTouchTargetsAndStayInsideACompactScrollableWindow() {
    launch().use { scenario ->
      scenario.onActivity { activity ->
        val density = activity.resources.displayMetrics.density
        for (description in listOf(TEXT_CHOICE, VOICE_CHOICE)) {
          val choice = views(activity).single { it.contentDescription == description }
          assertTrue(choice.isClickable)
          assertTrue(choice.isFocusable)
          assertTrue("Input choice must remain at least 48dp high", choice.height >= 48 * density)
        }
        for (text in views(activity).filterIsInstance<TextView>()) {
          val layout = text.layout
          assertNotNull("Visible text must have a measured layout", layout)
          assertTrue("Text height must grow with the font size", layout.height <= text.height - text.compoundPaddingTop - text.compoundPaddingBottom)
          for (line in 0 until layout.lineCount) {
            assertEquals("Chooser text must not be truncated", 0, layout.getEllipsisCount(line))
            assertTrue("Chooser text must fit its row", layout.getLineWidth(line) <= layout.width + 1)
          }
        }
        val scroll = views(activity).filterIsInstance<ScrollView>().single()
        assertTrue("Dialog must not expand across a tablet", activity.window.attributes.width <= 400 * density)
        assertTrue("Dialog must fit the display", activity.window.decorView.height <= activity.resources.displayMetrics.heightPixels)
        scroll.scrollTo(0, scroll.getChildAt(0).height)
        val close = views(activity).filterIsInstance<TextView>().single { it.contentDescription == context.getString(R.string.quick_entry_close) }
        val visible = Rect()
        assertTrue("Close must remain reachable by scrolling", close.getGlobalVisibleRect(visible))
        assertTrue("The close touch target must remain visible", visible.height() >= 48 * density)
      }
    }
  }

  @Test fun textChoiceOpensTheExistingEditorAndReturningRestoresTheChooser() {
    launch().use { scenario ->
      scenario.onActivity { activity ->
        views(activity).single { it.contentDescription == TEXT_CHOICE }.performClick()
        assertTrue(views(activity).any { it is EditText })
        assertTrue(texts(activity).contains("모든 입력은 기기에서 처리합니다."))
        views(activity).filterIsInstance<TextView>().single { it.text.toString() == "뒤로" }.performClick()
        assertTrue(views(activity).any { it.contentDescription == TEXT_CHOICE })
        assertTrue(views(activity).none { it is EditText })
      }
    }
  }

  @Test fun calendarPreviewIsEditableAndNeverAutoSaves() {
    val before = ScheduleStore(context).use { it.all().size }
    val date = LocalDate.now().plusDays(4)
    val source = "${date.year}년 ${date.monthValue}월 ${date.dayOfMonth}일 오후 3시에 치과 예약"
    ActivityScenario.launch<QuickEntryActivity>(
      Intent(context, QuickEntryActivity::class.java).putExtra("entryMode", "text")
    ).use { scenario ->
      scenario.onActivity { activity ->
        val input = views(activity).filterIsInstance<EditText>().first()
        input.setText(source)
        views(activity).filterIsInstance<TextView>()
          .first { it.text.toString() == "내용 확인" && it.isClickable }.performClick()
        assertTrue(texts(activity).contains("일정 확인 및 저장"))
        val fields = views(activity).filterIsInstance<EditText>()
        assertTrue(fields.any { it.contentDescription == "일정 제목" })
        assertEquals(date.toString(),
          fields.first { it.contentDescription == "날짜 (YYYY-MM-DD)" }.text.toString())
        assertEquals("15:00",
          fields.first { it.contentDescription == "시간 (HH:mm)" }.text.toString())
        assertTrue(texts(activity).contains("일정 저장"))
        assertEquals(before, ScheduleStore(context).use { it.all().size })
      }
    }
    assertEquals("Opening an editable preview must not save a calendar event",
      before, ScheduleStore(context).use { it.all().size })
  }

  @Test fun confirmationKeepsBackAndSaveFixedWhileDirectIsoEditingRemainsOptional() {
    val before = ScheduleStore(context).use { it.all().size }
    val date = LocalDate.now().plusDays(4)
    val spoken = "${date.year}년 ${date.monthValue}월 ${date.dayOfMonth}일 오후 3시에 치과 예약"
    ActivityScenario.launch<QuickEntryActivity>(
      Intent(context, QuickEntryActivity::class.java).putExtra("entryMode", "text")
    ).use { scenario ->
      scenario.onActivity { activity ->
        val input = views(activity).filterIsInstance<EditText>().first()
        input.setText(spoken)
        views(activity).filterIsInstance<TextView>()
          .single { it.text.toString() == "내용 확인" && it.isClickable }.performClick()
      }
      InstrumentationRegistry.getInstrumentation().waitForIdleSync()
      scenario.onActivity { activity ->
        val visibleTexts = texts(activity)
        assertTrue("Display a Korean date first", visibleTexts.any {
          it.contains("${date.year}년") && it.contains("15:00")
        })
        assertTrue("Display actual configured timezone, not a forced conversion",
          visibleTexts.any { it.startsWith("저장 기준 시간대: ") })
        val fieldDate = views(activity).filterIsInstance<EditText>()
          .single { it.contentDescription == "날짜 (YYYY-MM-DD)" }
        val fieldTime = views(activity).filterIsInstance<EditText>()
          .single { it.contentDescription == "시간 (HH:mm)" }
        assertEquals(date.toString(), fieldDate.text.toString())
        assertEquals("15:00", fieldTime.text.toString())
        assertEquals("ISO fields must be hidden until requested", View.GONE, (fieldDate.parent as View).visibility)
        assertEquals(View.GONE, (fieldTime.parent as View).visibility)
        val buttons = views(activity).filterIsInstance<Button>()
        val back = buttons.single { it.text.toString() == "입력으로 돌아가기" }
        val save = buttons.single { it.text.toString() == "일정 저장" }
        assertSame("Both confirmation actions must share the fixed footer", back.parent, save.parent)
        assertTrue("Footer must be outside the scroll container", save.parent !is ScrollView)
        val saveBounds = Rect()
        val backBounds = Rect()
        assertTrue("Save must be reachable without scrolling", save.getGlobalVisibleRect(saveBounds))
        assertTrue("Back must be reachable without scrolling", back.getGlobalVisibleRect(backBounds))
        assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
          activity.window.attributes.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST)
        buttons.single { it.text.toString() == "날짜·시간 직접 입력" }.performClick()
        assertEquals(View.VISIBLE, (fieldDate.parent as View).visibility)
        assertEquals(View.VISIBLE, (fieldTime.parent as View).visibility)
        fieldDate.setText("invalid")
        save.performClick()
        assertTrue("Invalid date must show a visible footer error", visibleError(activity))
        assertEquals("Invalid form must not save an event", before, ScheduleStore(context).use { it.all().size })
      }
    }
  }

  private fun visibleError(activity: QuickEntryActivity): Boolean =
    views(activity).filterIsInstance<TextView>().any {
      it.visibility == View.VISIBLE && it.text.toString().contains("날짜와 시간을 다시 확인")
    }

  @Test fun voiceChoiceOnlyOpensTheEditorAndWaitsForAnExplicitRecordingStart() {
    val permission = context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
    launch().use { scenario ->
      scenario.onActivity { activity ->
        views(activity).single { it.contentDescription == VOICE_CHOICE }.performClick()
        assertTrue(views(activity).any { it is EditText })
        assertTrue(texts(activity).contains("음성 입력 시작을 누르면 기기 내 한국어 인식을 확인합니다."))
        assertFalse(texts(activity).any { it.contains("듣고 있습니다") || it.contains("마이크 권한을 허용") })
      }
      val instrumentation = InstrumentationRegistry.getInstrumentation()
      instrumentation.waitForIdleSync()
      val automation = instrumentation.uiAutomation
      automation.waitForIdle(100, 5_000)
      assertTrue("Voice UI check requires an interactive test device", context.getSystemService(PowerManager::class.java).isInteractive)
      assertFalse("Voice UI check requires an unlocked test device", context.getSystemService(KeyguardManager::class.java).isKeyguardLocked)
      val activeRoot = automation.rootInActiveWindow
        ?: throw AssertionError("Active window must be observable after choosing voice")
      try {
        val activePackage = activeRoot.packageName?.toString().orEmpty()
        assertTrue("Active window must identify its package", activePackage.isNotBlank())
        Log.i("QuickEntryActivityUiTest", "Voice choice active window package=$activePackage")
        assertFalse("Choosing voice must not open a microphone permission dialog; active=$activePackage",
          activePackage.endsWith(".permissioncontroller") || activePackage.endsWith(".packageinstaller"))
        val inputMethodPackages = context.getSystemService(InputMethodManager::class.java).enabledInputMethodList.map { it.packageName }
        assertTrue("Voice editor or its keyboard must be the active window; active=$activePackage",
          activePackage == context.packageName || activePackage in inputMethodPackages)
      } finally {
        activeRoot.recycle()
      }
      scenario.onActivity { activity ->
        Log.i("QuickEntryActivityUiTest", "Voice editor hasWindowFocus=${activity.hasWindowFocus()}")
        assertTrue(views(activity).any { it is EditText })
        assertTrue(texts(activity).contains("음성 입력 시작을 누르면 기기 내 한국어 인식을 확인합니다."))
        assertFalse(texts(activity).any { it.contains("듣고 있습니다") || it.contains("마이크 권한을 허용") })
        assertEquals(permission, activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO))
      }
    }
  }

  @Test fun closeDismissesTheChooserWithoutOpeningAnEditor() {
    launch().use { scenario ->
      scenario.onActivity { activity ->
        views(activity).filterIsInstance<TextView>().single { it.contentDescription == context.getString(R.string.quick_entry_close) }.performClick()
        assertTrue(activity.isFinishing)
      }
    }
  }

  private fun launch(): ActivityScenario<QuickEntryActivity> =
    ActivityScenario.launch(Intent(context, QuickEntryActivity::class.java))

  private fun views(activity: QuickEntryActivity) = descendants(activity.findViewById(android.R.id.content))
  private fun texts(activity: QuickEntryActivity) = views(activity).filterIsInstance<TextView>().map { it.text.toString() }
  private fun descendants(view: View): List<View> = listOf(view) +
    if (view is ViewGroup) (0 until view.childCount).flatMap { descendants(view.getChildAt(it)) } else emptyList()

  companion object {
    private const val TEXT_CHOICE = "텍스트로 일정 입력"
    private const val VOICE_CHOICE = "음성 입력 화면 열기. 녹음은 시작 버튼을 눌러야 시작됩니다."
  }
}
