import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('stage 3 groups optional voice and device AI actions without auto-recording', () => {
  assert.match(native, /optionalToolsStart=root\.childCount/);
  assert.match(native, /optionalTools\.visibility=if\(voice\) View\.VISIBLE else View\.GONE/);
  assert.match(native, /음성·AI 도구 펼치기/);
  assert.match(native, /session\.startModel/);
  assert.doesNotMatch(native, /if\(voice\) beginSpeech\(/);
});

test('stage 3 shows Korean date summary while ISO fields and timezone-safe save remain unchanged', () => {
  assert.match(native, /DateTimeFormatter\.ofPattern\("yyyy년 M월 d일 \(E\) · HH:mm",Locale\.KOREAN\)/);
  assert.match(native, /dateField\.addTextChangedListener\(summaryWatcher\)/);
  assert.match(native, /timeField\.addTextChangedListener\(summaryWatcher\)/);
  assert.match(native, /LocalDate\.parse\(dateField\.text/);
  assert.match(native, /ScheduleSerial\.withLock/);
  assert.match(native, /ScheduleRuntime\.save\(this,draft\)/);
});

test('stage 3 reserves independent confirmation footer and requires real error/filled captures', () => {
  assert.match(native, /private var confirmationFooter: LinearLayout\?=null/);
  assert.match(native, /val target=if\(label=="일정 저장" \|\| label=="변경 내용 저장" \|\| label=="입력으로 돌아가기"\)/);
  assert.match(native, /dp\(if\(confirmationPage\) 240 else 160\)/);
  for (const name of ['07c-native-confirmation-populated', '07d-native-confirmation-invalid']) {
    assert.ok(capture.includes(name), name + ' not captured');
    assert.ok(verify.includes(name + '.png'), name + ' not required');
  }
});

test('stage 5 clears stale native form errors after editing existing fields', () => {
  assert.match(native, /val clearErrorOnEdit=object: TextWatcher/);
  assert.match(native, /error\.text=""/);
  for (const field of ['titleField','dateField','timeField']) {
    assert.ok(native.includes(field + '.addTextChangedListener(clearErrorOnEdit)'));
  }
});
