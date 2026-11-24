package expo.modules.pushoffice

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test

class ShareTextDeviceTest {
  private val context get() = ApplicationProvider.getApplicationContext<Context>()
  private fun views(view: View): List<View> =
    listOf(view) + if(view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()

  @Test fun registeredPlainTextShareDoesNotExposeTheEditorAndDoesNotAutoSave() {
    val manager=context.packageManager
    val share=manager.getActivityInfo(ComponentName(context,ShareTextActivity::class.java),0)
    val editor=manager.getActivityInfo(ComponentName(context,QuickEntryActivity::class.java),0)
    assertTrue(share.exported)
    assertFalse(editor.exported)
    val send=Intent(Intent.ACTION_SEND).setType("text/plain").setPackage(context.packageName)
    assertTrue(manager.queryIntentActivities(send,0).any { it.activityInfo.name==ShareTextActivity::class.java.name })
    assertFalse(manager.queryIntentActivities(Intent(Intent.ACTION_SEND).setType("image/png").setPackage(context.packageName),0)
      .any { it.activityInfo.name==ShareTextActivity::class.java.name })
    val count=ScheduleStore(context).use { it.all().size }
    val input="내일 오후 3시 합성 공유 일정"
    ActivityScenario.launch<QuickEntryActivity>(Intent(context,QuickEntryActivity::class.java)
      .putExtra("entryMode","sharedText").putExtra(SharedScheduleText.EXTRA,input)).use { scenario ->
      scenario.onActivity { activity ->
        val all=views(activity.window.decorView)
        assertEquals(input,all.filterIsInstance<EditText>().first().text.toString())
        assertTrue(all.filterIsInstance<TextView>().any { it.text.toString().contains("공유한 텍스트를 확인") })
        assertEquals(count,ScheduleStore(context).use { it.all().size })
      }
    }
    assertEquals(count,ScheduleStore(context).use { it.all().size })
  }
}
