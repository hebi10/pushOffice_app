package expo.modules.pushoffice

import org.junit.Assert.*
import org.junit.Test

class CaptureSessionTest {
  @Test fun manualPreviewOrChooserExitRejectsLateSupportAndResults() {
    val session=CaptureSession(); session.resume(); session.enterEditor()
    val speech=session.startVoice()!!
    assertTrue(session.accepts(speech))
    session.leaveEditor()
    assertFalse(session.accepts(speech))
    assertNull(session.startVoice())
    session.enterEditor()
    assertFalse(session.accepts(speech))
  }
  @Test fun onlyExplicitNewVoiceIntentCanRestartAfterPause() {
    val session=CaptureSession(); session.resume(); session.enterEditor()
    val old=session.startVoice()!!; session.pause(); session.resume()
    assertFalse(session.accepts(old))
    val new=session.startVoice()!!
    assertTrue(session.accepts(new)); assertFalse(session.accepts(old))
    session.stopVoice(); assertFalse(session.accepts(new))
  }
  @Test fun transcriptEditRejectsNanoOutputEvenIfTextLaterMatchesAgain() {
    val session=CaptureSession(); session.resume(); session.enterEditor()
    val work=session.startModel("내일 오후 3시 회의")!!
    assertTrue(session.accepts(work,"내일 오후 3시 회의"))
    session.inputChanged(); session.inputChanged()
    assertFalse(session.accepts(work,"내일 오후 3시 회의"))
  }
  @Test fun explicitVoiceStartSupersedesPendingNanoInterpretation() {
    val session=CaptureSession(); session.resume(); session.enterEditor()
    val model=session.startModel("원본")!!
    assertNotNull(session.startVoice())
    assertFalse(session.accepts(model,"원본"))
  }
  @Test fun newerModelRequestSupersedesEarlierRequestWithSameText() {
    val session=CaptureSession(); session.resume(); session.enterEditor()
    val first=session.startModel("같은 내용")!!
    val second=session.startModel("같은 내용")!!
    assertFalse(session.accepts(first,"같은 내용"))
    assertTrue(session.accepts(second,"같은 내용"))
  }
  @Test fun previewChooserAndNewEditorRejectEarlierNanoCompletion() {
    val session=CaptureSession(); session.resume(); session.enterEditor()
    val work=session.startModel("원본")!!
    session.leaveEditor(); assertFalse(session.accepts(work,"원본"))
    session.enterEditor(); assertFalse(session.accepts(work,"원본"))
    val current=session.startModel("새 내용")!!
    assertFalse(session.accepts(current,"다른 내용"))
    assertEquals("새 내용",current.source)
    assertTrue(session.accepts(current,"새 내용"))
  }
}
