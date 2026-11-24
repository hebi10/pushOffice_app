import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SCHEDULE_CATEGORIES, normalizeScheduleCategory, scheduleCategoryLabel } from '../src/features/schedules/scheduleCategories.mjs';
import { buildScheduleSearchIndex, filterScheduleIndex } from '../src/features/schedules/scheduleSearch.ts';
import { createLocalBackup, parseLocalBackup } from '../src/features/storage/localBackupCodec.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const time = n => ({toMillis:()=>n});
const records = [
  {id:'old',title:'이전 일정',startAt:time(1),repeatType:'yearly'},
  {id:'work',title:'ＡＢＣ 미팅',location:'3층 회의실',notes:'발표 준비',category:'work',startAt:time(4),repeatType:'weekly'},
  {id:'health',title:'진료 예약',location:'병원',notes:'진료',category:'health',startAt:time(3),repeatType:'none'},
  {id:'other',title:'자료 정리',notes:'발표 준비',category:'study',startAt:time(2),sourceText:'hidden raw',meetingUrl:'https://private.example'},
];
test('local search includes title, location, notes, category; Korean and normalized case-insensitive tokens',()=>{
  const index = buildScheduleSearchIndex(records);
  const ids = (q,category='all') => filterScheduleIndex(index,q,category).map(r=>r.id);
  assert.deepEqual(ids('abc   회의실'),['work']);
  assert.deepEqual(ids('발표 준비'),['work','other']);
  assert.deepEqual(ids('건강'),['health']);
  assert.deepEqual(ids('발표','study'),['other']);
  assert.deepEqual(ids('','work'),['work']);
  assert.deepEqual(ids('',null),['old']);
  assert.deepEqual(ids(''),['work','health','other','old']);
  assert.deepEqual(ids('hidden raw'),[]);
  assert.deepEqual(ids('private.example'),[]);
  assert.deepEqual(ids('absent'),[]);
  assert.equal(index.find(row=>row.record.id==='work').record,records[1]);
  assert.deepEqual(records.map(r=>r.id),['old','work','health','other']);
});

test('category IDs validated and aligned with native options; no silent reassignment of legacy records',()=>{
  assert.deepEqual(SCHEDULE_CATEGORIES.map(x=>x.id),[null,'work','personal','family','health','study','other']);
  assert.equal(normalizeScheduleCategory(undefined),null);
  assert.equal(scheduleCategoryLabel(undefined),'미분류');
  const kt = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleCategory.kt');
  for (const c of SCHEDULE_CATEGORIES) {
    assert.equal(normalizeScheduleCategory(c.id),c.id);
    assert.ok(kt.includes((c.id === null ? 'null' : '"'+c.id+'"') + ' to "'+c.label+'"'));
  }
  for (const bad of ['', 'private', 'work ',{},5]) assert.throws(()=>normalizeScheduleCategory(bad),/카테고리/);
});

const checksum=async value=>createHash('sha256').update(value,'utf8').digest('hex');
const settings={timezone:'Asia/Seoul',pushEnabled:true,dailyBriefingEnabled:false,dailyBriefingTime:{hour:8,minute:0},
  digestTypes:{weather:false,stocks:false,news:false},digestCity:'Seoul',weatherRegion:null,stockTickers:[],newsLanguage:'ko',
  newsKeywords:[],newsCategories:[],themeMode:'system',fontFamily:'pretendard'};
const fixture={id:'fixture',userId:'local',type:'schedule',title:'회의',startAt:1820000000000,endAt:null,
  isAllDay:false,repeatType:'monthly',notificationEnabled:true,notificationId:null,sourceText:'회의',createdAt:1,updatedAt:2,anchorZone:'Asia/Seoul'};

test('backups preserve optional category and legacy v1 checksums',async()=>{
  const old=await parseLocalBackup(await createLocalBackup([fixture],settings,checksum),checksum);
  assert.deepEqual(old.schedules,[fixture]);
  assert.equal(Object.hasOwn(old.schedules[0],'category'),false);
  for(const category of [null,'work','health','study']) {
    const record={...fixture,category};
    const saved=await createLocalBackup([record],settings,checksum);
    assert.deepEqual((await parseLocalBackup(saved,checksum)).schedules,[record]);
  }
  await assert.rejects(createLocalBackup([{...fixture,category:'unsupported'}],settings,checksum),/카테고리/);
  const damaged=await createLocalBackup([{...fixture,category:'work'}],settings,checksum);
  await assert.rejects(parseLocalBackup(damaged.replace('"work"','"family"'),checksum),/손상/);
});

test('UI and native persistence preserve explicit categories and use unexpanded local records',()=>{
  const search=read('app/schedule-search.tsx');
  const calendar=read('app/(tabs)/calendar.tsx');
  const detail=read('app/schedule/[id].tsx');
  const native=read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
  const store=read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleStore.kt');
  assert.match(search, /<FlatList/);
  assert.match(search, /useSchedules\(\)/);
  assert.match(search, /filterScheduleIndex\(index, deferredQuery, category\)/);
  assert.match(search, /includeAll/);
  assert.match(search, /검색 조건에 맞는 일정이 없습니다/);
  assert.match(search, /variant="search"/);
  assert.doesNotMatch(search, /projectOccurrences|\bfetch\s*\(|\baxios\b|\baiParse\b/);
  assert.match(calendar, /router\.push\('\/schedule-search'\)/);
  assert.match(detail, /category: normalizeScheduleCategory\(category\)/);
  assert.match(native, /categorySpinner\.selectedItemPosition/);
  assert.match(native, /category=category/);
  assert.match(store, /"push_office_local\.db", null, 4/);
  assert.match(store, /ALTER TABLE schedules ADD COLUMN category TEXT/);
  assert.doesNotMatch(store, /DROP TABLE schedules/);
});
