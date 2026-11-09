import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const prefix = 'modules/push-office-native/android/src/main/';
const native = read(prefix + 'java/expo/modules/pushoffice/QuickEntryActivity.kt');
const tile = read(prefix + 'java/expo/modules/pushoffice/ScheduleTileService.kt');
const tileIcon = read(prefix + 'res/drawable/ic_schedule_tile.xml');
const widgetViews = read(prefix + 'java/expo/modules/pushoffice/ScheduleWidgetViews.kt');
const palettes = read('src/lib/theme.ts');

function palette(name) {
  const start = palettes.indexOf('export const ' + name + ': AppColors = {');
  const end = palettes.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start, 'Missing ' + name);
  return Object.fromEntries(
    [...palettes.slice(start, end).matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)]
      .map(([, key, value]) => [key, value]),
  );
}
function luminance(hex) {
  const linear = [1, 3, 5].map(i => {
    const x = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(a, b) {
  const l = luminance(a), r = luminance(b);
  return (Math.max(l, r) + .05) / (Math.min(l, r) + .05);
}
const nativeRoles = {
  primary: 'po_native_primary',
  onPrimary: 'po_native_on_primary',
  surface: 'po_native_surface',
  text: 'po_native_text',
  textSecondary: 'po_native_secondary',
  inputBackground: 'po_native_field',
  inputBorder: 'po_native_input_border',
  danger: 'po_native_danger',
};

test('10-E day/night Android resources and native action colors match React Native semantic roles', () => {
  for (const [folder, mode] of [['values', 'lightColors'], ['values-night', 'darkColors']]) {
    const p = palette(mode);
    const xml = read(prefix + 'res/' + folder + '/colors.xml');
    for (const [role, name] of Object.entries(nativeRoles)) {
      assert.ok(xml.includes('<color name="' + name + '">' + p[role] + '</color>'), folder + ' ' + role);
    }
    assert.ok(xml.includes('<color name="po_widget_secondary">' + p.textSecondary + '</color>'));
    for (const [background, foreground, required] of [
      ['primary', 'onPrimary', 4.5],
      ['surface', 'textSecondary', 4.5],
      ['inputBackground', 'textSecondary', 4.5],
      ['inputBorder', 'inputBackground', 3],
    ]) assert.ok(contrast(p[background], p[foreground]) >= required,
      mode + ' ' + background + '/' + foreground);
  }
  const exactColors = [
    'private val actionColor: Int get() = if(isDark) Color.rgb(231,233,236) else Color.rgb(35,38,43)',
    'private val onPrimary: Int get() = if(isDark) Color.rgb(17,19,21) else Color.WHITE',
    'private val surface: Int get() = if(isDark) Color.rgb(28,31,34) else Color.WHITE',
    'private val foregroundColor: Int get() = if(isDark) Color.rgb(245,246,247) else Color.rgb(28,30,33)',
    'private val secondary: Int get() = if(isDark) Color.rgb(177,182,189) else Color.rgb(93,98,105)',
    'private val fieldBackground: Int get() = if(isDark) Color.rgb(41,45,49) else Color.rgb(236,238,241)',
    'private val inputBorder: Int get() = if(isDark) Color.rgb(119,127,136) else Color.rgb(129,136,145)',
    'private val dangerColor: Int get() = if(isDark) Color.rgb(255,120,120) else Color.rgb(180,35,24)',
  ];
  for (const role of exactColors) assert.ok(native.includes(role), role);
});

test('10-E preserves native explicit themes, actions, errors and opt-in microphone behavior', () => {
  assert.doesNotMatch(native, /\bblue\b|Color\.rgb\(96,165,250\)|Color\.rgb\(37,99,235\)/);
  assert.match(native, /setColorFilter\(actionColor\)/);
  assert.match(native, /setTextColor\(dangerColor\)/);
  assert.match(native, /"dark" -> setTheme\(R\.style\.PushOfficeDialogDark\)/);
  assert.match(native, /"light" -> setTheme\(R\.style\.PushOfficeDialogLight\)/);
  assert.match(native, /optionalTools.visibility=if\(optionalTools.visibility==View.VISIBLE\)/);
  assert.match(native, /minHeight=dp\(50\)/);
  assert.match(native, /minimumHeight=dp\(48\)/);
  assert.match(native, /button\("내용 확인"\)/);
  assert.match(native, /ScheduleRuntime\.save\(this,draft\)/);
  assert.match(native, /NotificationSuggestionStore\.dismiss\(this, suggestionId\)/);
  assert.doesNotMatch(native, /if\(voice\) beginSpeech\(/);
  const explicit = read(prefix + 'res/values/explicit-dialog-themes.xml');
  for (const [style, color, text] of [
    ['PushOfficeDialogLight', '#23262B', '#1C1E21'],
    ['PushOfficeDialogDark', '#E7E9EC', '#F5F6F7'],
  ]) {
    const body = explicit.split('<style name="' + style + '"')[1]?.split('</style>')[0];
    assert.ok(body);
    assert.ok(body.includes('<item name="android:colorAccent">' + color + '</item>'));
    assert.ok(body.includes('<item name="android:textColorPrimary">' + text + '</item>'));
  }
});

test('10-E widget layouts keep 48dp text/voice actions and fixed click/intent contracts', () => {
  const bg = read(prefix + 'res/drawable/widget_background.xml');
  const primary = read(prefix + 'res/drawable/widget_primary_action_background.xml');
  const secondary = read(prefix + 'res/drawable/widget_action_background.xml');
  assert.match(bg, /android:radius="10dp"/);
  assert.match(primary, /android:radius="8dp"/);
  assert.match(secondary, /android:radius="8dp"/);
  for (const kind of ['widget_small', 'widget_agenda']) {
    const layout = read(prefix + 'res/layout/' + kind + '.xml');
    assert.match(layout, /android:layout_height="48dp"/);
    assert.match(layout, /@color\/po_widget_secondary/);
    assert.match(layout, /@drawable\/widget_primary_action_background/);
    assert.match(layout, /@drawable\/widget_action_background/);
    assert.match(layout, /android:contentDescription="텍스트로 일정 입력"/);
    assert.match(layout, /android:contentDescription="음성 입력 선택 화면 열기"/);
  }
  for (const token of [
    'setOnClickPendingIntent(R.id.widget_text',
    'setOnClickPendingIntent(R.id.widget_voice',
    'eventIntent(context, event.id)',
    'entryIntent(context, "chooser")',
    'Uri.parse("pushofficeapp://schedule/',
  ]) assert.ok(widgetViews.includes(token), token);
});

test('10-E tile vector is a monochrome outline while OS tile routing and lock behavior remain intact', () => {
  assert.match(tileIcon, /android:strokeColor="#FFFFFFFF"/);
  assert.match(tileIcon, /android:fillColor="@android:color\/transparent"/);
  assert.match(tileIcon, /android:strokeWidth="1\.8"/);
  assert.doesNotMatch(tileIcon, /#2563EB|#60A5FA/);
  for (const marker of [
    'Tile.STATE_ACTIVE',
    'contentDescription=getString(R.string.tile_content_description)',
    'PendingIntent.getActivity',
    'if(isLocked) unlockAndRun(open) else open.run()',
  ]) assert.ok(tile.includes(marker), marker);
});
