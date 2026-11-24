import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { projectOccurrences, nextOccurrence } from '../src/features/schedules/scheduleCodec.ts';
import { normalizeExcludedStarts } from '../src/features/schedules/scheduleOccurrences.mjs';
import { createLocalBackup,parseLocalBackup } from '../src/features/storage/localBackupCodec.mjs';

const at=Date.parse;
const start=at('2027-01-31T09:00:00+09:00'),feb=at('2027-02-28T09:00:00+09:00'),mar=at('2027-03-31T09:00:00+09:00');
const base={id:'series',userId:'local',type:'schedule',title:'회의',startAt:start,endAt:start+3600000,
  isAllDay:false,repeatType:'monthly',notificationEnabled:true,notificationId:null,sourceText:'',createdAt:1,updatedAt:2,anchorZone:'Asia/Seoul'};
const settings={timezone:'Asia/Seoul',pushEnabled:true,dailyBriefingEnabled:false,dailyBriefingTime:{hour:8,minute:0},digestTypes:{weather:false,stocks:false,news:false},digestCity:'Seoul',weatherRegion:null,stockTickers:[],newsLanguage:'ko',newsKeywords:[],newsCategories:[],themeMode:'system',fontFamily:'pretendard'};
const checksum=async value=>createHash('sha256').update(value,'utf8').digest('hex');

test('monthly exclusions skip the anchor and second slot without changing future recurrence',()=>{
  const series={...base,excludedStarts:[start,feb]};
  const detached={...base,id:'detached',repeatType:'none',startAt:feb+3600000,endAt:feb+7200000};
  const rows=projectOccurrences([series,detached],new Date(start-1),new Date(mar+1));
  assert.deepEqual(rows.map(r=>[r.id,r.startAt]),[['detached',feb+3600000],['series',mar]]);
  assert.equal(nextOccurrence(series,start-86400000).startAt,mar);
  assert.equal(series.startAt,start);
  assert.equal(nextOccurrence(base,start+1).startAt,feb);
});

test('daily/weekly projections skip individual original instants',()=>{
  const series={...base,repeatType:'weekly',excludedStarts:[start+7*86400000]};
  const rows=projectOccurrences([series],new Date(start-1),new Date(start+22*86400000));
  assert.deepEqual(rows.map(r=>r.startAt),[start,start+14*86400000,start+21*86400000]);
  assert.equal(nextOccurrence(series,start+1).startAt,start+14*86400000);
});

test('backup retains exclusions, including old v1 payload compatibility',async()=>{
  const old=await parseLocalBackup(await createLocalBackup([base],settings,checksum),checksum);
  assert.deepEqual(old.schedules,[base]);
  const series={...base,excludedStarts:[start,feb]};
  const output=await createLocalBackup([series],settings,checksum);
  assert.deepEqual((await parseLocalBackup(output,checksum)).schedules,[series]);
  for(const bad of [[start,start],[-1],[1.1],null]) assert.throws(()=>normalizeExcludedStarts(bad));
  await assert.rejects(createLocalBackup([{...series,repeatType:'none'}],settings,checksum),/제외 회차/);
});
