package expo.modules.pushoffice

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.speech.*
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.Gravity
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.*
import kotlinx.coroutines.*
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.UUID

/** A small native surface shared by the tile, widgets and app. Recording is always user initiated. */
class QuickEntryActivity : Activity() {
  private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
  private lateinit var root: LinearLayout
  private lateinit var transcript: EditText
  private lateinit var status: TextView
  private var recognizer: SpeechRecognizer?=null
  private var voiceRequested=false
  private val session=CaptureSession()
  private var applyingSpeech=false
  private var modelJob: Job?=null
  private val blue=Color.rgb(37,99,235)
  private val zone get()=ScheduleZone.fallback(ReminderSettings.load(this).timezone,ZoneId.systemDefault())
  private fun eventZone(record: ScheduleRecord)=record.anchorZone?.let(ZoneId::of) ?: zone
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    window.setBackgroundDrawableResource(android.R.color.transparent)
    window.setLayout((resources.displayMetrics.widthPixels*.94).toInt(), WindowManager.LayoutParams.WRAP_CONTENT)
    when(intent.getStringExtra("entryMode")) { "text" -> editor(false); "voice" -> editor(true); else -> chooser() }
  }
  private fun page(title: String, subtitle: String) {
    exitEditor()
    root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(22),dp(18),dp(22),dp(18)); background=GradientDrawable().apply { setColor(Color.WHITE); cornerRadius=dp(24).toFloat() } }
    val scroll=ScrollView(this).apply { addView(root); isFillViewport=false }
    setContentView(scroll)
    root.addView(TextView(this).apply { text="PUSH OFFICE"; setTextColor(blue); textSize=12f; setTypeface(null,Typeface.BOLD) })
    root.addView(TextView(this).apply { text=title; textSize=24f; setTextColor(Color.rgb(17,24,39)); setTypeface(null,Typeface.BOLD); setPadding(0,dp(10),0,dp(6)) })
    root.addView(TextView(this).apply { text=subtitle; textSize=14f; setTextColor(Color.rgb(107,114,128)); setPadding(0,0,0,dp(14)) })
    window.setLayout((resources.displayMetrics.widthPixels*.94).toInt(),WindowManager.LayoutParams.WRAP_CONTENT)
  }
  private fun chooser() {
    exitEditor()
    var availableWidth=resources.displayMetrics.widthPixels
    var availableHeight=resources.displayMetrics.heightPixels
    if(Build.VERSION.SDK_INT>=30) {
      val metrics=windowManager.currentWindowMetrics
      val insets=metrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      availableWidth=metrics.bounds.width()-insets.left-insets.right
      availableHeight=metrics.bounds.height()-insets.top-insets.bottom
    }
    val maxHeight=(availableHeight-dp(32)).coerceAtLeast(1)
    root=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      setPadding(dp(22),dp(18),dp(22),dp(12))
      background=GradientDrawable().apply { setColor(Color.WHITE); cornerRadius=dp(24).toFloat() }
    }
    val scroll=object: ScrollView(this) {
      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val height=if(MeasureSpec.getMode(heightMeasureSpec)==MeasureSpec.UNSPECIFIED) maxHeight
          else MeasureSpec.getSize(heightMeasureSpec).coerceAtMost(maxHeight)
        super.onMeasure(widthMeasureSpec,MeasureSpec.makeMeasureSpec(height,MeasureSpec.AT_MOST))
      }
    }.apply { addView(root); isFillViewport=false }
    setContentView(scroll)
    root.addView(TextView(this).apply {
      text=getString(R.string.tile_label); textSize=12f; setTextColor(blue); setTypeface(null,Typeface.BOLD)
    })
    root.addView(TextView(this).apply {
      text=getString(R.string.quick_entry_title); textSize=22f; setTextColor(Color.rgb(17,24,39))
      setTypeface(null,Typeface.BOLD); setPadding(0,dp(8),0,dp(6))
    })
    root.addView(TextView(this).apply {
      text=getString(R.string.quick_entry_description); textSize=14f; setTextColor(Color.rgb(75,85,99))
      setPadding(0,0,0,dp(12))
    })
    fun choice(title: Int, detail: Int, description: Int, primary: Boolean, action: ()->Unit) {
      val textColor=if(primary) Color.WHITE else Color.rgb(17,24,39)
      val row=LinearLayout(this).apply {
        orientation=LinearLayout.VERTICAL; gravity=Gravity.CENTER_VERTICAL
        setPadding(dp(16),dp(12),dp(16),dp(12)); minimumHeight=dp(64)
        background=GradientDrawable().apply {
          setColor(if(primary) blue else Color.rgb(248,250,252))
          cornerRadius=dp(12).toFloat()
          if(!primary) setStroke(dp(1),Color.rgb(203,213,225))
        }
        val attributes=obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackground))
        foreground=attributes.getDrawable(0); attributes.recycle()
        isClickable=true; isFocusable=true; contentDescription=getString(description)
        accessibilityDelegate=object: View.AccessibilityDelegate() {
          override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
            super.onInitializeAccessibilityNodeInfo(host,info); info.className=Button::class.java.name
          }
        }
        setOnClickListener { action() }
      }
      row.addView(TextView(this).apply {
        text=getString(title); textSize=16f; setTextColor(textColor); setTypeface(null,Typeface.BOLD)
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
      })
      row.addView(TextView(this).apply {
        text=getString(detail); textSize=13f; setTextColor(if(primary) Color.WHITE else Color.rgb(75,85,99))
        setPadding(0,dp(3),0,0); importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
      })
      root.addView(row,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(8) })
    }
    choice(R.string.quick_entry_text,R.string.quick_entry_text_detail,R.string.quick_entry_text_accessibility,true) { editor(false) }
    choice(R.string.quick_entry_voice,R.string.quick_entry_voice_detail,R.string.quick_entry_voice_accessibility,false) { editor(true) }
    root.addView(Button(this).apply {
      text=getString(R.string.quick_entry_close); contentDescription=text; textSize=14f
      isAllCaps=false; setTextColor(blue); background=null; minimumHeight=dp(48)
      setPadding(dp(12),0,dp(12),0); setOnClickListener { finish() }
    },LinearLayout.LayoutParams(-2,-2).apply { gravity=Gravity.END; topMargin=dp(4) })
    window.setLayout((availableWidth-dp(32)).coerceAtMost(dp(400)).coerceAtLeast(1),WindowManager.LayoutParams.WRAP_CONTENT)
  }
  private fun editor(voice: Boolean) {
    page("일정을 남겨 보세요", "예: 내일 오후 3시 고객 미팅\n변경: 고객 미팅 한 시간 늦춰")
    session.enterEditor()
    transcript=field("일정 입력", "날짜, 시간, 일정 제목을 입력하세요", "", true)
    transcript.addTextChangedListener(object: TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        session.inputChanged(); cancelModel()
        if(!applyingSpeech) stopSpeech()
      }
      override fun afterTextChanged(s: Editable?) {}
    })
    status=TextView(this).apply { text="모든 입력은 기기에서 처리합니다."; setTextColor(Color.DKGRAY); textSize=13f; accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE }
    root.addView(status)
    button("내용 확인") { val source=transcript.text.toString(); preview(ScheduleParser.parse(source,ZonedDateTime.now(zone)),source) }
    button("음성 입력 시작", "기기 내 한국어 음성 녹음 시작") { beginSpeech() }
    button("음성 입력 중지") { stopSpeech() }
    button("기기 AI로 해석") {
      stopSpeech(); cancelModel()
      val request=session.startModel(transcript.text.toString())
      if(request!=null) modelJob=scope.launch {
        fun current()=session.accepts(request,transcript.text.toString())
        status.text="기기 AI 상태 확인 중…"
        try {
          val availability=NanoClient.status()
          ensureActive(); if(!current()) return@launch
          status.text=availability.getValue("message")
          if(availability["status"]=="available") {
            val basic=ScheduleParser.parse(request.source,ZonedDateTime.now(zone))
            val parsed=if(basic.shiftMinutes!=null) basic else NanoClient.parse(request.source,ZonedDateTime.now(zone))
            ensureActive(); if(current()) preview(parsed,request.source)
          }
        } catch(e: CancellationException) { throw e } catch(e: Exception) {
          if(current()) status.text="${e.message}\n기본 해석 또는 직접 입력을 이용해 주세요."
        }
      }
    }
    button("AI 해석 취소") { session.inputChanged(); cancelModel(); status.text="기기 AI 해석을 취소했습니다." }
    button("직접 날짜와 시간 지정") { val source=transcript.text.toString(); preview(ParsedSchedule(title=source),source) }
    button("뒤로") { chooser() }
    if(voice) status.text="음성 입력 시작을 누르면 기기 내 한국어 인식을 확인합니다."
  }
  private fun preview(parsed: ParsedSchedule, source: String) {
    stopSpeech(); cancelModel()
    if(parsed.shiftMinutes != null && parsed.error==null) {
      val candidates=ScheduleStore(this).use { ScheduleParser.targets(parsed,it.all()) }
      if(candidates.isEmpty()) { status.text="일치하는 일정이 없습니다. 제목을 확인해 주세요."; return }
      fun selected(record: ScheduleRecord) {
        val before=Instant.ofEpochMilli(record.startAt).atZone(eventZone(record))
        val after=before.plusMinutes(parsed.shiftMinutes.toLong())
        form(record.title,after,record.repeatType,source,record,"변경 전: ${record.title}\n${before.format(FORMAT)}\n변경 후: ${after.format(FORMAT)}")
      }
      exitEditor()
      fun returnToEditor() { editor(false); transcript.setText(source) }
      AlertDialog.Builder(this).setTitle("변경할 일정을 선택해 주세요")
        .setItems(candidates.map { "${it.title} · ${Instant.ofEpochMilli(it.startAt).atZone(eventZone(it)).format(FORMAT)} (${eventZone(it).id})" }.toTypedArray()) { _,which -> selected(candidates[which]) }.setNegativeButton("취소") { _,_ -> returnToEditor() }.setOnCancelListener { returnToEditor() }.show()
    } else form(parsed.title,parsed.start,parsed.repeatType,source,null,parsed.error ?: "날짜와 시간을 확인한 뒤 저장해 주세요.")
  }
  private fun form(title: String, dateTime: ZonedDateTime?, repeat: String, source: String, original: ScheduleRecord?, message: String) {
    val formZone=original?.let(::eventZone) ?: dateTime?.zone ?: zone
    page(if(original==null) "저장 전 확인" else "변경 전 확인","$message\n시간대: ${formZone.id}")
    val titleField=field("일정 제목","일정 제목",title)
    val dateField=field("날짜 (YYYY-MM-DD)","날짜 YYYY-MM-DD",dateTime?.toLocalDate()?.toString().orEmpty())
    val timeField=field("시간 (HH:mm)","시간 HH:mm",dateTime?.toLocalTime()?.format(DateTimeFormatter.ofPattern("HH:mm")).orEmpty())
    root.addView(TextView(this).apply { text="반복"; textSize=13f; setTextColor(Color.rgb(75,85,99)); setPadding(0,dp(12),0,dp(5)) })
    val repeats=listOf("none","monthly","yearly")
    val spinner=Spinner(this).apply {
      contentDescription="반복 설정"
      adapter=ArrayAdapter(this@QuickEntryActivity,android.R.layout.simple_spinner_dropdown_item,listOf("반복 없음","매월","매년"))
      setSelection(repeats.indexOf(repeat).coerceAtLeast(0))
      minimumHeight=dp(50)
      setPadding(dp(10),0,dp(10),0)
      background=GradientDrawable().apply {
        setColor(Color.rgb(248,250,252))
        cornerRadius=dp(10).toFloat()
        setStroke(dp(1),Color.rgb(203,213,225))
      }
    }
    root.addView(spinner)
    val error=TextView(this).apply { setTextColor(Color.rgb(185,28,28)); accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE }; root.addView(error)
    button(if(original==null) "일정 저장" else "변경 내용 저장") {
      try {
        val start=LocalDate.parse(dateField.text.toString().trim()).atTime(LocalTime.parse(timeField.text.toString().trim())).atZone(formZone).toInstant().toEpochMilli()
        val now=System.currentTimeMillis()
        val draft=original?.copy(title=titleField.text.toString().trim(), startAt=start,
          endAt=original.endAt?.let { it+(start-original.startAt) },repeatType=repeats[spinner.selectedItemPosition],sourceText=source,updatedAt=now)
          ?: ScheduleRecord(UUID.randomUUID().toString(),"local","event",titleField.text.toString().trim(),start,repeatType=repeats[spinner.selectedItemPosition],sourceText=source,createdAt=now,updatedAt=now,anchorZone=formZone.id)
        require(start>now || original!=null && draft.repeatType!="none") { "미래 날짜와 시간을 지정해 주세요." }
        ScheduleTime.validate(draft,now)
        // Re-read under the same global mutation lock; a stale preview must never overwrite another edit.
        ScheduleSerial.withLock {
          if(original!=null) require(ScheduleStore(this).use { it.get(original.id) }==original) { "일정이 변경되었습니다. 다시 입력해 주세요." }
          ScheduleRuntime.save(this,draft)
        }
        Toast.makeText(this,"일정을 저장했습니다.",Toast.LENGTH_SHORT).show(); finish()
      } catch(e: Exception) { error.text=e.message?.takeIf { it.contains("주세요") || it.contains("일정") } ?: "날짜와 시간을 YYYY-MM-DD, HH:mm 형식으로 확인해 주세요." }
    }
    button("입력으로 돌아가기") { editor(false); transcript.setText(source) }
  }
  private fun field(label: String, hintText: String, value: String, multi: Boolean=false): EditText {
    root.addView(TextView(this).apply {
      text=label
      textSize=13f
      setTextColor(Color.rgb(75,85,99))
      setPadding(0,dp(12),0,dp(6))
    })
    return EditText(this).apply {
      hint=hintText
      contentDescription=label
      setText(value)
      textSize=16f
      setTextColor(Color.rgb(31,41,55))
      setHintTextColor(Color.rgb(107,114,128))
      setSingleLine(!multi)
      if(multi) { minLines=3; maxLines=5; gravity=Gravity.TOP }
      minimumHeight=dp(if(multi)104 else 50)
      setPadding(dp(12),dp(10),dp(12),dp(10))
      background=GradientDrawable().apply {
        setColor(Color.rgb(248,250,252))
        cornerRadius=dp(10).toFloat()
        setStroke(dp(1),Color.rgb(203,213,225))
      }
      root.addView(this,LinearLayout.LayoutParams(-1,-2))
    }
  }
  private fun button(label: String, description: String=label, action: ()->Unit) {
    val primary=label=="내용 확인" || label=="일정 저장" || label=="변경 내용 저장"
    val color=if(primary) Color.WHITE else blue
    root.addView(Button(this).apply {
      text=label
      contentDescription=description
      textSize=15f
      isAllCaps=false
      setTypeface(null,Typeface.BOLD)
      setTextColor(color)
      stateListAnimator=null
      background=GradientDrawable().apply {
        setColor(if(primary) blue else Color.WHITE)
        cornerRadius=dp(12).toFloat()
        setStroke(dp(1),if(primary) blue else Color.rgb(203,213,225))
      }
      setOnClickListener { action() }
    },LinearLayout.LayoutParams(-1,dp(50)).apply { topMargin=dp(if(primary)14 else 8) })
  }
  private fun beginSpeech() {
    session.inputChanged(); cancelModel()
    if(Build.VERSION.SDK_INT<31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) { status.text="이 기기는 기기 내 음성 인식을 지원하지 않습니다. 텍스트를 이용해 주세요. 온라인 인식은 사용하지 않습니다."; return }
    if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) { voiceRequested=true; status.text="마이크 권한을 허용한 뒤 음성 입력 시작을 다시 눌러 주세요."; requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),80); return }
    stopSpeech()
    val token=session.startVoice() ?: return
    val recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this); this.recognizer=recognizer
    recognizer.setRecognitionListener(object: RecognitionListener {
      override fun onResults(results: Bundle?) {
        if(!session.accepts(token)) return
        applySpeech(results); stopSpeech()
        status.text="인식 결과를 수정한 뒤 내용을 확인해 주세요."
      }
      override fun onPartialResults(results: Bundle?) { if(session.accepts(token)) applySpeech(results) }
      override fun onError(error: Int) { if(!session.accepts(token)) return; stopSpeech(); status.text="기기 내 음성 인식 오류 ($error). 다시 시도하거나 텍스트를 입력해 주세요." }
      override fun onReadyForSpeech(params: Bundle?) {}
      override fun onBeginningOfSpeech() {}
      override fun onRmsChanged(rmsdB: Float) {}
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() {}
      override fun onEvent(eventType: Int, params: Bundle?) {}
    })
    val request=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ko-KR").putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true)
    if(Build.VERSION.SDK_INT>=33) {
      recognizer.checkRecognitionSupport(request,mainExecutor,object: RecognitionSupportCallback {
        override fun onSupportResult(support: RecognitionSupport) {
          if(!session.accepts(token) || isFinishing || isDestroyed) return
          if(support.installedOnDeviceLanguages.any { it.equals("ko-KR",true) || it.equals("ko",true) }) {
            status.text="듣고 있습니다…"; recognizer.startListening(request)
          } else {
            status.text="기기 내 한국어 모델이 설치되지 않았습니다. 다운로드 후 음성 입력을 다시 눌러 주세요."
            if(support.supportedOnDeviceLanguages.any { it.startsWith("ko",true) }) AlertDialog.Builder(this@QuickEntryActivity).setTitle("한국어 음성 모델 다운로드").setMessage("기기의 음성 인식 서비스에 한국어 모델 다운로드를 요청할까요?").setPositiveButton("다운로드 요청") { _,_ ->
              if(session.accepts(token)) try { recognizer.triggerModelDownload(request) } catch(e: Exception) { status.text="모델 다운로드를 요청하지 못했습니다. 텍스트를 이용해 주세요." }
            }.setNegativeButton("텍스트 사용") { _,_ -> stopSpeech() }.show()
          }
        }
        override fun onError(error: Int) { if(session.accepts(token)) { stopSpeech(); status.text="기기 내 한국어 지원 여부를 확인할 수 없습니다 ($error). 텍스트를 이용해 주세요." } }
      })
    } else { stopSpeech(); status.text="이 Android 버전에서는 한국어 모델 설치 상태를 확인할 수 없습니다. 텍스트를 이용해 주세요." }
  }
  private fun applySpeech(results: Bundle?) {
    results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let {
      applyingSpeech=true
      try { transcript.setText(it) } finally { applyingSpeech=false }
    }
  }
  override fun onRequestPermissionsResult(code: Int, permissions: Array<out String>, results: IntArray) {
    super.onRequestPermissionsResult(code,permissions,results)
    if(code==80 && voiceRequested) {
      voiceRequested=false
      if(results.firstOrNull()==PackageManager.PERMISSION_GRANTED) beginSpeech() else status.text="마이크 권한 없이 텍스트로 입력할 수 있습니다."
    }
  }
  private fun cancelModel() { modelJob?.cancel(); modelJob=null }
  private fun stopSpeech() {
    session.stopVoice(); voiceRequested=false
    val old=recognizer; recognizer=null
    old?.cancel(); old?.destroy()
  }
  /** All internal screen changes pass here; leaving the editor is as strict as leaving the activity. */
  private fun exitEditor() { session.leaveEditor(); stopSpeech(); cancelModel() }
  override fun onResume() { super.onResume(); session.resume() }
  override fun onPause() { session.pause(); stopSpeech(); cancelModel(); super.onPause() }
  override fun onDestroy() { exitEditor(); scope.cancel(); super.onDestroy() }
  private fun dp(value: Int)=(resources.displayMetrics.density*value).toInt()
  companion object { private val FORMAT=DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm") }
}
