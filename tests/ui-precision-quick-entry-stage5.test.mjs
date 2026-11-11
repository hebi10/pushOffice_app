import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = source('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const capture = source('tools/ui/capture_android.py');
const verify = source('tools/ui/verify_captures.py');
const section = (a, b) => {
  const start = native.indexOf(a);
  const end = native.indexOf(b, start + 1);
  assert.ok(start >= 0 && end > start, 'Missing section ' + a);
  return native.slice(start, end);
};

test('precision stage 5 enlarges bounded chooser artwork and primary/secondary choices', () => {
  const chooser = section('private fun chooser()', 'private fun sectionLabel(');
  assert.match(chooser, /window\.setGravity\(Gravity\.BOTTOM\)/);
  assert.match(chooser, /val maxHeight=/);
  assert.match(chooser, /dp\(140\),dp\(106\)/);
  assert.match(chooser, /minimumHeight=dp\(72\)/);
  assert.match(chooser, /quick_entry_text_accessibility/);
  assert.match(chooser, /quick_entry_voice_accessibility/);
  assert.match(chooser, /quick_entry_close/);
  assert.match(chooser, /root\.addView\(ImageView\(this\)/);
  assert.match(chooser, /R\.drawable\.quick_entry_mono/);
});

test('precision stage 5 keeps editor centered, shorter and main confirmation last', () => {
  const page = section('private fun page(', 'private fun chooser()');
  const editor = section('private fun editor(voice: Boolean)', 'private fun preview(');
  assert.match(page, /window\.setGravity\(Gravity\.CENTER\)/);
  assert.match(page, /object: ScrollView\(this\)/);
  assert.match(page, /setPadding\(dp\(18\),dp\(14\),dp\(18\),dp\(16\)\)/);
  assert.match(editor, /transcript=field\("일정 내용"/);
  assert.match(editor, /sectionLabel\("음성 입력"/);
  assert.match(editor, /sectionLabel\("기기 AI"/);
  assert.match(editor, /pairedButtons\("기기 AI로 해석"/);
  assert.match(editor, /button\("직접 날짜와 시간 지정"\)/);
  assert.match(editor, /button\("내용 확인"\)/);
  assert.ok(editor.lastIndexOf('button("뒤로")') < editor.lastIndexOf('button("내용 확인")'));
  assert.doesNotMatch(editor, /if\(voice\) beginSpeech\(/);
  assert.match(editor, /if\(voice\) status\.text=/);
});

test('precision stage 5 makes confirmation input fields compact but preserves local parsing and save', () => {
  const form = section('private fun form(', 'private fun field(');
  const field = section('private fun field(', 'private fun button(');
  for (const label of ['일정 제목', '날짜 (YYYY-MM-DD)', '시간 (HH:mm)']) {
    assert.ok(form.includes('field("' + label), 'Missing editable field ' + label);
  }
  assert.equal((form.match(/compact=true/g) || []).length, 3);
  assert.match(field, /compact: Boolean=false/);
  assert.match(field, /dp\(if\(compact\) 6 else 10\)/);
  assert.match(form, /DatePickerDialog\(/);
  assert.match(form, /TimePickerDialog\(/);
  assert.match(form, /repeatCard\.addView\(spinner/);
  assert.match(form, /val formZone=original\?\.let\(::eventZone\)/);
  assert.match(form, /ScheduleTime\.validate\(draft,now\)/);
  assert.match(form, /ScheduleSerial\.withLock/);
  assert.match(form, /it\.get\(original\.id\) \}==original/);
  assert.match(form, /ScheduleRuntime\.save\(this,draft\)/);
  assert.ok(form.indexOf('button("입력으로 돌아가기")') < form.indexOf('button(if(original==null) "일정 저장"'));
});

test('precision stage 5 keeps voice opt-in and native AI cancellation', () => {
  const speech = section('private fun beginSpeech()', 'private fun applySpeech(');
  assert.match(speech, /SpeechRecognizer\.createOnDeviceSpeechRecognizer/);
  assert.match(speech, /Manifest\.permission\.RECORD_AUDIO/);
  assert.match(native, /session\.inputChanged\(\); cancelModel\(\)/);
  assert.match(native, /override fun onPause\(\) \{ session\.pause\(\); stopSpeech\(\); cancelModel\(\); super\.onPause\(\) \}/);
  assert.match(native, /"dark" -> setTheme\(R\.style\.PushOfficeDialogDark\)/);
  assert.match(native, /"light" -> setTheme\(R\.style\.PushOfficeDialogLight\)/);
});

test('precision stage 5 verifies real primary save actions on normal and compact screens', () => {
  for (const name of ['07b-native-confirmation-actions', '17b-compact-confirmation-actions']) {
    assert.ok(capture.includes(name), 'No screenshot recorded: ' + name);
    assert.ok(verify.includes(name + '.png'), 'Missing required screenshot: ' + name);
  }
  assert.match(capture, /Native confirmation footer actions are unreachable after scrolling/);
  assert.match(capture, /Compact confirmation footer actions are unreachable after scrolling/);
  for (const name of ['05-quick-entry', '05a-voice-editor', '07-native-save-preview', '09-native-time-picker', '11-quick-entry-dark', '16-compact-editor']) {
    assert.ok(capture.includes(name));
  }
});
