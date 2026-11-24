import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { normalizeReminderOffsets, normalizeCompletedAt, toggleReminderOffset, reminderOffsetLabel } from '../src/features/schedules/scheduleReminders.mjs';
import { projectOccurrences, nextSchedule } from '../src/features/schedules/scheduleCodec.ts';
import { createLocalBackup, parseLocalBackup } from '../src/features/storage/localBackupCodec.mjs';
const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const at=Date.parse;
const start=at('2026-12-01T09:00:00+09:00');
const base={id:'fixture',userId:'local',type:'schedule',title:'합성 일정',startAt:start,endAt:null,
  isAllDay:false,repeatType:'daily',notificationEnabled:true,notificationId:null,sourceText:'일정',createdAt:1,updatedAt:2,anchorZone:'Asia/Seoul'};
const settings={timezone:'Asia/Seoul',pushEnabled:true,dailyBriefingEnabled:false,dailyBriefingTime:{hour:8,minute:0},
  digestTypes:{weather:false,stocks:false,news:false},digestCity:'Seoul',weatherRegion:null,stockTickers:[],newsLanguage:'ko',
  newsKeywords:[],newsCategories:[],themeMode:'system',fontFamily:'pretendard'};
const checksum=async value=>createHash('sha256').update(value,'utf8').digest('hex');

test('multi-alert choices are bounded and keep at least one stored choice',()=>{
  assert.deepEqual(normalizeReminderOffsets(undefined),[0]);
  assert.deepEqual(normalizeReminderOffsets([1440,30,0,10]),[0,10,30,1440]);
  for(const bad of [[],[0,0],[7],[-1],[0,5,10,15,30],null,['0'],[NaN]]) assert.throws(()=>normalizeReminderOffsets(bad),/알림 시점/);
  assert.deepEqual(toggleReminderOffset([0],0),[0]);
  assert.deepEqual(toggleReminderOffset([0],30),[0,30]);
  assert.deepEqual(toggleReminderOffset([0,5,10,15],30),[0,5,10,15]);
  assert.deepEqual(toggleReminderOffset([0,30],0),[30]);
  assert.equal(reminderOffsetLabel(1440),'1일 전');
  assert.equal(normalizeCompletedAt(undefined),null);
  for(const bad of [-1,NaN,'1',1.5]) assert.throws(()=>normalizeCompletedAt(bad),/완료 시각/);
});

test('completed series stays searchable and keeps history but stops future projections',()=>{
  const done={...base,completedAt:start+86400000+60000,reminderOffsets:[0,30]};
  const from=new Date(start-1), until=new Date(start+5*86400000);
  assert.equal(nextSchedule([done],start-1),null);
  assert.deepEqual(projectOccurrences([done],from,until).map(r=>r.startAt),[start,start+86400000]);
  assert.deepEqual(projectOccurrences([{...done,completedAt:start-1}],from,until).map(r=>r.startAt),[start]);
  const reopened={...done,completedAt:null};
  assert.equal(nextSchedule([reopened],start+1).startAt,start+86400000);
  assert.equal(projectOccurrences([reopened],from,until).length,5);
  assert.equal(done.startAt,start);
});

test('plain and encrypted backup payload retains lead-time and completion; old v1 remains readable',async()=>{
  const legacy=await parseLocalBackup(await createLocalBackup([base],settings,checksum),checksum);
  assert.deepEqual(legacy.schedules,[base]);
  const record={...base,category:'work',reminderOffsets:[0,10,60],completedAt:start-1000};
  const saved=await createLocalBackup([record],settings,checksum);
  assert.deepEqual((await parseLocalBackup(saved,checksum)).schedules,[record]);
  await assert.rejects(createLocalBackup([{...record,reminderOffsets:[0,7]}],settings,checksum),/알림 시점/);
  await assert.rejects(createLocalBackup([{...record,completedAt:-1}],settings,checksum),/완료 시각/);
  await assert.rejects(parseLocalBackup(saved.replace('"completedAt":','"completedAt":-'),checksum));
});

test('native and UI paths keep completed rows from new alarms and make completion explicit',()=>{
  const root='modules/push-office-native/android/src/main/java/expo/modules/pushoffice/';
  const scheduler=read(root+'ReminderScheduler.kt');
  const runtime=read(root+'ScheduleRuntime.kt');
  const receiver=read(root+'ReminderReceiver.kt');
  const detail=read('app/schedule/[id].tsx');
  assert.match(scheduler,/for \(offset in record\.reminderOffsets\)/);
  assert.match(scheduler,/ScheduleReminders\.enabled\(record\)/);
  assert.match(scheduler,/compatibleVersions\(record\)/);
  assert.match(receiver,/ScheduleReminders\.stillUseful\(fired, offset/);
  assert.match(runtime,/fun setCompleted/);
  assert.match(runtime,/current\.copy\(completedAt = if \(completed\) now else null/);
  assert.match(detail,/visible=\{pendingDialog === 'completion'\}/);
  assert.match(detail,/반복 일정 전체 완료/);
  assert.match(detail,/toggleReminderOffset\(old, offset\)/);
  assert.match(detail,/disabled=\{completed \|\| complete\.isPending\}/);
  assert.match(read(root+'ScheduleTime.kt'),/if \(record\.completedAt != null\) return null/);
});
