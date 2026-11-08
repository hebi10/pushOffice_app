package expo.modules.pushoffice

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.res.Configuration
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
import java.util.Locale
import java.util.UUID

/** A small native surface shared by the tile, widgets and app. Recording is always user initiated. */
class QuickEntryActivity : Activity() {
  private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
  private lateinit var root: LinearLayout
  private var confirmationFooter: LinearLayout?=null
  private lateinit var transcript: EditText
  private lateinit var status: TextView
  private var recognizer: SpeechRecognizer?=null
  private var voiceRequested=false
  private val session=CaptureSession()
  private var applyingSpeech=false
  private var modelJob: Job?=null
  private val isDark: Boolean get() = when(
    getSharedPreferences("push_office_ui", MODE_PRIVATE).getString("themeMode","system")
  ) {
    "dark" -> true
    "light" -> false
    else -> (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
  }
  private val actionColor: Int get() = if(isDark) Color.rgb(231,233,236) else Color.rgb(35,38,43)
  private val onPrimary: Int get() = if(isDark) Color.rgb(17,19,21) else Color.WHITE
  private val surface: Int get() = if(isDark) Color.rgb(28,31,34) else Color.WHITE
  private val foregroundColor: Int get() = if(isDark) Color.rgb(245,246,247) else Color.rgb(28,30,33)
  private val secondary: Int get() = if(isDark) Color.rgb(177,182,189) else Color.rgb(93,98,105)
  private val fieldBackground: Int get() = if(isDark) Color.rgb(41,45,49) else Color.rgb(236,238,241)
  private val inputBorder: Int get() = if(isDark) Color.rgb(119,127,136) else Color.rgb(129,136,145)
  private val dangerColor: Int get() = if(isDark) Color.rgb(255,120,120) else Color.rgb(180,35,24)
  private val zone get()=ScheduleZone.fallback(ReminderSettings.load(this).timezone,ZoneId.systemDefault())
  private fun eventZone(record: ScheduleRecord)=record.anchorZone?.let(ZoneId::of) ?: zone
  override fun onCreate(state: Bundle?) {
    when(getSharedPreferences("push_office_ui",MODE_PRIVATE).getString("themeMode","system")) {
      "dark" -> setTheme(R.style.PushOfficeDialogDark)
      "light" -> setTheme(R.style.PushOfficeDialogLight)
    }
    super.onCreate(state)
    window.setBackgroundDrawableResource(android.R.color.transparent)
    window.setLayout((resources.displayMetrics.widthPixels*.94).toInt(), WindowManager.LayoutParams.WRAP_CONTENT)
    when(intent.getStringExtra("entryMode")) {
      "text" -> editor(false)
      "voice" -> editor(true)
      "notificationSuggestion" -> {
        val suggestion = intent.getStringExtra("suggestionId")?.let { NotificationSuggestionStore.get(this, it) }
        if (suggestion == null) chooser()
        else {
          val date = Instant.ofEpochMilli(suggestion.startAt).atZone(zone)
          form(suggestion.title, date, "none", suggestion.excerpt, null,
            "알림 출처: ${suggestion.sourceApp}\n내용: ${suggestion.excerpt}\n분석 결과를 수정하거나 확인한 뒤 직접 저장해 주세요.")
        }
      }
      else -> chooser()
    }
  }
  private fun page(title: String, subtitle: String) {
    exitEditor()
    confirmationFooter=null
    root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(18),dp(14),dp(18),dp(16)); background=GradientDrawable().apply { setColor(surface); cornerRadius=dp(10).toFloat() } }
    val limit=(resources.displayMetrics.heightPixels-dp(160)).coerceAtLeast(dp(180))
    val scroll=object: ScrollView(this) {
      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val height=if(MeasureSpec.getMode(heightMeasureSpec)==MeasureSpec.UNSPECIFIED) limit
          else MeasureSpec.getSize(heightMeasureSpec).coerceAtMost(limit)
        super.onMeasure(widthMeasureSpec,MeasureSpec.makeMeasureSpec(height,MeasureSpec.AT_MOST))
      }
    }.apply { addView(root); isFillViewport=false }
    val frame=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      background=GradientDrawable().apply { setColor(surface); cornerRadius=dp(10).toFloat() }
    }
    frame.addView(scroll,LinearLayout.LayoutParams(-1,-2))
    confirmationFooter=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      setPadding(dp(18),0,dp(18),dp(12))
      visibility=View.GONE
    }.also { frame.addView(it,LinearLayout.LayoutParams(-1,-2)) }
    setContentView(frame)
    root.addView(TextView(this).apply { text="PUSH OFFICE"; setTextColor(actionColor); textSize=11f; setTypeface(null,Typeface.BOLD) })
    root.addView(TextView(this).apply { text=title; textSize=22f; setTextColor(foregroundColor); setTypeface(null,Typeface.BOLD); setPadding(0,dp(6),0,dp(4)) })
    root.addView(TextView(this).apply { text=subtitle; textSize=13f; setTextColor(secondary); setPadding(0,0,0,dp(10)) })
    window.setGravity(Gravity.CENTER)
    window.setLayout((resources.displayMetrics.widthPixels*.94).toInt().coerceAtMost(dp(440)),WindowManager.LayoutParams.WRAP_CONTENT)
  }
  private fun chooser() {
    confirmationFooter=null
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
      setPadding(dp(20),dp(12),dp(20),dp(22))
      background=GradientDrawable().apply {
        setColor(surface)
        val r=dp(10).toFloat()
        cornerRadii=floatArrayOf(r,r,r,r,0f,0f,0f,0f)
      }
    }
    val scroll=object: ScrollView(this) {
      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val height=if(MeasureSpec.getMode(heightMeasureSpec)==MeasureSpec.UNSPECIFIED) maxHeight
          else MeasureSpec.getSize(heightMeasureSpec).coerceAtMost(maxHeight)
        super.onMeasure(widthMeasureSpec,MeasureSpec.makeMeasureSpec(height,MeasureSpec.AT_MOST))
      }
    }.apply { addView(root); isFillViewport=false }
    setContentView(scroll)
    root.addView(View(this).apply {
      background=GradientDrawable().apply {
        setColor(inputBorder)
        cornerRadius=dp(3).toFloat()
      }
      importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
    },LinearLayout.LayoutParams(dp(42),dp(4)).apply {
      gravity=Gravity.CENTER_HORIZONTAL
      bottomMargin=dp(10)
    })
    val heading=LinearLayout(this).apply {
      orientation=LinearLayout.HORIZONTAL
      gravity=Gravity.CENTER_VERTICAL
    }
    heading.addView(TextView(this).apply {
      text=getString(R.string.tile_label)
      textSize=12f
      setTextColor(actionColor)
      setTypeface(null,Typeface.BOLD)
    },LinearLayout.LayoutParams(0,-2,1f))
    heading.addView(TextView(this).apply {
      text="×"
      contentDescription=getString(R.string.quick_entry_close)
      textSize=28f
      gravity=Gravity.CENTER
      setTextColor(secondary)
      minimumHeight=dp(48)
      minimumWidth=dp(48)
      isClickable=true
      isFocusable=true
      setOnClickListener { finish() }
    },LinearLayout.LayoutParams(dp(48),dp(48)))
    root.addView(heading)
    root.addView(ImageView(this).apply {
      setImageResource(R.drawable.quick_entry_mono)
      setColorFilter(actionColor)
      scaleType=ImageView.ScaleType.FIT_CENTER
      importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
    },LinearLayout.LayoutParams(dp(140),dp(106)).apply {
      gravity=Gravity.CENTER_HORIZONTAL
      bottomMargin=dp(10)
    })
    root.addView(TextView(this).apply {
      text=getString(R.string.quick_entry_title)
      textSize=22f
      setTextColor(foregroundColor)
      setTypeface(null,Typeface.BOLD)
      gravity=Gravity.CENTER
      setPadding(0,0,0,dp(8))
    })
    root.addView(TextView(this).apply {
      text=getString(R.string.quick_entry_description)
      textSize=14f
      setTextColor(secondary)
      gravity=Gravity.CENTER
      setPadding(0,0,0,dp(12))
    })
    fun choice(title: Int, detail: Int, description: Int, iconRes: Int, primary: Boolean, action: ()->Unit) {
      val textColor=if(primary) (onPrimary) else foregroundColor
      val row=LinearLayout(this).apply {
        orientation=LinearLayout.HORIZONTAL
        gravity=Gravity.CENTER_VERTICAL
        setPadding(dp(14),dp(12),dp(14),dp(12))
        minimumHeight=dp(72)
        background=GradientDrawable().apply {
          setColor(if(primary) actionColor else fieldBackground)
          cornerRadius=dp(8).toFloat()
          if(!primary) setStroke(dp(1),inputBorder)
        }
        val attributes=obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackground))
        foreground=attributes.getDrawable(0)
        attributes.recycle()
        isClickable=true
        isFocusable=true
        contentDescription=getString(description)
        accessibilityDelegate=object: View.AccessibilityDelegate() {
          override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
            super.onInitializeAccessibilityNodeInfo(host,info)
            info.className=Button::class.java.name
          }
        }
        setOnClickListener { action() }
      }
      row.addView(ImageView(this).apply {
        setImageResource(iconRes)
        setColorFilter(textColor)
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
      },LinearLayout.LayoutParams(dp(24),dp(24)).apply { marginEnd=dp(12) })
      val copy=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL }
      copy.addView(TextView(this).apply {
        text=getString(title)
        textSize=16f
        setTextColor(textColor)
        setTypeface(null,Typeface.BOLD)
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
      })
      copy.addView(TextView(this).apply {
        text=getString(detail)
        textSize=13f
        setTextColor(if(primary) textColor else secondary)
        alpha=if(primary) 0.85f else 1f
        setPadding(0,dp(3),0,0)
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
      })
      row.addView(copy,LinearLayout.LayoutParams(0,-2,1f))
      row.addView(TextView(this).apply {
        text="›"
        textSize=24f
        setTextColor(textColor)
        gravity=Gravity.CENTER
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
      },LinearLayout.LayoutParams(dp(22),-2))
      root.addView(row,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(10) })
    }
    choice(R.string.quick_entry_text,R.string.quick_entry_text_detail,R.string.quick_entry_text_accessibility,android.R.drawable.ic_menu_edit,true) { editor(false) }
    choice(R.string.quick_entry_voice,R.string.quick_entry_voice_detail,R.string.quick_entry_voice_accessibility,android.R.drawable.ic_btn_speak_now,false) { editor(true) }
    window.setGravity(Gravity.BOTTOM)
    window.setLayout(availableWidth.coerceAtMost(dp(440)).coerceAtLeast(1),WindowManager.LayoutParams.WRAP_CONTENT)
  }
  private fun sectionLabel(title: String, detail: String?=null) {
    root.addView(TextView(this).apply {
      text=title
      textSize=14f
      setTypeface(null,Typeface.BOLD)
      setTextColor(foregroundColor)
      setPadding(dp(2),dp(11),dp(2),dp(3))
    })
    if(!detail.isNullOrBlank()) root.addView(TextView(this).apply {
      text=detail
      textSize=12f
      setTextColor(secondary)
      setPadding(dp(2),0,dp(2),dp(2))
    })
  }
  private fun editor(voice: Boolean) {
    page("일정 입력", "텍스트나 음성으로 기록하고 저장 전에 확인하세요.")
    root.addView(TextView(this).apply {
      text="예: 내일 3시 고객 미팅 · 고객 미팅 1시간 늦춰"
      textSize=13f
      setTextColor(secondary)
      setPadding(dp(2),0,dp(2),dp(6))
    })
    session.enterEditor()
    transcript=field("일정 내용", "날짜, 시간, 일정 제목을 입력하세요", "", true)
    transcript.addTextChangedListener(object: TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        session.inputChanged(); cancelModel()
        if(!applyingSpeech) stopSpeech()
      }
      override fun afterTextChanged(s: Editable?) {}
    })
    status=TextView(this).apply {
      text="모든 입력은 기기에서 처리합니다."
      setTextColor(secondary)
      textSize=13f
      minimumHeight=dp(40)
      setPadding(dp(10),dp(8),dp(10),dp(8))
      gravity=Gravity.CENTER_VERTICAL
      background=GradientDrawable().apply {
        setColor(fieldBackground)
        cornerRadius=dp(6).toFloat()
      }
      accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    root.addView(status,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(8) })
    val optionalToolsStart=root.childCount
    sectionLabel("음성 입력", "시작 버튼을 누른 후에만 녹음합니다.")
    pairedButtons(
      "음성 입력 시작", { beginSpeech() },
      "음성 입력 중지", { stopSpeech() }
    )
    sectionLabel("기기 AI", "지원하는 기기에서만 로컬 해석을 사용합니다.")
    pairedButtons("기기 AI로 해석", {
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
    }, "AI 해석 취소", { session.inputChanged(); cancelModel(); status.text="기기 AI 해석을 취소했습니다." })
    val optionalTools=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL }
    while(root.childCount>optionalToolsStart) {
      val item=root.getChildAt(optionalToolsStart)
      root.removeViewAt(optionalToolsStart)
      optionalTools.addView(item)
    }
    val toolsToggle=Button(this).apply {
      text=if(voice) "음성·AI 도구 접기" else "음성·AI 도구 펼치기"
      isAllCaps=false
      contentDescription=text
      minimumHeight=dp(48)
      setTextColor(foregroundColor)
      stateListAnimator=null
      background=GradientDrawable().apply {
        setColor(fieldBackground)
        cornerRadius=dp(8).toFloat()
        setStroke(dp(1),inputBorder)
      }
      setOnClickListener {
        optionalTools.visibility=if(optionalTools.visibility==View.VISIBLE) View.GONE else View.VISIBLE
        text=if(optionalTools.visibility==View.VISIBLE) "음성·AI 도구 접기" else "음성·AI 도구 펼치기"
        contentDescription=text
      }
    }
    root.addView(toolsToggle)
    optionalTools.visibility=if(voice) View.VISIBLE else View.GONE
    root.addView(optionalTools)
    sectionLabel("내용 확인")
    button("직접 날짜와 시간 지정") { val source=transcript.text.toString(); preview(ParsedSchedule(title=source),source) }
    button("뒤로") { chooser() }
    button("내용 확인") { val source=transcript.text.toString(); preview(ScheduleParser.parse(source,ZonedDateTime.now(zone)),source) }
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
      val options: List<Pair<String, () -> Unit>> = candidates.map { record ->
        val text="${record.title} · ${Instant.ofEpochMilli(record.startAt).atZone(eventZone(record)).format(FORMAT)} (${eventZone(record).id})"
        text to { selected(record) }
      }
      showBrandedDialog("변경할 일정을 선택해 주세요",null,options,"취소") { returnToEditor() }
    } else form(parsed.title,parsed.start,parsed.repeatType,source,null,parsed.error ?: "날짜와 시간을 확인한 뒤 저장해 주세요.")
  }
  private fun form(title: String, dateTime: ZonedDateTime?, repeat: String, source: String, original: ScheduleRecord?, message: String) {
    val formZone=original?.let(::eventZone) ?: dateTime?.zone ?: zone
    page(
      if(original==null) "일정 확인 및 저장" else "변경 내용 확인",
      "제목, 날짜, 시간, 반복을 확인한 뒤 저장하세요."
    )
    val note=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      setPadding(dp(12),dp(9),dp(12),dp(9))
      background=GradientDrawable().apply {
        setColor(fieldBackground)
        cornerRadius=dp(6).toFloat()
      }
    }
    note.addView(TextView(this).apply {
      text=if(original==null) message else "기존 일정에서 변경되는 내용을 확인해 주세요."
      textSize=14f
      setTextColor(foregroundColor)
    })
    note.addView(TextView(this).apply {
      text="시간대: ${formZone.id}"
      textSize=12f
      setTextColor(secondary)
      setPadding(0,dp(6),0,0)
    })
    root.addView(note)
    if(original!=null && dateTime!=null) {
      val originalValue=Instant.ofEpochMilli(original.startAt).atZone(formZone).format(FORMAT)
      val updatedValue=dateTime.format(FORMAT)
      val summary=LinearLayout(this).apply {
        orientation=LinearLayout.VERTICAL
        setPadding(dp(14),dp(12),dp(14),dp(12))
        background=GradientDrawable().apply {
          setColor(fieldBackground); cornerRadius=dp(6).toFloat()
          setStroke(dp(1),inputBorder)
        }
      }
      summary.addView(TextView(this).apply {
        text=original.title
        textSize=16f
        setTypeface(null,Typeface.BOLD)
        setTextColor(foregroundColor)
        setPadding(0,0,0,dp(8))
      })
      summary.addView(TextView(this).apply {
        text="변경 전"
        textSize=12f
        setTextColor(secondary)
      })
      summary.addView(TextView(this).apply {
        text=originalValue
        textSize=14f
        setTextColor(foregroundColor)
      })
      summary.addView(TextView(this).apply {
        text="변경 후"
        textSize=12f
        setTextColor(secondary)
        setPadding(0,dp(10),0,0)
      })
      summary.addView(TextView(this).apply {
        text=updatedValue
        textSize=17f
        setTypeface(null,Typeface.BOLD)
        setTextColor(actionColor)
      })
      root.addView(summary,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(12) })
    }
    sectionLabel("일정 정보")
    val localizedSummary=TextView(this).apply {
      text=dateTime?.format(DateTimeFormatter.ofPattern("yyyy년 M월 d일 (E) · HH:mm",Locale.KOREAN)) ?: "날짜와 시간을 선택해 주세요."
      textSize=15f
      setTextColor(foregroundColor)
      setTypeface(null,Typeface.BOLD)
      setPadding(dp(3),dp(4),dp(3),dp(8))
      accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    root.addView(localizedSummary)
    val titleField=field("일정 제목","일정 제목",title,compact=true)
    val dateField=field("날짜 (YYYY-MM-DD)","날짜 YYYY-MM-DD",dateTime?.toLocalDate()?.toString().orEmpty(),compact=true)
    val timeField=field("시간 (HH:mm)","시간 HH:mm",dateTime?.toLocalTime()?.format(DateTimeFormatter.ofPattern("HH:mm")).orEmpty(),compact=true)
    fun updateLocalizedSummary() {
      val date=runCatching { LocalDate.parse(dateField.text.toString().trim()) }.getOrNull()
      val time=runCatching { LocalTime.parse(timeField.text.toString().trim()) }.getOrNull()
      localizedSummary.text=if(date!=null && time!=null) date.atTime(time).format(DateTimeFormatter.ofPattern("yyyy년 M월 d일 (E) · HH:mm",Locale.KOREAN)) else "날짜와 시간을 확인해 주세요."
    }
    val summaryWatcher=object: TextWatcher {
      override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
      override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) { updateLocalizedSummary() }
      override fun afterTextChanged(s: Editable?) {}
    }
    dateField.addTextChangedListener(summaryWatcher)
    timeField.addTextChangedListener(summaryWatcher)
    val pickerRow=LinearLayout(this).apply {
      orientation=LinearLayout.HORIZONTAL
      setPadding(0,dp(6),0,dp(2))
    }
    fun pickerButton(label: String, action: ()->Unit) {
      pickerRow.addView(TextView(this).apply {
        text=label
        contentDescription=label
        textSize=14f
        setTypeface(null,Typeface.BOLD)
        setTextColor(actionColor)
        gravity=Gravity.CENTER
        minimumHeight=dp(48)
        isClickable=true
        isFocusable=true
        background=GradientDrawable().apply {
          setColor(surface)
          cornerRadius=dp(8).toFloat()
          setStroke(dp(1),inputBorder)
        }
        setOnClickListener { action() }
      },LinearLayout.LayoutParams(0,-2,1f).apply {
        val margin=dp(4)
        setMargins(margin,0,margin,0)
      })
    }
    pickerButton("날짜 선택") {
      val initial=runCatching { LocalDate.parse(dateField.text.toString().trim()) }
        .getOrDefault(dateTime?.toLocalDate() ?: LocalDate.now(formZone))
      DatePickerDialog(this@QuickEntryActivity, { _,year,month,day ->
        dateField.setText(LocalDate.of(year,month+1,day).toString())
      },initial.year,initial.monthValue-1,initial.dayOfMonth).show()
    }
    pickerButton("시간 선택") {
      val initial=runCatching { LocalTime.parse(timeField.text.toString().trim()) }
        .getOrDefault(dateTime?.toLocalTime() ?: LocalTime.of(9,0))
      TimePickerDialog(this@QuickEntryActivity, { _,hour,minute ->
        timeField.setText(String.format(java.util.Locale.ROOT,"%02d:%02d",hour,minute))
      },initial.hour,initial.minute,true).show()
    }
    root.addView(pickerRow)
    val repeatCard=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      setPadding(dp(10),dp(8),dp(10),dp(10))
      background=GradientDrawable().apply {
        setColor(surface)
        cornerRadius=dp(8).toFloat()
          setStroke(dp(1),inputBorder)
      }
    }
    repeatCard.addView(TextView(this).apply {
      text="반복"
      textSize=13f
      setTypeface(null,Typeface.BOLD)
      setTextColor(foregroundColor)
      setPadding(dp(2),0,0,dp(5))
    })
    val repeats=listOf("none","monthly","yearly")
    val repeatLabels=listOf("반복 없음","매월","매년")
    val spinner=Spinner(this).apply {
      contentDescription="반복 설정"
      adapter=object: ArrayAdapter<String>(
        this@QuickEntryActivity,
        android.R.layout.simple_spinner_item,
        repeatLabels
      ) {
        override fun getView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
          (super.getView(position,convertView,parent) as TextView).apply {
            setTextColor(foregroundColor)
            textSize=15f
          }
        override fun getDropDownView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
          (super.getDropDownView(position,convertView,parent) as TextView).apply {
            setTextColor(foregroundColor)
            setBackgroundColor(surface)
            textSize=15f
            setPadding(dp(14),dp(12),dp(14),dp(12))
          }
      }
      setSelection(repeats.indexOf(repeat).coerceAtLeast(0))
      minimumHeight=dp(50)
      setPadding(dp(10),0,dp(10),0)
      background=GradientDrawable().apply {
        setColor(fieldBackground)
        cornerRadius=dp(6).toFloat()
        setStroke(dp(1),inputBorder)
      }
    }
    repeatCard.addView(spinner,LinearLayout.LayoutParams(-1,-2))
    root.addView(repeatCard,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(6) })
    val error=TextView(this).apply {
      setTextColor(dangerColor)
      textSize=13f
      setPadding(dp(2),dp(8),dp(2),0)
      accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    root.addView(error)
    val clearErrorOnEdit=object: TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        error.text=""
      }
      override fun afterTextChanged(s: Editable?) {}
    }
    titleField.addTextChangedListener(clearErrorOnEdit)
    dateField.addTextChangedListener(clearErrorOnEdit)
    timeField.addTextChangedListener(clearErrorOnEdit)
    button("입력으로 돌아가기") { editor(false); transcript.setText(source) }
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
          val suggestionId = intent.getStringExtra("suggestionId")
          if (suggestionId != null) {
            require(NotificationSuggestionStore.get(this, suggestionId) != null) { "일정 후보가 만료됐습니다. 다시 확인해 주세요." }
            val duplicate = ScheduleStore(this).use { it.all().any { row -> row.title == draft.title && row.startAt == draft.startAt } }
            require(!duplicate) { "이미 같은 제목과 시각의 일정이 있습니다. 다시 확인해 주세요." }
          }
          ScheduleRuntime.save(this,draft)
          if (suggestionId != null) NotificationSuggestionStore.dismiss(this, suggestionId)
        }
        Toast.makeText(this,"일정을 저장했습니다.",Toast.LENGTH_SHORT).show(); finish()
      } catch(e: Exception) { error.text=e.message?.takeIf { it.contains("주세요") || it.contains("일정") } ?: "날짜와 시간을 YYYY-MM-DD, HH:mm 형식으로 확인해 주세요." }
    }
  }
  private fun field(label: String, hintText: String, value: String, multi: Boolean=false, compact: Boolean=false): EditText {
    val card=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      setPadding(dp(if(compact) 10 else 12),dp(if(compact) 8 else 10),dp(if(compact) 10 else 12),dp(if(compact) 9 else 12))
      background=GradientDrawable().apply {
        setColor(surface)
        cornerRadius=dp(8).toFloat()
          setStroke(dp(1),inputBorder)
      }
    }
    card.addView(TextView(this).apply {
      text=label
      textSize=13f
      setTypeface(null,Typeface.BOLD)
      setTextColor(foregroundColor)
      setPadding(dp(2),0,0,dp(if(compact) 5 else 8))
    })
    return EditText(this).apply {
      hint=hintText
      contentDescription=label
      setText(value)
      textSize=16f
      setTextColor(foregroundColor)
      setHintTextColor(secondary)
      setSingleLine(!multi)
      if(multi) { minLines=3; maxLines=5; gravity=Gravity.TOP }
      minimumHeight=dp(if(multi)104 else 48)
      setPadding(dp(12),dp(10),dp(12),dp(10))
      background=GradientDrawable().apply {
        setColor(fieldBackground)
        cornerRadius=dp(6).toFloat()
        setStroke(dp(1),inputBorder)
      }
      card.addView(this,LinearLayout.LayoutParams(-1,-2))
      root.addView(card,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(if(compact) 6 else 10) })
    }
  }
  private fun button(label: String, description: String=label, action: ()->Unit) {
    val primary=label=="내용 확인" || label=="일정 저장" || label=="변경 내용 저장"
    val color=if(primary) (onPrimary) else actionColor
    val target=if(label=="일정 저장" || label=="변경 내용 저장") confirmationFooter ?: root else root
    if(target !== root) target.visibility=View.VISIBLE
    target.addView(Button(this).apply {
      text=label
      contentDescription=description
      textSize=15f
      isAllCaps=false
      setTypeface(null,Typeface.BOLD)
      setTextColor(color)
      stateListAnimator=null
      background=GradientDrawable().apply {
        setColor(if(primary) actionColor else surface)
        cornerRadius=dp(8).toFloat()
        setStroke(dp(1),if(primary) actionColor else inputBorder)
      }
      minHeight=dp(50)
      setSingleLine(false)
      setPadding(dp(12),dp(10),dp(12),dp(10))
      setOnClickListener { action() }
    },LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(if(primary)12 else 6) })
  }
  private fun pairedButtons(
    leftLabel: String, leftAction: () -> Unit,
    rightLabel: String, rightAction: () -> Unit
  ) {
    val container=LinearLayout(this).apply {
      orientation=LinearLayout.HORIZONTAL
      gravity=Gravity.CENTER_VERTICAL
    }
    fun add(label: String, action: () -> Unit) {
      container.addView(Button(this).apply {
        text=label
        contentDescription=label
        textSize=14f
        isAllCaps=false
        setSingleLine(false)
        setTextColor(actionColor)
        setTypeface(null,Typeface.BOLD)
        stateListAnimator=null
        setPadding(dp(8),dp(8),dp(8),dp(8))
        minHeight=dp(50)
        background=GradientDrawable().apply {
          setColor(surface)
          cornerRadius=dp(8).toFloat()
          setStroke(dp(1),inputBorder)
        }
        setOnClickListener { action() }
      },LinearLayout.LayoutParams(0,-2,1f).apply {
        setMargins(dp(4),0,dp(4),0)
      })
    }
    add(leftLabel,leftAction)
    add(rightLabel,rightAction)
    root.addView(container,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(8) })
  }

  private fun showBrandedDialog(
    title: String,
    message: String?,
    choices: List<Pair<String, () -> Unit>>,
    cancelLabel: String,
    onCancel: () -> Unit
  ) {
    val container=LinearLayout(this).apply {
      orientation=LinearLayout.VERTICAL
      setPadding(dp(20),dp(20),dp(20),dp(16))
      background=GradientDrawable().apply {
        setColor(surface)
        cornerRadius=dp(10).toFloat()
      }
    }
    container.addView(TextView(this).apply {
      text=title
      textSize=20f
      setTypeface(null,Typeface.BOLD)
      setTextColor(foregroundColor)
      setPadding(0,0,0,dp(10))
    })
    if(!message.isNullOrBlank()) container.addView(TextView(this).apply {
      text=message
      textSize=14f
      setTextColor(secondary)
      setPadding(0,0,0,dp(12))
    })
    val maxHeight=(resources.displayMetrics.heightPixels*0.78f).toInt().coerceAtLeast(dp(240))
    val scroll=object: ScrollView(this) {
      override fun onMeasure(widthSpec: Int, heightSpec: Int) {
        val size=if(MeasureSpec.getMode(heightSpec)==MeasureSpec.UNSPECIFIED) maxHeight
          else MeasureSpec.getSize(heightSpec).coerceAtMost(maxHeight)
        super.onMeasure(widthSpec,MeasureSpec.makeMeasureSpec(size,MeasureSpec.AT_MOST))
      }
    }.apply { addView(container); isFillViewport=false }
    val dialog=AlertDialog.Builder(this).setView(scroll).create()
    choices.forEachIndexed { index, entry ->
      val emphasized=choices.size==1 && index==0
      container.addView(TextView(this).apply {
        text=entry.first
        contentDescription=entry.first
        textSize=15f
        setTypeface(null,if(emphasized) Typeface.BOLD else Typeface.NORMAL)
        setTextColor(if(emphasized) (onPrimary) else foregroundColor)
        gravity=Gravity.CENTER_VERTICAL
        minimumHeight=dp(52)
        setPadding(dp(14),dp(12),dp(14),dp(12))
        isClickable=true
        isFocusable=true
        background=GradientDrawable().apply {
          setColor(if(emphasized) actionColor else fieldBackground)
          cornerRadius=dp(8).toFloat()
          if(!emphasized) setStroke(dp(1),inputBorder)
        }
        setOnClickListener { dialog.dismiss(); entry.second() }
      },LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(8) })
    }
    container.addView(TextView(this).apply {
      text=cancelLabel
      contentDescription=cancelLabel
      textSize=14f
      setTypeface(null,Typeface.BOLD)
      setTextColor(actionColor)
      gravity=Gravity.CENTER
      minimumHeight=dp(48)
      isClickable=true
      isFocusable=true
      setOnClickListener { dialog.dismiss(); onCancel() }
    },LinearLayout.LayoutParams(-1,dp(48)).apply { topMargin=dp(8) })
    dialog.setOnCancelListener { onCancel() }
    dialog.show()
    dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
    dialog.window?.setLayout(
      (resources.displayMetrics.widthPixels-dp(32)).coerceAtMost(dp(440)),
      WindowManager.LayoutParams.WRAP_CONTENT
    )
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
            if(support.supportedOnDeviceLanguages.any { it.startsWith("ko",true) }) {
              val actions: List<Pair<String, () -> Unit>> = listOf(
                "다운로드 요청" to {
                  if(session.accepts(token)) try { recognizer.triggerModelDownload(request) }
                  catch(e: Exception) { status.text="모델 다운로드를 요청하지 못했습니다. 텍스트를 이용해 주세요." }
                }
              )
              showBrandedDialog(
                "한국어 음성 모델 다운로드",
                "기기의 음성 인식 서비스에 한국어 모델 다운로드를 요청할까요?",
                actions,
                "텍스트 사용"
              ) { stopSpeech() }
            }
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
