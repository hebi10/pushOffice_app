import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const native = read('modules/push-office-native/android/src/androidTest/java/expo/modules/pushoffice/QuickEntryActivityUiTest.kt');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

function section(from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, 'Missing source section: ' + from);
  return source.slice(start, end);
}

test('UI-12-04 makes all 3 native steps understandable without changing the chooser design', () => {
  const chooser = section('private fun chooser()', 'private fun stepHint(');
  const steps = section('private fun stepHint(', 'private fun sectionLabel(');
  const editor = section('private fun editor(', 'private fun preview(');
  const confirm = section('private fun form(', 'private fun field(');
  assert.match(chooser, /stepHint\(1,"입력 방식 선택"\)/);
  assert.match(editor, /stepHint\(2,"일정 내용 작성"\)/);
  assert.match(confirm, /stepHint\(3,"저장 전 확인"\)/);
  assert.match(steps, /contentDescription="전체 3단계 중 \$\{step\}단계 · \$name"/);
  assert.match(chooser, /dp\(140\),dp\(106\)/);
  assert.match(chooser, /window\.setGravity\(Gravity\.BOTTOM\)/);
  assert.match(chooser, /quick_entry_text_accessibility/);
  assert.match(chooser, /quick_entry_voice_accessibility/);
});

test('UI-12-04 preserves a fixed footer and keyboard-safe primary action on step 2 and 3', () => {
  const page = section('private fun page(', 'private fun chooser()');
  const editor = section('private fun editor(', 'private fun preview(');
  const buttons = section('private fun button(', 'private fun pairedButtons(');
  assert.match(page, /title=="일정 입력"/);
  assert.match(page, /SOFT_INPUT_ADJUST_RESIZE/);
  assert.match(page, /frame\.addView\(scroll,if\(confirmationPage\) LinearLayout\.LayoutParams\(-1,0,1f\)/);
  assert.match(page, /confirmationFooter=LinearLayout/);
  assert.match(page, /if\(confirmationPage\) WindowManager\.LayoutParams\.MATCH_PARENT/);
  assert.match(buttons, /label=="뒤로" \|\| label=="내용 확인"/);
  assert.match(editor, /button\("뒤로"\)/);
  assert.match(editor, /button\("내용 확인"\)/);
  assert.ok(editor.indexOf('button("뒤로")') < editor.indexOf('button("내용 확인")'));
  assert.match(editor, /sectionLabel\("직접 지정"/);
  assert.match(editor, /button\("직접 날짜와 시간 지정"\)/);
  assert.match(native, /editorHasFixedActionsAndStepFeedback/);
});

test('UI-12-04 marks invalid dates and keeps the original explicit save and error recovery', () => {
  const confirm = section('private fun form(', 'private fun field(');
  assert.match(confirm, /setTextColor\(if\(original==null && dateTime==null\) dangerColor else foregroundColor\)/);
  assert.match(confirm, /accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE/);
  for (const expected of [
    '저장 기준 시간대:',
    'manualFields.visibility',
    'button("입력으로 돌아가기")',
    'if(saving) return@button',
    'ScheduleSerial.withLock',
    'ScheduleRuntime.save(this,draft)',
    'error.visibility=View.VISIBLE',
    'saving=false',
  ]) {
    assert.ok(confirm.includes(expected), 'The protected save flow changed: ' + expected);
  }
});

test('UI-12-04 leaves recording, on-device AI and the existing Android capture suite unchanged', () => {
  const editor = section('private fun editor(', 'private fun preview(');
  assert.match(editor, /sectionLabel\("음성 입력"/);
  assert.match(editor, /sectionLabel\("기기 AI"/);
  assert.match(editor, /optionalTools.visibility=if\(voice\) View.VISIBLE else View.GONE/);
  assert.match(editor, /if\(voice\) status.text="음성 입력 시작을 누르면 기기 내 한국어 인식을 확인합니다."/);
  assert.match(source, /if\(checkSelfPermission\(Manifest.permission.RECORD_AUDIO\)!=PackageManager.PERMISSION_GRANTED\)/);
  assert.match(source, /SpeechRecognizer\.createOnDeviceSpeechRecognizer\(this\)/);
  for (const filename of [
    '05-quick-entry.png',
    '06-native-editor.png',
    '07b-native-confirmation-actions.png',
    '17b-compact-confirmation-actions.png',
    '17c-compact-confirmation-keyboard.png',
    '20f-large-font-confirmation.png',
  ]) {
    assert.ok(verify.includes(filename), 'Expected existing screenshot: ' + filename);
  }
  assert.ok(capture.includes('screenshot("05-quick-entry"'));
  assert.ok(capture.includes('screenshot("06-native-editor"'));
  assert.ok(capture.includes('screenshot("07b-native-confirmation-actions"'));
  assert.doesNotMatch(source, /"weekly"|"daily"|"location"|"meetingUrl"/);
});
