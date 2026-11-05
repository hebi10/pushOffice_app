import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const native = readFileSync(new URL('../modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt', import.meta.url), 'utf8');
const capture = readFileSync(new URL('../tools/ui/capture_android.py', import.meta.url), 'utf8');

const slice = (from, to) => {
  const a = native.indexOf(from);
  const b = native.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `Could not locate section ${from} → ${to}`);
  return native.slice(a, b);
};

test('PO-UI-03 chooser is a bounded accessible bottom sheet with both input options and explicit close', () => {
  const chooser = slice('private fun chooser()', 'private fun sectionLabel(');
  assert.match(chooser, /window\.setGravity\(Gravity\.BOTTOM\)/);
  assert.match(chooser, /val maxHeight=/);
  assert.match(chooser, /maxHeight\)/);
  assert.match(chooser, /quick_entry_text_accessibility/);
  assert.match(chooser, /quick_entry_voice_accessibility/);
  assert.match(chooser, /quick_entry_close/);
  assert.match(chooser, /android\.R\.drawable\.ic_menu_edit/);
  assert.match(chooser, /android\.R\.drawable\.ic_btn_speak_now/);
  assert.match(chooser, /contentDescription=getString\(description\)/);
});

test('PO-UI-03 editor remains centered with keyboard-resizable bounded scroll and no automatic audio recording', () => {
  const page = slice('private fun page(', 'private fun chooser()');
  const editor = slice('private fun editor(voice: Boolean)', 'private fun preview(');
  assert.match(page, /window\.setGravity\(Gravity\.CENTER\)/);
  assert.match(page, /object: ScrollView/);
  assert.match(editor, /session\.enterEditor\(\)/);
  assert.match(editor, /pairedButtons\(/);
  assert.match(editor, /sectionLabel\("음성 입력"/);
  assert.match(editor, /sectionLabel\("기기 AI"/);
  assert.match(editor, /button\("내용 확인"\)/);
  assert.match(editor, /if\(voice\) status\.text=/);
  assert.doesNotMatch(editor, /if\(voice\) beginSpeech\(/);
  assert.ok(editor.indexOf('button("내용 확인")') > editor.indexOf('sectionLabel("기기 AI"'));
});

test('PO-UI-03 confirmation groups labels, supports picker inputs and compares changes', () => {
  const form = slice('private fun form(', 'private fun field(');
  assert.match(form, /"일정 확인 및 저장"/);
  assert.match(form, /"변경 내용 확인"/);
  assert.match(form, /"변경 전"/);
  assert.match(form, /"변경 후"/);
  assert.match(form, /text=original\.title/);
  assert.match(form, /field\("일정 제목"/);
  assert.match(form, /field\("날짜 \(YYYY-MM-DD\)"/);
  assert.match(form, /field\("시간 \(HH:mm\)"/);
  assert.match(form, /DatePickerDialog\(/);
  assert.match(form, /TimePickerDialog\(/);
  assert.match(form, /"반복 설정"/);
  assert.match(form, /repeatCard\.addView\(spinner/);
});

test('PO-UI-03 change target and save preserve stale-event protection, timezone, recurrence and cancellation', () => {
  const choose = slice('private fun preview(', 'private fun form(');
  const form = slice('private fun form(', 'private fun field(');
  assert.match(choose, /ScheduleParser\.targets/);
  assert.match(choose, /showBrandedDialog/);
  assert.match(choose, /returnToEditor\(\)/);
  assert.match(form, /val formZone=original\?\.let\(::eventZone\)/);
  assert.match(form, /original\?\.copy/);
  assert.match(form, /repeats\[spinner\.selectedItemPosition\]/);
  assert.match(form, /ScheduleTime\.validate\(draft,now\)/);
  assert.match(form, /ScheduleSerial\.withLock/);
  assert.match(form, /it\.get\(original\.id\)==original/);
  assert.match(form, /ScheduleRuntime\.save\(this,draft\)/);
  assert.match(form, /button\("입력으로 돌아가기"\)/);
});

test('PO-UI-03 speech remains opt-in on device and cancels on background', () => {
  const speech = slice('private fun beginSpeech()', 'private fun applySpeech(');
  const teardown = native.slice(native.indexOf('private fun cancelModel()'));
  assert.match(speech, /checkSelfPermission\(Manifest\.permission\.RECORD_AUDIO\)/);
  assert.match(speech, /SpeechRecognizer\.isOnDeviceRecognitionAvailable\(this\)/);
  assert.match(speech, /SpeechRecognizer\.createOnDeviceSpeechRecognizer/);
  assert.match(speech, /showBrandedDialog\(/);
  assert.match(teardown, /override fun onPause\(\) \{ session\.pause\(\); stopSpeech\(\); cancelModel\(\); super\.onPause\(\) \}/);
});

test('PO-UI-03 emulator capture includes voice, compact and dark-mode states', () => {
  assert.match(capture, /05a-voice-editor/);
  assert.match(capture, /15-compact-chooser/);
  assert.match(capture, /16-compact-editor/);
  assert.match(capture, /17-compact-confirmation/);
  assert.match(capture, /assert_dark_surface\("11-quick-entry-dark"/);
});
