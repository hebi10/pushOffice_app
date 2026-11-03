package expo.modules.pushoffice

/** Activity-independent policy for the real capture UI's asynchronous callbacks. */
class CaptureSession {
  class Voice internal constructor(internal val screen: Long, internal val revision: Long)
  class Model internal constructor(val source: String, internal val screen: Long, internal val input: Long)
  private var foreground=false
  private var editor=false
  private var screen=0L
  private var input=0L
  private var speech=0L
  private var voiceIntent=false
  fun resume() { foreground=true }
  fun pause() { foreground=false; screen++; stopVoice() }
  fun enterEditor() { screen++; input++; editor=true; stopVoice() }
  fun leaveEditor() { screen++; input++; editor=false; stopVoice() }
  fun inputChanged() { input++ }
  fun stopVoice() { speech++; voiceIntent=false }
  fun startVoice(): Voice? {
    if(!foreground || !editor) return null
    input++; speech++; voiceIntent=true
    return Voice(screen,speech)
  }
  fun startModel(source: String): Model? {
    if(!foreground || !editor) return null
    input++
    return Model(source,screen,input)
  }
  fun accepts(voice: Voice): Boolean = foreground && editor && voiceIntent && voice.screen==screen && voice.revision==speech
  fun accepts(model: Model, source: String): Boolean = foreground && editor && model.screen==screen && model.input==input && model.source==source
}
