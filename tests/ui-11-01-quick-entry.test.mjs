import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');
const screenshots = read('.github/workflows/ui-screenshots.yml');

const section = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, 'Missing section: ' + from);
  return source.slice(start, end);
};

test('UI-11-01 keeps confirmation footer outside keyboard-resized scroll container', () => {
  const page = section('private fun page(', 'private fun chooser()');
  const button = section('private fun button(', 'private fun pairedButtons(');
  assert.match(page, /SOFT_INPUT_ADJUST_RESIZE/);
  assert.match(page, /confirmationPage/);
  assert.match(page, /frame\.addView\(scroll/);
  assert.match(page, /confirmationFooter=LinearLayout/);
  assert.match(page, /if\(confirmationPage\) LinearLayout\.LayoutParams\(-1,0,1f\)/);
  assert.match(page, /if\(confirmationPage\) WindowManager\.LayoutParams\.MATCH_PARENT/);
  assert.match(button, /label=="입력으로 돌아가기"/);
  assert.match(button, /label=="일정 저장"/);
  assert.match(button, /label=="변경 내용 저장"/);
});

test('UI-11-01 shows localized date and picker first, with ISO fields as optional advanced input', () => {
  const form = section('private fun form(', 'private fun field(');
  assert.match(form, /yyyy년 M월 d일 \(E\) · HH:mm/);
  assert.match(form, /저장 기준 시간대/);
  assert.match(form, /manualFields=LinearLayout/);
  assert.match(form, /manualFields\.addView\(manualDateCard\)/);
  assert.match(form, /manualFields\.addView\(manualTimeCard\)/);
  assert.match(form, /날짜·시간 직접 입력/);
  assert.match(form, /pickerButton\("날짜 선택"\)/);
  assert.match(form, /pickerButton\("시간 선택"\)/);
  assert.ok(form.indexOf('root.addView(pickerRow)') < form.indexOf('root.addView(manualFields)'));
});

test('UI-11-01 preserves serial persistence, original recurrence anchor and explicit save', () => {
  const form = section('private fun form(', 'private fun field(');
  for (const part of [
    'ScheduleSerial.withLock', 'ScheduleRuntime.save(this,draft)',
    'ScheduleTime.validate(draft,now)', 'anchorZone=formZone.id',
    'original?.copy(', 'repeats[spinner.selectedItemPosition]',
    'if(saving) return@button', 'saving=true', 'saving=false',
    'error.visibility=View.VISIBLE',
  ]) assert.ok(form.includes(part), 'Missing persistence or validation guard: ' + part);
  assert.ok(form.indexOf('var saving=false') < form.indexOf('ScheduleRuntime.save(this,draft)'));
});

test('UI-11-01 captures normal, compact keyboard and large-font confirmation with Seoul timezone', () => {
  for (const file of [
    '07b-native-confirmation-actions.png',
    '17b-compact-confirmation-actions.png',
    '17c-compact-confirmation-keyboard.png',
    '20f-large-font-confirmation.png',
  ]) assert.ok(verify.includes(file), 'Missing required screenshot: ' + file);
  assert.match(capture, /날짜·시간 직접 입력/);
  assert.match(capture, /EMULATOR_TIMEZONE/);
  assert.match(capture, /EMULATOR_UTC_OFFSET/);
  assert.match(verify, /Android capture timezone must be Asia\/Seoul/);
  assert.match(screenshots, /-timezone Asia\/Seoul/);
});
