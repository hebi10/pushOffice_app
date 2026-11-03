import test from 'node:test';
import assert from 'node:assert/strict';
import { toNativeSchedule, hydrateSchedule, projectOccurrences } from '../src/features/schedules/scheduleCodec.ts';
import { importLegacyOnce } from '../src/features/storage/legacyImport.ts';
import { hasFirebaseConfig, chooseStartupMode, configuredResource } from '../src/lib/localMode.ts';

const record = { id:'native-entry', userId:'native', type:'schedule', title:'월말 보고', startAt:new Date(2024,0,31,9).getTime(), endAt:null, isAllDay:false, repeatType:'monthly', notificationEnabled:true, notificationId:null, sourceText:'월말 보고', createdAt:1000, updatedAt:2000 };
test('hydration keeps the public Timestamp API and native owner, serialization round trips', () => {
 const hydrated=hydrateSchedule(record);
 assert.equal(hydrated.startAt.toMillis(),record.startAt);
 assert.equal(hydrated.startAt.toDate().getHours(),9);
 assert.deepEqual(toNativeSchedule(hydrated),record);
 assert.equal(toNativeSchedule({...record,startAt:{seconds:1700000000,nanoseconds:123000000}}).startAt,1700000000123);
});
test('monthly projections retain January 31 anchor after February clamping', () => {
 const all=projectOccurrences([record],new Date(2024,1,1),new Date(2024,3,1));
 assert.deepEqual(all.map(x=>new Date(x.startAt).getDate()),[29,31]);
 assert.equal(record.startAt,new Date(2024,0,31,9).getTime());
});
test('leap yearly recurrence returns to Feb 29, ignores pre-anchor months and preserves duration',()=>{
 const leap={...record,startAt:new Date(2024,1,29,10).getTime(),repeatType:'yearly',endAt:new Date(2024,1,29,11).getTime()};
 const all=projectOccurrences([leap],new Date(2025,0,1),new Date(2029,0,1));
 assert.deepEqual(all.map(x=>new Date(x.startAt).getDate()),[28,28,28,29]);
 assert.ok(all.every(x=>x.endAt-x.startAt===3600000));
 assert.equal(projectOccurrences([record],new Date(2023,0,1),new Date(2023,11,1)).length,0);
});
test('legacy import commits marker only after native import and does not resurrect deleted records',async()=>{
 const markers=new Map();let imports=0;let cancellation=0;
 const deps={readMarker:async k=>markers.get(k),writeMarker:async(k,v)=>markers.set(k,v),readRecords:async()=>[record],importRecords:async rows=>{imports++;assert.equal(rows[0].userId,'native');},cancelLegacy:async()=>{cancellation++;}};
 await importLegacyOnce('local-v1',deps);await importLegacyOnce('local-v1',deps);
 assert.equal(imports,1);assert.equal(cancellation,1);
 await assert.rejects(importLegacyOnce('failed',{...deps,importRecords:async()=>{throw new Error('disk full');}}));
 assert.equal(markers.has('failed'),false);
});
test('fresh install and invalid Firebase configuration always choose local without keys',()=>{
 assert.equal(hasFirebaseConfig({apiKey:'',projectId:'',appId:''}),false);
 assert.equal(chooseStartupMode(null,false),'local');
 assert.equal(chooseStartupMode('firebase',false),'local');
 assert.equal(chooseStartupMode('firebase',true),'firebase');
});

test('importable cloud boundary initializes no service before an explicit configured request',()=>{
 let initializations=0;
 const getMissing=configuredResource({apiKey:'',projectId:'',appId:''},()=>{initializations++;return {};});
 assert.equal(initializations,0);assert.throws(getMissing,/Firebase/);assert.equal(initializations,0);
 const getConfigured=configuredResource({apiKey:'configured',projectId:'legacy',appId:'app'},()=>{initializations++;return {};});
 assert.equal(initializations,0);assert.equal(getConfigured(),getConfigured());assert.equal(initializations,1);
});

test('cleanup failure after import cannot resurrect a deleted schedule on retry', async()=>{
 const markers=new Map();const store=new Map();let imports=0;let fail=true;let cancelled;
 const deps={readMarker:async k=>markers.get(k),writeMarker:async(k,v)=>markers.set(k,v),readRecords:async()=>[{...record,notificationId:'expo-imported'}],importRecords:async rows=>{imports++;for(const row of rows)if(!store.has(row.id))store.set(row.id,row);},cancelLegacy:async ids=>{cancelled=ids;if(fail)throw new Error('cleanup unavailable');}};
 await assert.rejects(importLegacyOnce('cleanup-retry',deps),/cleanup unavailable/);
 store.delete(record.id);fail=false;
 await importLegacyOnce('cleanup-retry',deps);
 assert.equal(imports,1);assert.equal(store.size,0);assert.deepEqual(cancelled,['expo-imported']);
});
test('canonical anchor zone survives hydration and serialization',()=>{
 const canonical={...record,anchorZone:'Asia/Seoul'};
 assert.equal(toNativeSchedule(hydrateSchedule(canonical)).anchorZone,'Asia/Seoul');
});
test('Seoul month-end recurrence stays on February 28 when viewed from New York',()=>{
 const previous=process.env.TZ;process.env.TZ='America/New_York';
 try {
  const zoned={...record,startAt:Date.parse('2026-01-31T00:00:00Z'),anchorZone:'Asia/Seoul'};
  const rows=projectOccurrences([zoned],new Date('2026-02-01T00:00:00-05:00'),new Date('2026-03-01T00:00:00-05:00'));
  assert.deepEqual(rows.map(x=>new Date(x.startAt).toISOString()),['2026-02-28T00:00:00.000Z']);
 } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('zoned recurrence matches native gap shift and earlier overlap offset',()=>{
 const gap={...record,startAt:Date.parse('2026-02-08T07:30:00Z'),anchorZone:'America/New_York'};
 const rows=projectOccurrences([gap],new Date('2026-03-01T00:00:00Z'),new Date('2026-05-01T00:00:00Z'));
 assert.deepEqual(rows.map(x=>new Date(x.startAt).toISOString()),['2026-03-08T07:30:00.000Z','2026-04-08T06:30:00.000Z']);
 const overlap={...record,startAt:Date.parse('2026-10-01T05:30:00Z'),anchorZone:'America/New_York'};
 assert.equal(new Date(projectOccurrences([overlap],new Date('2026-11-01T00:00:00Z'),new Date('2026-12-01T00:00:00Z'))[0].startAt).toISOString(),'2026-11-01T05:30:00.000Z');
});
test('legacy explicit timezone is used as anchor metadata rather than guessing from the viewing device',()=>{
 assert.equal(toNativeSchedule({...record,timezone:'Pacific/Auckland'}).anchorZone,'Pacific/Auckland');
});
