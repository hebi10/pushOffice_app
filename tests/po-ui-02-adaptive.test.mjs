import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { adaptiveLayout } from '../src/lib/adaptiveLayout.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('layout responds to window and font scale, not model or fixed portrait size',()=>{
  assert.equal(adaptiveLayout(320,1).narrow,true);
  assert.equal(adaptiveLayout(390,1).twoPane,false);
  assert.equal(adaptiveLayout(700,1).twoPane,false);
  assert.equal(adaptiveLayout(823,1).twoPane,true);
  assert.equal(adaptiveLayout(1200,1).contentMaxWidth,1120);
  assert.equal(adaptiveLayout(823,1.3).twoPane,false);
  assert.equal(adaptiveLayout(390,1.5).showIntroArtwork,false);
  assert.equal(adaptiveLayout(390,1.5).stackDialogActions,true);
  assert.ok(adaptiveLayout(390,1.5).tabHeight>adaptiveLayout(390,1).tabHeight);
  assert.equal(adaptiveLayout(NaN,NaN).twoPane,false);
});
test('adaptive calendar panels and native editor retain existing route and save boundaries',()=>{
  const calendar=read('app/(tabs)/calendar.tsx');
  const home=read('app/(tabs)/index.tsx');
  const native=read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
  const manifest=read('modules/push-office-native/android/src/main/AndroidManifest.xml');
  assert.match(calendar,/layout\.twoPane && styles\.calendarPanelsWide/);
  assert.match(calendar,/panelsTop\.current \+ agendaTop\.current/);
  assert.match(calendar,/openQuickEntryForDate\(selected\)/);
  assert.match(home,/layout\.twoPane && styles\.homePanelsWide/);
  assert.match(native,/override fun onConfigurationChanged/);
  assert.match(native,/root\.requestLayout\(\)/);
  assert.match(native,/IME_FLAG_NO_EXTRACT_UI/);
  assert.match(manifest,/QuickEntryActivity" android:exported="false" android:configChanges="orientation\|screenSize\|smallestScreenSize\|screenLayout\|keyboardHidden"/);
  assert.equal(JSON.parse(read('app.json')).expo.orientation,'default');
  for(const name of ['24a-wide-calendar-week','24b-resize-wide-draft','24c-resize-narrow-draft']){
    assert.ok(read('tools/ui/capture_android.py').includes('screenshot("'+name+'"'));
    assert.ok(read('tools/ui/verify_captures.py').includes('"'+name+'.png"'));
  }
});
